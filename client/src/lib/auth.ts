
import { create } from "zustand";
import { syncConfig } from "./config";

const ACCESS_TOKEN_KEY = "swim_access_token";
const REFRESH_TOKEN_KEY = "swim_refresh_token";
const USER_KEY = "swimmer_user";
const USER_ID_KEY = "swimmer_user_id";
const USER_ROLE_KEY = "swimmer_user_role";
const COACH_SELECTED_ATHLETE_ID_KEY = "coach_selected_athlete_id";
const COACH_SELECTED_ATHLETE_NAME_KEY = "coach_selected_athlete_name";

const readStorageValue = (key: string) => {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch (error) {
    console.warn(`[auth] Unable to read ${key} from storage`, error);
    return null;
  }
};

const readStoredUserId = () => {
  const raw = readStorageValue(USER_ID_KEY);
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
};

const readStoredUserRole = () => {
  const raw = readStorageValue(USER_ROLE_KEY);
  return raw || null;
};

const readStoredSelectedAthleteId = () => {
  const raw = readStorageValue(COACH_SELECTED_ATHLETE_ID_KEY);
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
};

const readStoredSelectedAthleteName = () => {
  const raw = readStorageValue(COACH_SELECTED_ATHLETE_NAME_KEY);
  return raw || null;
};

const setStorageValue = (key: string, value: string | null) => {
  if (typeof window === "undefined") return;
  try {
    if (value === null) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, value);
    }
  } catch (error) {
    console.warn(`[auth] Unable to update ${key} in storage`, error);
  }
};

const clearStoredSession = () => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(USER_KEY);
  window.localStorage.removeItem(USER_ID_KEY);
  window.localStorage.removeItem(USER_ROLE_KEY);
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  window.localStorage.removeItem(COACH_SELECTED_ATHLETE_ID_KEY);
  window.localStorage.removeItem(COACH_SELECTED_ATHLETE_NAME_KEY);
};

const parseUserName = (user: any, fallback = "") => {
  const displayName = String(user?.display_name || user?.displayName || "").trim();
  if (displayName) return displayName;
  const email = String(user?.email || "").trim();
  return email || fallback;
};

export const getStoredAccessToken = () => readStorageValue(ACCESS_TOKEN_KEY) ?? "";
export const getStoredRefreshToken = () => readStorageValue(REFRESH_TOKEN_KEY) ?? "";

const safeJsonParse = (text: string) => {
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch (error) {
    console.warn("[auth] Unable to parse auth response", error);
    return {};
  }
};

const requestAuthMe = async (token: string) => {
  if (!syncConfig.endpoint) {
    return { ok: false, status: 0, error: "Endpoint d'authentification non configuré." };
  }
  const url = new URL(syncConfig.endpoint);
  url.searchParams.set("action", "auth_me");
  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const text = await res.text();
    const payload = safeJsonParse(text);
    if (!res.ok || payload?.ok !== true) {
      return { ok: false, status: res.status, error: payload?.error || `Erreur ${res.status}` };
    }
    return { ok: true, status: res.status, user: payload?.data?.user ?? payload?.user };
  } catch (error) {
    console.warn("[auth] Auth request failed", error);
    return { ok: false, status: 0, error: "Erreur réseau lors de l'authentification." };
  }
};

export const refreshStoredAccessToken = async () => {
  const refreshToken = getStoredRefreshToken();
  if (!syncConfig.endpoint || !refreshToken) return null;
  const url = new URL(syncConfig.endpoint);
  url.searchParams.set("action", "auth_refresh");
  try {
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    const text = await res.text();
    const payload = safeJsonParse(text);
    if (!res.ok || payload?.ok !== true) return null;
    const accessToken = payload?.data?.access_token;
    if (!accessToken) return null;
    setStorageValue(ACCESS_TOKEN_KEY, accessToken);
    useAuth.getState().updateAccessToken(accessToken);
    return accessToken;
  } catch (error) {
    console.warn("[auth] Token refresh failed", error);
    return null;
  }
};

interface AuthState {
  user: string | null;
  userId: number | null;
  role: string | null;
  selectedAthleteId: number | null;
  selectedAthleteName: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  login: (payload: {
    user: string;
    accessToken: string;
    refreshToken: string;
    userId?: number | null;
    role?: string | null;
  }) => void;
  logout: () => void;
  updateAccessToken: (token: string) => void;
  setSelectedAthlete: (athlete: { id: number | null; name: string | null } | null) => void;
  loadUser: () => Promise<string | null>;
}

export const useAuth = create<AuthState>((set) => ({
  user: readStorageValue(USER_KEY),
  userId: readStoredUserId(),
  role: readStoredUserRole(),
  selectedAthleteId: readStoredSelectedAthleteId(),
  selectedAthleteName: readStoredSelectedAthleteName(),
  accessToken: readStorageValue(ACCESS_TOKEN_KEY),
  refreshToken: readStorageValue(REFRESH_TOKEN_KEY),

  login: ({ user, accessToken, refreshToken, userId, role }) => {
    setStorageValue(USER_KEY, user);
    setStorageValue(ACCESS_TOKEN_KEY, accessToken);
    setStorageValue(REFRESH_TOKEN_KEY, refreshToken);
    setStorageValue(USER_ID_KEY, userId !== null && userId !== undefined ? String(userId) : null);
    setStorageValue(USER_ROLE_KEY, role ?? null);
    set({ user, accessToken, refreshToken, userId: userId ?? null, role: role ?? null });
  },

  logout: () => {
    clearStoredSession();
    set({ user: null, userId: null, role: null, accessToken: null, refreshToken: null });
  },

  updateAccessToken: (token: string) => {
    setStorageValue(ACCESS_TOKEN_KEY, token);
    set({ accessToken: token });
  },

  setSelectedAthlete: (athlete) => {
    if (!athlete) {
      setStorageValue(COACH_SELECTED_ATHLETE_ID_KEY, null);
      setStorageValue(COACH_SELECTED_ATHLETE_NAME_KEY, null);
      set({ selectedAthleteId: null, selectedAthleteName: null });
      return;
    }
    setStorageValue(
      COACH_SELECTED_ATHLETE_ID_KEY,
      athlete.id !== null && athlete.id !== undefined ? String(athlete.id) : null,
    );
    setStorageValue(COACH_SELECTED_ATHLETE_NAME_KEY, athlete.name ?? null);
    set({ selectedAthleteId: athlete.id ?? null, selectedAthleteName: athlete.name ?? null });
  },

  loadUser: async () => {
    const accessToken = getStoredAccessToken();
    if (!syncConfig.endpoint || !accessToken) return null;
    let result = await requestAuthMe(accessToken);
    if (!result.ok && result.status === 401) {
      const refreshed = await refreshStoredAccessToken();
      if (refreshed) {
        result = await requestAuthMe(refreshed);
      }
    }
    if (!result.ok) {
      clearStoredSession();
      set({ user: null, userId: null, role: null, accessToken: null, refreshToken: null });
      return null;
    }
    const name = parseUserName(result.user, readStorageValue(USER_KEY) ?? "");
    const rawUserId = Number(result.user?.id);
    const userId = Number.isFinite(rawUserId) ? rawUserId : null;
    const role = result.user?.role ? String(result.user.role) : null;
    setStorageValue(USER_KEY, name);
    setStorageValue(USER_ID_KEY, userId !== null ? String(userId) : null);
    setStorageValue(USER_ROLE_KEY, role);
    set({ user: name, userId, role });
    return name;
  },
}));
