/**
 * E2E tests – Dashboard: affichage séances
 *
 * Covers:
 *  1. Renders the calendar with weekday headers
 *  2. Displays the current month label in French
 *  3. Navigates between months
 *  4. Renders day cells with session indicators
 *  5. Shows the km counter header
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../helpers";

// ---------------------------------------------------------------------------
// Time helpers
// ---------------------------------------------------------------------------
const now = new Date();
const isoToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

// ---------------------------------------------------------------------------
// Hoisted mocks
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

vi.mock("@/lib/api", () => ({
  api: {
    getSessions: vi.fn().mockResolvedValue([
      {
        id: 1,
        athlete_name: "Alice Nageur",
        athlete_id: 42,
        date: isoToday,
        slot: "AM",
        effort: 3,
        feeling: 4,
        performance: 3,
        engagement: 4,
        fatigue: 2,
        distance: 4500,
        duration: 90,
        comments: "Bonne séance",
        created_at: new Date().toISOString(),
      },
    ]),
    getAssignments: vi.fn().mockResolvedValue([
      {
        id: 101,
        session_type: "swim",
        title: "Endurance aérobie",
        description: "Séance matin",
        assigned_date: isoToday,
        status: "pending",
        slot: "AM",
        session_id: 1,
        distance_meters: 4500,
      },
      {
        id: 102,
        session_type: "swim",
        title: "Vitesse lactique",
        description: "Séance soir",
        assigned_date: isoToday,
        status: "pending",
        slot: "PM",
        session_id: 2,
        distance_meters: 3000,
      },
    ]),
    syncSession: vi.fn().mockResolvedValue({ id: 1 }),
    updateSession: vi.fn().mockResolvedValue({ id: 1 }),
    deleteSession: vi.fn().mockResolvedValue({}),
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
  const Dashboard = (await import("@/pages/Dashboard")).default;
  return renderWithProviders(<Dashboard />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("Dashboard – affichage séances", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the calendar header with 'Suivi'", async () => {
    await setupAndRender();

    await waitFor(() => {
      expect(screen.getAllByText("Suivi").length).toBeGreaterThan(0);
    });
  });

  it("displays weekday headers (L, M, J, V, S, D)", async () => {
    await setupAndRender();

    const days = ["L", "M", "J", "V", "S", "D"];
    for (const day of days) {
      const matching = screen.getAllByText(day);
      expect(matching.length).toBeGreaterThan(0);
    }
  });

  it("shows the current month label in French", async () => {
    await setupAndRender();

    const monthLabel = now.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

    await waitFor(() => {
      expect(screen.getByText(new RegExp(monthLabel, "i"))).toBeInTheDocument();
    });
  });

  it("renders calendar day cells with aria labels", async () => {
    await setupAndRender();

    await waitFor(() => {
      const dayButtons = screen.getAllByRole("button", { name: new RegExp(isoToday) });
      expect(dayButtons.length).toBeGreaterThan(0);
    });
  });

  it("navigates to the previous month", async () => {
    const user = userEvent.setup();
    await setupAndRender();

    const prevButton = screen.getByRole("button", { name: /mois précédent/i });
    await user.click(prevButton);

    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevLabel = prevMonth.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

    await waitFor(() => {
      expect(screen.getByText(new RegExp(prevLabel, "i"))).toBeInTheDocument();
    });
  });

  it("navigates to the next month", async () => {
    const user = userEvent.setup();
    await setupAndRender();

    const nextButton = screen.getByRole("button", { name: /mois suivant/i });
    await user.click(nextButton);

    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const nextLabel = nextMonth.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

    await waitFor(() => {
      expect(screen.getByText(new RegExp(nextLabel, "i"))).toBeInTheDocument();
    });
  });

  it("displays km counter in the header", async () => {
    await setupAndRender();

    await waitFor(() => {
      const kmElements = screen.getAllByText(/km/i);
      expect(kmElements.length).toBeGreaterThan(0);
    });
  });

  it("has Settings and Info icon buttons", async () => {
    await setupAndRender();

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /paramètres/i }).length).toBeGreaterThan(0);
      expect(screen.getAllByRole("button", { name: /infos/i }).length).toBeGreaterThan(0);
    });
  });

  it("returns to today after navigating away", async () => {
    const user = userEvent.setup();
    await setupAndRender();

    const prevButton = screen.getByRole("button", { name: /mois précédent/i });
    await user.click(prevButton);

    const todayButton = screen.getByRole("button", { name: /aller à aujourd/i });
    await user.click(todayButton);

    const currentMonthLabel = now.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
    await waitFor(() => {
      // Month label may appear multiple times (mobile + desktop header)
      const matches = screen.getAllByText(new RegExp(currentMonthLabel, "i"));
      expect(matches.length).toBeGreaterThan(0);
    });
  });
});
