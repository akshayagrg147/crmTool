import { apiClient } from "./client";
import type {
  AnalyticsResponse,
  AssignmentHistoryOut,
  BulkImportResult,
  CallLogOut,
  DashboardResponse,
  DuplicateLeadMatch,
  IntegrationOut,
  IntegrationProvider,
  LeadCategory,
  LeadCategoryOption,
  LeadOut,
  MergeLeadResult,
  LeadActivityOut,
  LeadSource,
  LeadStatus,
  BulkDeleteLostDealsResult,
  BulkReassignResult,
  AutoAssignResult,
  PaginatedLostDeals,
  MyOrganization,
  OrganizationOut,
  OrganizationDetailsOut,
  PaginatedFollowUps,
  PaginatedLeads,
  PlatformStats,
  SyncResult,
  TeamMemberOut,
  PaginatedTasks,
  TaskOut,
  TaskPriority,
  TaskStatus,
  TaskType,
  CustomFieldDefinition,
  PipelineStage,
  AutomationRule,
  AuditEvent,
  PaginatedAuditEvents,
  SavedReport,
  BackupRecord,
  LeadNoteOut,
  LeadAttachmentOut,
  UserOut,
  UserRole,
  AttendanceApprovals,
  AttendanceOverview,
  LeaveRequest,
  PayrollSummary,
  PayrollSchedule,
  PayrollScheduleException,
  PayrollTimeEntry,
  TimeEntryCategory,
  TimeEntryStatus,
} from "./types";

export interface TokenPair {
  access_token: string;
  refresh_token: string;
}

export const authApi = {
  login: (phone: string, password: string, countryCode?: string, otp?: string) =>
    apiClient
      .post<{ tokens: TokenPair; user: UserOut; organization_name: string | null; organization_logo_url: string | null }>("/auth/login", {
        phone,
        password,
        country_code: countryCode,
        otp,
      })
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
  managers: () => apiClient.get<TeamMemberOut[]>("/users/managers").then((r) => r.data),
  create: (payload: {
    name: string;
    phone: string;
    email: string;
    role: UserRole;
    password: string;
    state: string;
    city: string;
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
  remove: (id: string, managerId?: string) =>
    apiClient.delete(`/users/${id}`, { params: managerId ? { manager_id: managerId } : undefined }).then((r) => r.data),
  resetPassword: (id: string, newPassword: string) =>
    apiClient.post(`/users/${id}/reset-password`, { new_password: newPassword }).then((r) => r.data),
};

export interface LeadFilters {
  source?: LeadSource;
  status?: LeadStatus;
  assigned_to?: string;
  unassigned_only?: boolean;
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
  interested_categories?: LeadCategory[];
  drug_license_number?: string;
  specialty?: string;
  credit_limit?: number | null;
  outstanding_amount?: number | null;
  dnd?: boolean;
  stage_key?: string;
  custom_fields?: Record<string, unknown>;
}

export const leadsApi = {
  list: (filters: LeadFilters) => apiClient.get<PaginatedLeads>("/leads", { params: filters }).then((r) => r.data),
  get: (id: string) => apiClient.get<LeadOut>(`/leads/${id}`).then((r) => r.data),
  assignmentHistory: (id: string) =>
    apiClient.get<AssignmentHistoryOut[]>(`/leads/${id}/assignment-history`).then((r) => r.data),
  create: (payload: LeadCreatePayload) => apiClient.post<LeadOut>("/leads", payload).then((r) => r.data),
  update: (id: string, payload: Partial<LeadOut>) => apiClient.patch<LeadOut>(`/leads/${id}`, payload).then((r) => r.data),
  reassign: (id: string, assigned_to: string | null) =>
    apiClient.post<LeadOut>(`/leads/${id}/reassign`, { assigned_to }).then((r) => r.data),
  bulkReassign: (lead_ids: string[], assigned_to: string) =>
    apiClient.post<BulkReassignResult>("/leads/bulk-reassign", { lead_ids, assigned_to }).then((r) => r.data),
  autoAssignUnassigned: () =>
    apiClient.post<AutoAssignResult>("/leads/auto-assign-unassigned").then((r) => r.data),
  markLost: (id: string, payload: { manager_id: string; reason: string }) =>
    apiClient.post<LeadOut>(`/leads/${id}/mark-lost`, payload).then((r) => r.data),
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
  merge: (primaryLeadId: string, duplicateLeadId: string) =>
    apiClient
      .post<MergeLeadResult>("/leads/merge", {
        primary_lead_id: primaryLeadId,
        duplicate_lead_id: duplicateLeadId,
      })
      .then((r) => r.data),
  categories: () => apiClient.get<LeadCategoryOption[]>("/leads/categories").then((r) => r.data),
  createCategory: (name: string) =>
    apiClient.post<LeadCategoryOption>("/leads/categories", { name }).then((r) => r.data),
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
      next_follow_up_at?: string | null;
    }
  ) => apiClient.post<CallLogOut>(`/leads/${leadId}/calls`, payload).then((r) => r.data),
  history: (leadId: string) => apiClient.get<CallLogOut[]>(`/leads/${leadId}/calls`).then((r) => r.data),
  activity: (leadId: string) => apiClient.get<LeadActivityOut[]>(`/leads/${leadId}/activity`).then((r) => r.data),
};

export const workspaceApi = {
  customFields: () => apiClient.get<CustomFieldDefinition[]>("/workspace/custom-fields").then((r) => r.data),
  createCustomField: (payload: Omit<CustomFieldDefinition, "id" | "organization_id" | "created_at">) => apiClient.post<CustomFieldDefinition>("/workspace/custom-fields", payload).then((r) => r.data),
  updateCustomField: (id: string, payload: Partial<CustomFieldDefinition>) => apiClient.patch<CustomFieldDefinition>(`/workspace/custom-fields/${id}`, payload).then((r) => r.data),
  deleteCustomField: (id: string) => apiClient.delete(`/workspace/custom-fields/${id}`).then((r) => r.data),
  stages: () => apiClient.get<PipelineStage[]>("/workspace/stages").then((r) => r.data),
  createStage: (payload: Omit<PipelineStage, "id" | "organization_id" | "created_at">) => apiClient.post<PipelineStage>("/workspace/stages", payload).then((r) => r.data),
  updateStage: (id: string, payload: Partial<PipelineStage>) => apiClient.patch<PipelineStage>(`/workspace/stages/${id}`, payload).then((r) => r.data),
  deleteStage: (id: string) => apiClient.delete(`/workspace/stages/${id}`).then((r) => r.data),
  automations: () => apiClient.get<AutomationRule[]>("/workspace/automations").then((r) => r.data),
  createAutomation: (payload: Omit<AutomationRule, "id" | "organization_id" | "created_by" | "created_at" | "updated_at">) => apiClient.post<AutomationRule>("/workspace/automations", payload).then((r) => r.data),
  updateAutomation: (id: string, payload: Partial<AutomationRule>) => apiClient.patch<AutomationRule>(`/workspace/automations/${id}`, payload).then((r) => r.data),
  deleteAutomation: (id: string) => apiClient.delete(`/workspace/automations/${id}`).then((r) => r.data),
  audit: (params: { page?: number; page_size?: number; entity_type?: string }) => apiClient.get<PaginatedAuditEvents>("/workspace/audit", { params }).then((r) => r.data),
  auditExport: () => apiClient.get<Blob>("/workspace/audit/export", { responseType: "blob" }).then((r) => r.data),
  reports: () => apiClient.get<SavedReport[]>("/workspace/reports").then((r) => r.data),
  createReport: (payload: { name: string; report_type: "leads" | "analytics"; filters: Record<string, unknown> }) => apiClient.post<SavedReport>("/workspace/reports", payload).then((r) => r.data),
  deleteReport: (id: string) => apiClient.delete(`/workspace/reports/${id}`).then((r) => r.data),
  backups: () => apiClient.get<BackupRecord[]>("/workspace/backups").then((r) => r.data),
  createBackup: () => apiClient.post<BackupRecord>("/workspace/backups").then((r) => r.data),
  downloadBackup: (id: string) => apiClient.get<Blob>(`/workspace/backups/${id}/download`, { responseType: "blob" }).then((r) => r.data),
  exportWorkspace: () => apiClient.get<Blob>("/workspace/export", { responseType: "blob" }).then((r) => r.data),
};

export const notesApi = {
  list: (leadId: string) => apiClient.get<LeadNoteOut[]>(`/leads/${leadId}/notes`).then((r) => r.data),
  create: (leadId: string, payload: { body: string; pinned?: boolean }) => apiClient.post<LeadNoteOut>(`/leads/${leadId}/notes`, payload).then((r) => r.data),
  update: (leadId: string, noteId: string, payload: { body?: string; pinned?: boolean }) => apiClient.patch<LeadNoteOut>(`/leads/${leadId}/notes/${noteId}`, payload).then((r) => r.data),
  remove: (leadId: string, noteId: string) => apiClient.delete(`/leads/${leadId}/notes/${noteId}`).then((r) => r.data),
  attachments: (leadId: string) => apiClient.get<LeadAttachmentOut[]>(`/leads/${leadId}/attachments`).then((r) => r.data),
  upload: (leadId: string, file: File) => { const form = new FormData(); form.append("file", file); return apiClient.post<LeadAttachmentOut>(`/leads/${leadId}/attachments`, form, { headers: { "Content-Type": "multipart/form-data" } }).then((r) => r.data); },
  download: (leadId: string, attachmentId: string) => apiClient.get<Blob>(`/leads/${leadId}/attachments/${attachmentId}/download`, { responseType: "blob" }).then((r) => r.data),
  removeAttachment: (leadId: string, attachmentId: string) => apiClient.delete(`/leads/${leadId}/attachments/${attachmentId}`).then((r) => r.data),
};

export const securityApi = {
  twoFactorStatus: () => apiClient.get<{ enabled: boolean }>("/security/2fa").then((r) => r.data),
  twoFactorSetup: () => apiClient.post<{ secret: string; otpauth_url: string }>("/security/2fa/setup").then((r) => r.data),
  twoFactorEnable: (code: string) => apiClient.post<{ enabled: boolean }>("/security/2fa/enable", null, { params: { code } }).then((r) => r.data),
  twoFactorDisable: (code: string) => apiClient.post<{ enabled: boolean }>("/security/2fa/disable", null, { params: { code } }).then((r) => r.data),
};

export const payrollApi = {
  summary: (month: string) => apiClient.get<PayrollSummary>("/payroll", { params: { month } }).then((r) => r.data),
  schedule: () => apiClient.get<PayrollSchedule>("/payroll/schedule").then((r) => r.data),
  updateSchedule: (payload: { working_days: number[]; standard_hours_per_day: number }) =>
    apiClient.put<PayrollSchedule>("/payroll/schedule", payload).then((r) => r.data),
  addScheduleException: (payload: { exception_date: string; name: string; is_working_day: boolean }) =>
    apiClient.post<PayrollScheduleException>("/payroll/schedule/exceptions", payload).then((r) => r.data),
  removeScheduleException: (id: string) => apiClient.delete(`/payroll/schedule/exceptions/${id}`).then((r) => r.data),
  updateRate: (userId: string, payload: { hourly_rate: number; standard_hours_per_day: number }) =>
    apiClient.put(`/payroll/employees/${userId}`, payload).then((r) => r.data),
};

export const attendanceApi = {
  overview: (month: string) => apiClient.get<AttendanceOverview>("/attendance", { params: { month } }).then((r) => r.data),
  approvals: (month: string) => apiClient.get<AttendanceApprovals>("/attendance/approvals", { params: { month } }).then((r) => r.data),
  createTimeEntry: (payload: {
    user_id?: string;
    entry_date: string;
    hours: number;
    category: TimeEntryCategory;
    description?: string;
    status?: TimeEntryStatus;
  }) => apiClient.post<PayrollTimeEntry>("/attendance/time-entries", payload).then((r) => r.data),
  reviewTimeEntry: (id: string, status: TimeEntryStatus) => apiClient.patch<PayrollTimeEntry>(`/attendance/time-entries/${id}`, { status }).then((r) => r.data),
  createLeave: (payload: { user_id?: string; start_date: string; end_date: string; leave_type: LeaveRequest["leave_type"]; reason: string }) =>
    apiClient.post<LeaveRequest>("/attendance/leave-requests", payload).then((r) => r.data),
  reviewLeave: (id: string, status: LeaveRequest["status"], review_note?: string) =>
    apiClient.patch<LeaveRequest>(`/attendance/leave-requests/${id}`, { status, review_note }).then((r) => r.data),
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

export const tasksApi = {
  list: (filters: {
    status?: TaskStatus;
    assigned_to?: string;
    lead_id?: string;
    date_from?: string;
    date_to?: string;
    page?: number;
    page_size?: number;
  }) => apiClient.get<PaginatedTasks>("/tasks", { params: filters }).then((r) => r.data),
  create: (payload: {
    title: string;
    description?: string;
    lead_id?: string;
    assigned_to?: string;
    task_type?: TaskType;
    priority?: TaskPriority;
    due_at?: string;
  }) => apiClient.post<TaskOut>("/tasks", payload).then((r) => r.data),
  update: (id: string, payload: Partial<{
    title: string;
    description: string | null;
    lead_id: string | null;
    assigned_to: string | null;
    task_type: TaskType;
    priority: TaskPriority;
    status: TaskStatus;
    due_at: string | null;
  }>) => apiClient.patch<TaskOut>(`/tasks/${id}`, payload).then((r) => r.data),
  remove: (id: string) => apiClient.delete(`/tasks/${id}`).then((r) => r.data),
};

export interface LostDealFilters {
  telecaller_id?: string;
  q?: string;
  page?: number;
  page_size?: number;
}

export const lostDealsApi = {
  list: (filters: LostDealFilters) =>
    apiClient.get<PaginatedLostDeals>("/lost-deals", { params: filters }).then((r) => r.data),
  remove: (id: string) => apiClient.delete<BulkDeleteLostDealsResult>(`/lost-deals/${id}`).then((r) => r.data),
  bulkRemove: (ids: string[]) =>
    apiClient.post<BulkDeleteLostDealsResult>("/lost-deals/bulk-delete", { ids }).then((r) => r.data),
};

export const analyticsApi = {
  dashboard: () => apiClient.get<DashboardResponse>("/dashboard").then((r) => r.data),
  analytics: (range: "today" | "7d" | "all", assigneeId?: string) =>
    apiClient
      .get<AnalyticsResponse>("/analytics", { params: { range, assignee_id: assigneeId || undefined } })
      .then((r) => r.data),
};

export const integrationsApi = {
  list: () => apiClient.get<IntegrationOut[]>("/integrations").then((r) => r.data),
  connect: (provider: IntegrationProvider, credentials: Record<string, string>, is_enabled = true) =>
    apiClient
      .put<IntegrationOut>(`/integrations/${provider}`, { credentials, is_enabled })
      .then((r) => r.data),
  disconnect: (provider: IntegrationProvider) =>
    apiClient.delete<IntegrationOut>(`/integrations/${provider}`).then((r) => r.data),
  sync: (provider: IntegrationProvider) =>
    apiClient.post<SyncResult>(`/integrations/${provider}/sync`).then((r) => r.data),
};

export const superAdminApi = {
  listOrganizations: () => apiClient.get<OrganizationOut[]>("/super-admin/organizations").then((r) => r.data),
  getOrganization: (id: string) => apiClient.get<OrganizationDetailsOut>(`/super-admin/organizations/${id}`).then((r) => r.data),
  createOrganization: (payload: {
    name: string;
    admin_name: string;
    admin_phone: string;
    admin_email?: string;
    admin_password: string;
  }) => apiClient.post<OrganizationOut>("/super-admin/organizations", payload).then((r) => r.data),
  uploadOrganizationLogo: (id: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return apiClient
      .post<OrganizationOut>(`/super-admin/organizations/${id}/logo`, form, { headers: { "Content-Type": "multipart/form-data" } })
      .then((r) => r.data);
  },
  removeOrganizationLogo: (id: string) =>
    apiClient.delete<OrganizationOut>(`/super-admin/organizations/${id}/logo`).then((r) => r.data),
  updateOrganization: (
    id: string,
    payload: {
      name: string;
      plan: "trial" | "starter" | "professional" | "enterprise";
      admin_name: string;
      admin_phone: string;
      admin_email: string | null;
      admin_password?: string;
    }
  ) => apiClient.patch<OrganizationDetailsOut>(`/super-admin/organizations/${id}`, payload).then((r) => r.data),
  deleteOrganization: (id: string, confirmName: string) =>
    apiClient.delete(`/super-admin/organizations/${id}`, { params: { confirm_name: confirmName } }).then((r) => r.data),
  suspend: (id: string) => apiClient.post<OrganizationOut>(`/super-admin/organizations/${id}/suspend`).then((r) => r.data),
  reactivate: (id: string) =>
    apiClient.post<OrganizationOut>(`/super-admin/organizations/${id}/reactivate`).then((r) => r.data),
  stats: () => apiClient.get<PlatformStats>("/super-admin/stats").then((r) => r.data),
  impersonate: (organizationId: string) =>
    apiClient.post<TokenPair>("/super-admin/impersonate", { organization_id: organizationId }).then((r) => r.data),
};
