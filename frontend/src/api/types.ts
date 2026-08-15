export type UserRole = "super_admin" | "admin" | "manager" | "telecaller";
export type LeadSource = "manual" | "indiamart" | "tradeindia" | "website" | "referral";
export type LeadStatus = "new" | "follow_up" | "not_picked" | "converted" | "lost";
export type LeadCategory = "pharmaceutical" | "ayurvedic" | "homeopathic" | "nutraceutical" | "generic" | "other";

export interface ProductOut {
  id: string;
  name: string;
  sku: string | null;
  created_at: string;
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
  drug_license_number: string | null;
  specialty: string | null;
  product_id: string | null;
  product_name: string | null;
  credit_limit: number | null;
  outstanding_amount: number | null;
  dnd: boolean;
}

export interface PaginatedLeads {
  items: LeadOut[];
  total: number;
  page: number;
  page_size: number;
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
  product_id: string | null;
  product_name: string | null;
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

export interface ProductBreakdown {
  product_id: string;
  product_name: string;
  orders_count: number;
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
  product_breakdown: ProductBreakdown[];
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
