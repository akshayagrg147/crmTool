import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Check, ClipboardCheck, Clock3, FileText, Plus, Send, X } from "lucide-react";
import { attendanceApi } from "@/api/endpoints";
import { EmptyState } from "@/components/EmptyState";
import { PageLoading } from "@/components/Spinner";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { formatDate, formatDateTime } from "@/lib/format";
import type { LeaveStatus, TimeEntryCategory, TimeEntryStatus } from "@/api/types";

const categories: { value: TimeEntryCategory; label: string }[] = [
  { value: "event", label: "Event / celebration" },
  { value: "training", label: "Training" },
  { value: "admin", label: "Admin work" },
  { value: "other", label: "Other" },
];
const leaveTypes = ["casual", "sick", "planned", "personal", "other"] as const;

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function todayForMonth(month: string) {
  const today = new Date().toISOString().slice(0, 10);
  return today.startsWith(month) ? today : `${month}-01`;
}

function monthEnd(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10);
}

function statusClass(status: string) {
  if (status === "approved") return "bg-success/10 text-success";
  if (status === "rejected") return "bg-danger/10 text-danger";
  return "bg-accent-soft text-accent-dark";
}

export function AttendancePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(currentMonth);
  const [entryDate, setEntryDate] = useState(todayForMonth(currentMonth()));
  const [hours, setHours] = useState("");
  const [category, setCategory] = useState<TimeEntryCategory>("event");
  const [description, setDescription] = useState("");
  const [leaveStart, setLeaveStart] = useState(todayForMonth(currentMonth()));
  const [leaveEnd, setLeaveEnd] = useState(todayForMonth(currentMonth()));
  const [leaveType, setLeaveType] = useState<(typeof leaveTypes)[number]>("personal");
  const [leaveReason, setLeaveReason] = useState("");
  const isReviewer = user?.role === "admin" || user?.role === "manager";

  const { data, isLoading } = useQuery({
    queryKey: ["attendance", month],
    queryFn: () => attendanceApi.overview(month),
  });
  const { data: approvals } = useQuery({
    queryKey: ["attendance-approvals", month],
    queryFn: () => attendanceApi.approvals(month),
    enabled: isReviewer,
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["attendance", month] });
    if (isReviewer) void queryClient.invalidateQueries({ queryKey: ["attendance-approvals", month] });
    void queryClient.invalidateQueries({ queryKey: ["payroll", month] });
  };

  const timeMutation = useMutation({
    mutationFn: () => attendanceApi.createTimeEntry({ entry_date: entryDate, hours: Number(hours), category, description: description || undefined }),
    onSuccess: () => { refresh(); toast("Work time submitted for approval.", "success"); setHours(""); setDescription(""); },
    onError: (error: any) => toast(error?.response?.data?.detail ?? "Couldn't submit work time.", "error"),
  });
  const leaveMutation = useMutation({
    mutationFn: () => attendanceApi.createLeave({ start_date: leaveStart, end_date: leaveEnd, leave_type: leaveType, reason: leaveReason }),
    onSuccess: () => { refresh(); toast("Leave request submitted.", "success"); setLeaveReason(""); },
    onError: (error: any) => toast(error?.response?.data?.detail ?? "Couldn't submit leave request.", "error"),
  });
  const reviewTimeMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TimeEntryStatus }) => attendanceApi.reviewTimeEntry(id, status),
    onSuccess: (_result, variables) => { refresh(); toast(`Time entry ${variables.status}.`, "success"); },
    onError: (error: any) => toast(error?.response?.data?.detail ?? "Couldn't review time entry.", "error"),
  });
  const reviewLeaveMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: LeaveStatus }) => attendanceApi.reviewLeave(id, status),
    onSuccess: (_result, variables) => { refresh(); toast(`Leave request ${variables.status}.`, "success"); },
    onError: (error: any) => toast(error?.response?.data?.detail ?? "Couldn't review leave request.", "error"),
  });

  if (isLoading || !data) return <PageLoading />;

  const totalHours = data.entries.reduce((total, entry) => total + entry.hours, 0);
  const approvedHours = data.entries.filter((entry) => entry.status === "approved").reduce((total, entry) => total + entry.hours, 0);
  const pendingLeaves = data.leaves.filter((leave) => leave.status === "pending").length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-ink-100 pb-5">
        <div><p className="page-eyebrow mb-1">Operations / Attendance</p><h1 className="page-title">My time & leave</h1><p className="page-subtitle">Log every kind of work, request leave, and keep approvals in one place.</p></div>
        <label className="flex items-center gap-2 text-sm font-medium text-ink-600"><CalendarClock size={16} className="text-ink-400" /><span className="sr-only">Attendance month</span><input type="month" className="input w-auto py-2" value={month} onChange={(event) => { setMonth(event.target.value); setEntryDate(todayForMonth(event.target.value)); setLeaveStart(todayForMonth(event.target.value)); setLeaveEnd(todayForMonth(event.target.value)); }} /></label>
      </div>

      <div className="rounded-xl border border-primary/10 bg-primary-soft/50 px-4 py-3 text-sm text-primary-dark"><span className="font-semibold">Private payroll:</span> your hours and leave requests are visible to the assigned manager and admin for approval. Salary totals are available only in the admin Payroll workspace.</div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card p-5"><p className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-500">Logged hours</p><p className="mt-3 text-3xl font-bold tabular-nums text-ink-900">{totalHours.toFixed(1)}h</p><p className="mt-1 text-xs text-ink-500">{approvedHours.toFixed(1)}h approved</p></div>
        <div className="card p-5"><p className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-500">Leave requests</p><p className="mt-3 text-3xl font-bold tabular-nums text-ink-900">{data.leaves.length}</p><p className="mt-1 text-xs text-ink-500">{pendingLeaves} awaiting review</p></div>
        {isReviewer ? <div className="card border-accent/15 bg-accent-soft/30 p-5"><p className="text-[11px] font-bold uppercase tracking-[0.12em] text-accent-dark">Team approvals</p><p className="mt-3 text-3xl font-bold tabular-nums text-ink-900">{data.pending_approvals}</p><p className="mt-1 text-xs text-ink-600">Pending in this workspace</p></div> : <div className="card p-5"><p className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-500">Work rule</p><p className="mt-3 text-3xl font-bold tabular-nums text-ink-900">8h</p><p className="mt-1 text-xs text-ink-500">Standard weekday target</p></div>}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <section className="card p-5 sm:p-6">
          <div className="mb-5 flex items-start gap-3"><div className="rounded-xl bg-primary-soft p-2.5 text-primary"><Clock3 size={19} /></div><div><h2 className="panel-header font-semibold text-ink-900">Log work time</h2><p className="mt-1 text-xs text-ink-500">Calling time is captured automatically when you log a call. Use this for events, training, admin work, or anything extra.</p></div></div>
          <form className="grid grid-cols-1 gap-3 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); if (Number(hours) > 0) timeMutation.mutate(); }}>
            <label className="text-xs font-semibold text-ink-600">Date<input required type="date" min={`${month}-01`} max={monthEnd(month)} className="input mt-1.5" value={entryDate} onChange={(event) => setEntryDate(event.target.value)} /></label>
            <label className="text-xs font-semibold text-ink-600">Hours<input required min="0.25" max="24" step="0.25" type="number" className="input mt-1.5" placeholder="e.g. 3.5" value={hours} onChange={(event) => setHours(event.target.value)} /></label>
            <label className="text-xs font-semibold text-ink-600 sm:col-span-2">Category<select className="input mt-1.5" value={category} onChange={(event) => setCategory(event.target.value as TimeEntryCategory)}>{categories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
            <label className="text-xs font-semibold text-ink-600 sm:col-span-2">Description <span className="font-normal text-ink-400">(optional)</span><input className="input mt-1.5" maxLength={500} placeholder="What did you work on?" value={description} onChange={(event) => setDescription(event.target.value)} /></label>
            <button className="btn-primary sm:col-span-2" type="submit" disabled={timeMutation.isPending || !hours}><Send size={16} />{timeMutation.isPending ? "Submitting…" : "Submit time for approval"}</button>
          </form>
        </section>

        <section className="card p-5 sm:p-6">
          <div className="mb-5 flex items-start gap-3"><div className="rounded-xl bg-accent-soft p-2.5 text-accent-dark"><CalendarClock size={19} /></div><div><h2 className="panel-header font-semibold text-ink-900">Request leave</h2><p className="mt-1 text-xs text-ink-500">Your manager or admin will review the request before it affects payroll.</p></div></div>
          <form className="grid grid-cols-1 gap-3 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); leaveMutation.mutate(); }}>
            <label className="text-xs font-semibold text-ink-600">From<input required type="date" min={`${month}-01`} max={monthEnd(month)} className="input mt-1.5" value={leaveStart} onChange={(event) => setLeaveStart(event.target.value)} /></label>
            <label className="text-xs font-semibold text-ink-600">To<input required type="date" min={`${month}-01`} max={monthEnd(month)} className="input mt-1.5" value={leaveEnd} onChange={(event) => setLeaveEnd(event.target.value)} /></label>
            <label className="text-xs font-semibold text-ink-600 sm:col-span-2">Leave type<select className="input mt-1.5" value={leaveType} onChange={(event) => setLeaveType(event.target.value as (typeof leaveTypes)[number])}>{leaveTypes.map((type) => <option key={type} value={type}>{type[0].toUpperCase() + type.slice(1)}</option>)}</select></label>
            <label className="text-xs font-semibold text-ink-600 sm:col-span-2">Reason<textarea required minLength={2} maxLength={500} rows={3} className="input mt-1.5 resize-none" placeholder="Tell your manager why you need leave" value={leaveReason} onChange={(event) => setLeaveReason(event.target.value)} /></label>
            <button className="btn-primary sm:col-span-2" type="submit" disabled={leaveMutation.isPending || leaveReason.trim().length < 2}><Plus size={16} />{leaveMutation.isPending ? "Submitting…" : "Submit leave request"}</button>
          </form>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <section className="card overflow-hidden"><div className="border-b border-ink-100 px-5 py-4"><h2 className="font-semibold text-ink-900">My work entries</h2><p className="mt-1 text-xs text-ink-500">Work logged for {month}.</p></div>{data.entries.length === 0 ? <EmptyState icon={Clock3} title="No work logged" message="Add your first time entry above." /> : <div className="divide-y divide-ink-100">{data.entries.map((entry) => <div key={entry.id} className="flex items-start gap-3 px-5 py-3.5"><div className="rounded-lg bg-primary-soft p-2 text-primary"><Clock3 size={15} /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium text-ink-800">{categories.find((item) => item.value === entry.category)?.label ?? entry.category}</p><span className={`badge ${statusClass(entry.status)}`}>{entry.status}</span></div><p className="mt-0.5 text-xs text-ink-500">{formatDate(entry.entry_date)} · {entry.hours.toFixed(2)} hours</p>{entry.description && <p className="mt-1 text-xs text-ink-600">{entry.description}</p>}</div></div>)}</div>}</section>
        <section className="card overflow-hidden"><div className="border-b border-ink-100 px-5 py-4"><h2 className="font-semibold text-ink-900">My leave requests</h2><p className="mt-1 text-xs text-ink-500">Requests and decisions for {month}.</p></div>{data.leaves.length === 0 ? <EmptyState icon={CalendarClock} title="No leave requests" message="You can request leave above when needed." /> : <div className="divide-y divide-ink-100">{data.leaves.map((leave) => <div key={leave.id} className="flex items-start gap-3 px-5 py-3.5"><div className="rounded-lg bg-accent-soft p-2 text-accent-dark"><CalendarClock size={15} /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium text-ink-800">{leave.leave_type} leave</p><span className={`badge ${statusClass(leave.status)}`}>{leave.status}</span></div><p className="mt-0.5 text-xs text-ink-500">{formatDate(leave.start_date)} – {formatDate(leave.end_date)}</p><p className="mt-1 text-xs text-ink-600">{leave.reason}</p>{leave.reviewed_by_name && <p className="mt-1 text-[11px] text-ink-400">Reviewed by {leave.reviewed_by_name}</p>}</div></div>)}</div>}</section>
      </div>

      {isReviewer && (
        <section className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 px-5 py-4"><div><h2 className="flex items-center gap-2 font-semibold text-ink-900"><ClipboardCheck size={18} className="text-primary" /> Approval queue</h2><p className="mt-1 text-xs text-ink-500">Approve or reject team submissions. Managers review telecaller activity; admins can review everyone.</p></div><span className="badge bg-accent-soft text-accent-dark">{(approvals?.time_entries.length ?? 0) + (approvals?.leaves.length ?? 0)} pending</span></div>
          {!approvals || (approvals.time_entries.length === 0 && approvals.leaves.length === 0) ? <EmptyState icon={ClipboardCheck} title="All caught up" message="There are no pending time or leave requests for this month." /> : <div className="divide-y divide-ink-100">
            {approvals.time_entries.map((entry) => <div key={`approval-time-${entry.id}`} className="flex flex-wrap items-center gap-3 px-5 py-4"><div className="rounded-lg bg-primary-soft p-2 text-primary"><Clock3 size={15} /></div><div className="min-w-[180px] flex-1"><p className="font-medium text-ink-800">{entry.user_name ?? "Team member"}</p><p className="mt-0.5 text-xs text-ink-500">{formatDate(entry.entry_date)} · {entry.hours.toFixed(2)}h · {categories.find((item) => item.value === entry.category)?.label ?? entry.category}</p>{entry.description && <p className="mt-1 text-xs text-ink-600">{entry.description}</p>}</div><p className="mr-2 text-[11px] text-ink-400">Submitted {formatDateTime(entry.created_at)}</p><div className="flex gap-2"><button type="button" className="btn-secondary px-3 py-1.5 text-xs text-danger" disabled={reviewTimeMutation.isPending} onClick={() => reviewTimeMutation.mutate({ id: entry.id, status: "rejected" })}><X size={14} /> Reject</button><button type="button" className="btn-primary px-3 py-1.5 text-xs" disabled={reviewTimeMutation.isPending} onClick={() => reviewTimeMutation.mutate({ id: entry.id, status: "approved" })}><Check size={14} /> Approve</button></div></div>)}
            {approvals.leaves.map((leave) => <div key={`approval-leave-${leave.id}`} className="flex flex-wrap items-center gap-3 px-5 py-4"><div className="rounded-lg bg-accent-soft p-2 text-accent-dark"><FileText size={15} /></div><div className="min-w-[180px] flex-1"><p className="font-medium text-ink-800">{leave.user_name ?? "Team member"} · {leave.leave_type} leave</p><p className="mt-0.5 text-xs text-ink-500">{formatDate(leave.start_date)} – {formatDate(leave.end_date)}</p><p className="mt-1 text-xs text-ink-600">{leave.reason}</p></div><div className="flex gap-2"><button type="button" className="btn-secondary px-3 py-1.5 text-xs text-danger" disabled={reviewLeaveMutation.isPending} onClick={() => reviewLeaveMutation.mutate({ id: leave.id, status: "rejected" })}><X size={14} /> Reject</button><button type="button" className="btn-primary px-3 py-1.5 text-xs" disabled={reviewLeaveMutation.isPending} onClick={() => reviewLeaveMutation.mutate({ id: leave.id, status: "approved" })}><Check size={14} /> Approve</button></div></div>)}
          </div>}
        </section>
      )}
    </div>
  );
}
