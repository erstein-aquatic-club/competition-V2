# Profile Photo Upload Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow users to upload a profile photo compressed client-side (max 200KB, 400x400 WebP) stored in Supabase Storage, replacing the current manual URL field.

**Architecture:** Client-side canvas compression converts any image to WebP ≤200KB at 400x400px. Compressed blob is uploaded to Supabase Storage bucket `avatars` at path `{user_id}.webp`. The resulting public URL replaces `avatar_url` in `user_profiles`. Existing fallback (DiceBear initials) remains when no photo is set.

**Tech Stack:** React 19, Supabase Storage, Canvas API, TypeScript

---

### Task 1: Create Supabase Storage bucket migration

**Files:**
- Create: `supabase/migrations/00028_avatars_storage.sql`

**Step 1: Write migration SQL**

```sql
-- Create storage bucket for avatar uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Public read access for avatars
CREATE POLICY "avatars_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- Authenticated users can upload their own avatar
CREATE POLICY "avatars_auth_insert"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars'
  AND auth.role() = 'authenticated'
);

-- Authenticated users can update their own avatar
CREATE POLICY "avatars_auth_update"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'avatars'
  AND auth.role() = 'authenticated'
);

-- Authenticated users can delete their own avatar
CREATE POLICY "avatars_auth_delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'avatars'
  AND auth.role() = 'authenticated'
);
```

**Step 2: Apply migration to Supabase**

Use the Supabase MCP tool `apply_migration` with:
- name: `avatars_storage`
- query: the SQL above
- project_id: (get from `list_projects`)

**Step 3: Commit**

```bash
git add supabase/migrations/00028_avatars_storage.sql
git commit -m "feat: add avatars storage bucket migration"
```

---

### Task 2: Create image compression utility

**Files:**
- Create: `src/lib/imageUtils.ts`

**Step 1: Write the utility**

```typescript
/**
 * Client-side image compression using Canvas API.
 * Resizes to max 400x400, converts to WebP (fallback JPEG), targets ≤200KB.
 */

const MAX_DIMENSION = 400;
const MAX_SIZE_BYTES = 200 * 1024; // 200 KB
const INITIAL_QUALITY = 0.85;
const MIN_QUALITY = 0.4;
const QUALITY_STEP = 0.1;

const ACCEPTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];

export function isAcceptedImageType(file: File): boolean {
  return ACCEPTED_TYPES.includes(file.type) || /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name);
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Impossible de charger l'image"));
    img.src = URL.createObjectURL(file);
  });
}

function resizeToCanvas(img: HTMLImageElement): HTMLCanvasElement {
  let { width, height } = img;
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, width, height);
  return canvas;
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Compression échouée"))),
      type,
      quality,
    );
  });
}

const supportsWebP = (() => {
  const c = document.createElement("canvas");
  c.width = 1;
  c.height = 1;
  return c.toDataURL("image/webp").startsWith("data:image/webp");
})();

export async function compressImage(file: File): Promise<{
  blob: Blob;
  mimeType: string;
  extension: string;
}> {
  const img = await loadImage(file);
  const canvas = resizeToCanvas(img);
  URL.revokeObjectURL(img.src);

  const mimeType = supportsWebP ? "image/webp" : "image/jpeg";
  const extension = supportsWebP ? "webp" : "jpg";

  let quality = INITIAL_QUALITY;
  let blob = await canvasToBlob(canvas, mimeType, quality);

  while (blob.size > MAX_SIZE_BYTES && quality > MIN_QUALITY) {
    quality -= QUALITY_STEP;
    blob = await canvasToBlob(canvas, mimeType, quality);
  }

  return { blob, mimeType, extension };
}
```

**Step 2: Commit**

```bash
git add src/lib/imageUtils.ts
git commit -m "feat: add client-side image compression utility"
```

---

### Task 3: Add uploadAvatar and deleteAvatar to API layer

**Files:**
- Modify: `src/lib/api/users.ts` — add `uploadAvatar()` and `deleteAvatar()` functions
- Modify: `src/lib/api/index.ts` — re-export new functions
- Modify: `src/lib/api.ts` — add delegation stubs

**Step 1: Add functions to `src/lib/api/users.ts`**

Add at the end of the file:

```typescript
export async function uploadAvatar(payload: {
  userId: number;
  blob: Blob;
  mimeType: string;
  extension: string;
}): Promise<string> {
  if (!canUseSupabase()) throw new Error("Supabase non disponible");

  const filePath = `${payload.userId}.${payload.extension}`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(filePath, payload.blob, {
      contentType: payload.mimeType,
      upsert: true,
    });
  if (uploadError) throw new Error(uploadError.message);

  const { data: urlData } = supabase.storage
    .from("avatars")
    .getPublicUrl(filePath);

  // Append cache-bust param so browsers see the new image
  const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

  // Update user_profiles with the new avatar URL
  const { error: profileError } = await supabase
    .from("user_profiles")
    .update({ avatar_url: publicUrl })
    .eq("user_id", payload.userId);
  if (profileError) throw new Error(profileError.message);

  return publicUrl;
}

export async function deleteAvatar(userId: number): Promise<void> {
  if (!canUseSupabase()) return;

  // Try both extensions
  const { error } = await supabase.storage
    .from("avatars")
    .remove([`${userId}.webp`, `${userId}.jpg`]);
  if (error) throw new Error(error.message);

  // Clear avatar_url in profile
  const { error: profileError } = await supabase
    .from("user_profiles")
    .update({ avatar_url: null })
    .eq("user_id", userId);
  if (profileError) throw new Error(profileError.message);
}
```

**Step 2: Add re-exports in `src/lib/api/index.ts`**

In the users re-export block, add `uploadAvatar` and `deleteAvatar`:

```typescript
export {
  getProfile,
  updateProfile,
  // ... existing exports ...
  authPasswordUpdate,
  uploadAvatar,
  deleteAvatar,
} from './users';
```

**Step 3: Add delegation stubs in `src/lib/api.ts`**

Import the new functions at the top (in the users import block):

```typescript
import {
  // ... existing imports ...
  uploadAvatar as _uploadAvatar,
  deleteAvatar as _deleteAvatar,
} from "./api/users";
```

Add stubs in the Users delegation section:

```typescript
async uploadAvatar(payload: Parameters<typeof _uploadAvatar>[0]) { return _uploadAvatar(payload); },
async deleteAvatar(userId: number) { return _deleteAvatar(userId); },
```

**Step 4: Commit**

```bash
git add src/lib/api/users.ts src/lib/api/index.ts src/lib/api.ts
git commit -m "feat: add uploadAvatar and deleteAvatar API functions"
```

---

### Task 4: Update Profile.tsx — replace URL field with photo upload

**Files:**
- Modify: `src/pages/Profile.tsx`

**Step 1: Update imports**

Add at the top:

```typescript
import { Camera, Trash2 } from "lucide-react";
import { compressImage, isAcceptedImageType } from "@/lib/imageUtils";
```

**Step 2: Remove `avatar_url` from the edit form schema**

In `profileEditSchema`, remove the `avatar_url` line:

```typescript
// REMOVE this line:
// avatar_url: z.string().url("URL invalide").optional().or(z.literal("")),
```

Update `ProfileEditForm` type and default values accordingly (remove `avatar_url: ""`).

**Step 3: Remove `avatar_url` from `startEdit`, `handleSaveProfile`, and `updateProfile.mutationFn`**

In `startEdit`:
- Remove: `avatar_url: profile?.avatar_url || "",`

In `updateProfile.mutationFn`:
- Remove: `avatar_url: data.avatar_url,`

**Step 4: Add avatar upload mutation**

After the existing `updateProfile` mutation, add:

```typescript
const uploadAvatarMutation = useMutation({
  mutationFn: async (file: File) => {
    if (!userId) throw new Error("Utilisateur non identifié");
    if (!isAcceptedImageType(file)) {
      throw new Error("Format non supporté. Utilisez JPEG, PNG ou WebP.");
    }
    if (file.size > 10 * 1024 * 1024) {
      throw new Error("Fichier trop volumineux (max 10 Mo).");
    }
    const { blob, mimeType, extension } = await compressImage(file);
    return api.uploadAvatar({ userId, blob, mimeType, extension });
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["profile"] });
    toast({ title: "Photo de profil mise à jour" });
  },
  onError: (error: unknown) => {
    toast({
      title: "Impossible de charger la photo",
      description: String((error as Error)?.message || error),
      variant: "destructive",
    });
  },
});

const deleteAvatarMutation = useMutation({
  mutationFn: async () => {
    if (!userId) throw new Error("Utilisateur non identifié");
    return api.deleteAvatar(userId);
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["profile"] });
    toast({ title: "Photo supprimée" });
  },
  onError: (error: unknown) => {
    toast({
      title: "Impossible de supprimer la photo",
      description: String((error as Error)?.message || error),
      variant: "destructive",
    });
  },
});
```

**Step 5: Replace the "Avatar (URL)" field in the edit Sheet form**

Replace the entire `<div className="grid gap-2">` block containing "Avatar (URL)" with:

```tsx
<div className="grid gap-2">
  <Label>Photo de profil</Label>
  <div className="flex items-center gap-3">
    <Avatar className="h-16 w-16 ring-2 ring-primary/20">
      <AvatarImage src={avatarSrc} alt="Avatar" />
      <AvatarFallback>{(user || "?").slice(0, 2).toUpperCase()}</AvatarFallback>
    </Avatar>
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-2"
        disabled={uploadAvatarMutation.isPending}
        onClick={() => document.getElementById("avatar-upload")?.click()}
      >
        <Camera className="h-4 w-4" />
        {uploadAvatarMutation.isPending ? "Envoi..." : "Changer la photo"}
      </Button>
      {profile?.avatar_url && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-2 text-destructive hover:text-destructive"
          disabled={deleteAvatarMutation.isPending}
          onClick={() => deleteAvatarMutation.mutate()}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Supprimer
        </Button>
      )}
    </div>
  </div>
  <input
    id="avatar-upload"
    type="file"
    accept="image/jpeg,image/png,image/webp,.heic,.heif"
    className="hidden"
    onChange={(e) => {
      const file = e.target.files?.[0];
      if (file) uploadAvatarMutation.mutate(file);
      e.target.value = "";
    }}
  />
</div>
```

**Step 6: Verify build**

Run: `npm run build`
Expected: no TypeScript errors

**Step 7: Commit**

```bash
git add src/pages/Profile.tsx
git commit -m "feat: replace avatar URL field with photo upload in Profile"
```

---

### Task 5: Verify and test end-to-end

**Step 1: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: no new errors (pre-existing story errors are acceptable)

**Step 2: Run tests**

Run: `npm test`
Expected: all tests pass (pre-existing failures in TimesheetHelpers are acceptable)

**Step 3: Manual test checklist**

- [ ] Open Profile page, click "Mon profil", see photo upload button
- [ ] Upload a JPEG photo → preview updates, toast "Photo de profil mise à jour"
- [ ] Upload a large PNG (>200KB) → compressed and uploaded successfully
- [ ] Click "Supprimer" → photo removed, falls back to DiceBear
- [ ] Reload page → uploaded photo persists
- [ ] Upload again → replaces old photo

**Step 4: Update documentation**

Add entry in `docs/implementation-log.md` and update `CLAUDE.md` if needed (add `src/lib/imageUtils.ts` to key files table).

**Step 5: Final commit**

```bash
git add docs/implementation-log.md CLAUDE.md
git commit -m "docs: add profile photo upload implementation log"
```
