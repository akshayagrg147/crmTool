import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCheck,
  Check,
  CircleAlert,
  Copy,
  Eye,
  Info,
  MessageCircleMore,
  MoreHorizontal,
  Paperclip,
  Plus,
  QrCode,
  RefreshCw,
  RotateCw,
  Search,
  ShieldCheck,
  Smile,
  Trash2,
  UserRound,
  UsersRound,
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

function partyLabel(name: string | null, phone: string | null, fallback: string) {
  return name || phone || fallback;
}

function visiblePhone(message: WhatsAppMessageOut, phone: string | null) {
  if (!phone || message.chat_type === "group") return null;
  const chatId = message.chat_id || "";
  const chatUser = chatId.endsWith("@lid") ? chatId.split("@", 1)[0]?.split(":", 1)[0] : null;
  // Older bridge events stored the anonymous LID as contact_phone. Never show
  // that internal identifier as though it were a customer's phone number.
  return chatUser && phone === chatUser ? null : phone;
}

function messageRoute(message: WhatsAppMessageOut, instance?: WhatsAppInstanceOut | null) {
  const employee = instance?.assigned_user_name || "Employee WhatsApp";
  const contact = message.contact_name || visiblePhone(message, message.contact_phone) || "Contact";
  const senderName = message.sender_name === "You" ? employee : message.sender_name;
  const sender = partyLabel(senderName, visiblePhone(message, message.sender_phone), message.direction === "outbound" ? employee : contact);
  const recipient = message.chat_type === "group"
    ? partyLabel(message.recipient_name || message.chat_name, null, "Group chat")
    : partyLabel(message.recipient_name, visiblePhone(message, message.recipient_phone), message.direction === "inbound" ? employee : contact);
  return { sender, recipient };
}

function MessageRow({ message, instance, onRead }: { message: WhatsAppMessageOut; instance?: WhatsAppInstanceOut | null; onRead: () => void }) {
  const inbound = message.direction === "inbound";
  const route = messageRoute(message, instance);
  return (
    <article className={`rounded-xl border p-3 ${message.is_read ? "border-ink-100 bg-white" : "border-primary/20 bg-primary/[0.035]"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-ink-900">{message.chat_name || message.contact_name || visiblePhone(message, message.contact_phone) || "Contact"}</p>
            <span className={`badge ${inbound ? "bg-secondary/10 text-secondary" : "bg-primary/10 text-primary"}`}>
              {inbound ? "Incoming" : "Outgoing"}
            </span>
            {message.chat_type === "group" && <span className="badge gap-1 bg-accent/10 text-accent-dark"><UsersRound size={12} /> Group chat</span>}
            {!message.is_read && <span className="badge bg-accent/15 text-accent-dark">New</span>}
          </div>
          <p className="mt-1 text-[11px] text-ink-400">From {route.sender} <span className="px-1">→</span> To {route.recipient}</p>
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

function initials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?";
}

function messageTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function messageDay(value: string) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" }).format(date);
}

function ChatMonitor({
  instances,
  selectedInstanceId,
  onInstanceChange,
  messages,
  isLoading,
  onMarkRead,
}: {
  instances: WhatsAppInstanceOut[];
  selectedInstanceId: string | null;
  onInstanceChange: (id: string) => void;
  messages: WhatsAppMessageOut[];
  isLoading: boolean;
  onMarkRead: (message: WhatsAppMessageOut) => void;
}) {
  const [search, setSearch] = useState("");
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const selectedInstance = instances.find((instance) => instance.id === selectedInstanceId) ?? null;

  const conversations = useMemo(() => {
    const grouped = new Map<string, WhatsAppMessageOut[]>();
    messages.forEach((message) => {
      const key = message.chat_id || `${message.chat_type}:${message.contact_phone || message.contact_name || "unknown"}`;
      grouped.set(key, [...(grouped.get(key) ?? []), message]);
    });
    return [...grouped.entries()]
      .map(([chatId, items]) => {
        const sorted = [...items].sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime());
        const chatType = sorted.some((message) => message.chat_type === "group") ? "group" : "direct";
        const phone = chatType === "group"
          ? "Group chat"
          : sorted.map((message) => visiblePhone(message, message.contact_phone)).find(Boolean) || "Phone unavailable";
        return {
          chatId,
          chatType,
          phone,
          name: chatType === "group" ? sorted.find((message) => message.chat_name)?.chat_name || "Group chat" : sorted.find((message) => message.chat_name || message.contact_name)?.chat_name || sorted.find((message) => message.contact_name)?.contact_name || phone,
          messages: sorted,
          latest: sorted[0],
          unread: sorted.filter((message) => !message.is_read && message.direction === "inbound").length,
        };
      })
      .sort((a, b) => new Date(b.latest.sent_at).getTime() - new Date(a.latest.sent_at).getTime());
  }, [messages]);

  useEffect(() => {
    if (!conversations.some((conversation) => conversation.chatId === activeChatId)) {
      setActiveChatId(conversations[0]?.chatId ?? null);
    }
  }, [activeChatId, conversations, selectedInstanceId]);

  const filteredConversations = conversations.filter((conversation) => {
    const query = search.trim().toLowerCase();
    return !query || `${conversation.name} ${conversation.phone} ${conversation.chatId} ${conversation.chatType} ${conversation.latest.body}`.toLowerCase().includes(query);
  });
  const activeConversation = conversations.find((conversation) => conversation.chatId === activeChatId) ?? null;
  const activeMessages = activeConversation ? [...activeConversation.messages].sort((a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime()) : [];

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 bg-white px-4 py-3 sm:px-5">
        <div className="flex items-center gap-4">
          <button type="button" className="inline-flex items-center gap-2 border-b-2 border-primary px-1 pb-2 pt-1 text-sm font-semibold text-primary">
            <Eye size={15} /> Monitor team chat
          </button>
          <span className="inline-flex items-center gap-2 px-1 pb-2 pt-1 text-sm font-medium text-ink-300" title="Admins can monitor chats but cannot send messages">
            <MessageCircleMore size={15} /> My chat
          </span>
        </div>
        <span className="badge border-primary/15 bg-primary/[0.04] text-primary"><ShieldCheck size={13} /> Admin-only view</span>
      </div>

      <div className="grid min-h-[620px] lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="border-b border-ink-100 bg-[#FBFAF7] lg:border-b-0 lg:border-r">
          <div className="border-b border-ink-100 p-4">
            <label className="section-label" htmlFor="whatsapp-monitor-instance">Monitoring chat for</label>
            <select id="whatsapp-monitor-instance" className="input mt-2 text-xs" value={selectedInstanceId ?? ""} onChange={(event) => onInstanceChange(event.target.value)} disabled={!instances.length}>
              {!instances.length && <option value="">No instances available</option>}
              {instances.map((instance) => <option key={instance.id} value={instance.id}>{instance.assigned_user_name} · {instance.label}{instance.phone_number ? ` · ${instance.phone_number}` : ""}</option>)}
            </select>
            <div className="relative mt-3">
              <Search size={15} className="pointer-events-none absolute left-3 top-3 text-ink-300" />
              <input className="input pl-9 text-xs" placeholder="Search chats" value={search} onChange={(event) => setSearch(event.target.value)} />
            </div>
          </div>
          <div className="border-b border-ink-100 px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-500">Chats</p>
              <span className="text-[11px] text-ink-400">{conversations.length} total</span>
            </div>
          </div>
          <div className="max-h-[420px] overflow-y-auto lg:max-h-[510px]">
            {isLoading ? (
              <div className="space-y-3 p-4"><div className="skeleton h-16" /><div className="skeleton h-16" /><div className="skeleton h-16" /></div>
            ) : !filteredConversations.length ? (
              <div className="px-5 py-12 text-center"><MessageCircleMore size={24} className="mx-auto text-ink-300" /><p className="mt-3 text-sm font-medium text-ink-700">No chats yet</p><p className="mt-1 text-xs leading-5 text-ink-400">Incoming and outgoing messages will appear here once this number is active.</p></div>
            ) : (
              <div className="divide-y divide-ink-100">
                {filteredConversations.map((conversation) => (
                  <button key={conversation.chatId} type="button" aria-pressed={conversation.chatId === activeChatId} onClick={() => setActiveChatId(conversation.chatId)} className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors ${conversation.chatId === activeChatId ? "bg-primary/[0.07]" : "hover:bg-primary/[0.035]"}`}>
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary">{conversation.chatType === "group" ? <UsersRound size={17} /> : initials(conversation.name)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2"><span className="flex min-w-0 items-center gap-1.5"><span className="truncate text-sm font-semibold text-ink-900">{conversation.name}</span>{conversation.chatType === "group" && <span className="badge shrink-0 bg-accent/10 px-1.5 py-0.5 text-[9px] text-accent-dark">Group</span>}</span><span className="shrink-0 text-[10px] text-ink-400">{timeAgo(conversation.latest.sent_at)}</span></span>
                      <span className="mt-0.5 block truncate text-xs text-ink-500">{conversation.latest.body}</span>
                      <span className="mt-1 flex items-center justify-between gap-2"><span className="truncate text-[10px] text-ink-400">{conversation.chatType === "group" ? "Group chat" : conversation.phone}</span>{conversation.unread > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-white">{conversation.unread}</span>}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>

        <div className="flex min-w-0 flex-col bg-[#F3F5F3]">
          {activeConversation && selectedInstance ? (
            <>
              <header className="flex items-center justify-between gap-3 border-b border-ink-100 bg-white px-4 py-3 sm:px-6">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary">{activeConversation.chatType === "group" ? <UsersRound size={17} /> : initials(activeConversation.name)}</span>
                  <div className="min-w-0"><div className="flex items-center gap-2"><p className="truncate font-semibold text-ink-900">{activeConversation.name}</p>{activeConversation.chatType === "group" && <span className="badge gap-1 bg-accent/10 text-accent-dark"><UsersRound size={12} /> Group chat</span>}</div><p className="mt-0.5 truncate text-xs text-ink-500">{activeConversation.chatType === "group" ? "Group chat" : activeConversation.phone} · monitored for {selectedInstance.assigned_user_name} · <StatusPill status={selectedInstance.status} /></p></div>
                </div>
                <div className="flex shrink-0 items-center gap-1 text-ink-400"><button type="button" className="icon-button" title="Read-only monitoring"><Info size={17} /></button><button type="button" className="icon-button" title="More options"><MoreHorizontal size={18} /></button></div>
              </header>
              <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-8">
                <div className="mx-auto flex max-w-3xl flex-col gap-2">
                  {activeMessages.map((message, index) => {
                    const showDay = index === 0 || messageDay(activeMessages[index - 1].sent_at) !== messageDay(message.sent_at);
                    const inbound = message.direction === "inbound";
                    return (
                      <div key={message.id}>
                        {showDay && <div className="my-3 flex justify-center"><span className="rounded-full border border-ink-100 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-400 shadow-sm">{messageDay(message.sent_at)}</span></div>}
                        <div className={`flex ${inbound ? "justify-start" : "justify-end"}`}>
                          <div className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 shadow-sm sm:max-w-[72%] ${inbound ? "rounded-tl-md border border-ink-100 bg-white text-ink-800" : "rounded-tr-md border border-[#C7E7C9] bg-[#DDF4DF] text-ink-800"}`}>
                            {(() => { const route = messageRoute(message, selectedInstance); return <p className="mb-1 text-[10px] font-medium text-ink-400">From {route.sender} <span className="px-1">→</span> To {route.recipient}</p>; })()}
                            <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.body}</p>
                            <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-ink-400"><span>{messageTime(message.sent_at)}</span>{!inbound && <CheckCheck size={13} className="text-primary" />}{inbound && !message.is_read && <button type="button" onClick={() => onMarkRead(message)} className="ml-1 font-semibold text-primary hover:underline">Mark read</button>}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <footer className="border-t border-ink-100 bg-white px-4 py-3 sm:px-6"><div className="flex items-center gap-2 rounded-xl border border-ink-100 bg-[#F8F7F3] px-3 py-2"><Paperclip size={17} className="shrink-0 text-ink-300" /><input className="w-full bg-transparent text-sm text-ink-500 outline-none placeholder:text-ink-300" disabled placeholder="Read-only monitoring — sending is disabled" /><Smile size={17} className="shrink-0 text-ink-300" /></div><p className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-ink-400"><ShieldCheck size={13} /> Chats update when the employee’s WhatsApp instance is active.</p></footer>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center"><span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-soft text-primary"><UserRound size={24} /></span><h3 className="mt-4 text-lg font-semibold text-ink-900">Select a chat to monitor</h3><p className="mt-1 max-w-sm text-sm leading-6 text-ink-500">Choose an employee’s WhatsApp instance and conversation from the left. This admin view never sends messages.</p></div>
          )}
        </div>
      </div>
    </section>
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
  const [monitorInstanceSelection, setMonitorInstanceSelection] = useState<string | null>(null);
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
  const availableInstances = instancesQuery.data ?? [];
  const monitorInstanceId = monitorInstanceSelection && availableInstances.some((instance) => instance.id === monitorInstanceSelection)
    ? monitorInstanceSelection
    : availableInstances[0]?.id ?? null;
  const monitorMessagesQuery = useQuery({
    queryKey: ["whatsapp-monitor-messages", monitorInstanceId],
    queryFn: () => whatsappApi.messages(monitorInstanceId!),
    enabled: !!monitorInstanceId,
    refetchInterval: 5000,
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
    if (monitorInstanceId) void queryClient.invalidateQueries({ queryKey: ["whatsapp-monitor-messages", monitorInstanceId] });
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

  function openCreateForEmployee(employeeId?: string) {
    setForm((current) => ({ ...current, assigned_user_id: employeeId ?? employees[0]?.id ?? "" }));
    setShowCreate(true);
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
        <button className="btn-primary text-sm" onClick={() => openCreateForEmployee()} disabled={!employees.length}>
          <Plus size={16} /> Add instance
        </button>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-primary/15 bg-primary/[0.035] p-4">
        <ShieldCheck size={18} className="mt-0.5 shrink-0 text-primary" />
        <div className="text-sm text-ink-700">
          <p className="font-semibold text-ink-900">Admin-only tracking</p>
          <p className="mt-0.5">Create one instance per telecaller/number. Every instance has its own QR, persistent login, and isolated chat stream; connecting one number never replaces another.</p>
        </div>
      </div>

      <ChatMonitor
        instances={instances}
        selectedInstanceId={monitorInstanceId}
        onInstanceChange={setMonitorInstanceSelection}
        messages={monitorMessagesQuery.data?.items ?? []}
        isLoading={monitorMessagesQuery.isLoading}
        onMarkRead={(message) => readMutation.mutate({ instanceId: message.instance_id, messageId: message.id })}
      />

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
                  <span className="flex items-center gap-1.5"><span className="badge bg-primary/10 text-primary">{employee.instances} {employee.instances === 1 ? "number" : "numbers"}</span><button type="button" className="icon-button h-7 w-7" title={`Add another WhatsApp number for ${employee.user_name}`} onClick={() => openCreateForEmployee(employee.user_id)}><Plus size={14} /></button></span>
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
          <EmptyState icon={MessageCircleMore} title="No WhatsApp instances yet" message="Create one session for each employee’s WhatsApp number to start tracking activity." action={<button className="btn-primary text-sm" onClick={() => openCreateForEmployee()}><Plus size={15} /> Add first instance</button>} />
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
          <p className="text-sm text-ink-500">One instance equals one WhatsApp number and one isolated session. Repeat this form for every telecaller number you want to monitor. The bridge token is shown only once after creation.</p>
          <div><label className="mb-1.5 block text-xs font-medium text-ink-500" htmlFor="whatsapp-instance-label">Instance name</label><input id="whatsapp-instance-label" className="input" placeholder="Priya · Sales WhatsApp" value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value })} /></div>
          <div><label className="mb-1.5 block text-xs font-medium text-ink-500" htmlFor="whatsapp-instance-employee">Assigned employee</label><select id="whatsapp-instance-employee" className="input" value={form.assigned_user_id} onChange={(event) => setForm({ ...form, assigned_user_id: event.target.value })}><option value="" disabled>Select an employee</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name} · {employee.role.replace("_", " ")}</option>)}</select>{form.assigned_user_id && <p className="mt-1 text-xs text-ink-500">{instances.filter((instance) => instance.assigned_user_id === form.assigned_user_id).length} existing {instances.filter((instance) => instance.assigned_user_id === form.assigned_user_id).length === 1 ? "number" : "numbers"} assigned to this employee.</p>}</div>
          <div><label className="mb-1.5 block text-xs font-medium text-ink-500" htmlFor="whatsapp-instance-phone">WhatsApp number <span className="font-normal text-ink-300">(optional)</span></label><input id="whatsapp-instance-phone" className="input" placeholder="+91 99999 00000" value={form.phone_number} onChange={(event) => setForm({ ...form, phone_number: event.target.value })} /><p className="mt-1 text-xs text-ink-500">This is a label for the admin view; the connected bridge remains the source of truth.</p></div>
        </div>
      </Modal>

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected ? `${selected.label} · messages` : "Messages"} size="lg" footer={<button className="btn-secondary" onClick={() => setSelected(null)}>Close</button>}>
        {selected && <div className="flex flex-col gap-4"><div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink-100 bg-[#F8F7F3] p-3"><div><p className="font-medium text-ink-900">{selected.assigned_user_name}</p><p className="mt-0.5 text-xs text-ink-500">{selected.phone_number || "Number pending"} · <StatusPill status={selected.status} /></p></div><button className="btn-ghost text-xs" onClick={() => actionMutation.mutate({ id: selected.id, action: "rotate" })}><RotateCw size={14} /> Rotate bridge token</button></div>{messagesQuery.isLoading ? <TableSkeleton rows={4} cols={2} /> : messagesQuery.data?.items.length ? <div className="flex max-h-[52dvh] flex-col gap-2 overflow-y-auto pr-1">{messagesQuery.data.items.map((message) => <MessageRow key={message.id} message={message} instance={selected} onRead={() => readMutation.mutate({ instanceId: selected.id, messageId: message.id })} />)}</div> : <EmptyState icon={MessageCircleMore} title="No messages tracked" message="Messages will appear here when the connected WhatsApp bridge posts events to this instance webhook." />}</div>}
      </Modal>

      <Modal open={!!qrInstanceId} onClose={() => setQrInstanceId(null)} title={qrInstance ? `${qrInstance.label} · WhatsApp Web` : "WhatsApp Web"} size="md" footer={<div className="flex justify-end gap-2">{qrInstance?.status === "error" && <button className="btn-primary" onClick={() => actionMutation.mutate({ id: qrInstance.id, action: "connect" })} disabled={actionMutation.isPending}><QrCode size={15} /> Generate new QR</button>}<button className="btn-secondary" onClick={() => setQrInstanceId(null)}>Close</button></div>}>
        {qrInstance && <div className="flex flex-col items-center gap-4 text-center"><div className="w-full rounded-xl border border-ink-100 bg-[#F8F7F3] p-4"><p className="font-semibold text-ink-900">{qrInstance.status === "connected" ? "WhatsApp Web connected" : "Scan this QR code"}</p><p className="mt-1 text-sm text-ink-500">On the employee’s phone, open WhatsApp → Linked devices → Link a device.</p>{qrInstance.qr_code ? <img className="mx-auto mt-4 h-64 w-64 rounded-lg bg-white p-2" src={qrInstance.qr_code} alt="WhatsApp Web QR code" /> : <div className="mx-auto mt-5 flex h-64 w-64 items-center justify-center rounded-lg border border-dashed border-ink-200 bg-white px-6 text-sm text-ink-500">{qrInstance.status === "connecting" ? "Generating a fresh QR code…" : qrInstance.status === "connected" ? "This number is already linked." : qrInstance.last_error || "Start the connection to generate a QR code."}</div>}</div><p className="text-xs text-ink-500">This QR code is private to this instance and expires shortly. Do not share screenshots of it.</p></div>}
      </Modal>

      <Modal open={!!tokenNotice} onClose={() => setTokenNotice(null)} title="Bridge token — copy it now" size="md" footer={<button className="btn-primary" onClick={() => setTokenNotice(null)}>Done</button>}>
        {tokenNotice && <div className="flex flex-col gap-4"><div className="flex items-start gap-3 rounded-xl border border-warning/25 bg-warning/5 p-3"><CircleAlert size={18} className="mt-0.5 shrink-0 text-warning" /><p className="text-sm text-ink-700">This token is displayed once. It is used by the private bridge to post events for this number; never share it with employees.</p></div><div><label className="mb-1.5 block text-xs font-medium text-ink-500">Webhook URL</label><div className="flex gap-2"><input className="input font-mono text-xs" readOnly value={tokenNotice.instance.webhook_url} /><button className="btn-secondary shrink-0" onClick={() => { void navigator.clipboard.writeText(tokenNotice.instance.webhook_url); }} aria-label="Copy webhook URL"><Copy size={15} /></button></div></div><div><label className="mb-1.5 block text-xs font-medium text-ink-500">Webhook token</label><div className="flex gap-2"><input className="input font-mono text-xs" readOnly value={tokenNotice.token} /><button className="btn-secondary shrink-0" onClick={copyToken} aria-label="Copy webhook token">{copied ? <Check size={15} /> : <Copy size={15} />}</button></div></div><p className="text-xs text-ink-500">The token is normally managed automatically by the bridge. Use it only when configuring a compatible external bridge.</p></div>}
      </Modal>

      <ConfirmModal open={!!removeTarget} onClose={() => setRemoveTarget(null)} onConfirm={() => removeTarget && removeMutation.mutate(removeTarget.id)} title="Remove WhatsApp instance?" message={`This will permanently remove ${removeTarget?.label ?? "this instance"} and its tracked message history. The external WhatsApp session must also be stopped in the bridge.`} confirmLabel="Remove instance" isLoading={removeMutation.isPending} />
    </div>
  );
}
