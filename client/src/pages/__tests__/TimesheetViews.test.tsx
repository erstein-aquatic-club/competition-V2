import React from "react";
import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Administratif from "@/pages/Administratif";
import Comite from "@/pages/Comite";
import { useAuth } from "@/lib/auth";

const setAuthRole = (role: string | null) => {
  useAuth.setState({ role, userId: role ? 7 : null, user: role ? "Utilisateur" : null });
};

test("Administratif renders totals for coach shifts", () => {
  setAuthRole("coach");
  const queryClient = new QueryClient();
  queryClient.setQueryData(["timesheet-shifts", 7], [
    {
      id: 1,
      coach_id: 7,
      shift_date: "2024-05-13",
      start_time: "2024-05-13T08:00:00",
      end_time: "2024-05-13T10:00:00",
      location: "Piscine",
      is_travel: false,
    },
    {
      id: 2,
      coach_id: 7,
      shift_date: "2024-05-14",
      start_time: "2024-05-14T11:00:00",
      end_time: "2024-05-14T11:30:00",
      location: "Route",
      is_travel: true,
    },
  ]);

  const markup = renderToStaticMarkup(
    <QueryClientProvider client={queryClient}>
      <Administratif params={{}} />
    </QueryClientProvider>,
  );

  assert.ok(markup.includes("Heures aujourd&#x27;hui"));
});

test("Administratif switches between dashboard and shifts views", () => {
  setAuthRole("coach");
  const queryClient = new QueryClient();

  const pointageMarkup = renderToStaticMarkup(
    <QueryClientProvider client={queryClient}>
      <Administratif params={{}} />
    </QueryClientProvider>,
  );
  const dashboardMarkup = renderToStaticMarkup(
    <QueryClientProvider client={queryClient}>
      <Administratif initialTab="DASHBOARD" params={{}} />
    </QueryClientProvider>,
  );

  assert.ok(pointageMarkup.includes("Heures aujourd&#x27;hui"));
  assert.ok(dashboardMarkup.includes("Dashboard KPI"));
  assert.ok(!dashboardMarkup.includes("Heures aujourd&#x27;hui"));
});

test("Administratif highlights ongoing shifts", () => {
  setAuthRole("coach");
  const queryClient = new QueryClient();
  queryClient.setQueryData(["timesheet-shifts", 7], [
    {
      id: 3,
      coach_id: 7,
      shift_date: "2024-05-15",
      start_time: "2024-05-15T09:00:00",
      end_time: null,
      location: "Bureau",
      is_travel: false,
    },
  ]);

  const markup = renderToStaticMarkup(
    <QueryClientProvider client={queryClient}>
      <Administratif params={{}} />
    </QueryClientProvider>,
  );

  assert.ok(markup.includes("En cours"));
});

test("Administratif is hidden for athlete role", () => {
  setAuthRole("athlete");
  const queryClient = new QueryClient();

  const markup = renderToStaticMarkup(
    <QueryClientProvider client={queryClient}>
      <Administratif params={{}} />
    </QueryClientProvider>,
  );

  assert.ok(!markup.includes("Nouveau shift"));
});

test("Comite is hidden for coach role", () => {
  setAuthRole("coach");
  const queryClient = new QueryClient();

  const markup = renderToStaticMarkup(
    <QueryClientProvider client={queryClient}>
      <Comite />
    </QueryClientProvider>,
  );

  assert.ok(!markup.includes("Tableau de bord shifts"));
});

test("Comite renders filter for committee", () => {
  setAuthRole("comite");
  const queryClient = new QueryClient();
  queryClient.setQueryData(["timesheet-coaches"], [
    { id: 7, display_name: "Coach Martin" },
    { id: 8, display_name: "Coach Léa" },
  ]);
  queryClient.setQueryData(["timesheet-shifts", "all"], []);

  const markup = renderToStaticMarkup(
    <QueryClientProvider client={queryClient}>
      <Comite />
    </QueryClientProvider>,
  );

  assert.ok(markup.includes("Filtrer par coach"));
  assert.ok(markup.includes("Trajet uniquement"));
});
