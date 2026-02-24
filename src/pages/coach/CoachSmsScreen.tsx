import { useMemo, useState } from "react";
import { MessageSquare, Copy, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import CoachSectionHeader from "./CoachSectionHeader";

type CoachSmsScreenProps = {
  onBack: () => void;
  athletes: Array<{ id: number | null; display_name: string; email?: string | null; group_id?: number | null; group_label?: string | null }>;
  groups: Array<{ id: number; name: string }>;
  athletesLoading: boolean;
};

const CoachSmsScreen = ({ onBack, athletes, groups, athletesLoading }: CoachSmsScreenProps) => {
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const [targetValue, setTargetValue] = useState("");

  const { data: athletePhones } = useQuery({
    queryKey: ["athlete-phones"],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_profiles")
        .select("user_id, phone")
        .not("phone", "is", null);
      return new Map((data ?? []).map((p: any) => [p.user_id as number, p.phone as string]));
    },
  });

  const athleteOptions = useMemo(
    () =>
      athletes
        .filter((a) => a.id != null)
        .map((a) => ({
          value: `user:${a.id}`,
          label: a.group_label ? `${a.display_name} · ${a.group_label}` : a.display_name,
          id: a.id!,
        })),
    [athletes],
  );

  const groupOptions = useMemo(
    () =>
      groups.map((g) => ({
        value: `group:${g.id}`,
        label: g.name,
        id: g.id,
      })),
    [groups],
  );

  const resolvePhones = (): { found: string[]; total: number } => {
    if (!targetValue || !athletePhones) return { found: [], total: 0 };

    if (targetValue.startsWith("user:")) {
      const userId = Number(targetValue.split(":")[1]);
      const phone = athletePhones.get(userId);
      return { found: phone ? [phone] : [], total: 1 };
    }

    if (targetValue.startsWith("group:")) {
      const groupId = Number(targetValue.split(":")[1]);
      const groupAthletes = athletes.filter((a) => a.group_id === groupId && a.id != null);
      const phones = groupAthletes
        .map((a) => athletePhones.get(a.id!))
        .filter((p): p is string => !!p && p.trim().length > 0);
      return { found: phones, total: groupAthletes.length };
    }

    return { found: [], total: 0 };
  };

  const { found: selectedPhones, total: selectedTotal } = resolvePhones();
  const missingCount = selectedTotal - selectedPhones.length;

  const handleSendSms = () => {
    if (selectedPhones.length === 0) {
      toast({
        title: "Aucun numéro",
        description: "Aucun nageur avec un numéro de téléphone dans cette sélection.",
        variant: "destructive",
      });
      return;
    }

    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
      const body = message.trim() ? encodeURIComponent(message.trim()) : "";
      const uri = body
        ? `sms:${selectedPhones.join(",")}?body=${body}`
        : `sms:${selectedPhones.join(",")}`;
      window.location.href = uri;
    } else {
      navigator.clipboard.writeText(selectedPhones.join(", ")).then(() => {
        toast({
          title: "Numéros copiés",
          description: `${selectedPhones.length} numéro${selectedPhones.length > 1 ? "s" : ""} copié${selectedPhones.length > 1 ? "s" : ""} dans le presse-papiers. Utilisez votre téléphone pour envoyer le SMS.`,
        });
      }).catch(() => {
        toast({ title: "Erreur", description: "Impossible de copier les numéros.", variant: "destructive" });
      });
    }
  };

  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  return (
    <div className="space-y-6 pb-24">
      <CoachSectionHeader
        title="Envoyer un SMS"
        description="Ouvre votre application SMS ou copie les numéros."
        onBack={onBack}
      />

      <Card className="border-l-4 border-l-primary">
        <CardHeader>
          <CardTitle>Destinataire</CardTitle>
          <CardDescription>Sélectionnez un nageur ou un groupe.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Destinataire</Label>
            <Select value={targetValue} onValueChange={setTargetValue}>
              <SelectTrigger>
                <SelectValue placeholder={athletesLoading ? "Chargement..." : "Choisir un nageur ou un groupe"} />
              </SelectTrigger>
              <SelectContent>
                {groupOptions.length ? (
                  <>
                    <SelectItem value="section-group" disabled>
                      Groupes
                    </SelectItem>
                    {groupOptions.map((g) => (
                      <SelectItem key={g.value} value={g.value}>
                        {g.label}
                      </SelectItem>
                    ))}
                  </>
                ) : null}
                {athleteOptions.length ? (
                  <>
                    <SelectItem value="section-athlete" disabled>
                      Nageurs
                    </SelectItem>
                    {athleteOptions.map((a) => (
                      <SelectItem key={a.value} value={a.value}>
                        {a.label}
                      </SelectItem>
                    ))}
                  </>
                ) : null}
              </SelectContent>
            </Select>
          </div>
          {targetValue && selectedPhones.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              {selectedPhones.length} numéro{selectedPhones.length > 1 ? "s" : ""} trouvé{selectedPhones.length > 1 ? "s" : ""}
              {missingCount > 0 ? (
                <span className="text-destructive"> · {missingCount} sans téléphone</span>
              ) : null}
            </p>
          ) : null}
          {targetValue && selectedPhones.length === 0 ? (
            <p className="text-xs text-destructive">
              Aucun numéro de téléphone disponible pour cette sélection.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Message</CardTitle>
          <CardDescription>Optionnel — pré-rempli dans votre application SMS.</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Contenu du SMS…"
            rows={3}
          />
        </CardContent>
      </Card>

      <div className="sticky bottom-0 z-10 -mx-4 border-t bg-background/95 p-4 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:p-0">
        <Button
          className="w-full sm:w-auto"
          onClick={handleSendSms}
          disabled={!targetValue || selectedPhones.length === 0}
        >
          {isMobile ? (
            <>
              <MessageSquare className="mr-2 h-4 w-4" />
              Ouvrir dans l'app SMS
              <ExternalLink className="ml-2 h-3 w-3" />
            </>
          ) : (
            <>
              <Copy className="mr-2 h-4 w-4" />
              Copier les numéros
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default CoachSmsScreen;
