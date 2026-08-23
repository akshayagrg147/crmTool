import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, Download, FileKey2, Plus, ShieldCheck, SlidersHorizontal, Trash2, Workflow } from "lucide-react";
import { usersApi, workspaceApi, securityApi } from "@/api/endpoints";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { formatDateTime } from "@/lib/format";
import type { AutomationAction, AutomationTrigger, CustomFieldType } from "@/api/types";

type Tab = "configuration" | "automation" | "audit" | "reports" | "security" | "data";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function WorkspaceSettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>(user?.role === "admin" ? "configuration" : "security");
  const isAdmin = user?.role === "admin";
  const canAudit = isAdmin || user?.role === "manager";

  const tabs = [
    { key: "configuration" as const, label: "Fields & stages", icon: SlidersHorizontal, show: isAdmin },
    { key: "automation" as const, label: "Automations", icon: Workflow, show: isAdmin },
    { key: "audit" as const, label: "Audit log", icon: FileKey2, show: canAudit },
    { key: "reports" as const, label: "Saved reports", icon: SlidersHorizontal, show: true },
    { key: "security" as const, label: "Security", icon: ShieldCheck, show: true },
    { key: "data" as const, label: "Data & backups", icon: Archive, show: isAdmin },
  ].filter((item) => item.show);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="page-eyebrow mb-1">Workspace / Controls</p>
        <h1 className="page-title">Workspace settings</h1>
        <p className="page-subtitle">Shape the operating rules, data model, and controls your team works with.</p>
      </div>
      <div className="flex flex-wrap gap-2 border-b border-ink-100 pb-2">
        {tabs.map((item) => (
          <button key={item.key} className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${tab === item.key ? "bg-primary text-white" : "text-ink-600 hover:bg-ink-50"}`} onClick={() => setTab(item.key)}>
            <item.icon size={15} /> {item.label}
          </button>
        ))}
      </div>
      {tab === "configuration" && <ConfigurationPanel />}
      {tab === "automation" && <AutomationPanel />}
      {tab === "audit" && <AuditPanel />}
      {tab === "reports" && <ReportsPanel />}
      {tab === "security" && <SecurityPanel />}
      {tab === "data" && <DataPanel />}
    </div>
  );
}

function ReportsPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: reports = [] } = useQuery({ queryKey: ["workspace-reports"], queryFn: workspaceApi.reports });
  const [form, setForm] = useState({ name: "", report_type: "leads" as "leads" | "analytics" });
  const create = useMutation({
    mutationFn: () => workspaceApi.createReport({ name: form.name.trim(), report_type: form.report_type, filters: {} }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["workspace-reports"] }); setForm({ name: "", report_type: "leads" }); toast("Report saved", "success"); },
    onError: () => toast("Couldn't save report", "error"),
  });
  const remove = useMutation({ mutationFn: workspaceApi.deleteReport, onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workspace-reports"] }), onError: () => toast("Couldn't delete report", "error") });
  return <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
    <section className="card overflow-hidden">
      <div className="border-b border-ink-100 p-5"><h2 className="text-lg font-semibold text-ink-900">Saved reports</h2><p className="mt-1 text-sm text-ink-500">Keep frequently used lead and analytics views available to the whole workspace.</p></div>
      <div className="divide-y divide-ink-100">{reports.map((report) => <div key={report.id} className="flex items-center gap-3 px-5 py-3"><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-ink-800">{report.name}</p><p className="mt-1 text-xs text-ink-500">{report.report_type === "leads" ? "Lead report" : "Analytics report"} · updated {formatDateTime(report.updated_at)}</p></div><button className="btn-icon text-danger" aria-label={`Delete ${report.name}`} onClick={() => remove.mutate(report.id)}><Trash2 size={14} /></button></div>)}{!reports.length && <p className="p-8 text-center text-sm text-ink-500">No saved reports yet.</p>}</div>
    </section>
    <section className="card p-5"><h3 className="text-base font-semibold text-ink-900">Create a saved report</h3><p className="mt-1 text-sm text-ink-500">A report can be extended with filter criteria as your team standardizes its operating views.</p><div className="mt-4 space-y-3"><input className="input" placeholder="e.g. High-value follow-ups" aria-label="Saved report name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /><select className="input" aria-label="Saved report type" value={form.report_type} onChange={(event) => setForm({ ...form, report_type: event.target.value as "leads" | "analytics" })}><option value="leads">Lead report</option><option value="analytics">Analytics report</option></select><button className="btn-primary w-full" disabled={!form.name.trim() || create.isPending} onClick={() => create.mutate()}><Plus size={15} /> Save report</button></div></section>
  </div>;
}

function ConfigurationPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: fields = [] } = useQuery({ queryKey: ["workspace-custom-fields"], queryFn: workspaceApi.customFields });
  const { data: stages = [] } = useQuery({ queryKey: ["workspace-stages"], queryFn: workspaceApi.stages });
  const [field, setField] = useState({ key: "", label: "", field_type: "text" as CustomFieldType, options: "", required: false });
  const [stage, setStage] = useState({ key: "", name: "", color: "#17324D", sort_order: 10, is_closed: false, is_won: false });
  const createField = useMutation({
    mutationFn: () => workspaceApi.createCustomField({ key: field.key, label: field.label, field_type: field.field_type, options: field.options.split(",").map((value) => value.trim()).filter(Boolean), required: field.required, is_active: true, sort_order: fields.length }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["workspace-custom-fields"] }); setField({ key: "", label: "", field_type: "text", options: "", required: false }); toast("Custom field added", "success"); },
    onError: (error: any) => toast(error?.response?.data?.detail ?? "Couldn't add custom field", "error"),
  });
  const createStage = useMutation({
    mutationFn: () => workspaceApi.createStage(stage),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["workspace-stages"] }); setStage({ key: "", name: "", color: "#17324D", sort_order: stages.length + 1, is_closed: false, is_won: false }); toast("Pipeline stage added", "success"); },
    onError: (error: any) => toast(error?.response?.data?.detail ?? "Couldn't add pipeline stage", "error"),
  });
  const deleteField = useMutation({ mutationFn: workspaceApi.deleteCustomField, onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workspace-custom-fields"] }), onError: () => toast("Couldn't delete field", "error") });
  const deleteStage = useMutation({ mutationFn: workspaceApi.deleteStage, onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workspace-stages"] }), onError: (error: any) => toast(error?.response?.data?.detail ?? "Couldn't delete stage", "error") });

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <section className="card p-5">
        <div className="mb-4 flex items-start justify-between"><div><h2 className="text-lg font-semibold text-ink-900">Custom fields</h2><p className="mt-1 text-sm text-ink-500">Capture organization-specific qualification data on every lead.</p></div><span className="badge bg-primary/10 text-primary">{fields.length} fields</span></div>
        <div className="space-y-2">
          {fields.map((item) => <div key={item.id} className="flex items-center gap-3 rounded-lg border border-ink-100 px-3 py-2.5"><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-ink-800">{item.label}</p><p className="text-xs text-ink-500">{item.key} · {item.field_type}{item.required ? " · required" : ""}</p></div><button className="btn-icon text-danger" aria-label={`Delete ${item.label}`} onClick={() => deleteField.mutate(item.id)}><Trash2 size={14} /></button></div>)}
          {!fields.length && <p className="rounded-lg border border-dashed border-ink-100 p-4 text-center text-sm text-ink-500">No custom fields yet.</p>}
        </div>
        <div className="mt-4 grid gap-2 border-t border-ink-100 pt-4 sm:grid-cols-2">
          <input className="input" placeholder="field_key" aria-label="Custom field key" value={field.key} onChange={(event) => setField({ ...field, key: event.target.value })} />
          <input className="input" placeholder="Customer segment" aria-label="Custom field label" value={field.label} onChange={(event) => setField({ ...field, label: event.target.value })} />
          <select className="input" aria-label="Custom field type" value={field.field_type} onChange={(event) => setField({ ...field, field_type: event.target.value as CustomFieldType })}><option value="text">Text</option><option value="number">Number</option><option value="boolean">Yes / No</option><option value="date">Date</option><option value="select">Select</option></select>
          <input className="input" placeholder="Options, comma separated" aria-label="Custom field options" value={field.options} onChange={(event) => setField({ ...field, options: event.target.value })} />
          <label className="flex items-center gap-2 text-sm text-ink-700 sm:col-span-2"><input type="checkbox" className="h-4 w-4 accent-primary" checked={field.required} onChange={(event) => setField({ ...field, required: event.target.checked })} /> Required on new leads</label>
          <button className="btn-secondary sm:col-span-2" disabled={!field.key || !field.label || createField.isPending} onClick={() => createField.mutate()}><Plus size={15} /> Add custom field</button>
        </div>
      </section>

      <section className="card p-5">
        <div className="mb-4 flex items-start justify-between"><div><h2 className="text-lg font-semibold text-ink-900">Pipeline stages</h2><p className="mt-1 text-sm text-ink-500">Use a pipeline vocabulary that matches how your team sells.</p></div><span className="badge bg-accent/15 text-accent-dark">{stages.length} stages</span></div>
        <div className="space-y-2">{stages.map((item) => <div key={item.id} className="flex items-center gap-3 rounded-lg border border-ink-100 px-3 py-2.5"><span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} /><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-ink-800">{item.name}</p><p className="text-xs text-ink-500">{item.key} · {item.is_won ? "won" : item.is_closed ? "closed" : "open"}</p></div>{!['new','follow_up','converted','lost'].includes(item.key) && <button className="btn-icon text-danger" aria-label={`Delete ${item.name}`} onClick={() => deleteStage.mutate(item.id)}><Trash2 size={14} /></button>}</div>)}</div>
        <div className="mt-4 grid gap-2 border-t border-ink-100 pt-4 sm:grid-cols-2"><input className="input" placeholder="stage_key" aria-label="Pipeline stage key" value={stage.key} onChange={(event) => setStage({ ...stage, key: event.target.value })} /><input className="input" placeholder="Qualified" aria-label="Pipeline stage name" value={stage.name} onChange={(event) => setStage({ ...stage, name: event.target.value })} /><input className="input" type="color" aria-label="Pipeline stage color" value={stage.color} onChange={(event) => setStage({ ...stage, color: event.target.value })} /><label className="flex items-center gap-2 text-sm text-ink-700"><input type="checkbox" className="h-4 w-4 accent-primary" checked={stage.is_won} onChange={(event) => setStage({ ...stage, is_won: event.target.checked, is_closed: event.target.checked })} /> Won stage</label><button className="btn-secondary sm:col-span-2" disabled={!stage.key || !stage.name || createStage.isPending} onClick={() => createStage.mutate()}><Plus size={15} /> Add pipeline stage</button></div>
      </section>
    </div>
  );
}

function AutomationPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: rules = [] } = useQuery({ queryKey: ["workspace-automations"], queryFn: workspaceApi.automations });
  const { data: managers = [] } = useQuery({ queryKey: ["team-managers"], queryFn: usersApi.managers });
  const [form, setForm] = useState({ name: "", trigger: "lead_created" as AutomationTrigger, action: "create_task" as AutomationAction, title: "Follow up with this lead", body: "", due_in_hours: "24", manager_id: "" });
  const create = useMutation({ mutationFn: () => workspaceApi.createAutomation({ name: form.name, trigger: form.trigger, action: form.action, conditions: {}, is_active: true, action_config: form.action === "create_task" ? { title: form.title, due_in_hours: Number(form.due_in_hours) || 0 } : form.action === "add_note" ? { body: form.body } : { manager_id: form.manager_id } }), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["workspace-automations"] }); setForm({ name: "", trigger: "lead_created", action: "create_task", title: "Follow up with this lead", body: "", due_in_hours: "24", manager_id: "" }); toast("Automation rule added", "success"); }, onError: (error: any) => toast(error?.response?.data?.detail ?? "Couldn't add automation", "error") });
  const remove = useMutation({ mutationFn: workspaceApi.deleteAutomation, onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workspace-automations"] }), onError: () => toast("Couldn't delete automation", "error") });
  return <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]"><section className="card p-5"><div className="mb-4"><h2 className="text-lg font-semibold text-ink-900">Automation rules</h2><p className="mt-1 text-sm text-ink-500">Turn repeatable internal actions into consistent follow-through.</p></div><div className="space-y-2">{rules.map((rule) => <div key={rule.id} className="flex items-start gap-3 rounded-lg border border-ink-100 p-3"><span className={`mt-1 h-2.5 w-2.5 rounded-full ${rule.is_active ? "bg-success" : "bg-ink-300"}`} /><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-ink-800">{rule.name}</p><p className="mt-1 text-xs text-ink-500">When <strong>{rule.trigger.replace(/_/g, " ")}</strong>, {rule.action.replace(/_/g, " ")}</p></div><button className="btn-icon text-danger" aria-label={`Delete ${rule.name}`} onClick={() => remove.mutate(rule.id)}><Trash2 size={14} /></button></div>)}{!rules.length && <p className="rounded-lg border border-dashed border-ink-100 p-4 text-center text-sm text-ink-500">No automation rules configured.</p>}</div></section><section className="card p-5"><h3 className="text-base font-semibold text-ink-900">New rule</h3><div className="mt-4 space-y-3"><input className="input" placeholder="Rule name" aria-label="Automation name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /><select className="input" aria-label="Automation trigger" value={form.trigger} onChange={(event) => setForm({ ...form, trigger: event.target.value as AutomationTrigger })}><option value="lead_created">Lead created</option><option value="lead_assigned">Lead assigned</option><option value="status_changed">Status changed</option><option value="task_completed">Task completed</option></select><select className="input" aria-label="Automation action" value={form.action} onChange={(event) => setForm({ ...form, action: event.target.value as AutomationAction })}><option value="create_task">Create task</option><option value="add_note">Add note</option><option value="assign_manager">Assign to manager</option></select>{form.action === "create_task" ? <><input className="input" placeholder="Task title" aria-label="Automation task title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /><input className="input" type="number" min="0" placeholder="Due in hours" aria-label="Automation due hours" value={form.due_in_hours} onChange={(event) => setForm({ ...form, due_in_hours: event.target.value })} /></> : form.action === "add_note" ? <textarea className="input min-h-24" placeholder="Note text" aria-label="Automation note text" value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} /> : <select className="input" aria-label="Automation manager" value={form.manager_id} onChange={(event) => setForm({ ...form, manager_id: event.target.value })}><option value="">Choose manager</option>{managers.map((manager) => <option key={manager.id} value={manager.id}>{manager.name}</option>)}</select>}<button className="btn-primary w-full" disabled={!form.name || (form.action === "assign_manager" && !form.manager_id) || create.isPending} onClick={() => create.mutate()}><Plus size={15} /> Create rule</button></div></section></div>;
}

function AuditPanel() {
  const { toast } = useToast();
  const { data } = useQuery({ queryKey: ["workspace-audit"], queryFn: () => workspaceApi.audit({ page: 1, page_size: 100 }) });
  const exportMutation = useMutation({ mutationFn: workspaceApi.auditExport, onSuccess: (blob) => downloadBlob(blob, "talkocrm-audit-log.csv"), onError: () => toast("Couldn't export audit log", "error") });
  return <section className="card overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 p-5"><div><h2 className="text-lg font-semibold text-ink-900">Audit log</h2><p className="mt-1 text-sm text-ink-500">A durable record of configuration, ownership, and data changes.</p></div><button className="btn-secondary text-sm" onClick={() => exportMutation.mutate()}><Download size={15} /> Export log</button></div><div className="divide-y divide-ink-100">{data?.items.map((event) => <div key={event.id} className="flex gap-3 px-5 py-3"><div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" /><div className="min-w-0 flex-1"><p className="text-sm text-ink-800">{event.summary}</p><p className="mt-1 text-xs text-ink-500">{event.actor_name ?? "System"} · {event.entity_type} · {formatDateTime(event.created_at)}</p></div><span className="badge bg-ink-100 text-ink-600">{event.action}</span></div>)}{!data?.items.length && <p className="p-8 text-center text-sm text-ink-500">No audit events yet.</p>}</div></section>;
}

function SecurityPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: status } = useQuery({ queryKey: ["security-2fa"], queryFn: securityApi.twoFactorStatus });
  const [setup, setSetup] = useState<{ secret: string; otpauth_url: string } | null>(null);
  const [code, setCode] = useState("");
  const setupMutation = useMutation({ mutationFn: securityApi.twoFactorSetup, onSuccess: setSetup, onError: () => toast("Couldn't start two-factor setup", "error") });
  const enableMutation = useMutation({ mutationFn: () => securityApi.twoFactorEnable(code), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["security-2fa"] }); setSetup(null); setCode(""); toast("Two-factor authentication enabled", "success"); }, onError: (error: any) => toast(error?.response?.data?.detail ?? "Invalid authenticator code", "error") });
  const disableMutation = useMutation({ mutationFn: () => securityApi.twoFactorDisable(code), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["security-2fa"] }); setCode(""); toast("Two-factor authentication disabled", "success"); }, onError: (error: any) => toast(error?.response?.data?.detail ?? "Invalid authenticator code", "error") });
  return <section className="card max-w-2xl p-5"><div className="flex items-start gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10 text-success"><ShieldCheck size={18} /></div><div><h2 className="text-lg font-semibold text-ink-900">Two-factor authentication</h2><p className="mt-1 text-sm text-ink-500">Protect your CRM login with a time-based authenticator code.</p></div><span className={`ml-auto badge ${status?.enabled ? "bg-success/10 text-success" : "bg-ink-100 text-ink-600"}`}>{status?.enabled ? "Enabled" : "Not enabled"}</span></div>{!status?.enabled && !setup && <button className="btn-primary mt-5" onClick={() => setupMutation.mutate()} disabled={setupMutation.isPending}>Set up authenticator</button>}{setup && <div className="mt-5 rounded-lg border border-accent/25 bg-accent/5 p-4"><p className="text-sm font-semibold text-ink-800">Add this account to your authenticator app</p><p className="mt-2 break-all rounded bg-white px-3 py-2 font-mono text-sm text-ink-700">{setup.secret}</p><p className="mt-2 text-xs text-ink-500">Then enter the six-digit code generated by the app.</p><div className="mt-3 flex gap-2"><input className="input max-w-40" inputMode="numeric" maxLength={6} placeholder="000000" aria-label="Authenticator code" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} /><button className="btn-primary" disabled={code.length !== 6 || enableMutation.isPending} onClick={() => enableMutation.mutate()}>Confirm</button></div></div>}{status?.enabled && <div className="mt-5 flex gap-2"><input className="input max-w-40" inputMode="numeric" maxLength={6} placeholder="Current code" aria-label="Disable authenticator code" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} /><button className="btn-secondary text-danger" disabled={code.length !== 6 || disableMutation.isPending} onClick={() => disableMutation.mutate()}>Disable 2FA</button></div>}</section>;
}

function DataPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: backups = [] } = useQuery({ queryKey: ["workspace-backups"], queryFn: workspaceApi.backups });
  const backupMutation = useMutation({ mutationFn: workspaceApi.createBackup, onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["workspace-backups"] }); toast("Backup created", "success"); }, onError: () => toast("Couldn't create backup", "error") });
  const exportMutation = useMutation({ mutationFn: workspaceApi.exportWorkspace, onSuccess: (blob) => downloadBlob(blob, "talkocrm-workspace-export.json"), onError: () => toast("Couldn't export workspace", "error") });
  const downloadMutation = useMutation({ mutationFn: workspaceApi.downloadBackup, onSuccess: (blob, id) => { const backup = backups.find((item) => item.id === id); downloadBlob(blob, backup?.filename ?? "talkocrm-backup.json"); }, onError: () => toast("Couldn't download backup", "error") });
  return <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]"><section className="card p-5"><h2 className="text-lg font-semibold text-ink-900">Data portability</h2><p className="mt-1 text-sm leading-6 text-ink-500">Download a complete JSON export of leads, calls, tasks, notes, stages, fields, and automation rules.</p><button className="btn-secondary mt-5" disabled={exportMutation.isPending} onClick={() => exportMutation.mutate()}><Download size={15} /> Export workspace</button><div className="mt-6 border-t border-ink-100 pt-5"><h3 className="text-sm font-semibold text-ink-800">Point-in-time backups</h3><p className="mt-1 text-xs text-ink-500">Create a local workspace snapshot for recovery workflows. Move this storage to encrypted object storage before production scale.</p><button className="btn-primary mt-3" disabled={backupMutation.isPending} onClick={() => backupMutation.mutate()}><Archive size={15} /> Create backup</button></div></section><section className="card overflow-hidden"><div className="border-b border-ink-100 p-5"><h2 className="text-lg font-semibold text-ink-900">Backup history</h2></div><div className="divide-y divide-ink-100">{backups.map((backup) => <div key={backup.id} className="flex items-center gap-3 px-5 py-3"><Archive size={16} className="text-ink-400" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-ink-800">{backup.filename}</p><p className="text-xs text-ink-500">{formatDateTime(backup.created_at)} · {(backup.size_bytes / 1024).toFixed(1)} KB</p></div><button className="btn-icon text-primary" aria-label={`Download ${backup.filename}`} onClick={() => downloadMutation.mutate(backup.id)}><Download size={15} /></button></div>)}{!backups.length && <p className="p-8 text-center text-sm text-ink-500">No backups created yet.</p>}</div></section></div>;
}
