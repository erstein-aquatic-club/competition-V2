type NotificationLinkInput = {
  type?: string | null;
  title?: string | null;
  message?: string | null;
  metadata?: Record<string, unknown> | null;
};

export function resolveNotificationHref(notification: NotificationLinkInput): string {
  const metadataUrl = notification.metadata?.url;
  if (typeof metadataUrl === "string" && metadataUrl.trim()) {
    return metadataUrl;
  }

  const title = String(notification.title ?? "").toLowerCase();
  const message = String(notification.message ?? "").toLowerCase();
  const type = String(notification.type ?? "").toLowerCase();
  const haystack = `${title} ${message}`;

  if (type === "interview" || haystack.includes("entretien")) {
    return "/suivi?tab=entretiens";
  }

  if (type === "assignment") {
    return "/";
  }

  if (type === "objective" || haystack.includes("objectif")) {
    return "/suivi?tab=objectifs";
  }

  return "/profile?section=messages";
}

export function resolveNotificationActionLabel(notification: NotificationLinkInput): string | null {
  const href = resolveNotificationHref(notification);
  if (href === "/suivi?tab=entretiens") return "Ouvrir l'entretien";
  if (href === "/suivi?tab=objectifs") return "Ouvrir les objectifs";
  if (href === "/") return "Ouvrir l'accueil";
  if (href === "/profile?section=messages") return null;
  return "Ouvrir";
}
