// API Types - All TypeScript interfaces for the API layer

export type StrokeDistances = {
  NL?: number;
  DOS?: number;
  BR?: number;
  PAP?: number;
  QN?: number;
};

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
  stroke_distances?: StrokeDistances | null;
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
  folder_id?: number | null;
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
  folder_id?: number | null;
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

export interface StrengthFolder {
  id: number;
  name: string;
  type: 'session' | 'exercise';
  sort_order: number;
}

export interface SwimSessionTemplate {
  id: number;
  name: string;
  description?: string | null;
  created_by?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
  folder?: string | null;
  is_archived?: boolean;
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
  email?: string | null;
  group_id?: number | null;
  group_label?: string | null;
  ffn_iuf?: string | null;
}

export interface GroupSummary {
  id: number;
  name: string;
  member_count?: number | null;
  is_temporary?: boolean;
  is_active?: boolean;
  parent_group_id?: number | null;
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
  swimmer_iuf?: string | null;
  sex: string;
  pool_m: number;
  event_code: string;
  event_label?: string | null;
  age: number;
  original_age?: number | null; // Original age before cascade
  time_ms: number;
  record_date?: string | null;
}

export interface ClubPerformanceRanked {
  id: number;
  athlete_name: string;
  swimmer_iuf?: string | null;
  sex: string;
  pool_m: number;
  event_code: string;
  event_label?: string | null;
  age: number;
  actual_age?: number | null;
  time_ms: number;
  record_date?: string | null;
  source?: string | null;
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
  stroke_distances?: StrokeDistances | null;
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

export interface SwimmerPerformance {
  id: number;
  user_id?: number | null;
  swimmer_iuf: string;
  event_code: string;
  pool_length: number;
  time_seconds: number;
  time_display?: string | null;
  competition_name?: string | null;
  competition_date?: string | null;
  competition_location?: string | null;
  ffn_points?: number | null;
  source: string;
  imported_at?: string | null;
}

export interface SplitTimeEntry {
  rep: number;
  time_seconds: number;
}

export interface StrokeCountEntry {
  rep: number;
  count: number;
}

export interface SwimExerciseLog {
  id: string;
  session_id: number;
  user_id: string;
  exercise_label: string;
  source_item_id: number | null;
  split_times: SplitTimeEntry[];
  tempo: number | null;
  stroke_count: StrokeCountEntry[];
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SwimExerciseLogInput {
  exercise_label: string;
  source_item_id?: number | null;
  split_times?: SplitTimeEntry[];
  tempo?: number | null;
  stroke_count?: StrokeCountEntry[];
  notes?: string | null;
}

export interface CoachAssignment {
  id: number;
  title: string;
  type: "swim" | "strength";
  scheduledDate: string;        // ISO date "YYYY-MM-DD"
  scheduledSlot: "morning" | "evening" | null;
  targetLabel: string;           // Group name or swimmer name
  targetType: "group" | "user";
  status: string;
}

export interface TemporaryGroupSummary {
  id: number;
  name: string;
  is_active: boolean;
  parent_group_id: number | null;
  member_count: number;
  subgroup_count: number;
  created_at: string;
  created_by: number;
}

export interface TemporaryGroupMember {
  user_id: number;
  display_name: string;
  permanent_group_label: string | null;
}

export interface TemporaryGroupDetail {
  id: number;
  name: string;
  is_active: boolean;
  members: TemporaryGroupMember[];
  subgroups: Array<{
    id: number;
    name: string;
    members: Array<{ user_id: number; display_name: string }>;
  }>;
}

export interface Competition {
  id: string;
  name: string;
  date: string;
  end_date?: string | null;
  location?: string | null;
  description?: string | null;
  created_by?: string | null;
  created_at?: string | null;
}

export interface CompetitionInput {
  name: string;
  date: string;
  end_date?: string | null;
  location?: string | null;
  description?: string | null;
}

export interface Objective {
  id: string;
  athlete_id: string;
  competition_id?: string | null;
  event_code?: string | null;
  pool_length?: number | null;
  target_time_seconds?: number | null;
  text?: string | null;
  created_by?: string | null;
  created_at?: string | null;
  competition_name?: string | null;
  competition_date?: string | null;
  athlete_name?: string | null;
}

export interface ObjectiveInput {
  athlete_id: string;
  competition_id?: string | null;
  event_code?: string | null;
  pool_length?: number | null;
  target_time_seconds?: number | null;
  text?: string | null;
}
