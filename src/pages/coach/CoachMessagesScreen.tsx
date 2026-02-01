import { useMemo, useState } from "react";
import { MessageSquare } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import CoachSectionHeader from "./CoachSectionHeader";

type CoachMessagesScreenProps = {
  onBack: () => void;
  athletes: Array<{ id: number | null; display_name: string; group_label?: string | null }>;
  groups: Array<{ id: number; name: string }>;
  athletesLoading: boolean;
};

const CoachMessagesScreen = ({ onBack, athletes, groups, athletesLoading }: CoachMessagesScreenProps) => {
  const { toast } = useToast();
  const [messageBody, setMessageBody] = useState("");
  const [messageTitle, setMessageTitle] = useState("Message Coach");
  const [messageTargetValue, setMessageTargetValue] = useState("");

  const athleteOptions = useMemo(
    () =>
      athletes
        .filter((athlete) => athlete.id)
        .map((athlete) => ({
          value: `user:${athlete.id}`,
          label: athlete.group_label ? `${athlete.display_name} · ${athlete.group_label}` : athlete.display_name,
          id: athlete.id,
        })),
    [athletes],
  );
  const groupOptions = useMemo(
    () =>
      groups.map((group) => ({
        value: `group:${group.id}`,
        label: group.name,
        id: group.id,
      })),
    [groups],
  );
  const targetLookup = useMemo(
    () => new Map([...athleteOptions, ...groupOptions].map((target) => [target.value, target])),
    [athleteOptions, groupOptions],
  );

  const sendMessage = useMutation({
    mutationFn: (data: { title: string; body: string; targets: Array<{ target_user_id?: number; target_group_id?: number }> }) =>
      api.notifications_send({ ...data, type: "message" }),
    onSuccess: () => {
      toast({ title: "Message envoyé" });
      setMessageBody("");
    },
  });

  const handleSend = () => {
    if (!messageTitle.trim() || !messageBody.trim()) {
      toast({ title: "Message incomplet", description: "Ajoutez un titre et un contenu." });
      return;
    }
    if (!messageTargetValue) {
      toast({ title: "Destinataire manquant", description: "Sélectionnez un nageur ou un groupe." });
      return;
    }
    const target = targetLookup.get(messageTargetValue);
    if (!target?.id) {
      toast({
        title: "Destinataire invalide",
        description: "Sélectionnez un destinataire valide.",
      });
      return;
    }
    if (messageTargetValue.startsWith("group:")) {
      sendMessage.mutate({
        title: messageTitle,
        body: messageBody,
        targets: [{ target_group_id: target.id }],
      });
      return;
    }
    sendMessage.mutate({
      title: messageTitle,
      body: messageBody,
      targets: [{ target_user_id: target.id }],
    });
  };

  return (
    <div className="space-y-6 pb-24">
      <CoachSectionHeader
        title="Messagerie rapide"
        description="Envoyez un message ciblé à vos nageurs."
        onBack={onBack}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-l-4 border-l-primary">
          <CardHeader>
            <CardTitle>Destinataire</CardTitle>
            <CardDescription>Sélectionnez un nageur ou un groupe à prévenir.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Destinataire</Label>
              <Select value={messageTargetValue} onValueChange={setMessageTargetValue}>
                <SelectTrigger>
                  <SelectValue placeholder={athletesLoading ? "Chargement..." : "Choisir un nageur ou un groupe"} />
                </SelectTrigger>
                <SelectContent>
                  {groupOptions.length ? (
                    <>
                      <SelectItem value="section-group" disabled>
                        Groupes
                      </SelectItem>
                      {groupOptions.map((group) => (
                        <SelectItem key={group.value} value={group.value}>
                          {group.label}
                        </SelectItem>
                      ))}
                    </>
                  ) : null}
                  {athleteOptions.length ? (
                    <>
                      <SelectItem value="section-athlete" disabled>
                        Nageurs
                      </SelectItem>
                      {athleteOptions.map((athlete) => (
                        <SelectItem key={athlete.value} value={athlete.value}>
                          {athlete.label}
                        </SelectItem>
                      ))}
                    </>
                  ) : null}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contenu</CardTitle>
            <CardDescription>Rédigez votre message en quelques lignes.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Titre</Label>
              <Input value={messageTitle} onChange={(event) => setMessageTitle(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea
                placeholder="Message..."
                value={messageBody}
                onChange={(event) => setMessageBody(event.target.value)}
                rows={5}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="sticky bottom-0 z-10 -mx-4 border-t bg-background/95 p-4 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:p-0">
        <Button className="w-full sm:w-auto" onClick={handleSend} disabled={sendMessage.isPending}>
          <MessageSquare className="mr-2 h-4 w-4" />
          {sendMessage.isPending ? "Envoi..." : "Envoyer"}
        </Button>
      </div>
    </div>
  );
};

export default CoachMessagesScreen;
