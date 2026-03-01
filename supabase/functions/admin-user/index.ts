// supabase/functions/admin-user/index.ts
// Edge Function: Admin user management operations
// Requires service_role for auth.admin operations and direct DB writes

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// --- Helpers ---

function jsonResponse(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ error: message }, status);
}

function generatePassword(length = 12): string {
  const chars = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => chars[b % chars.length]).join("");
}

// Actions that each role is allowed to perform
const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: ["create_coach", "update_role", "update_password", "disable_user"],
  coach: ["create_coach", "update_password"],
};

// --- Auth check: verify caller JWT and extract role ---

async function verifyCallerRole(req: Request): Promise<{ role: string; userId: number } | Response> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return errorResponse("Missing or invalid Authorization header", 401);
  }

  const token = authHeader.replace("Bearer ", "");

  // Create a client with the caller's JWT to verify identity
  const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? supabaseServiceKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user }, error } = await callerClient.auth.getUser(token);
  if (error || !user) {
    return errorResponse("Invalid or expired token", 401);
  }

  const appRole = user.app_metadata?.app_user_role as string | undefined;
  const appUserId = user.app_metadata?.app_user_id as number | undefined;

  if (!appRole || !appUserId) {
    return errorResponse("User has no app role assigned", 403);
  }

  return { role: appRole, userId: appUserId };
}

// --- Action handlers ---

async function handleCreateCoach(body: {
  display_name: string;
  email: string;
  password?: string;
}): Promise<Response> {
  const { display_name, email } = body;
  if (!display_name || !email) {
    return errorResponse("Missing required fields: display_name and email");
  }

  const password = body.password || generatePassword();

  // Create the auth user — the trigger handle_new_auth_user will create users + user_profiles rows
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name },
  });

  if (authError) {
    return errorResponse(`Failed to create auth user: ${authError.message}`, 500);
  }

  const authUserId = authData.user.id;

  // Wait briefly for the trigger to fire and create the public.users row
  await new Promise((r) => setTimeout(r, 500));

  // Find the public user by email
  const { data: publicUser, error: findError } = await supabase
    .from("users")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (findError || !publicUser) {
    return errorResponse(
      `Auth user created but public.users row not found. Trigger may have failed. Error: ${findError?.message ?? "not found"}`,
      500,
    );
  }

  // Update role to coach
  const { error: roleError } = await supabase
    .from("users")
    .update({ role: "coach" })
    .eq("id", publicUser.id);

  if (roleError) {
    return errorResponse(`Failed to set coach role: ${roleError.message}`, 500);
  }

  // Sync role to JWT claims
  const { error: syncError } = await supabase.rpc("sync_user_role_to_jwt", {
    p_user_id: publicUser.id,
  });

  if (syncError) {
    console.error("sync_user_role_to_jwt error:", syncError);
    // Non-fatal: role is set in DB, JWT will sync on next login
  }

  return jsonResponse({
    user: {
      id: publicUser.id,
      email,
      display_name,
    },
    initial_password: password,
  });
}

async function handleUpdateRole(body: {
  user_id: number;
  role: string;
}): Promise<Response> {
  const { user_id, role } = body;
  if (!user_id || !role) {
    return errorResponse("Missing required fields: user_id and role");
  }

  const validRoles = ["athlete", "coach", "comite", "admin"];
  if (!validRoles.includes(role)) {
    return errorResponse(`Invalid role. Must be one of: ${validRoles.join(", ")}`);
  }

  const { error: roleError } = await supabase
    .from("users")
    .update({ role })
    .eq("id", user_id);

  if (roleError) {
    return errorResponse(`Failed to update role: ${roleError.message}`, 500);
  }

  // Sync role to JWT claims
  const { error: syncError } = await supabase.rpc("sync_user_role_to_jwt", {
    p_user_id: user_id,
  });

  if (syncError) {
    console.error("sync_user_role_to_jwt error:", syncError);
  }

  return jsonResponse({ status: "updated" });
}

async function handleUpdatePassword(body: {
  user_id: number;
  password: string;
}): Promise<Response> {
  const { user_id, password } = body;
  if (!user_id || !password) {
    return errorResponse("Missing required fields: user_id and password");
  }

  // The users table has no auth_user_id column.
  // The link is: auth.users.raw_app_meta_data->>'app_user_id' = users.id
  // We find the auth user by matching email instead (more reliable via supabase client)
  const { data: publicUser, error: findError } = await supabase
    .from("users")
    .select("id, email")
    .eq("id", user_id)
    .maybeSingle();

  if (findError || !publicUser || !publicUser.email) {
    return errorResponse(`User not found or has no email: ${findError?.message ?? "not found"}`, 404);
  }

  // Find auth user by email using admin API
  const { data: { users: authUsers }, error: listError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1,
  });

  // Use a more targeted approach: list all and filter, or use the admin getUserByEmail workaround
  // Since supabase-js doesn't have getUserByEmail, we search via the admin API
  let authUserId: string | null = null;

  // Query auth.users directly via service role
  const { data: authRow, error: authFindError } = await supabase
    .rpc("get_auth_user_id_by_email", { p_email: publicUser.email })
    .maybeSingle();

  if (authRow) {
    authUserId = authRow as unknown as string;
  }

  // Fallback: search through listed users if RPC doesn't exist
  if (!authUserId) {
    const { data: listData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const found = listData?.users?.find((u) => u.email === publicUser.email);
    if (found) authUserId = found.id;
  }

  if (!authUserId) {
    return errorResponse("Could not find auth user for this account", 404);
  }

  const { error: updateError } = await supabase.auth.admin.updateUserById(authUserId, {
    password,
  });

  if (updateError) {
    return errorResponse(`Failed to update password: ${updateError.message}`, 500);
  }

  return jsonResponse({ status: "updated" });
}

async function handleDisableUser(body: {
  user_id: number;
}): Promise<Response> {
  const { user_id } = body;
  if (!user_id) {
    return errorResponse("Missing required field: user_id");
  }

  // Disable in public.users
  const { error: disableError } = await supabase
    .from("users")
    .update({ is_active: false })
    .eq("id", user_id);

  if (disableError) {
    return errorResponse(`Failed to disable user: ${disableError.message}`, 500);
  }

  // Also ban in auth.users (find auth user by email)
  const { data: publicUser } = await supabase
    .from("users")
    .select("email")
    .eq("id", user_id)
    .maybeSingle();

  if (publicUser?.email) {
    // Find auth user
    const { data: listData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const authUser = listData?.users?.find((u) => u.email === publicUser.email);

    if (authUser) {
      const { error: banError } = await supabase.auth.admin.updateUserById(authUser.id, {
        ban_duration: "876600h", // ~100 years, effectively permanent
      });
      if (banError) {
        console.error("Failed to ban auth user:", banError);
      }
    }
  }

  return jsonResponse({ status: "disabled" });
}

// --- Main handler ---

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return errorResponse("Method not allowed. Use POST.", 405);
  }

  try {
    const body = await req.json();
    const { action } = body;

    if (!action) {
      return errorResponse("Missing required field: action");
    }

    // Verify caller authentication and role
    const callerResult = await verifyCallerRole(req);
    if (callerResult instanceof Response) {
      return callerResult; // Error response
    }

    const { role: callerRole } = callerResult;

    // Check permissions
    const allowedActions = ROLE_PERMISSIONS[callerRole];
    if (!allowedActions || !allowedActions.includes(action)) {
      return errorResponse(
        `Role '${callerRole}' is not authorized for action '${action}'`,
        403,
      );
    }

    // Route to the appropriate handler
    switch (action) {
      case "create_coach":
        return await handleCreateCoach(body);
      case "update_role":
        return await handleUpdateRole(body);
      case "update_password":
        return await handleUpdatePassword(body);
      case "disable_user":
        return await handleDisableUser(body);
      default:
        return errorResponse(
          `Unknown action: ${action}. Valid actions: create_coach, update_role, update_password, disable_user`,
        );
    }
  } catch (err) {
    console.error("admin-user error:", err);
    return errorResponse(
      `Internal server error: ${err instanceof Error ? err.message : String(err)}`,
      500,
    );
  }
});
