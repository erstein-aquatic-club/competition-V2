export const PASSWORD_REQUIRED_ROLES = ["athlete", "coach", "comite", "admin"] as const;

export type PasswordRequiredRole = (typeof PASSWORD_REQUIRED_ROLES)[number];

export const requiresPasswordForRole = (role?: string | null) =>
  PASSWORD_REQUIRED_ROLES.includes(role as PasswordRequiredRole);
