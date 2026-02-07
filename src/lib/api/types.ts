// API Types - All TypeScript interfaces for the API layer

export interface Session {
  id: number;
  athlete_id?: number;
  athlete_name: string;
  date: string;
  slot: string;
  effort: number;
  feeling: number;
  rpe?: number | null;
  performance?: number | null;
  engagement?: number | null;
  fatigue?: number | null;
  distance: number;
  duration: number;
  comments: string;
  created_at: string;
}

export interface Exercise {
  id: number;
  name?: string;
  numero_exercice?: number | null;
  nom_exercice: string;
  description?: string | null;
  illustration_gif?: string | null;
  exercise_type: "strength" | "warmup";
  warmup_reps?: number | null;
  warmup_duration?: number | null;
  Nb_series_endurance?: number | null;
  Nb_reps_endurance?: number | null;
  pct_1rm_endurance?: number | null;
  recup_endurance?: number | null;
  recup_exercices_endurance?: number | null;
  Nb_series_hypertrophie?: number | null;
  Nb_reps_hypertrophie?: number | null;
  pct_1rm_hypertrophie?: number | null;
  recup_hypertrophie?: number | null;
  recup_exercices_hypertrophie?: number | null;
  Nb_series_force?: number | null;
  Nb_reps_force?: number | null;
  pct_1rm_force?: number | null;
  recup_force?: number | null;
  recup_exercices_force?: number | null;
}

export type StrengthCycleType = "endurance" | "hypertrophie" | "force";

export interface StrengthSessionTemplate {
  id: number;
  title: string;
  name?: string;
  description: string;
  cycle: StrengthCycleType;
  cycle_type?: StrengthCycleType | null;
  items?: StrengthSessionItem[];
}

export interface StrengthSessionItem {
  exercise_id: number;
  order_index: number;
  sets: number;
  reps: number;
  rest_seconds: number;
  percent_1rm: number;
  cycle_type?: StrengthCycleType | null;
  notes?: string;
  exercise_name?: string;
  category?: string;
}

export interface SwimSessionTemplate {
  id: number;
  name: string;
  description?: string | null;
  created_by?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
  items?: SwimSessionItem[];
}

export interface SwimSessionItem {
  id?: number;
  catalog_id?: number;
  ordre?: number;
  label?: string | null;
  distance?: number | null;
  duration?: number | null;
  intensity?: string | null;
  notes?: string | null;
  raw_payload?: Record<string, unknown> | null;
}

export interface Assignment {
  id: number;
  session_id: number;
  session_type: "swim" | "strength";
  title: string;
  description: string;
  assigned_date: string;
  status: string;
  items?: StrengthSessionItem[] | SwimSessionItem[];
  cycle?: string;
}

export interface Notification {
  id: number;
  target_id?: number;
  target_user_id?: number | null;
  target_group_id?: number | null;
  target_group_name?: string | null;
  sender_id?: number | null;
  sender_email?: string | null;
  sender_name?: string | null;
  sender_role?: string | null;
  counterparty_id?: number | null;
  counterparty_name?: string | null;
  counterparty_role?: string | null;
  sender: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  date: string;
  related_id?: number;
}

export interface UserProfile {
  id?: number | null;
  display_name?: string;
  email?: string | null;
  birthdate?: string | null;
  group_id?: number | null;
  group_label?: string | null;
  objectives?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  ffn_iuf?: string | null;
}

export interface AthleteSummary {
  id: number | null;
  display_name: string;
  group_label?: string | null;
}

export interface GroupSummary {
  id: number;
  name: string;
  member_count?: number | null;
}

export interface UpcomingBirthday {
  id: number;
  display_name: string;
  birthdate: string;
  next_birthday: string;
  days_until: number;
}

export interface UserSummary {
  id: number;
  display_name: string;
  role: string;
  email?: string | null;
  is_active?: number | boolean;
  group_label?: string | null;
}

export interface SwimRecord {
  id: number;
  athlete_id: number;
  athlete_name?: string | null;
  event_name: string;
  pool_length?: number | null;
  time_seconds?: number | null;
  record_date?: string | null;
  notes?: string | null;
  record_type?: string | null;
  ffn_points?: number | null;
  points?: number | null;
}

export interface ClubRecord {
  id: number;
  performance_id: number;
  athlete_name: string;
  sex: string;
  pool_m: number;
  event_code: string;
  event_label?: string | null;
  age: number;
  time_ms: number;
  record_date?: string | null;
}

export interface ClubRecordSwimmer {
  id: number | null;
  source_type: "user" | "manual";
  user_id?: number | null;
  display_name: string;
  iuf?: string | null;
  sex?: "M" | "F" | null;
  birthdate?: string | null;
  is_active: number;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface TimesheetShift {
  id: number;
  coach_id: number;
  coach_name?: string | null;
  shift_date: string;
  start_time: string;
  end_time?: string | null;
  location?: string | null;
  is_travel: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface TimesheetLocation {
  id: number;
  name: string;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface FeatureCapability {
  available: boolean;
  missingTables?: string[];
}

export interface ApiCapabilities {
  version?: string | null;
  timesheet: FeatureCapability;
  messaging: FeatureCapability;
  mode: "supabase" | "local";
}

export interface ApiErrorInfo {
  message: string;
  code?: string;
  status?: number;
}

export interface SyncSessionInput {
  athlete_name: string;
  date: string;
  slot: string;
  effort: number;
  feeling: number;
  rpe?: number | null;
  performance?: number | null;
  engagement?: number | null;
  fatigue?: number | null;
  distance: number;
  duration: number;
  comments: string;
}

export interface StrengthRunPayload {
  sessionId: number;
  startedAt: string;
  athleteId?: number | string | null;
  athleteName?: string | null;
  cycle?: StrengthCycleType | null;
}

export interface StrengthSetPayload {
  runId: number;
  exerciseId: number;
  setIndex: number;
  reps: number;
  weight: number;
  notes?: string | null;
  athleteId?: number | string | null;
  athleteName?: string | null;
}
