import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getSwimCatalog } from "@/lib/api/swim";
import type { SwimSessionTemplate } from "@/lib/api/types";
import { calculateSwimTotalDistance } from "@/lib/swimSessionUtils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, SwatchBook, Waves } from "lucide-react";

/* ─── Props ───────────────────────────────────────────────── */

interface SlotTemplatePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (catalogId: number, sessionName: string) => void;
}

/* ─── Component ───────────────────────────────────────────── */

export function SlotTemplatePicker({
  open,
  onOpenChange,
  onSelect,
}: SlotTemplatePickerProps) {
  const [search, setSearch] = useState("");

  /* ── data ─────────────────────────────────────────────── */

  const { data: sessions, isLoading } = useQuery({
    queryKey: ["swim_catalog"],
    queryFn: () => getSwimCatalog(),
    enabled: open,
  });

  /* Filter out archived, apply search, sort alphabetically */
  const filtered = useMemo(() => {
    if (!sessions) return [];
    const q = search.trim().toLowerCase();
    return sessions
      .filter((s) => !s.is_archived)
      .filter(
        (s) =>
          !q ||
          s.name.toLowerCase().includes(q) ||
          (s.folder ?? "").toLowerCase().includes(q),
      )
      .sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }, [sessions, search]);

  /* ── handlers ────────────────────────────────────────── */

  const handleSelect = (session: SwimSessionTemplate) => {
    onSelect(session.id, session.name);
    onOpenChange(false);
  };

  /* ── render ──────────────────────────────────────────── */

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="flex h-[80vh] flex-col rounded-t-2xl px-4 pb-4 pt-5"
      >
        {/* Header */}
        <SheetHeader className="shrink-0 space-y-1">
          <SheetTitle className="text-base font-semibold">
            Choisir une séance
          </SheetTitle>
          <SheetDescription className="sr-only">
            Parcourez et recherchez dans la bibliothèque de séances natation
          </SheetDescription>
        </SheetHeader>

        {/* Search */}
        <div className="relative mt-3 shrink-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher une séance..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Scrollable list */}
        <div className="mt-3 flex-1 overflow-y-auto overscroll-contain">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-[72px] w-full rounded-xl" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
              <Waves className="h-10 w-10 opacity-40" />
              <p className="text-sm">Aucune séance dans la bibliothèque</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((session) => {
                const totalDistance = calculateSwimTotalDistance(
                  session.items ?? [],
                );
                return (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => handleSelect(session)}
                    className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left shadow-sm transition-transform active:scale-[0.98]"
                  >
                    {/* Icon */}
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
                      <SwatchBook className="h-5 w-5" />
                    </div>

                    {/* Text */}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {session.name}
                      </p>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                        {totalDistance > 0 && (
                          <span>{totalDistance.toLocaleString("fr-FR")} m</span>
                        )}
                        {totalDistance > 0 && session.folder && (
                          <span aria-hidden="true">·</span>
                        )}
                        {session.folder && (
                          <span className="truncate">{session.folder}</span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
