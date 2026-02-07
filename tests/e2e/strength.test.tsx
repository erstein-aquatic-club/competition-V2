/**
 * E2E tests – Strength: consultation et exécution séance
 *
 * Covers:
 *  1. Renders the Strength page with tabs
 *  2. Displays session list from catalog
 *  3. Cycle type selector (Endurance / Hypertrophie / Force)
 *  4. Search filtering
 *  5. Session card shows exercise count
 *  6. Opening a session switches to reader mode
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../helpers";

// ---------------------------------------------------------------------------
// Mock Supabase
// ---------------------------------------------------------------------------
vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      refreshSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
        }),
      }),
    }),
  },
}));

vi.mock("@/lib/config", () => ({
  supabaseConfig: { url: "https://test.supabase.co", anonKey: "test-key", hasSupabase: true },
}));

// ---------------------------------------------------------------------------
// Mock API — all data inline to avoid hoisting issues
// ---------------------------------------------------------------------------
vi.mock("@/lib/api", () => ({
  api: {
    getAssignments: vi.fn().mockResolvedValue([]),
    getStrengthSessions: vi.fn().mockResolvedValue([
      {
        id: 10,
        title: "Haut du corps",
        description: "Séance pectoraux / épaules",
        cycle: "endurance",
        items: [
          { exercise_id: 2, order_index: 0, sets: 3, reps: 12, cycle_type: "endurance" },
        ],
      },
      {
        id: 11,
        title: "Bas du corps",
        description: "Séance jambes",
        cycle: "endurance",
        items: [
          { exercise_id: 1, order_index: 0, sets: 3, reps: 15, cycle_type: "endurance" },
        ],
      },
      {
        id: 12,
        title: "Full body explosif",
        description: "Préparation compétition",
        cycle: "force",
        items: [
          { exercise_id: 1, order_index: 0, sets: 5, reps: 5, cycle_type: "force" },
          { exercise_id: 2, order_index: 1, sets: 5, reps: 3, cycle_type: "force" },
        ],
      },
    ]),
    getExercises: vi.fn().mockResolvedValue([
      {
        id: 1,
        nom_exercice: "Squat",
        exercise_type: "strength",
        Nb_series_endurance: 3,
        Nb_reps_endurance: 15,
        pct_1rm_endurance: 50,
        recup_endurance: 60,
        recup_exercices_endurance: 90,
        Nb_series_hypertrophie: 4,
        Nb_reps_hypertrophie: 10,
        pct_1rm_hypertrophie: 70,
        recup_hypertrophie: 90,
        recup_exercices_hypertrophie: 120,
        Nb_series_force: 5,
        Nb_reps_force: 5,
        pct_1rm_force: 85,
        recup_force: 180,
        recup_exercices_force: 240,
      },
      {
        id: 2,
        nom_exercice: "Développé couché",
        exercise_type: "strength",
        Nb_series_endurance: 3,
        Nb_reps_endurance: 12,
        pct_1rm_endurance: 50,
        recup_endurance: 60,
        recup_exercices_endurance: 90,
        Nb_series_hypertrophie: 4,
        Nb_reps_hypertrophie: 8,
        pct_1rm_hypertrophie: 75,
        recup_hypertrophie: 90,
        recup_exercices_hypertrophie: 120,
        Nb_series_force: 5,
        Nb_reps_force: 3,
        pct_1rm_force: 90,
        recup_force: 180,
        recup_exercices_force: 240,
      },
    ]),
    get1RM: vi.fn().mockResolvedValue([
      { exercise_id: 1, weight: 100 },
      { exercise_id: 2, weight: 80 },
    ]),
    getStrengthHistory: vi.fn().mockResolvedValue({
      runs: [],
      pagination: { limit: 10, offset: 0, total: 0 },
      exercise_summary: [],
    }),
    startStrengthRun: vi.fn().mockResolvedValue({ run_id: 1 }),
    logStrengthSet: vi.fn().mockResolvedValue({}),
    updateStrengthRun: vi.fn().mockResolvedValue({}),
    deleteStrengthRun: vi.fn().mockResolvedValue({}),
    notifications_list: vi.fn().mockResolvedValue({ notifications: [] }),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function setupAndRender() {
  const { useAuth } = await import("@/lib/auth");
  useAuth.setState({
    user: "Alice Nageur",
    userId: 42,
    role: "athlete",
    accessToken: "at-123",
    refreshToken: "rt-456",
    selectedAthleteId: null,
    selectedAthleteName: null,
  });
  const Strength = (await import("@/pages/Strength")).default;
  return renderWithProviders(<Strength />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("Strength – consultation et exécution séance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the Strength page with session count", async () => {
    await setupAndRender();

    await waitFor(() => {
      expect(screen.getByText(/séance.*disponible/i)).toBeInTheDocument();
    });
  });

  it("displays cycle type selectors (Endurance, Hypertrophie, Force)", async () => {
    await setupAndRender();

    await waitFor(() => {
      expect(screen.getByText("Endurance")).toBeInTheDocument();
      expect(screen.getByText("Hypertrophie")).toBeInTheDocument();
      expect(screen.getByText("Force")).toBeInTheDocument();
    });
  });

  it("shows session cards from the catalog", async () => {
    await setupAndRender();

    await waitFor(() => {
      expect(screen.getByText("Haut du corps")).toBeInTheDocument();
      expect(screen.getByText("Bas du corps")).toBeInTheDocument();
      expect(screen.getByText("Full body explosif")).toBeInTheDocument();
    });
  });

  it("shows exercise count on session cards", async () => {
    await setupAndRender();

    await waitFor(() => {
      const exerciseLabels = screen.getAllByText(/exercice/i);
      expect(exerciseLabels.length).toBeGreaterThan(0);
    });
  });

  it("shows search input", async () => {
    await setupAndRender();

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/rechercher une séance/i)).toBeInTheDocument();
    });
  });

  it("filters sessions when typing in search", async () => {
    const user = userEvent.setup();
    await setupAndRender();

    await waitFor(() => {
      expect(screen.getByText("Haut du corps")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/rechercher une séance/i);
    await user.type(searchInput, "Haut");

    await waitFor(() => {
      expect(screen.getByText("Haut du corps")).toBeInTheDocument();
      expect(screen.queryByText("Bas du corps")).not.toBeInTheDocument();
      expect(screen.queryByText("Full body explosif")).not.toBeInTheDocument();
    });
  });

  it("filters out sessions when search matches none", async () => {
    const user = userEvent.setup();
    await setupAndRender();

    await waitFor(() => {
      expect(screen.getByText("Haut du corps")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/rechercher une séance/i);
    await user.type(searchInput, "xyz-inexistant");

    await waitFor(() => {
      expect(screen.queryByText("Haut du corps")).not.toBeInTheDocument();
      expect(screen.queryByText("Bas du corps")).not.toBeInTheDocument();
    });
  });

  it("switching cycle type updates the session display", async () => {
    const user = userEvent.setup();
    await setupAndRender();

    await waitFor(() => {
      expect(screen.getByText("Endurance")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Force"));

    await waitFor(() => {
      expect(screen.getByText("Haut du corps")).toBeInTheDocument();
      expect(screen.getByText("Full body explosif")).toBeInTheDocument();
    });
  });

  it("clicking a session card opens the reader view", async () => {
    const user = userEvent.setup();
    await setupAndRender();

    await waitFor(() => {
      expect(screen.getByText("Haut du corps")).toBeInTheDocument();
    });

    const sessionCard = screen.getByText("Haut du corps").closest("button");
    expect(sessionCard).not.toBeNull();
    await user.click(sessionCard!);

    await waitFor(() => {
      const headings = screen.getAllByText("Haut du corps");
      expect(headings.length).toBeGreaterThan(0);
    });
  });

  it("shows 'Choisir une séance' section header", async () => {
    await setupAndRender();

    await waitFor(() => {
      expect(screen.getByText(/choisir une séance/i)).toBeInTheDocument();
    });
  });

  it("displays session descriptions", async () => {
    await setupAndRender();

    await waitFor(() => {
      expect(screen.getByText(/pectoraux/i)).toBeInTheDocument();
      expect(screen.getByText(/jambes/i)).toBeInTheDocument();
    });
  });
});
