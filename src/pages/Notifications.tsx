import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, summarizeApiError, type Notification } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { supabaseConfig } from "@/lib/config";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, ArrowLeft, Send } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useMemo, useState } from "react";
import { useToast } from "@/hooks/use-toast";

export type NotificationThread = {
  key: string;
  senderId: number | null;
  senderLabel: string;
  messages: Notification[];
  lastMessage: Notification;
  lastTimestamp: number;
  hasUnread: boolean;
  counterpartyId: number | null;
  targetGroupId: number | null;
  targetGroupName: string | null;
  replyTargetId: number | null;
};

export const getThreadKey = (notification: Notification, viewerId?: number | null) => {
  if (notification.target_group_id) {
    return `group:${notification.target_group_id}`;
  }
  if (
    viewerId &&
    notification.sender_id !== null &&
    notification.sender_id !== undefined &&
    notification.sender_id !== viewerId
  ) {
    return `user:${notification.sender_id}`;
  }
  if (viewerId && notification.counterparty_id !== null && notification.counterparty_id !== undefined) {
    return `user:${notification.counterparty_id}`;
  }
  if (viewerId && notification.target_user_id) {
    return `user:${notification.target_user_id}`;
  }
  if (notification.counterparty_id !== null && notification.counterparty_id !== undefined) {
    return `user:${notification.counterparty_id}`;
  }
  if (notification.sender_id !== null && notification.sender_id !== undefined) {
    return `user:${notification.sender_id}`;
  }
  if (notification.sender_email) {
    return `email:${notification.sender_email}`;
  }
  return `sender:${notification.sender}`;
};

export const sortThreadMessages = (messages: Notification[]) =>
  [...messages].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

export const collectThreadMarkReadTargets = (messages: Notification[]) =>
  messages
    .filter((message) => !message.read)
    .map((message) => message.target_id ?? message.id)
    .filter((value): value is number => Number.isFinite(value));

export const buildOptimisticNotification = ({
  message,
  senderId,
  senderLabel,
  targetUserId,
  targetGroupId,
  title = "Message",
}: {
  message: string;
  senderId?: number | null;
  senderLabel?: string | null;
  targetUserId?: number | null;
  targetGroupId?: number | null;
  title?: string;
}): Notification => ({
  id: Date.now(),
  sender: senderLabel || "Coach",
  sender_name: senderLabel || null,
  sender_id: senderId ?? null,
  sender_email: null,
  target_user_id: targetUserId ?? null,
  target_group_id: targetGroupId ?? null,
  title,
  message,
  type: "message",
  read: true,
  date: new Date().toISOString(),
});

export const groupNotificationsBySender = (
  notifications: Notification[],
  viewerId?: number | null,
): NotificationThread[] => {
  const map = new Map<string, Notification[]>();
  notifications.forEach((notification) => {
    const key = getThreadKey(notification, viewerId);
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key)?.push(notification);
  });

  return Array.from(map.entries()).map(([key, messages]) => {
    const sortedByDate = sortThreadMessages(messages);
    const lastMessage = sortedByDate[sortedByDate.length - 1];
    const hasUnread = messages.some((message) => !message.read);
    const counterpartyId = key.startsWith("user:") ? Number(key.split(":")[1]) : null;
    const targetGroupId = key.startsWith("group:") ? Number(key.split(":")[1]) : null;
    const displayMessage = viewerId
      ? messages.find((message) => message.sender_id && message.sender_id !== viewerId) ?? lastMessage
      : lastMessage;
    const counterpartyLabel = messages.find((message) => message.counterparty_name)?.counterparty_name;
    const targetGroupName = messages.find((message) => message.target_group_name)?.target_group_name ?? null;
    const replyTargetId = viewerId
      ? messages.find((message) => message.target_id)?.target_id ?? null
      : messages.find((message) => message.target_id)?.target_id ?? null;
    return {
      key,
      senderId: lastMessage.sender_id ?? null,
      senderLabel: targetGroupName ?? counterpartyLabel ?? displayMessage.sender,
      messages: sortedByDate,
      lastMessage,
      lastTimestamp: new Date(lastMessage.date).getTime(),
      hasUnread,
      counterpartyId: Number.isFinite(counterpartyId) ? counterpartyId : null,
      targetGroupId: Number.isFinite(targetGroupId) ? targetGroupId : null,
      targetGroupName,
      replyTargetId,
    };
  });
};

export default function Notifications() {
  const { user, userId, role } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedThreadKey, setSelectedThreadKey] = useState<string | null>(null);
  const [messageBody, setMessageBody] = useState("");

  const { data: notificationsResult, isLoading, error: notificationsError } = useQuery({
    queryKey: ["notifications", userId, user, "threads"],
    queryFn: () =>
      api.notifications_list({
        targetUserId: userId,
        targetAthleteName: user,
        limit: 200,
        offset: 0,
        type: "message",
        order: "desc",
      }),
    enabled: !!user,
    refetchInterval: 10000,
  });

  const { data: capabilities, error: capabilitiesError } = useQuery({
    queryKey: ["capabilities", "messaging"],
    queryFn: () => api.getCapabilities(),
    enabled: supabaseConfig.hasSupabase,
  });

  const markRead = useMutation({
    mutationFn: (id: number) => api.notifications_mark_read({ targetId: id }),
    onMutate: async (targetId) => {
      await queryClient.cancelQueries({ queryKey: ["notifications"] });
      const previous = queryClient.getQueryData(["notifications", userId, user, "threads"]);
      queryClient.setQueryData(["notifications", userId, user, "threads"], (current: unknown) => {
        const data = current as { notifications?: Notification[] } | undefined;
        if (!data?.notifications) return current;
        return {
          ...data,
          notifications: data.notifications.map((notif: Notification) =>
            (notif.target_id ?? notif.id) === targetId ? { ...notif, read: true } : notif,
          ),
        };
      });
      return { previous };
    },
    onError: (_error, _targetId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["notifications", userId, user, "threads"], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const sendMessage = useMutation({
    mutationFn: (payload: {
      targetUserId: number;
      targetGroupId?: number | null;
      replyTargetId?: number | null;
      message: string;
    }) =>
      api.notifications_send({
        title: "Message",
        body: payload.message,
        type: "message",
        targets: [
          payload.targetGroupId
            ? { target_group_id: payload.targetGroupId }
            : { target_user_id: payload.targetUserId || null },
        ],
        reply_to_target_id: payload.replyTargetId ?? undefined,
      }),
    onMutate: async (payload) => {
      if (!payload.message.trim()) return;
      await queryClient.cancelQueries({ queryKey: ["notifications", userId, user, "threads"] });
      const previous = queryClient.getQueryData(["notifications", userId, user, "threads"]);
      const optimistic = buildOptimisticNotification({
        message: payload.message,
        senderId: userId,
        senderLabel: user ?? "Coach",
        targetUserId: payload.targetUserId,
        targetGroupId: payload.targetGroupId ?? null,
      });
      queryClient.setQueryData(["notifications", userId, user, "threads"], (current: unknown) => {
        const data = current as { notifications?: Notification[] } | undefined;
        if (!data?.notifications) return current;
        return {
          ...data,
          notifications: [optimistic, ...data.notifications],
        };
      });
      return { previous };
    },
    onSuccess: () => {
      setMessageBody("");
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (error: unknown, _payload, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["notifications", userId, user, "threads"], context.previous);
      }
      const summary = summarizeApiError(error, "Le message n'a pas pu être envoyé.");
      toast({
        title: "Envoi impossible",
        description: summary.message,
        variant: "destructive",
      });
    },
  });

  const notifications = notificationsResult?.notifications ?? [];
  const unreadCount = notifications.filter((notification) => !notification.read).length;
  const threads = useMemo(
    () => groupNotificationsBySender(notifications, userId).sort((a, b) => b.lastTimestamp - a.lastTimestamp),
    [notifications, userId],
  );
  const directThreads = threads.filter((thread) => !thread.targetGroupId);
  const groupThreads = threads.filter((thread) => thread.targetGroupId);
  const activeThread = selectedThreadKey
    ? threads.find((thread) => thread.key === selectedThreadKey)
    : null;
  const canReply =
    Boolean(activeThread?.counterpartyId || activeThread?.targetGroupId) &&
    (role !== "athlete" || !supabaseConfig.hasSupabase || Boolean(activeThread?.replyTargetId));

  const handleOpenThread = (thread: NotificationThread) => {
    setSelectedThreadKey(thread.key);
    const targets = collectThreadMarkReadTargets(thread.messages);
    targets.forEach((targetId) => markRead.mutate(targetId));
  };

  if (isLoading) return (
    <div className="space-y-4 p-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-start gap-3 rounded-xl bg-muted animate-pulse motion-reduce:animate-none p-4">
          <div className="h-10 w-10 rounded-full bg-muted-foreground/10" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-3/4 rounded bg-muted-foreground/10" />
            <div className="h-3 w-1/2 rounded bg-muted-foreground/10" />
          </div>
        </div>
      ))}
    </div>
  );

  const capabilityMessage = capabilitiesError
    ? summarizeApiError(capabilitiesError, "Impossible de vérifier la messagerie.").message
    : capabilities?.mode === "supabase" && !capabilities.messaging.available
      ? "Messagerie indisponible (tables manquantes côté D1)."
      : null;

  const notificationsErrorMessage = notificationsError
    ? summarizeApiError(notificationsError, "Impossible de charger les messages.").message
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-display font-bold uppercase italic text-primary">Messagerie</h1>
        {unreadCount > 0 && <Badge variant="destructive">{unreadCount} non lus</Badge>}
      </div>

      {capabilityMessage ? (
        <Card className="border-dashed">
          <CardContent className="py-4 text-sm text-muted-foreground">{capabilityMessage}</CardContent>
        </Card>
      ) : null}
      {notificationsErrorMessage ? (
        <Card className="border-destructive/40">
          <CardContent className="py-4 text-sm text-destructive">{notificationsErrorMessage}</CardContent>
        </Card>
      ) : null}

      {!activeThread ? (
        <div className="space-y-4">
          <div className="space-y-3">
            <div className="text-sm font-bold uppercase text-muted-foreground tracking-wider ml-1">Discussions</div>
            <div className="space-y-3">
              {directThreads.map((thread) => (
                <button
                  key={thread.key}
                  type="button"
                  onClick={() => handleOpenThread(thread)}
                  className="w-full text-left"
                >
                  <Card className="group hover:bg-muted/50 transition-colors border-l-4 border-l-transparent hover:border-l-primary">
                    <CardContent className="p-4 flex items-start gap-4">
                      <div className={`p-2 rounded-full ${thread.hasUnread ? "bg-primary/20" : "bg-muted"}`}>
                        <MessageSquare className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <div className="font-bold truncate">{thread.senderLabel}</div>
                          <div className="text-xs text-muted-foreground shrink-0 ml-2">
                            {format(new Date(thread.lastMessage.date), "dd MMM", { locale: fr })}
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-1 break-words">{thread.lastMessage.message}</p>
                      </div>
                      {thread.hasUnread ? <Badge variant="secondary">Non lu</Badge> : null}
                    </CardContent>
                  </Card>
                </button>
              ))}
              {directThreads.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="py-10 text-center text-sm text-muted-foreground">
                    Aucune discussion directe pour le moment.
                  </CardContent>
                </Card>
              ) : null}
            </div>
          </div>
          <div className="space-y-3">
            <div className="text-sm font-bold uppercase text-muted-foreground tracking-wider ml-1">Groupes</div>
            <div className="space-y-3">
              {groupThreads.map((thread) => (
                <button
                  key={thread.key}
                  type="button"
                  onClick={() => handleOpenThread(thread)}
                  className="w-full text-left"
                >
                  <Card className="group hover:bg-muted/50 transition-colors border-l-4 border-l-transparent hover:border-l-primary">
                    <CardContent className="p-4 flex items-start gap-4">
                      <div className={`p-2 rounded-full ${thread.hasUnread ? "bg-primary/20" : "bg-muted"}`}>
                        <MessageSquare className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <div className="font-bold truncate">{thread.senderLabel}</div>
                          <div className="text-xs text-muted-foreground shrink-0 ml-2">
                            {format(new Date(thread.lastMessage.date), "dd MMM", { locale: fr })}
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-1 break-words">{thread.lastMessage.message}</p>
                      </div>
                      {thread.hasUnread ? <Badge variant="secondary">Non lu</Badge> : null}
                    </CardContent>
                  </Card>
                </button>
              ))}
              {groupThreads.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="py-10 text-center text-sm text-muted-foreground">
                    Aucun message de groupe pour le moment.
                  </CardContent>
                </Card>
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground"
            onClick={() => setSelectedThreadKey(null)}
          >
            <ArrowLeft className="h-4 w-4" />
            Retour
          </button>

          <Card>
            <CardHeader>
              <CardTitle>{activeThread.senderLabel}</CardTitle>
              <CardDescription>Conversation</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {activeThread.messages.map((message) => {
                const isMine = message.sender_id === userId;
                return (
                  <div key={message.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                    <div className={`flex items-end gap-2 ${isMine ? "flex-row-reverse" : "flex-row"}`}>
                      <div
                        className={`max-w-[80%] rounded-2xl border px-4 py-3 text-sm shadow-sm ${
                          isMine
                            ? "border-primary/40 bg-primary text-primary-foreground"
                            : "border-border bg-muted/50 text-foreground"
                        }`}
                      >
                        <div className={`text-xs ${isMine ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                          {message.sender}
                        </div>
                        <div className="mt-1">{message.message}</div>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(message.date), "HH:mm", { locale: fr })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{canReply ? "Répondre" : "Réponse indisponible"}</CardTitle>
              <CardDescription>Répondez à ce fil.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {canReply ? (
                <>
                  <Textarea
                    value={messageBody}
                    onChange={(event) => setMessageBody(event.target.value)}
                    placeholder="Votre message..."
                    rows={3}
                  />
                  <Button
                    onClick={() => {
                      const targetUserId = activeThread.counterpartyId;
                      const targetGroupId = activeThread.targetGroupId;
                      if (!targetUserId && !targetGroupId) {
                        toast({
                          title: "Envoi impossible",
                          description: "Destinataire introuvable pour ce fil.",
                          variant: "destructive",
                        });
                        return;
                      }
                      sendMessage.mutate({
                        targetUserId: targetUserId ?? 0,
                        targetGroupId,
                        message: messageBody,
                        replyTargetId:
                          role === "athlete" && supabaseConfig.hasSupabase ? activeThread.replyTargetId : null,
                      });
                    }}
                    disabled={!messageBody.trim() || sendMessage.isPending}
                  >
                    <Send className="mr-2 h-4 w-4" />
                    Envoyer
                  </Button>
                </>
              ) : (
                <div className="text-sm text-muted-foreground">
                  {role === "athlete"
                    ? "Réponse possible uniquement sur un fil existant."
                    : "Aucun destinataire disponible pour ce fil."}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
