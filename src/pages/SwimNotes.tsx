import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/shared/PageHeader";
import { SwimExerciseLogsHistory } from "@/components/dashboard/SwimExerciseLogsHistory";
import { FileText } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function SwimNotes() {
  const user = useAuth((s) => s.user);
  const [authUuid, setAuthUuid] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAuthUuid(data.session?.user?.id ?? null);
    });
  }, [user]);

  if (!authUuid) {
    return (
      <div className="mx-auto max-w-lg px-4">
        <PageHeader
          title="Notes techniques"
          icon={<FileText className="h-3.5 w-3.5" />}
          backHref="/"
        />
        <div className="mt-4 space-y-3">
          <Skeleton className="h-16 rounded-2xl" />
          <Skeleton className="h-16 rounded-2xl" />
          <Skeleton className="h-16 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 pb-24">
      <PageHeader
        title="Notes techniques"
        icon={<FileText className="h-3.5 w-3.5" />}
        backHref="/"
      />
      <div className="mt-2">
        <SwimExerciseLogsHistory
          userId={authUuid}
          expanded
          onToggle={() => {}}
          standalone
        />
      </div>
    </div>
  );
}
