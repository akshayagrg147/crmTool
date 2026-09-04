import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  CircleAlert,
  Copy,
  Eye,
  MessageCircleMore,
  Plus,
  QrCode,
  RefreshCw,
  RotateCw,
  ShieldCheck,
  Trash2,
  Wifi,
  WifiOff,
} from "lucide-react";
import { usersApi, whatsappApi } from "@/api/endpoints";
import type { WhatsAppInstanceOut, WhatsAppMessageOut, WhatsAppInstanceStatus } from "@/api/types";
import { useToast } from "@/hooks/useToast";
import { Modal } from "@/components/Modal";
import { ConfirmModal } from "@/components/ConfirmModal";
import { EmptyState } from "@/components/EmptyState";
import { PageLoading, TableSkeleton } from "@/components/Spinner";
import { formatDateTime, timeAgo } from "@/lib/format";

const statusLabels: Record<WhatsAppInstanceStatus, string> = {
  disconnected: "Disconnected",
  connecting: "Connecting",
  connected: "Connected",
  paused: "Paused",
  error: "Needs attention",
};

const statusClasses: Record<WhatsAppInstanceStatus, string> = {
  disconnected: "bg-ink-100 text-ink-600",
  connecting: "bg-warning/10 text-warning",
  connected: "bg-success/10 text-success",
  paused: "bg-ink-100 text-ink-600",
  error: "bg-danger/10 text-danger",
};

function StatusPill({ status }: { status: WhatsAppInstanceStatus }) {
  return <span className={`badge ${statusClasses[status]}`}>{statusLabels[status]}</span>;
}

function StatCard({ label, value, tone = "primary" }: { label: string; value: number; tone?: "primary" | "success" | "warning" }) {
  const iconClass = tone === "success" ? "text-success bg-success/10" : tone === "warning" ? "text-warning bg-warning/10" : "text-primary bg-primary-soft";
  return (
    <div className="card flex items-center gap-3 p-4">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${iconClass}`}>
        <MessageCircleMore size={18} />
      </div>
      <div>
        <p className="text-xs text-ink-500">{label}</p>
        <p className="mt-0.5 text-xl font-semibold text-ink-900">{value}</p>
      </div>
    </div>
  );
}

function MessageRow({ message, onRead }: { message: WhatsAppMessageOut; onRead: () => void }) {
  const inbound = message.direction === "inbound";
  return (
    <article className={`rounded-xl border p-3 ${message.is_read ? "border-ink-100 bg-white" : "border-primary/20 bg-primary/[0.035]"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-ink-900">{message.contact_name || message.contact_phone}</p>
            <span className={`badge ${inbound ? "bg-secondary/10 text-secondary" : "bg-primary/10 text-primary"}`}>
              {inbound ? "Incoming" : "Outgoing"}
            </span>
            {!message.is_read && <span className="badge bg-accent/15 text-accent-dark">New</span>}
          </div>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-ink-700">{message.body}</p>
        </div>
        <div className="shrink-0 text-right">
          <time className="text-[11px] text-ink-400" dateTime={message.sent_at} title={formatDateTime(message.sent_at)}>
            {timeAgo(message.sent_at)}
          </time>
          {!message.is_read && (
            <button type="button" className="mt-2 block text-[11px] font-semibold text-primary hover:underline" onClick={onRead}>
              Mark read
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

export function WhatsAppPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<WhatsAppInstanceOut | null>(null);
  const [removeTarget, setRemoveTarget] = useState<WhatsAppInstanceOut | null>(null);
  const [tokenNotice, setTokenNotice] = useState<{ instance: WhatsAppInstanceOut; token: string } | null>(null);
  const [qrInstanceId, setQrInstanceId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({ assigned_user_id: "", label: "", phone_number: "" });

  const instancesQuery = useQuery({
    queryKey: ["whatsapp-instances"],
    queryFn: whatsappApi.instances,
    refetchInterval: (query) => query.state.data?.some((instance) => instance.status === "connecting") ? 3000 : false,
  });
  const overviewQuery = useQuery({ queryKey: ["whatsapp-overview"], queryFn: whatsappApi.overview });
  const teamQuery = useQuery({ queryKey: ["team"], queryFn: usersApi.list });
  const messagesQuery = useQuery({
    queryKey: ["whatsapp-messages", selected?.id],
    queryFn: () => whatsappApi.messages(selected!.id),
    enabled: !!selected,
  });

  const employees = useMemo(
    () => teamQuery.data?.filter((member) => member.is_active && member.role !== "super_admin") ?? [],
    [teamQuery.data],
  );

  useEffect(() => {
    if (showCreate && !form.assigned_user_id && employees[0]) {
      setForm((current) => ({ ...current, assigned_user_id: employees[0].id }));
    }
  }, [employees, form.assigned_user_id, showCreate]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["whatsapp-instances"] });
    void queryClient.invalidateQueries({ queryKey: ["whatsapp-overview"] });
    if (selected) void queryClient.invalidateQueries({ queryKey: ["whatsapp-messages", selected.id] });
  };

  const createMutation = useMutation({
    mutationFn: () => whatsappApi.create({
      assigned_user_id: form.assigned_user_id,
      label: form.label.trim(),
      phone_number: form.phone_number.trim() || null,
    }),
    onSuccess: (instance) => {
      invalidate();
      setShowCreate(false);
      setForm({ assigned_user_id: employees[0]?.id ?? "", label: "", phone_number: "" });
      if (instance.webhook_token) setTokenNotice({ instance, token: instance.webhook_token });
      toast("WhatsApp instance created", "success");
    },
    onError: (error: any) => toast(error?.response?.data?.detail ?? "Couldn’t create the instance.", "error"),
  });

  const actionMutation = useMutation({
    mutationFn: ({ action, id }: { action: "connect" | "disconnect" | "rotate"; id: string }) =>
      action === "connect" ? whatsappApi.connect(id) : action === "disconnect" ? whatsappApi.disconnect(id) : whatsappApi.rotateToken(id),
    onSuccess: (instance, variables) => {
      invalidate();
      if (variables.action === "rotate" && instance.webhook_token) setTokenNotice({ instance, token: instance.webhook_token });
      else if (variables.action === "connect") {
        setQrInstanceId(instance.id);
        toast("WhatsApp Web is starting — scan the QR code", "success");
      } else {
        setQrInstanceId(null);
        toast("Instance disconnected", "success");
      }
    },
    onError: (error: any) => toast(error?.response?.data?.detail ?? "Couldn’t update the instance.", "error"),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => whatsappApi.remove(id),
    onSuccess: () => {
      invalidate();
      setRemoveTarget(null);
      setSelected(null);
      toast("WhatsApp instance removed", "success");
    },
    onError: (error: any) => toast(error?.response?.data?.detail ?? "Couldn’t remove the instance.", "error"),
  });

  const readMutation = useMutation({
    mutationFn: ({ instanceId, messageId }: { instanceId: string; messageId: string }) => whatsappApi.markRead(instanceId, messageId),
    onSuccess: () => invalidate(),
    onError: () => toast("Couldn’t mark the message as read.", "error"),
  });

  if (instancesQuery.isLoading || overviewQuery.isLoading || teamQuery.isLoading) return <PageLoading />;

  const instances = instancesQuery.data ?? [];
  const overview = overviewQuery.data;
  const qrInstance = qrInstanceId ? instances.find((instance) => instance.id === qrInstanceId) ?? null : null;

  function copyToken() {
    if (!tokenNotice) return;
    void navigator.clipboard.writeText(tokenNotice.token).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="page-eyebrow mb-1">Admin / Conversations</p>
          <h1 className="page-title">WhatsApp instances</h1>
          <p className="page-subtitle max-w-3xl">
            Manage separate WhatsApp Web sessions for each employee and review their conversation activity from one private admin view.
          </p>
        </div>
        <button className="btn-primary text-sm" onClick={() => setShowCreate(true)} disabled={!employees.length}>
          <Plus size={16} /> Add instance
        </button>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-primary/15 bg-primary/[0.035] p-4">
        <ShieldCheck size={18} className="mt-0.5 shrink-0 text-primary" />
        <div className="text-sm text-ink-700">
          <p className="font-semibold text-ink-900">Admin-only tracking</p>
          <p className="mt-0.5">Employees cannot see this page or another employee’s messages. A WhatsApp bridge must post status and message events to each instance webhook.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Instances" value={overview?.total_instances ?? instances.length} />
        <StatCard label="Connected now" value={overview?.connected_instances ?? 0} tone="success" />
        <StatCard label="Messages tracked" value={overview?.total_messages ?? 0} />
        <StatCard label="Unread incoming" value={overview?.unread_messages ?? 0} tone="warning" />
      </div>

      {overview?.employees.some((employee) => employee.instances > 0) && (
        <section className="card overflow-hidden">
          <div className="border-b border-ink-100 px-5 py-4">
            <h2 className="font-semibold text-ink-900">By employee</h2>
            <p className="mt-0.5 text-xs text-ink-500">A quick view of session ownership and activity.</p>
          </div>
          <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
            {overview.employees.filter((employee) => employee.instances > 0).map((employee) => (
              <div key={employee.user_id} className="rounded-xl border border-ink-100 bg-[#F8F7F3] p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate font-medium text-ink-900">{employee.user_name}</p>
                  <span className="badge bg-primary/10 text-primary">{employee.instances}</span>
                </div>
                <p className="mt-1 text-xs text-ink-500">{employee.connected_instances} connected · {employee.messages} messages</p>
                {employee.unread_messages > 0 && <p className="mt-2 text-xs font-semibold text-warning">{employee.unread_messages} unread incoming</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 px-5 py-4">
          <div>
            <h2 className="font-semibold text-ink-900">Employee sessions</h2>
            <p className="mt-0.5 text-xs text-ink-500">Each row is an independent WhatsApp number/session.</p>
          </div>
          <button className="btn-ghost text-xs" onClick={invalidate}><RefreshCw size={14} /> Refresh</button>
        </div>
        {!instances.length ? (
          <EmptyState icon={MessageCircleMore} title="No WhatsApp instances yet" message="Create one session for each employee’s WhatsApp number to start tracking activity." action={<button className="btn-primary text-sm" onClick={() => setShowCreate(true)}><Plus size={15} /> Add first instance</button>} />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs uppercase tracking-wide text-ink-500"><th className="px-5 py-3 font-medium">Instance</th><th className="px-5 py-3 font-medium">Employee</th><th className="px-5 py-3 font-medium">Status</th><th className="px-5 py-3 font-medium">Messages</th><th className="px-5 py-3 font-medium">Last activity</th><th className="px-5 py-3 text-right font-medium">Actions</th></tr></thead>
                <tbody>
                  {instances.map((instance) => (
                    <tr key={instance.id} className="border-t border-ink-100 hover:bg-bg/60">
                      <td className="px-5 py-3"><p className="font-medium text-ink-900">{instance.label}</p><p className="mt-0.5 text-xs text-ink-500">{instance.phone_number || "Number pending"}</p></td>
                      <td className="px-5 py-3"><p className="text-ink-800">{instance.assigned_user_name}</p><p className="mt-0.5 text-xs capitalize text-ink-500">{instance.assigned_user_role.replace("_", " ")}</p></td>
                      <td className="px-5 py-3"><StatusPill status={instance.status} />{instance.last_error && <p className="mt-1 max-w-40 truncate text-[11px] text-danger" title={instance.last_error}>{instance.last_error}</p>}</td>
                      <td className="px-5 py-3 text-ink-700">{instance.message_count}{instance.unread_count > 0 && <span className="ml-1 text-xs font-semibold text-warning">({instance.unread_count} new)</span>}</td>
                      <td className="px-5 py-3 text-xs text-ink-500">{timeAgo(instance.last_message_at || instance.last_seen_at)}</td>
                      <td className="px-5 py-3"><div className="flex justify-end gap-1"><button className="btn-ghost h-9 px-2.5 text-xs" onClick={() => setSelected(instance)}><Eye size={14} /> View</button>{(instance.qr_code || instance.status === "connecting") && <button className="btn-ghost h-9 px-2.5 text-xs" onClick={() => setQrInstanceId(instance.id)}><QrCode size={14} /> QR</button>}<button className="btn-ghost h-9 px-2.5 text-xs" onClick={() => { if (instance.status !== "connected") setQrInstanceId(instance.id); actionMutation.mutate({ id: instance.id, action: instance.status === "connected" ? "disconnect" : "connect" }); }} disabled={actionMutation.isPending}>{instance.status === "connected" ? <><WifiOff size={14} /> Stop</> : <><Wifi size={14} /> Connect</>}</button><button className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-danger hover:bg-danger/10" onClick={() => setRemoveTarget(instance)} aria-label={`Remove ${instance.label}`}><Trash2 size={15} /></button></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="divide-y divide-ink-100 md:hidden">
              {instances.map((instance) => (
                <article key={instance.id} className="p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-ink-900">{instance.label}</p><p className="mt-0.5 text-xs text-ink-500">{instance.assigned_user_name} · {instance.phone_number || "Number pending"}</p></div><StatusPill status={instance.status} /></div><div className="mt-3 grid grid-cols-2 gap-2 rounded-lg border border-ink-100 bg-[#F8F7F3] p-3 text-xs"><div><p className="text-ink-400">Messages</p><p className="mt-0.5 font-medium text-ink-700">{instance.message_count}{instance.unread_count ? ` · ${instance.unread_count} new` : ""}</p></div><div><p className="text-ink-400">Last activity</p><p className="mt-0.5 font-medium text-ink-700">{timeAgo(instance.last_message_at || instance.last_seen_at)}</p></div></div><div className="mt-3 flex gap-2"><button className="btn-secondary flex-1 text-xs" onClick={() => setSelected(instance)}><Eye size={14} /> View messages</button>{(instance.qr_code || instance.status === "connecting") && <button className="btn-ghost text-xs" onClick={() => setQrInstanceId(instance.id)}><QrCode size={14} /></button>}<button className="btn-ghost text-xs" onClick={() => { if (instance.status !== "connected") setQrInstanceId(instance.id); actionMutation.mutate({ id: instance.id, action: instance.status === "connected" ? "disconnect" : "connect" }); }}>{instance.status === "connected" ? <WifiOff size={14} /> : <Wifi size={14} />}</button></div></article>
              ))}
            </div>
          </>
        )}
      </section>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Add WhatsApp instance" footer={<><button className="btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button><button className="btn-primary" disabled={createMutation.isPending || !form.assigned_user_id || !form.label.trim()} onClick={() => createMutation.mutate()}>{createMutation.isPending ? "Creating…" : "Create instance"}</button></>}>
        <div className="flex flex-col gap-4">
          <p className="text-sm text-ink-500">Create a separate session for one employee. The bridge token is shown only once after creation.</p>
          <div><label className="mb-1.5 block text-xs font-medium text-ink-500" htmlFor="whatsapp-instance-label">Instance name</label><input id="whatsapp-instance-label" className="input" placeholder="Priya · Sales WhatsApp" value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value })} /></div>
          <div><label className="mb-1.5 block text-xs font-medium text-ink-500" htmlFor="whatsapp-instance-employee">Assigned employee</label><select id="whatsapp-instance-employee" className="input" value={form.assigned_user_id} onChange={(event) => setForm({ ...form, assigned_user_id: event.target.value })}><option value="" disabled>Select an employee</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name} · {employee.role.replace("_", " ")}</option>)}</select></div>
          <div><label className="mb-1.5 block text-xs font-medium text-ink-500" htmlFor="whatsapp-instance-phone">WhatsApp number <span className="font-normal text-ink-300">(optional)</span></label><input id="whatsapp-instance-phone" className="input" placeholder="+91 99999 00000" value={form.phone_number} onChange={(event) => setForm({ ...form, phone_number: event.target.value })} /><p className="mt-1 text-xs text-ink-500">This is a label for the admin view; the connected bridge remains the source of truth.</p></div>
        </div>
      </Modal>

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected ? `${selected.label} · messages` : "Messages"} size="lg" footer={<button className="btn-secondary" onClick={() => setSelected(null)}>Close</button>}>
        {selected && <div className="flex flex-col gap-4"><div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink-100 bg-[#F8F7F3] p-3"><div><p className="font-medium text-ink-900">{selected.assigned_user_name}</p><p className="mt-0.5 text-xs text-ink-500">{selected.phone_number || "Number pending"} · <StatusPill status={selected.status} /></p></div><button className="btn-ghost text-xs" onClick={() => actionMutation.mutate({ id: selected.id, action: "rotate" })}><RotateCw size={14} /> Rotate bridge token</button></div>{messagesQuery.isLoading ? <TableSkeleton rows={4} cols={2} /> : messagesQuery.data?.items.length ? <div className="flex max-h-[52dvh] flex-col gap-2 overflow-y-auto pr-1">{messagesQuery.data.items.map((message) => <MessageRow key={message.id} message={message} onRead={() => readMutation.mutate({ instanceId: selected.id, messageId: message.id })} />)}</div> : <EmptyState icon={MessageCircleMore} title="No messages tracked" message="Messages will appear here when the connected WhatsApp bridge posts events to this instance webhook." />}</div>}
      </Modal>

      <Modal open={!!qrInstanceId} onClose={() => setQrInstanceId(null)} title={qrInstance ? `${qrInstance.label} · WhatsApp Web` : "WhatsApp Web"} size="md" footer={<button className="btn-secondary" onClick={() => setQrInstanceId(null)}>Close</button>}>
        {qrInstance && <div className="flex flex-col items-center gap-4 text-center"><div className="w-full rounded-xl border border-ink-100 bg-[#F8F7F3] p-4"><p className="font-semibold text-ink-900">{qrInstance.status === "connected" ? "WhatsApp Web connected" : "Scan this QR code"}</p><p className="mt-1 text-sm text-ink-500">On the employee’s phone, open WhatsApp → Linked devices → Link a device.</p>{qrInstance.qr_code ? <img className="mx-auto mt-4 h-64 w-64 rounded-lg bg-white p-2" src={qrInstance.qr_code} alt="WhatsApp Web QR code" /> : <div className="mx-auto mt-5 flex h-64 w-64 items-center justify-center rounded-lg border border-dashed border-ink-200 bg-white px-6 text-sm text-ink-500">{qrInstance.status === "connecting" ? "Generating a fresh QR code…" : qrInstance.status === "connected" ? "This number is already linked." : qrInstance.last_error || "Start the connection to generate a QR code."}</div>}</div><p className="text-xs text-ink-500">This QR code is private to this instance and expires shortly. Do not share screenshots of it.</p></div>}
      </Modal>

      <Modal open={!!tokenNotice} onClose={() => setTokenNotice(null)} title="Bridge token — copy it now" size="md" footer={<button className="btn-primary" onClick={() => setTokenNotice(null)}>Done</button>}>
        {tokenNotice && <div className="flex flex-col gap-4"><div className="flex items-start gap-3 rounded-xl border border-warning/25 bg-warning/5 p-3"><CircleAlert size={18} className="mt-0.5 shrink-0 text-warning" /><p className="text-sm text-ink-700">This token is displayed once. It is used by the private bridge to post events for this number; never share it with employees.</p></div><div><label className="mb-1.5 block text-xs font-medium text-ink-500">Webhook URL</label><div className="flex gap-2"><input className="input font-mono text-xs" readOnly value={tokenNotice.instance.webhook_url} /><button className="btn-secondary shrink-0" onClick={() => { void navigator.clipboard.writeText(tokenNotice.instance.webhook_url); }} aria-label="Copy webhook URL"><Copy size={15} /></button></div></div><div><label className="mb-1.5 block text-xs font-medium text-ink-500">Webhook token</label><div className="flex gap-2"><input className="input font-mono text-xs" readOnly value={tokenNotice.token} /><button className="btn-secondary shrink-0" onClick={copyToken} aria-label="Copy webhook token">{copied ? <Check size={15} /> : <Copy size={15} />}</button></div></div><p className="text-xs text-ink-500">The token is normally managed automatically by the bridge. Use it only when configuring a compatible external bridge.</p></div>}
      </Modal>

      <ConfirmModal open={!!removeTarget} onClose={() => setRemoveTarget(null)} onConfirm={() => removeTarget && removeMutation.mutate(removeTarget.id)} title="Remove WhatsApp instance?" message={`This will permanently remove ${removeTarget?.label ?? "this instance"} and its tracked message history. The external WhatsApp session must also be stopped in the bridge.`} confirmLabel="Remove instance" isLoading={removeMutation.isPending} />
    </div>
  );
}
