export const shouldOpenSignupOnAuthError = (code?: string | null) => code === "account_not_found";

export const shouldFocusSignup = (showRegister: boolean) => showRegister;

export const getLandingRouteForRole = (role: string | null) => {
  switch (role) {
    case "coach":
      return "/coach";
    case "admin":
      return "/admin";
    case "comite":
      return "/comite";
    default:
      return "/";
  }
};
