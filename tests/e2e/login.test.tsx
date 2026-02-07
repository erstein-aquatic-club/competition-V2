/**
 * E2E tests – Login / Logout flow
 *
 * Covers:
 *  1. Render the login page when unauthenticated
 *  2. Show validation error when password is missing
 *  3. Show error on invalid credentials
 *  4. Successful login → populates auth store
 *  5. Logout → clears auth store
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../helpers";

// ---------------------------------------------------------------------------
// Hoisted mocks – available inside vi.mock factories
// ---------------------------------------------------------------------------
const {
  signInWithPasswordMock,
  signOutMock,
  getSessionMock,
} = vi.hoisted(() => ({
  signInWithPasswordMock: vi.fn(),
  signOutMock: vi.fn(),
  getSessionMock: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      signInWithPassword: (...args: unknown[]) => signInWithPasswordMock(...args),
      signUp: vi.fn().mockResolvedValue({ data: { session: null, user: null }, error: null }),
      signOut: (...args: unknown[]) => signOutMock(...args),
      getSession: (...args: unknown[]) => getSessionMock(...args),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      refreshSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: { role: "athlete" }, error: null }),
        }),
      }),
    }),
  },
}));

vi.mock("@/lib/config", () => ({
  supabaseConfig: { url: "https://test.supabase.co", anonKey: "test-key", hasSupabase: true },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const fakeSession = {
  access_token: "at-123",
  refresh_token: "rt-456",
  user: {
    id: "uuid-1",
    email: "nageur@eac.fr",
    app_metadata: { app_user_id: 42, app_user_role: "athlete" },
    user_metadata: { display_name: "Alice Nageur" },
  },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("Login / Logout flow", () => {
  let useAuthModule: typeof import("@/lib/auth");

  beforeEach(async () => {
    vi.clearAllMocks();
    getSessionMock.mockResolvedValue({ data: { session: null }, error: null });
    signOutMock.mockResolvedValue({ error: null });

    useAuthModule = await import("@/lib/auth");
    useAuthModule.useAuth.setState({
      user: null,
      userId: null,
      role: null,
      accessToken: null,
      refreshToken: null,
      selectedAthleteId: null,
      selectedAthleteName: null,
    });
  });

  async function renderLogin() {
    const Login = (await import("@/pages/Login")).default;
    return renderWithProviders(<Login />);
  }

  it("renders the login form with email and password inputs", async () => {
    await renderLogin();

    expect(screen.getByPlaceholderText("Email")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Mot de passe")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /connexion/i })).toBeInTheDocument();
  });

  it("shows the 'Créer un compte' link", async () => {
    await renderLogin();
    expect(screen.getByText("Créer un compte")).toBeInTheDocument();
  });

  it("disables submit button when fields are empty", async () => {
    await renderLogin();
    const btn = screen.getByRole("button", { name: /connexion/i });
    expect(btn).toBeDisabled();
  });

  it("shows 'Mot de passe requis' when email is set but password empty", async () => {
    const user = userEvent.setup();
    await renderLogin();

    await user.type(screen.getByPlaceholderText("Email"), "nageur@eac.fr");

    const form = screen.getByPlaceholderText("Email").closest("form")!;
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    await waitFor(() => {
      expect(screen.getByText("Mot de passe requis.")).toBeInTheDocument();
    });
  });

  it("shows error message on invalid credentials", async () => {
    signInWithPasswordMock.mockResolvedValue({
      data: { session: null, user: null },
      error: { message: "Invalid login credentials" },
    });

    const user = userEvent.setup();
    await renderLogin();

    await user.type(screen.getByPlaceholderText("Email"), "bad@eac.fr");
    await user.type(screen.getByPlaceholderText("Mot de passe"), "wrong");
    await user.click(screen.getByRole("button", { name: /connexion/i }));

    await waitFor(() => {
      expect(screen.getByText("Identifiant ou mot de passe incorrect.")).toBeInTheDocument();
    });
  });

  it("shows localized error for unconfirmed email", async () => {
    signInWithPasswordMock.mockResolvedValue({
      data: { session: null, user: null },
      error: { message: "Email not confirmed" },
    });

    const user = userEvent.setup();
    await renderLogin();

    await user.type(screen.getByPlaceholderText("Email"), "unverified@eac.fr");
    await user.type(screen.getByPlaceholderText("Mot de passe"), "pass123");
    await user.click(screen.getByRole("button", { name: /connexion/i }));

    await waitFor(() => {
      expect(
        screen.getByText("Veuillez confirmer votre email avant de vous connecter."),
      ).toBeInTheDocument();
    });
  });

  it("successful login populates the auth store", async () => {
    signInWithPasswordMock.mockResolvedValue({
      data: { session: fakeSession },
      error: null,
    });
    getSessionMock.mockResolvedValue({
      data: { session: fakeSession },
      error: null,
    });

    const user = userEvent.setup();
    await renderLogin();

    await user.type(screen.getByPlaceholderText("Email"), "nageur@eac.fr");
    await user.type(screen.getByPlaceholderText("Mot de passe"), "pass123");
    await user.click(screen.getByRole("button", { name: /connexion/i }));

    await waitFor(() => {
      const state = useAuthModule.useAuth.getState();
      expect(state.user).toBe("Alice Nageur");
      expect(state.userId).toBe(42);
      expect(state.accessToken).toBe("at-123");
    });
  });

  it("logout clears the auth store", async () => {
    useAuthModule.useAuth.setState({
      user: "Alice Nageur",
      userId: 42,
      role: "athlete",
      accessToken: "at-123",
      refreshToken: "rt-456",
    });

    await useAuthModule.useAuth.getState().logout();

    const state = useAuthModule.useAuth.getState();
    expect(state.user).toBeNull();
    expect(state.userId).toBeNull();
    expect(state.role).toBeNull();
    expect(state.accessToken).toBeNull();
    expect(state.refreshToken).toBeNull();
  });

  it("shows 'Connexion...' text while submitting", async () => {
    signInWithPasswordMock.mockImplementation(
      () => new Promise(() => {}), // never resolves
    );

    const user = userEvent.setup();
    await renderLogin();

    await user.type(screen.getByPlaceholderText("Email"), "nageur@eac.fr");
    await user.type(screen.getByPlaceholderText("Mot de passe"), "pass123");
    await user.click(screen.getByRole("button", { name: /connexion/i }));

    await waitFor(() => {
      expect(screen.getByText("Connexion...")).toBeInTheDocument();
    });
  });
});
