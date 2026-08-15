import { apiClient } from "./client";
import type {
  AnalyticsResponse,
  BulkImportResult,
  CallLogOut,
  DashboardResponse,
  DuplicateLeadMatch,
  LeadCategory,
  LeadOut,
  LeadSource,
  LeadStatus,
  MyOrganization,
  OrganizationOut,
  PaginatedFollowUps,
  PaginatedLeads,
  PlatformStats,
  ProductOut,
  TeamMemberOut,
  UserOut,
  UserRole,
} from "./types";

export interface TokenPair {
  access_token: string;
  refresh_token: string;
}

export const authApi = {
  login: (phone: string, password: string) =>
    apiClient
      .post<{ tokens: TokenPair; user: UserOut; organization_name: string | null }>("/auth/login", { phone, password })
      .then((r) => r.data),
  me: () => apiClient.get<UserOut>("/auth/me").then((r) => r.data),
  impersonationStatus: () =>
    apiClient
      .get<{ is_impersonating: boolean; impersonated_by_name: string | null }>("/auth/impersonation-status")
      .then((r) => r.data),
  changePassword: (current_password: string, new_password: string) =>
    apiClient.post("/auth/change-password", { current_password, new_password }).then((r) => r.data),
};

export const organizationApi = {
  get: () => apiClient.get<MyOrganization>("/organization").then((r) => r.data),
  update: (name: string) => apiClient.patch<MyOrganization>("/organization", { name }).then((r) => r.data),
};

export const usersApi = {
  list: () => apiClient.get<TeamMemberOut[]>("/users").then((r) => r.data),
  create: (payload: {
    name: string;
    phone: string;
    email?: string;
    role: UserRole;
    password?: string;
    state?: string | null;
    city?: string | null;
  }) => apiClient.post<TeamMemberOut>("/users", payload).then((r) => r.data),
  update: (
    id: string,
    payload: Partial<{
      name: string;
      email: string;
      role: UserRole;
      is_active: boolean;
      state: string | null;
      city: string | null;
    }>
  ) => apiClient.patch<TeamMemberOut>(`/users/${id}`, payload).then((r) => r.data),
  remove: (id: string) => apiClient.delete(`/users/${id}`).then((r) => r.data),
};

export interface LeadFilters {
  source?: LeadSource;
  status?: LeadStatus;
  assigned_to?: string;
  category?: LeadCategory;
  state?: string;
  city?: string;
  dnd?: boolean;
  q?: string;
  has_callback?: boolean;
  overdue_only?: boolean;
  page?: number;
  page_size?: number;
}

export interface LeadCreatePayload {
  name: string;
  phone: string;
  city?: string;
  state?: string;
  source: LeadSource;
  notes?: string;
  category: LeadCategory;
  drug_license_number?: string;
  specialty?: string;
  product_id?: string | null;
  credit_limit?: number | null;
  outstanding_amount?: number | null;
  dnd?: boolean;
}

export const leadsApi = {
  list: (filters: LeadFilters) => apiClient.get<PaginatedLeads>("/leads", { params: filters }).then((r) => r.data),
  get: (id: string) => apiClient.get<LeadOut>(`/leads/${id}`).then((r) => r.data),
  create: (payload: LeadCreatePayload) => apiClient.post<LeadOut>("/leads", payload).then((r) => r.data),
  update: (id: string, payload: Partial<LeadOut>) => apiClient.patch<LeadOut>(`/leads/${id}`, payload).then((r) => r.data),
  reassign: (id: string, assigned_to: string | null) =>
    apiClient.post<LeadOut>(`/leads/${id}/reassign`, { assigned_to }).then((r) => r.data),
  bulkImport: (source: LeadSource, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return apiClient
      .post<BulkImportResult>(`/leads/bulk-import?source=${source}`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data);
  },
  clearAll: () => apiClient.delete("/leads").then((r) => r.data),
  remove: (id: string) => apiClient.delete(`/leads/${id}`).then((r) => r.data),
  checkDuplicate: (phone: string) =>
    apiClient.get<DuplicateLeadMatch[]>("/leads/check-duplicate", { params: { phone } }).then((r) => r.data),
  usedCategories: () => apiClient.get<LeadCategory[]>("/leads/categories").then((r) => r.data),
  usedCities: () => apiClient.get<string[]>("/leads/cities").then((r) => r.data),
  exportCsv: (filters: Omit<LeadFilters, "page" | "page_size">) =>
    apiClient
      .get("/leads/export", { params: filters, responseType: "blob" })
      .then((r) => r.data as Blob),
};

export const callsApi = {
  log: (
    leadId: string,
    payload: {
      duration_minutes: number;
      outcome: LeadStatus;
      notes?: string;
      order_value?: number | null;
      product_id?: string | null;
      next_follow_up_at?: string | null;
    }
  ) => apiClient.post<CallLogOut>(`/leads/${leadId}/calls`, payload).then((r) => r.data),
  history: (leadId: string) => apiClient.get<CallLogOut[]>(`/leads/${leadId}/calls`).then((r) => r.data),
};

export interface FollowUpFilters {
  telecaller_id?: string;
  outcome?: LeadStatus;
  q?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  page_size?: number;
}

export const followUpsApi = {
  list: (filters: FollowUpFilters) =>
    apiClient.get<PaginatedFollowUps>("/follow-ups", { params: filters }).then((r) => r.data),
};

export const analyticsApi = {
  dashboard: () => apiClient.get<DashboardResponse>("/dashboard").then((r) => r.data),
  analytics: (range: "today" | "7d" | "all", assigneeId?: string) =>
    apiClient
      .get<AnalyticsResponse>("/analytics", { params: { range, assignee_id: assigneeId || undefined } })
      .then((r) => r.data),
};

export const productsApi = {
  list: () => apiClient.get<ProductOut[]>("/products").then((r) => r.data),
  create: (payload: { name: string; sku?: string }) => apiClient.post<ProductOut>("/products", payload).then((r) => r.data),
  update: (id: string, payload: Partial<{ name: string; sku: string }>) =>
    apiClient.patch<ProductOut>(`/products/${id}`, payload).then((r) => r.data),
  remove: (id: string) => apiClient.delete(`/products/${id}`).then((r) => r.data),
};

export const superAdminApi = {
  listOrganizations: () => apiClient.get<OrganizationOut[]>("/super-admin/organizations").then((r) => r.data),
  createOrganization: (payload: {
    name: string;
    admin_name: string;
    admin_phone: string;
    admin_email?: string;
    admin_password: string;
  }) => apiClient.post<OrganizationOut>("/super-admin/organizations", payload).then((r) => r.data),
  suspend: (id: string) => apiClient.post<OrganizationOut>(`/super-admin/organizations/${id}/suspend`).then((r) => r.data),
  reactivate: (id: string) =>
    apiClient.post<OrganizationOut>(`/super-admin/organizations/${id}/reactivate`).then((r) => r.data),
  stats: () => apiClient.get<PlatformStats>("/super-admin/stats").then((r) => r.data),
  impersonate: (organizationId: string) =>
    apiClient.post<TokenPair>("/super-admin/impersonate", { organization_id: organizationId }).then((r) => r.data),
};
