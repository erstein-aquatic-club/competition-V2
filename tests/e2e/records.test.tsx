/**
 * E2E tests – Records: toggle 25/50m, affichage données
 *
 * Covers:
 *  1. Renders the Records page with title
 *  2. Shows Natation / Musculation tabs
 *  3. Shows Entraînement / Compétition sub-tabs
 *  4. Toggle 25m / 50m pool length
 *  5. Displays swim records data
 *  6. Shows "Aucun record" when no data for the pool length
 *  7. Displays 1RM records in Musculation tab
 *  8. Restricts access for non-athlete roles
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
// Mock API — hoisted mock for swim records so we can change it per-test
// ---------------------------------------------------------------------------
const { getSwimRecordsMock } = vi.hoisted(() => ({
  getSwimRecordsMock: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  api: {
    getSwimRecords: (...args: unknown[]) => getSwimRecordsMock(...args),
    get1RM: vi.fn().mockResolvedValue([
      { exercise_id: 1, weight: 100, recorded_at: "2025-03-20" },
      { exercise_id: 2, weight: 80, recorded_at: "2025-03-18" },
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
      },
    ]),
    update1RM: vi.fn().mockResolvedValue({}),
    upsertSwimRecord: vi.fn().mockResolvedValue({}),
    syncFfnSwimRecords: vi.fn().mockResolvedValue({ inserted: 0, updated: 0, skipped: 0 }),
    notifications_list: vi.fn().mockResolvedValue({ notifications: [] }),
  },
}));

// ---------------------------------------------------------------------------
// Default swim records data
// ---------------------------------------------------------------------------
const defaultSwimRecords = {
  records: [
    {
      id: 1,
      event_name: "50 NL",
      pool_length: 25,
      time_seconds: 27.45,
      record_date: "2025-03-15",
      notes: "",
      record_type: "training",
    },
    {
      id: 2,
      event_name: "100 NL",
      pool_length: 25,
      time_seconds: 59.82,
      record_date: "2025-03-10",
      notes: "FFN (450 pts)",
      record_type: "training",
    },
    {
      id: 3,
      event_name: "200 Dos",
      pool_length: 50,
      time_seconds: 152.3,
      record_date: "2025-02-20",
      notes: "",
      record_type: "training",
    },
    {
      id: 4,
      event_name: "50 NL",
      pool_length: 25,
      time_seconds: 26.88,
      record_date: "2025-04-01",
      notes: "FFN (520 pts)",
      record_type: "comp",
      meet: "Championnats Alsace",
      ffn_points: 520,
    },
  ],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function setupAthleteAndRender() {
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
  const Records = (await import("@/pages/Records")).default;
  return renderWithProviders(<Records />);
}

async function setupCoachAndRender() {
  const { useAuth } = await import("@/lib/auth");
  useAuth.setState({
    user: "Coach Dupont",
    userId: 10,
    role: "coach",
    accessToken: "at-coach",
    refreshToken: "rt-coach",
    selectedAthleteId: null,
    selectedAthleteName: null,
  });
  const Records = (await import("@/pages/Records")).default;
  return renderWithProviders(<Records />);
}

async function setupAdminAndRender() {
  const { useAuth } = await import("@/lib/auth");
  useAuth.setState({
    user: "Admin",
    userId: 1,
    role: "admin",
    accessToken: "at-admin",
    refreshToken: "rt-admin",
    selectedAthleteId: null,
    selectedAthleteName: null,
  });
  const Records = (await import("@/pages/Records")).default;
  return renderWithProviders(<Records />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("Records – toggle 25/50m, affichage données", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSwimRecordsMock.mockResolvedValue(defaultSwimRecords);
  });

  it("renders the Records page with title", async () => {
    await setupAthleteAndRender();

    await waitFor(() => {
      expect(screen.getByText("Records")).toBeInTheDocument();
    });
  });

  it("shows Natation and Musculation tabs", async () => {
    await setupAthleteAndRender();

    await waitFor(() => {
      expect(screen.getByText("Natation")).toBeInTheDocument();
      expect(screen.getByText("Musculation")).toBeInTheDocument();
    });
  });

  it("shows Entraînement / Compétition sub-tabs in swim mode", async () => {
    await setupAthleteAndRender();

    await waitFor(() => {
      expect(screen.getByText("Entraînement")).toBeInTheDocument();
      expect(screen.getByText("Compétition")).toBeInTheDocument();
    });
  });

  it("displays the 25m pool toggle by default", async () => {
    await setupAthleteAndRender();

    await waitFor(() => {
      expect(screen.getByText("25m")).toBeInTheDocument();
    });
  });

  it("shows swim records for 25m pool", async () => {
    await setupAthleteAndRender();

    await waitFor(() => {
      expect(screen.getByText("50 NL")).toBeInTheDocument();
      expect(screen.getByText("100 NL")).toBeInTheDocument();
    });
  });

  it("displays formatted times for swim records", async () => {
    await setupAthleteAndRender();

    await waitFor(() => {
      expect(screen.getByText("27.45")).toBeInTheDocument();
      expect(screen.getByText("59.82")).toBeInTheDocument();
    });
  });

  it("toggles to 50m and shows 50m records", async () => {
    const user = userEvent.setup();
    await setupAthleteAndRender();

    await waitFor(() => {
      expect(screen.getByText("25m")).toBeInTheDocument();
    });

    const poolToggle = screen.getByRole("button", { name: /changer le bassin/i });
    await user.click(poolToggle);

    await waitFor(() => {
      expect(screen.getByText("50m")).toBeInTheDocument();
      expect(screen.getByText("200 Dos")).toBeInTheDocument();
    });
  });

  it("toggles back from 50m to 25m", async () => {
    const user = userEvent.setup();
    await setupAthleteAndRender();

    await waitFor(() => {
      expect(screen.getByText("25m")).toBeInTheDocument();
    });

    const poolToggle = screen.getByRole("button", { name: /changer le bassin/i });

    await user.click(poolToggle);
    await waitFor(() => {
      expect(screen.getByText("50m")).toBeInTheDocument();
    });

    await user.click(poolToggle);
    await waitFor(() => {
      expect(screen.getByText("25m")).toBeInTheDocument();
      expect(screen.getByText("50 NL")).toBeInTheDocument();
    });
  });

  it("shows 'Aucun record' when no records for the pool length", async () => {
    getSwimRecordsMock.mockResolvedValue({
      records: [
        {
          id: 1,
          event_name: "50 NL",
          pool_length: 25,
          time_seconds: 27.45,
          record_date: "2025-03-15",
          notes: "",
          record_type: "training",
        },
      ],
    });

    const user = userEvent.setup();
    await setupAthleteAndRender();

    await waitFor(() => {
      expect(screen.getByText("50 NL")).toBeInTheDocument();
    });

    const poolToggle = screen.getByRole("button", { name: /changer le bassin/i });
    await user.click(poolToggle);

    await waitFor(() => {
      expect(screen.getByText(/aucun record en bassin 50m/i)).toBeInTheDocument();
    });
  });

  it("switches to Compétition mode and shows competition records", async () => {
    const user = userEvent.setup();
    await setupAthleteAndRender();

    await waitFor(() => {
      expect(screen.getByText("Entraînement")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Compétition"));

    await waitFor(() => {
      expect(screen.getByText("50 NL")).toBeInTheDocument();
    });
  });

  it("shows 'Ajouter' button in training mode", async () => {
    await setupAthleteAndRender();

    await waitFor(() => {
      expect(screen.getByText("Ajouter")).toBeInTheDocument();
    });
  });

  it("hides 'Ajouter' button in competition mode", async () => {
    const user = userEvent.setup();
    await setupAthleteAndRender();

    await waitFor(() => {
      expect(screen.getByText("Entraînement")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Compétition"));

    await waitFor(() => {
      expect(screen.queryByText("Ajouter")).not.toBeInTheDocument();
    });
  });

  it("shows 'Records fédération (lecture seule)' in competition mode", async () => {
    const user = userEvent.setup();
    await setupAthleteAndRender();

    await waitFor(() => {
      expect(screen.getByText("Entraînement")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Compétition"));

    await waitFor(() => {
      expect(screen.getByText(/records fédération.*lecture seule/i)).toBeInTheDocument();
    });
  });

  it("switches to Musculation tab and shows 1RM data", async () => {
    const user = userEvent.setup();
    await setupAthleteAndRender();

    await waitFor(() => {
      expect(screen.getByText("Musculation")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("tab", { name: /records de musculation/i }));

    await waitFor(() => {
      expect(screen.getByText("Squat")).toBeInTheDocument();
      expect(screen.getByText("Développé couché")).toBeInTheDocument();
    });
  });

  it("restricts access for coach role", async () => {
    await setupCoachAndRender();

    await waitFor(() => {
      expect(screen.getByText(/cette page est réservée aux nageurs/i)).toBeInTheDocument();
    });
  });

  it("restricts access for admin role", async () => {
    await setupAdminAndRender();

    await waitFor(() => {
      expect(screen.getByText(/cette page est réservée aux nageurs/i)).toBeInTheDocument();
    });
  });
});
