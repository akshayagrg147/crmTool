export type UserRole = "super_admin" | "admin" | "manager" | "telecaller";
export type LeadSource = "manual" | "indiamart" | "justdial" | "tradeindia" | "website" | "referral";
export type LeadStatus = "new" | "follow_up" | "not_picked" | "converted" | "lost";
export type LeadCategory = string;

export type IntegrationProvider = "indiamart" | "justdial";
export type IntegrationStatus = "disconnected" | "active" | "error";

export interface CredentialField {
  key: string;
  label: string;
  help: string;
  secret: boolean;
  required: boolean;
}

export interface IntegrationOut {
  provider: IntegrationProvider;
  label: string;
  /** "pull" = we poll them on a timer; "push" = they POST to our webhook. */
  ingestion: "pull" | "push";
  docs_url: string;
  setup_hint: string;
  credential_fields: CredentialField[];
  is_connected: boolean;
  is_enabled: boolean;
  status: IntegrationStatus;
  masked_credentials: Record<string, string>;
  last_synced_at: string | null;
  last_error: string | null;
  total_imported: number;
  total_duplicates: number;
  webhook_url: string | null;
}

export interface SyncResult {
  imported: number;
  duplicates: number;
  invalid: number;
  assignments: Record<string, number>;
  message: string;
}

export interface DuplicateLeadMatch {
  id: string;
  name: string;
  phone: string;
  status: LeadStatus;
  assignee_name: string | null;
}

export interface MyOrganization {
  id: string;
  name: string;
  plan: string;
  created_at: string;
}

export interface BulkImportResult {
  imported: number;
  skipped: number;
  duplicates_skipped: number;
  assignments: Record<string, number>;
  issues: BulkImportIssue[];
  issue_count: number;
  issues_truncated: boolean;
}

export interface BulkImportIssue {
  row: number | null;
  field: string | null;
  code: string;
  message: string;
  severity: "error" | "warning";
  value?: string;
}

export interface UserOut {
  id: string;
  organization_id: string | null;
  name: string;
  phone: string;
  email: string | null;
  role: UserRole;
  is_active: boolean;
}

export interface TeamMemberOut extends UserOut {
  created_at: string;
  active_leads_count: number;
  state: string | null;
  city: string | null;
}

export interface LastCall {
  outcome: LeadStatus;
  duration_minutes: number;
  notes: string | null;
  created_at: string;
}

export interface LeadOut {
  id: string;
  name: string;
  phone: string;
  city: string | null;
  state: string | null;
  source: LeadSource;
  status: LeadStatus;
  assigned_to: string | null;
  assignee_name: string | null;
  notes: string | null;
  created_at: string;
  last_contacted_at: string | null;
  next_follow_up_at: string | null;
  last_call: LastCall | null;
  category: LeadCategory;
  interested_categories: LeadCategory[];
  drug_license_number: string | null;
  specialty: string | null;
  credit_limit: number | null;
  outstanding_amount: number | null;
  dnd: boolean;
}

export interface AssignmentHistoryOut {
  id: string;
  previous_assignee_id: string | null;
  previous_assignee_name: string | null;
  new_assignee_id: string | null;
  new_assignee_name: string | null;
  assigned_by_id: string | null;
  assigned_by_name: string | null;
  action: string;
  source: string;
  created_at: string;
}

export interface LeadCategoryOption {
  value: string;
  label: string;
  is_custom: boolean;
}

export interface PaginatedLeads {
  items: LeadOut[];
  total: number;
  page: number;
  page_size: number;
}

export interface LostDealOut {
  id: string;
  name: string;
  phone: string;
  city: string | null;
  state: string | null;
  source: LeadSource;
  status: "lost";
  category: LeadCategory;
  interested_categories: LeadCategory[];
  assigned_to: string | null;
  assignee_name: string | null;
  lost_by: string | null;
  lost_by_name: string | null;
  lost_reason: string | null;
  lost_at: string | null;
  created_at: string;
}

export interface PaginatedLostDeals {
  items: LostDealOut[];
  total: number;
  page: number;
  page_size: number;
}

export interface BulkDeleteLostDealsResult {
  deleted: number;
}

export interface CallLogOut {
  id: string;
  lead_id: string;
  logged_by: string | null;
  logged_by_name: string | null;
  duration_minutes: number;
  outcome: LeadStatus;
  notes: string | null;
  created_at: string;
  order_value: number | null;
  next_follow_up_at: string | null;
}

export interface FollowUpOut {
  id: string;
  lead_id: string;
  lead_name: string;
  lead_phone: string;
  logged_by: string | null;
  logged_by_name: string | null;
  outcome: LeadStatus;
  notes: string | null;
  duration_minutes: number;
  created_at: string;
  next_follow_up_at: string | null;
}

export interface PaginatedFollowUps {
  items: FollowUpOut[];
  total: number;
  page: number;
  page_size: number;
}

export interface DashboardKPIs {
  total_leads: number;
  total_leads_delta: number;
  assigned: number;
  assigned_delta: number;
  converted: number;
  converted_delta: number;
  talk_time_minutes: number;
  talk_time_delta: number;
  total_order_value: number;
  total_order_value_delta: number;
}

export interface FunnelStage {
  stage: string;
  count: number;
}

export interface FollowUpItem {
  id: string;
  name: string;
  phone: string;
  assignee_name: string | null;
  last_contacted_at: string | null;
  next_follow_up_at: string | null;
  is_overdue: boolean;
}

export interface StaleLeadAlert {
  count: number;
  sample: string[];
}

export interface RecentLead {
  id: string;
  name: string;
  phone: string;
  status: LeadStatus;
  source: LeadSource;
  assignee_name: string | null;
  created_at: string;
}

export interface SourceBreakdown {
  source: LeadSource;
  count: number;
}

export interface DashboardResponse {
  kpis: DashboardKPIs;
  funnel: FunnelStage[];
  follow_ups: FollowUpItem[];
  stale_leads: StaleLeadAlert;
  recent_leads: RecentLead[];
  source_breakdown: SourceBreakdown[];
}

export interface HourlyVolume {
  hour: number;
  calls: number;
}

export interface LeaderboardRow {
  assignee_id: string;
  assignee_name: string;
  talk_time_minutes: number;
  calls: number;
}

export interface OutcomeSlice {
  outcome: LeadStatus;
  count: number;
}

export interface CityBreakdown {
  city: string;
  leads_count: number;
  converted_count: number;
  order_value: number;
}

export interface AnalyticsResponse {
  total_calls: number;
  total_talk_time_minutes: number;
  avg_call_length_minutes: number;
  not_picked_rate: number;
  total_order_value: number;
  avg_order_value: number;
  hourly_volume: HourlyVolume[];
  leaderboard: LeaderboardRow[];
  minutes_per_member: LeaderboardRow[];
  outcomes: OutcomeSlice[];
  city_breakdown: CityBreakdown[];
}

export interface OrganizationOut {
  id: string;
  name: string;
  is_active: boolean;
  plan: string;
  created_at: string;
  user_count: number;
  lead_count: number;
}

export interface PlatformStats {
  total_organizations: number;
  total_users: number;
  total_leads: number;
  active_organizations: number;
  growth: { month: string; organizations: number }[];
}
