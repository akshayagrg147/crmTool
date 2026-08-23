import { useMemo, useState, type FormEvent } from "react";
import { addDays, format, isBefore, isSameDay, startOfDay, startOfWeek } from "date-fns";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Check, CheckCircle2, Clock3, ListTodo, Plus, Search, Trash2, UserRound } from "lucide-react";
import { leadsApi, tasksApi, usersApi } from "@/api/endpoints";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { EmptyState } from "@/components/EmptyState";
import { Modal } from "@/components/Modal";
import { PageLoading } from "@/components/Spinner";
import type { TaskOut, TaskPriority, TaskStatus, TaskType } from "@/api/types";

const PRIORITY_STYLES: Record<TaskPriority, string> = {
  low: "bg-ink-50 text-ink-500",
  normal: "bg-primary-soft text-primary",
  high: "bg-accent-soft text-accent-dark",
  urgent: "bg-danger/10 text-danger",
};

const TYPE_LABELS: Record<TaskType, string> = { callback: "Callback", task: "Task", meeting: "Meeting", reminder: "Reminder" };

function dueLabel(task: TaskOut) {
  if (!task.due_at) return "No due date";
  const date = new Date(task.due_at);
  if (isBefore(date, new Date()) && task.status === "open") return `Overdue · ${format(date, "d MMM, h:mm a")}`;
  return format(date, "d MMM, h:mm a");
}

function TaskCard({ task, onComplete, onDelete }: { task: TaskOut; onComplete: () => void; onDelete: () => void }) {
  const overdue = task.status === "open" && !!task.due_at && isBefore(new Date(task.due_at), new Date());
  return <article className={`group rounded-[14px] border bg-surface p-4 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover ${overdue ? "border-danger/25" : "border-ink-100"}`}><div className="flex items-start gap-3"><button type="button" aria-label={task.status === "completed" ? "Task completed" : `Complete ${task.title}`} disabled={task.status !== "open"} onClick={onComplete} className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors ${task.status === "completed" ? "border-secondary bg-secondary text-white" : "border-ink-200 text-transparent hover:border-secondary hover:bg-secondary/10 hover:text-secondary"}`}><Check size={14} strokeWidth={3} /></button><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className={`truncate text-sm font-bold ${task.status === "completed" ? "text-ink-400 line-through" : "text-ink-900"}`}>{task.title}</h3><span className={`badge ${PRIORITY_STYLES[task.priority]}`}>{task.priority}</span></div><div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500"><span className={`flex items-center gap-1 ${overdue ? "font-semibold text-danger" : ""}`}><Clock3 size={12} /> {dueLabel(task)}</span><span className="flex items-center gap-1"><ListTodo size={12} /> {TYPE_LABELS[task.task_type]}</span></div>{task.description && <p className="mt-3 line-clamp-2 text-xs leading-5 text-ink-600">{task.description}</p>}<div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] text-ink-400">{task.lead_name && <span className="rounded-md bg-ink-50 px-2 py-1 font-semibold text-ink-600">{task.lead_name}</span>}{task.assigned_to_name && <span className="flex items-center gap-1"><UserRound size={11} /> {task.assigned_to_name}</span>}</div></div><button type="button" aria-label={`Delete ${task.title}`} onClick={onDelete} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-300 opacity-0 transition-all hover:bg-danger/10 hover:text-danger group-hover:opacity-100 focus-visible:opacity-100"><Trash2 size={15} /></button></div></article>;
}

function CreateTaskModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (payload: { title: string; description?: string; lead_id?: string; assigned_to?: string; task_type?: TaskType; priority?: TaskPriority; due_at?: string }) => void }) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [taskType, setTaskType] = useState<TaskType>("task");
  const [priority, setPriority] = useState<TaskPriority>("normal");
  const [dueAt, setDueAt] = useState("");
  const [leadId, setLeadId] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const { data: leads } = useQuery({ queryKey: ["task-leads"], queryFn: () => leadsApi.list({ page: 1, page_size: 200 }) });
  const { data: team } = useQuery({ queryKey: ["team"], queryFn: usersApi.list, enabled: user?.role !== "telecaller" });

  function reset() {
    setTitle(""); setDescription(""); setTaskType("task"); setPriority("normal"); setDueAt(""); setLeadId(""); setAssignedTo("");
  }
  function close() { reset(); onClose(); }
  function submit(event: FormEvent) {
    event.preventDefault();
    onCreated({ title: title.trim(), description: description.trim() || undefined, task_type: taskType, priority, due_at: dueAt ? new Date(dueAt).toISOString() : undefined, lead_id: leadId || undefined, assigned_to: assignedTo || undefined });
    reset();
  }

  return <Modal open={open} onClose={close} title="Create task" size="md" footer={<><button type="button" className="btn-secondary" onClick={close}>Cancel</button><button form="create-task-form" type="submit" className="btn-primary" disabled={!title.trim()}><Plus size={15} /> Create task</button></>}><form id="create-task-form" onSubmit={submit} className="space-y-4"><div><label htmlFor="task-title" className="mb-1.5 block text-xs font-semibold text-ink-600">Task title <span className="text-danger">*</span></label><input id="task-title" autoFocus className="input" placeholder="e.g. Call back about order terms" value={title} onChange={(event) => setTitle(event.target.value)} required /></div><div><label htmlFor="task-description" className="mb-1.5 block text-xs font-semibold text-ink-600">Description</label><textarea id="task-description" className="input min-h-20 resize-y" placeholder="Add context for the next person..." value={description} onChange={(event) => setDescription(event.target.value)} /></div><div className="grid gap-3 sm:grid-cols-2"><div><label htmlFor="task-type" className="mb-1.5 block text-xs font-semibold text-ink-600">Type</label><select id="task-type" className="input" value={taskType} onChange={(event) => setTaskType(event.target.value as TaskType)}>{Object.entries(TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div><div><label htmlFor="task-priority" className="mb-1.5 block text-xs font-semibold text-ink-600">Priority</label><select id="task-priority" className="input" value={priority} onChange={(event) => setPriority(event.target.value as TaskPriority)}>{["low", "normal", "high", "urgent"].map((value) => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}</select></div></div><div className="grid gap-3 sm:grid-cols-2"><div><label htmlFor="task-due" className="mb-1.5 block text-xs font-semibold text-ink-600">Due date and time</label><input id="task-due" type="datetime-local" className="input" value={dueAt} onChange={(event) => setDueAt(event.target.value)} /></div><div><label htmlFor="task-lead" className="mb-1.5 block text-xs font-semibold text-ink-600">Linked lead</label><select id="task-lead" className="input" value={leadId} onChange={(event) => setLeadId(event.target.value)}><option value="">No linked lead</option>{leads?.items.map((lead) => <option key={lead.id} value={lead.id}>{lead.name} · {lead.phone}</option>)}</select></div></div>{user?.role !== "telecaller" && <div><label htmlFor="task-assignee" className="mb-1.5 block text-xs font-semibold text-ink-600">Assign to</label><select id="task-assignee" className="input" value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)}><option value="">Me</option>{team?.filter((member) => member.is_active).map((member) => <option key={member.id} value={member.id}>{member.name} · {member.role}</option>)}</select></div>}</form></Modal>;
}

export function TasksPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<TaskStatus>("open");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"agenda" | "calendar">("agenda");
  const [showCreate, setShowCreate] = useState(false);
  const taskQuery = useQuery({ queryKey: ["tasks", statusFilter], queryFn: () => tasksApi.list({ status: statusFilter, page: 1, page_size: 200 }) });
  const createMutation = useMutation({ mutationFn: tasksApi.create, onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["tasks"] }); setShowCreate(false); toast("Task created", "success"); }, onError: (error) => toast(error, "error") });
  const updateMutation = useMutation({ mutationFn: ({ id, status }: { id: string; status: TaskStatus }) => tasksApi.update(id, { status }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }), onError: (error) => toast(error, "error") });
  const deleteMutation = useMutation({ mutationFn: tasksApi.remove, onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["tasks"] }); toast("Task deleted", "success"); }, onError: (error) => toast(error, "error") });

  const items = useMemo(() => { const query = search.trim().toLowerCase(); return (taskQuery.data?.items ?? []).filter((task) => !query || task.title.toLowerCase().includes(query) || task.lead_name?.toLowerCase().includes(query) || task.assigned_to_name?.toLowerCase().includes(query)); }, [taskQuery.data?.items, search]);
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));

  if (taskQuery.isLoading) return <PageLoading />;
  return <div className="flex flex-col gap-5 pb-8"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="page-eyebrow mb-1">Workspace / Execution</p><h1 className="page-title">Tasks &amp; calendar</h1><p className="page-subtitle">Turn every promise into a visible next action.</p></div><button type="button" className="btn-primary" onClick={() => setShowCreate(true)}><Plus size={17} /> New task</button></div><div className="flex flex-wrap items-center gap-2 rounded-[14px] border border-ink-100 bg-surface p-3 shadow-card"><div className="relative min-w-[220px] flex-1"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" /><input aria-label="Search tasks" className="input py-2 pl-8" placeholder="Search tasks, leads, or owners..." value={search} onChange={(event) => setSearch(event.target.value)} /></div><select aria-label="Filter tasks by status" className="input w-full py-2 sm:w-auto" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as TaskStatus)}><option value="open">Open tasks</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select><div className="flex rounded-lg border border-ink-100 bg-[#F8F7F3] p-1"><button type="button" className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold ${view === "agenda" ? "bg-primary text-white" : "text-ink-500"}`} onClick={() => setView("agenda")}><ListTodo size={14} /> Agenda</button><button type="button" className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold ${view === "calendar" ? "bg-primary text-white" : "text-ink-500"}`} onClick={() => setView("calendar")}><CalendarDays size={14} /> Week</button></div></div>{view === "calendar" ? <section className="rounded-[18px] border border-ink-100 bg-surface p-4 shadow-card sm:p-5"><div className="mb-4 flex items-center justify-between"><div><p className="page-eyebrow">This week</p><h2 className="mt-1 text-lg font-semibold text-ink-900">{format(weekStart, "d MMM")} — {format(addDays(weekStart, 6), "d MMM yyyy")}</h2></div><CalendarDays size={20} className="text-primary" /></div><div className="grid gap-2 md:grid-cols-7">{weekDays.map((day) => { const dayTasks = items.filter((task) => task.due_at && isSameDay(new Date(task.due_at), day)); return <div key={day.toISOString()} className={`min-h-36 rounded-xl border p-3 ${isSameDay(day, new Date()) ? "border-primary/35 bg-primary-soft/45" : "border-ink-100 bg-[#FCFCFA]"}`}><div className="flex items-center justify-between gap-2"><span className="text-[10px] font-bold uppercase tracking-wide text-ink-500">{format(day, "EEE")}</span><strong className="text-sm text-ink-900">{format(day, "d")}</strong></div><div className="mt-3 space-y-2">{dayTasks.length ? dayTasks.map((task) => <button type="button" key={task.id} onClick={() => task.status === "open" && updateMutation.mutate({ id: task.id, status: "completed" })} className={`block w-full rounded-lg border px-2 py-2 text-left text-[10px] font-semibold ${task.status === "completed" ? "border-secondary/15 bg-secondary/10 text-secondary line-through" : "border-primary/10 bg-white text-ink-800"}`}>{task.title}</button>) : <p className="text-[10px] text-ink-300">No tasks</p>}</div></div>; })}</div></section> : <section className="space-y-3">{!items.length ? <div className="card"><EmptyState icon={CheckCircle2} title={statusFilter === "open" ? "No open tasks" : "No tasks found"} message="Create a task to keep your team aligned on the next action." action={<button type="button" className="btn-primary text-xs" onClick={() => setShowCreate(true)}><Plus size={14} /> Create task</button>} /></div> : items.map((task) => <TaskCard key={task.id} task={task} onComplete={() => updateMutation.mutate({ id: task.id, status: "completed" })} onDelete={() => deleteMutation.mutate(task.id)} />)}</section>}<div className="flex items-center gap-2 rounded-[14px] border border-primary/10 bg-primary-soft/55 px-4 py-3 text-xs text-ink-600"><Clock3 size={15} className="text-primary" />{taskQuery.data?.total ?? 0} {statusFilter} tasks in your workspace{user?.role !== "telecaller" ? " · visible to your team" : " · assigned to you"}</div><CreateTaskModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={(payload) => createMutation.mutate(payload)} /></div>;
}

export default TasksPage;
