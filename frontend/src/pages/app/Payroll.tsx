import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CalendarDays,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Edit3,
  IndianRupee,
  Plus,
  Save,
  Trash2,
  Users2,
  Wallet,
  X,
} from "lucide-react";
import { attendanceApi, payrollApi } from "@/api/endpoints";
import { EmptyState } from "@/components/EmptyState";
import { PageLoading } from "@/components/Spinner";
import { KpiCard } from "@/components/KpiCard";
import { useToast } from "@/hooks/useToast";
import { formatCurrencyFull, formatDate, initials } from "@/lib/format";
import type { PayrollEmployee, TimeEntryCategory } from "@/api/types";

const roleLabels = { admin: "Admin", manager: "Manager", telecaller: "Telecaller", super_admin: "Super admin" } as const;
const categories: { value: TimeEntryCategory; label: string }[] = [
  { value: "calling", label: "Calling" },
  { value: "event", label: "Events & celebrations" },
  { value: "training", label: "Training" },
  { value: "admin", label: "Admin work" },
  { value: "other", label: "Other" },
];
const weekdays = [
  { value: 0, label: "Mon" },
  { value: 1, label: "Tue" },
  { value: 2, label: "Wed" },
  { value: 3, label: "Thu" },
  { value: 4, label: "Fri" },
  { value: 5, label: "Sat" },
  { value: 6, label: "Sun" },
];

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
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

export function PayrollPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(currentMonth);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [editingRateId, setEditingRateId] = useState<string | null>(null);
  const [rate, setRate] = useState("");
  const [standardHours, setStandardHours] = useState("8");
  const [entryDate, setEntryDate] = useState(`${currentMonth()}-01`);
  const [entryHours, setEntryHours] = useState("");
  const [entryCategory, setEntryCategory] = useState<TimeEntryCategory>("calling");
  const [entryDescription, setEntryDescription] = useState("");
  const [workingDays, setWorkingDays] = useState<number[]>([0, 1, 2, 3, 4]);
  const [scheduleHours, setScheduleHours] = useState("8");
  const [exceptionDate, setExceptionDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [exceptionName, setExceptionName] = useState("");
  const [exceptionIsWorkingDay, setExceptionIsWorkingDay] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["payroll", month],
    queryFn: () => payrollApi.summary(month),
  });
  const { data: schedule, isLoading: scheduleLoading } = useQuery({
    queryKey: ["payroll-schedule"],
    queryFn: payrollApi.schedule,
  });

  useEffect(() => {
    if (!schedule) return;
    setWorkingDays(schedule.working_days);
    setScheduleHours(String(schedule.standard_hours_per_day));
  }, [schedule]);

  const selectedEmployee = useMemo(
    () => data?.employees.find((employee) => employee.user_id === selectedEmployeeId) ?? null,
    [data?.employees, selectedEmployeeId],
  );

  const rateMutation = useMutation({
    mutationFn: ({ userId, hourlyRate, hours }: { userId: string; hourlyRate: number; hours: number }) =>
      payrollApi.updateRate(userId, { hourly_rate: hourlyRate, standard_hours_per_day: hours }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["payroll", month] });
      toast("Payroll profile saved.", "success");
      setEditingRateId(null);
    },
    onError: (error: any) => toast(error?.response?.data?.detail ?? "Couldn't save payroll profile.", "error"),
  });

  const scheduleMutation = useMutation({
    mutationFn: () => payrollApi.updateSchedule({ working_days: workingDays, standard_hours_per_day: Number(scheduleHours) }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["payroll-schedule"] });
      void queryClient.invalidateQueries({ queryKey: ["payroll"] });
      toast("Work schedule saved.", "success");
    },
    onError: (error: any) => toast(error?.response?.data?.detail ?? "Couldn't save work schedule.", "error"),
  });

  const exceptionMutation = useMutation({
    mutationFn: () => payrollApi.addScheduleException({ exception_date: exceptionDate, name: exceptionName, is_working_day: exceptionIsWorkingDay }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["payroll-schedule"] });
      void queryClient.invalidateQueries({ queryKey: ["payroll"] });
      toast(exceptionIsWorkingDay ? "Working-day override added." : "Holiday added.", "success");
      setExceptionName("");
    },
    onError: (error: any) => toast(error?.response?.data?.detail ?? "Couldn't add schedule exception.", "error"),
  });

  const removeExceptionMutation = useMutation({
    mutationFn: (id: string) => payrollApi.removeScheduleException(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["payroll-schedule"] });
      void queryClient.invalidateQueries({ queryKey: ["payroll"] });
      toast("Schedule override removed.", "success");
    },
    onError: (error: any) => toast(error?.response?.data?.detail ?? "Couldn't remove schedule exception.", "error"),
  });

  const timeMutation = useMutation({
    mutationFn: () => {
      if (!selectedEmployee) throw new Error("Select an employee first");
      return attendanceApi.createTimeEntry({
        user_id: selectedEmployee.user_id,
        entry_date: entryDate,
        hours: Number(entryHours),
        category: entryCategory,
        description: entryDescription || undefined,
        status: "approved",
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["payroll", month] });
      toast("Approved work time added to payroll.", "success");
      setEntryHours("");
      setEntryDescription("");
    },
    onError: (error: any) => toast(error?.response?.data?.detail ?? error?.message ?? "Couldn't record work time.", "error"),
  });

  function startEditing(employee: PayrollEmployee) {
    setEditingRateId(employee.user_id);
    setRate(String(employee.hourly_rate || ""));
    setStandardHours(String(employee.standard_hours_per_day || 8));
  }

  function selectEmployee(employee: PayrollEmployee) {
    setSelectedEmployeeId(employee.user_id);
    setEntryDate(`${month}-01`);
  }

  if (isLoading || !data || scheduleLoading || !schedule) return <PageLoading />;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-ink-100 pb-5">
        <div>
          <p className="page-eyebrow mb-1">Admin / People operations</p>
          <h1 className="page-title">Payroll workspace</h1>
          <p className="page-subtitle">Set hourly rates, review approved work, and calculate what each team member is owed.</p>
        </div>
        <label className="flex items-center gap-2 text-sm font-medium text-ink-600">
          <CalendarDays size={16} className="text-ink-400" />
          <span className="sr-only">Payroll month</span>
          <input type="month" className="input w-auto py-2" value={month} onChange={(event) => setMonth(event.target.value)} />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Estimated payroll" value={formatCurrencyFull(data.total_estimated_pay)} icon={Wallet} color="indigo" />
        <KpiCard label="Approved hours" value={`${data.total_approved_hours.toFixed(1)}h`} icon={CheckCircle2} color="teal" />
        <KpiCard label="Pending hours" value={`${data.total_pending_hours.toFixed(1)}h`} icon={Clock3} color="orange" />
        <KpiCard label="Approved leave days" value={data.total_leave_days.toFixed(1)} icon={Users2} color="pink" />
      </div>

      <section className="card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2"><CalendarDays size={17} className="text-primary" /><h2 className="panel-header font-semibold text-ink-900">Work schedule</h2><span className="badge bg-primary-soft text-primary-dark">Admin only</span></div>
            <p className="mt-1.5 max-w-2xl text-xs leading-5 text-ink-500">Choose the days your organization normally works. Add a one-off holiday or a working Saturday when the schedule changes for a specific date.</p>
          </div>
          <p className="rounded-lg bg-bg px-3 py-2 text-xs font-semibold text-ink-600">{workingDays.length} day{workingDays.length === 1 ? "" : "s"}/week · {Number(scheduleHours || 0).toFixed(2)}h/day</p>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[1.3fr_0.7fr]">
          <div>
            <p className="text-xs font-semibold text-ink-700">Regular working days</p>
            <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-7" role="group" aria-label="Regular working days">
              {weekdays.map((day) => {
                const selected = workingDays.includes(day.value);
                return <label key={day.value} className={`flex cursor-pointer items-center justify-center rounded-lg border px-2 py-2.5 text-xs font-semibold transition-colors ${selected ? "border-primary/30 bg-primary-soft text-primary-dark" : "border-ink-100 bg-white text-ink-400 hover:border-ink-200 hover:text-ink-600"}`}><input type="checkbox" className="sr-only" checked={selected} onChange={() => setWorkingDays((current) => selected ? (current.length === 1 ? current : current.filter((value) => value !== day.value)) : [...current, day.value].sort((a, b) => a - b))} />{day.label}</label>;
              })}
            </div>
            <p className="mt-2 text-[11px] text-ink-400">Saturday is off by default. Select it if your team works Saturdays.</p>
          </div>
          <label className="text-xs font-semibold text-ink-700">Default hours per working day<input required min="0.25" max="24" step="0.25" type="number" className="input mt-2" value={scheduleHours} onChange={(event) => setScheduleHours(event.target.value)} /><span className="mt-1 block text-[11px] font-normal text-ink-400">Employee-specific hours can still be overridden in the payroll table.</span></label>
        </div>
        <div className="mt-5 flex justify-end"><button type="button" className="btn-primary" disabled={scheduleMutation.isPending || !scheduleHours || workingDays.length === 0} onClick={() => scheduleMutation.mutate()}><Save size={15} />{scheduleMutation.isPending ? "Saving…" : "Save schedule"}</button></div>

        <div className="mt-6 border-t border-ink-100 pt-5">
          <div className="flex flex-wrap items-end justify-between gap-3"><div><h3 className="font-semibold text-ink-900">Date overrides</h3><p className="mt-1 text-xs text-ink-500">Close the office for a holiday or count an occasional weekend as a working day.</p></div><span className="badge bg-ink-50 text-ink-600">{schedule.exceptions.length} override{schedule.exceptions.length === 1 ? "" : "s"}</span></div>
          <form className="mt-4 grid gap-3 sm:grid-cols-[0.8fr_1.2fr_0.9fr_auto]" onSubmit={(event) => { event.preventDefault(); if (exceptionName.trim()) exceptionMutation.mutate(); }}>
            <label className="text-xs font-semibold text-ink-600">Date<input required type="date" className="input mt-1.5" value={exceptionDate} onChange={(event) => setExceptionDate(event.target.value)} /></label>
            <label className="text-xs font-semibold text-ink-600">Label<input required minLength={1} maxLength={120} className="input mt-1.5" placeholder="e.g. Independence Day" value={exceptionName} onChange={(event) => setExceptionName(event.target.value)} /></label>
            <label className="text-xs font-semibold text-ink-600">Date type<select className="input mt-1.5" value={exceptionIsWorkingDay ? "working" : "holiday"} onChange={(event) => setExceptionIsWorkingDay(event.target.value === "working")}><option value="holiday">Holiday (off)</option><option value="working">Working day</option></select></label>
            <button type="submit" className="btn-secondary self-end sm:mb-0.5" disabled={exceptionMutation.isPending || !exceptionName.trim()}><Plus size={15} />{exceptionMutation.isPending ? "Adding…" : "Add"}</button>
          </form>
          {schedule.exceptions.length > 0 && <div className="mt-4 divide-y divide-ink-100 rounded-xl border border-ink-100 bg-bg/40">{schedule.exceptions.map((exception) => <div key={exception.id} className="flex items-center gap-3 px-3.5 py-3"><CalendarDays size={15} className={exception.is_working_day ? "text-success" : "text-danger"} /><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-ink-800">{formatDate(exception.exception_date)} · {exception.name}</p><p className="mt-0.5 text-[11px] text-ink-400">{exception.is_working_day ? "Counts as a working day" : "Excluded from the working-day target"}</p></div><button type="button" className="icon-button text-ink-400 hover:text-danger" aria-label={`Remove ${exception.name}`} disabled={removeExceptionMutation.isPending} onClick={() => removeExceptionMutation.mutate(exception.id)}><Trash2 size={15} /></button></div>)}</div>}
        </div>
      </section>

      <section className="card border-primary/15 bg-primary-soft/20 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-white p-2.5 text-primary shadow-sm"><CalendarClock size={19} /></div>
            <div>
              <div className="flex flex-wrap items-center gap-2"><h2 className="panel-header font-semibold text-ink-900">Admin time & leave</h2><span className="badge bg-primary-soft text-primary-dark">Admin only</span></div>
              <p className="mt-1.5 max-w-2xl text-xs leading-5 text-ink-600">Log your own work time, request leave, and approve your requests from the same attendance workspace. Admin submissions remain pending until you approve them.</p>
            </div>
          </div>
          <Link to="/attendance#attendance-approvals" className="btn-ghost shrink-0 px-3 py-2 text-xs">Open approvals <ArrowRight size={14} /></Link>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link to="/attendance#log-work-time" className="btn-primary px-3 py-2 text-xs"><Clock3 size={15} />Log work time</Link>
          <Link to="/attendance#request-leave" className="btn-secondary px-3 py-2 text-xs"><CalendarClock size={15} />Request leave</Link>
        </div>
      </section>

      <div className="rounded-xl border border-primary/10 bg-primary-soft/50 px-4 py-3 text-sm text-primary-dark">
        <span className="font-semibold">How this is calculated:</span> approved hours × hourly rate. Monthly targets use your work schedule, daily hours, and date overrides. Pending or rejected entries are not included in pay.
      </div>

      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 px-5 py-4">
          <div>
            <p className="panel-header font-semibold text-ink-900">Team payroll</p>
            <p className="mt-1 text-xs text-ink-500">Rates and totals are private to administrators.</p>
          </div>
          <span className="badge bg-ink-50 text-ink-600">{data.employees.length} employees</span>
        </div>
        {!data.employees.length ? (
          <EmptyState icon={Users2} title="No employees yet" message="Add team members before setting up payroll." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[930px] text-sm">
              <thead>
                <tr className="bg-bg/60 text-left text-[11px] uppercase tracking-[0.12em] text-ink-500">
                  <th className="px-5 py-3 font-semibold">Employee</th>
                  <th className="px-5 py-3 font-semibold">Hourly rate</th>
                  <th className="px-5 py-3 font-semibold">Approved / target</th>
                  <th className="px-5 py-3 font-semibold">Pending</th>
                  <th className="px-5 py-3 font-semibold">Leave days</th>
                  <th className="px-5 py-3 font-semibold text-right">Estimated pay</th>
                  <th className="px-5 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.employees.map((employee) => {
                  const editing = editingRateId === employee.user_id;
                  return (
                    <tr key={employee.user_id} className={`border-t border-ink-100 transition-colors ${selectedEmployeeId === employee.user_id ? "bg-primary-soft/35" : "hover:bg-bg/50"}`}>
                      <td className="px-5 py-3.5">
                        <button type="button" className="flex items-center gap-3 text-left" onClick={() => selectEmployee(employee)}>
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-xs font-bold text-primary-dark">{initials(employee.name)}</span>
                          <span>
                            <span className="block font-semibold text-ink-900">{employee.name}</span>
                            <span className="block text-xs text-ink-500">{roleLabels[employee.role]} · {employee.is_active ? "Active" : "Inactive"}</span>
                          </span>
                        </button>
                      </td>
                      <td className="px-5 py-3.5">
                        {editing ? (
                          <div className="flex items-center gap-1.5">
                            <label className="sr-only">Hourly rate for {employee.name}</label>
                            <input className="input w-24 py-1.5" type="number" min="0" step="0.01" value={rate} onChange={(event) => setRate(event.target.value)} />
                            <button type="button" className="icon-button text-success" aria-label={`Save rate for ${employee.name}`} disabled={rateMutation.isPending} onClick={() => rateMutation.mutate({ userId: employee.user_id, hourlyRate: Number(rate), hours: Number(standardHours) || 8 })}><Save size={16} /></button>
                            <button type="button" className="icon-button text-ink-400" aria-label="Cancel rate edit" onClick={() => setEditingRateId(null)}><X size={16} /></button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className={employee.hourly_rate ? "font-semibold text-ink-800" : "text-ink-400"}>{employee.hourly_rate ? formatCurrencyFull(employee.hourly_rate) : "Not set"}</span>
                            <button type="button" className="icon-button text-primary" aria-label={`Edit payroll rate for ${employee.name}`} onClick={() => startEditing(employee)}><Edit3 size={14} /></button>
                          </div>
                        )}
                        {editing && <p className="mt-1 text-[10px] text-ink-400">per hour · {standardHours || 8}h/day</p>}
                      </td>
                      <td className="px-5 py-3.5"><span className="font-semibold text-ink-800">{employee.approved_hours.toFixed(1)}h</span><span className="text-ink-400"> / {employee.target_hours.toFixed(0)}h</span></td>
                      <td className="px-5 py-3.5 text-ink-700">{employee.pending_hours.toFixed(1)}h</td>
                      <td className="px-5 py-3.5 text-ink-700">{employee.leave_days.toFixed(1)}</td>
                      <td className="px-5 py-3.5 text-right font-semibold text-ink-900">{formatCurrencyFull(employee.estimated_pay)}</td>
                      <td className="px-5 py-3.5 text-right"><button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={() => selectEmployee(employee)}>View activity</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedEmployee && (
        <section className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="card p-5 sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-primary text-sm font-bold text-white">{initials(selectedEmployee.name)}</span>
                <div><p className="page-eyebrow mb-0.5">{month} activity</p><h2 className="panel-header font-semibold text-ink-900">{selectedEmployee.name}</h2></div>
              </div>
              <button type="button" className="icon-button text-ink-400" aria-label="Close employee activity" onClick={() => setSelectedEmployeeId(null)}><X size={18} /></button>
            </div>
            <div className="mb-5 grid grid-cols-3 gap-2 rounded-xl border border-ink-100 bg-bg/60 p-3 text-center">
              <div><p className="text-lg font-bold text-ink-900">{selectedEmployee.approved_hours.toFixed(1)}h</p><p className="text-[10px] uppercase tracking-wide text-ink-400">Approved</p></div>
              <div><p className="text-lg font-bold text-accent-dark">{selectedEmployee.pending_hours.toFixed(1)}h</p><p className="text-[10px] uppercase tracking-wide text-ink-400">Pending</p></div>
              <div><p className="text-lg font-bold text-primary-dark">{formatCurrencyFull(selectedEmployee.estimated_pay)}</p><p className="text-[10px] uppercase tracking-wide text-ink-400">Pay</p></div>
            </div>
            <h3 className="mb-3 flex items-center gap-2 font-semibold text-ink-900"><IndianRupee size={16} className="text-accent-dark" /> Record approved work time</h3>
            <p className="mb-4 text-xs text-ink-500">Use this to add approved work, events, training, or other time. Calls are captured automatically from the call log.</p>
            <form className="grid grid-cols-1 gap-3 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); if (Number(entryHours) > 0) timeMutation.mutate(); }}>
              <label className="text-xs font-semibold text-ink-600">Date<input required type="date" min={`${month}-01`} max={monthEnd(month)} className="input mt-1.5" value={entryDate} onChange={(event) => setEntryDate(event.target.value)} /></label>
              <label className="text-xs font-semibold text-ink-600">Hours<input required min="0.25" max="24" step="0.25" type="number" className="input mt-1.5" placeholder="e.g. 3" value={entryHours} onChange={(event) => setEntryHours(event.target.value)} /></label>
              <label className="text-xs font-semibold text-ink-600 sm:col-span-2">Work category<select className="input mt-1.5" value={entryCategory} onChange={(event) => setEntryCategory(event.target.value as TimeEntryCategory)}>{categories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}</select></label>
              <label className="text-xs font-semibold text-ink-600 sm:col-span-2">Notes <span className="font-normal text-ink-400">(optional)</span><input className="input mt-1.5" maxLength={500} placeholder="What was this time spent on?" value={entryDescription} onChange={(event) => setEntryDescription(event.target.value)} /></label>
              <button className="btn-primary sm:col-span-2" type="submit" disabled={timeMutation.isPending || !entryHours}><CheckCircle2 size={16} />{timeMutation.isPending ? "Saving…" : "Add approved time"}</button>
            </form>
          </div>

          <div className="card overflow-hidden">
            <div className="border-b border-ink-100 px-5 py-4"><h3 className="font-semibold text-ink-900">Work entries & leave</h3><p className="mt-1 text-xs text-ink-500">All submitted activity for {selectedEmployee.name} in {month}.</p></div>
            <div className="max-h-[430px] overflow-y-auto">
              {selectedEmployee.entries.length === 0 && selectedEmployee.leaves.length === 0 ? <EmptyState icon={Clock3} title="No activity yet" message="Approved work and leave requests will appear here." /> : (
                <div className="divide-y divide-ink-100">
                  {selectedEmployee.entries.map((entry) => <div key={`entry-${entry.id}`} className="flex items-start gap-3 px-5 py-3.5"><div className="mt-0.5 rounded-lg bg-primary-soft p-2 text-primary"><Clock3 size={15} /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium text-ink-800">{categories.find((category) => category.value === entry.category)?.label ?? entry.category}</p><span className={`badge ${statusClass(entry.status)}`}>{entry.status}</span></div><p className="mt-0.5 text-xs text-ink-500">{formatDate(entry.entry_date)} · {entry.hours.toFixed(2)} hours</p>{entry.description && <p className="mt-1 text-xs text-ink-600">{entry.description}</p>}</div></div>)}
                  {selectedEmployee.leaves.map((leave) => <div key={`leave-${leave.id}`} className="flex items-start gap-3 px-5 py-3.5"><div className="mt-0.5 rounded-lg bg-accent-soft p-2 text-accent-dark"><CalendarDays size={15} /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium text-ink-800">{leave.leave_type} leave</p><span className={`badge ${statusClass(leave.status)}`}>{leave.status}</span></div><p className="mt-0.5 text-xs text-ink-500">{formatDate(leave.start_date)} – {formatDate(leave.end_date)}</p><p className="mt-1 text-xs text-ink-600">{leave.reason}</p></div></div>)}
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
