import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Check, ClipboardCheck, Clock3, FileText, LocateFixed, LogIn, LogOut, MapPin, Plus, Send, ShieldCheck, UsersRound, X } from "lucide-react";
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

function formatWorkedMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours === 0) return `${remainingMinutes}m`;
  return `${hours}h ${remainingMinutes.toString().padStart(2, "0")}m`;
}

function readCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Location services are not available in this browser."));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 60000,
    });
  });
}

function locationErrorMessage(error: unknown) {
  const geoError = error as GeolocationPositionError;
  if (typeof geoError?.code === "number") {
    if (geoError.code === 1) return "Location permission is required to record attendance.";
    if (geoError.code === 2) return "We could not determine your location. Try again near the workplace.";
    if (geoError.code === 3) return "Location lookup timed out. Try again.";
  }
  const responseError = error as { response?: { data?: { detail?: string } } };
  return responseError?.response?.data?.detail ?? (error instanceof Error ? error.message : "Couldn't record attendance.");
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
  const [locationName, setLocationName] = useState("");
  const [locationLatitude, setLocationLatitude] = useState("");
  const [locationLongitude, setLocationLongitude] = useState("");
  const [locationRadius, setLocationRadius] = useState("200");
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const isReviewer = user?.role === "admin" || user?.role === "manager";
  const isAdmin = user?.role === "admin";

  const { data, isLoading } = useQuery({
    queryKey: ["attendance", month],
    queryFn: () => attendanceApi.overview(month),
  });
  const { data: approvals } = useQuery({
    queryKey: ["attendance-approvals", month],
    queryFn: () => attendanceApi.approvals(month),
    enabled: isReviewer,
  });
  const { data: attendanceStatus, isLoading: isAttendanceStatusLoading } = useQuery({
    queryKey: ["attendance-status"],
    queryFn: () => attendanceApi.status(),
    refetchInterval: 60_000,
  });
  const { data: attendanceLocation } = useQuery({
    queryKey: ["attendance-location"],
    queryFn: () => attendanceApi.location(),
    enabled: isAdmin,
  });
  const { data: teamAttendance } = useQuery({
    queryKey: ["attendance-team", month],
    queryFn: () => attendanceApi.team(month),
    enabled: isReviewer,
  });

  useEffect(() => {
    if (!attendanceLocation) return;
    setLocationName(attendanceLocation.name ?? "");
    setLocationLatitude(attendanceLocation.latitude == null ? "" : String(attendanceLocation.latitude));
    setLocationLongitude(attendanceLocation.longitude == null ? "" : String(attendanceLocation.longitude));
    setLocationRadius(String(attendanceLocation.radius_meters ?? 200));
  }, [attendanceLocation]);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["attendance", month] });
    void queryClient.invalidateQueries({ queryKey: ["attendance-status"] });
    void queryClient.invalidateQueries({ queryKey: ["attendance-team", month] });
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

  const checkInMutation = useMutation({
    mutationFn: async () => {
      const position = await readCurrentPosition();
      return attendanceApi.checkIn({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy_meters: Math.min(position.coords.accuracy, 10000),
      });
    },
    onSuccess: () => { refresh(); toast("Attendance checked in successfully.", "success"); },
    onError: (error: unknown) => toast(locationErrorMessage(error), "error"),
  });

  const checkOutMutation = useMutation({
    mutationFn: async () => {
      const position = await readCurrentPosition();
      return attendanceApi.checkOut({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy_meters: Math.min(position.coords.accuracy, 10000),
      });
    },
    onSuccess: (record) => { refresh(); toast(`Checked out after ${formatWorkedMinutes(record.worked_minutes)}.`, "success"); },
    onError: (error: unknown) => toast(locationErrorMessage(error), "error"),
  });

  const saveLocationMutation = useMutation({
    mutationFn: () => attendanceApi.updateLocation({
      name: locationName.trim(),
      latitude: Number(locationLatitude),
      longitude: Number(locationLongitude),
      radius_meters: Number(locationRadius),
    }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["attendance-location"] });
      void queryClient.invalidateQueries({ queryKey: ["attendance-status"] });
      setLocationMessage("Workplace location saved. Employees can now check in from this area.");
      toast("Attendance location updated.", "success");
    },
    onError: (error: any) => toast(error?.response?.data?.detail ?? "Couldn't save the attendance location.", "error"),
  });

  const useCurrentLocation = async () => {
    setLocationMessage(null);
    try {
      const position = await readCurrentPosition();
      setLocationLatitude(position.coords.latitude.toFixed(6));
      setLocationLongitude(position.coords.longitude.toFixed(6));
      setLocationMessage("Current location filled in. Save it to make this the workplace check-in area.");
    } catch (error) {
      setLocationMessage(locationErrorMessage(error));
    }
  };

  if (isLoading || !data) return <PageLoading />;

  const totalHours = data.entries.reduce((total, entry) => total + entry.hours, 0);
  const approvedHours = data.entries.filter((entry) => entry.status === "approved").reduce((total, entry) => total + entry.hours, 0);
  const pendingLeaves = data.leaves.filter((leave) => leave.status === "pending").length;
  const attendanceHours = (data.records ?? []).reduce((total, record) => total + record.worked_minutes / 60, 0);
  const attendanceBusy = checkInMutation.isPending || checkOutMutation.isPending || isAttendanceStatusLoading;
  const todayRecord = attendanceStatus?.record;
  const locationConfigured = attendanceStatus?.location_configured ?? attendanceLocation?.configured ?? false;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-ink-100 pb-5">
        <div><p className="page-eyebrow mb-1">Operations / Attendance</p><h1 className="page-title">{isAdmin ? "Attendance center" : "My attendance & leave"}</h1><p className="page-subtitle">{isAdmin ? "Set the workplace area, review attendance, and approve team requests." : "Check in from the workplace, track your hours, and request leave."}</p></div>
        <label className="flex items-center gap-2 text-sm font-medium text-ink-600"><CalendarClock size={16} className="text-ink-400" /><span className="sr-only">Attendance month</span><input type="month" className="input w-auto py-2" value={month} onChange={(event) => { setMonth(event.target.value); setEntryDate(todayForMonth(event.target.value)); setLeaveStart(todayForMonth(event.target.value)); setLeaveEnd(todayForMonth(event.target.value)); }} /></label>
      </div>

      <div className="rounded-xl border border-primary/10 bg-primary-soft/50 px-4 py-3 text-sm text-primary-dark"><span className="font-semibold">Private payroll:</span> {isAdmin ? "Admins can check in and out like other team members, but manual work-time and leave requests stay review-only." : "Your attendance, hours, and leave requests are visible to the assigned manager and admin for approval."} Salary totals are available only in the admin Payroll workspace.</div>

      <section className="card overflow-hidden border-primary/15 bg-gradient-to-br from-primary-dark via-primary to-primary-dark text-white shadow-lg shadow-primary/10">
        <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-white/10 p-3 text-accent ring-1 ring-white/10"><ShieldCheck size={22} /></div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/60">Today · {attendanceStatus?.attendance_date ?? "—"}</p>
              <h2 className="mt-1 text-xl font-semibold">Workplace attendance</h2>
              <p className="mt-1 max-w-xl text-sm leading-6 text-white/70">
                {locationConfigured
                  ? <>Check in and out from <span className="font-semibold text-white">{attendanceStatus?.location_name ?? attendanceLocation?.name ?? "your configured workplace"}</span>. Your device location is checked within {attendanceStatus?.radius_meters ?? attendanceLocation?.radius_meters ?? 200} m.</>
                  : isAdmin
                    ? "Configure the workplace location below before the team can record attendance."
                    : "Your admin has not configured a workplace location yet. Ask them to set it up before checking in."}
              </p>
              {todayRecord && <p className="mt-2 text-xs text-white/60">Checked in at {formatDateTime(todayRecord.checked_in_at)}{todayRecord.checked_out_at ? ` · Checked out at ${formatDateTime(todayRecord.checked_out_at)}` : ""}</p>}
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            {attendanceStatus?.status === "checked_in" && todayRecord && <div className="rounded-lg bg-white/10 px-3 py-2 text-center text-xs text-white/80"><span className="block text-[10px] uppercase tracking-wider text-white/50">Elapsed</span><span className="font-semibold">{formatWorkedMinutes(todayRecord.worked_minutes)}</span></div>}
            {attendanceStatus?.status === "checked_out" && todayRecord && <div className="rounded-lg bg-emerald-400/15 px-3 py-2 text-center text-xs text-emerald-100"><span className="block text-[10px] uppercase tracking-wider text-emerald-200/70">Completed</span><span className="font-semibold">{formatWorkedMinutes(todayRecord.worked_minutes)}</span></div>}
            {attendanceStatus?.status === "checked_in" ? <button type="button" className="btn-secondary min-h-11 justify-center border-white/20 bg-white text-primary-dark hover:bg-white/90" disabled={attendanceBusy || !locationConfigured} onClick={() => checkOutMutation.mutate()}><LogOut size={16} />{checkOutMutation.isPending ? "Checking out…" : "Check out"}</button> : attendanceStatus?.status === "checked_out" ? <span className="inline-flex min-h-11 items-center justify-center rounded-lg bg-white/10 px-4 text-sm font-semibold text-white/80">Attendance recorded</span> : <button type="button" className="btn-primary min-h-11 justify-center bg-accent text-primary-dark hover:bg-accent/90" disabled={attendanceBusy || !locationConfigured} onClick={() => checkInMutation.mutate()}><LogIn size={16} />{checkInMutation.isPending ? "Checking in…" : "Check in from workplace"}</button>}
          </div>
        </div>
        {(checkInMutation.isError || checkOutMutation.isError) && <div className="border-t border-white/10 bg-black/10 px-5 py-3 text-xs text-red-100">{locationErrorMessage(checkInMutation.error ?? checkOutMutation.error)}</div>}
      </section>

      {isAdmin && <section className="card border-ink-200 p-5 sm:p-6">
        <div className="mb-5 flex items-start gap-3"><div className="rounded-xl bg-accent-soft p-2.5 text-accent-dark"><MapPin size={19} /></div><div><h2 className="panel-header font-semibold text-ink-900">Workplace check-in area</h2><p className="mt-1 max-w-2xl text-xs leading-5 text-ink-500">Set the organization’s attendance point once. Coordinates are private to admins; employees only see the workplace name and allowed radius.</p></div></div>
        <form className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" onSubmit={(event) => { event.preventDefault(); if (locationName.trim() && locationLatitude && locationLongitude && locationRadius) saveLocationMutation.mutate(); }}>
          <label className="text-xs font-semibold text-ink-600 sm:col-span-2">Workplace name<input required maxLength={255} className="input mt-1.5" placeholder="Head office" value={locationName} onChange={(event) => setLocationName(event.target.value)} /></label>
          <label className="text-xs font-semibold text-ink-600">Latitude<input required type="number" min="-90" max="90" step="0.000001" className="input mt-1.5" placeholder="28.6139" value={locationLatitude} onChange={(event) => setLocationLatitude(event.target.value)} /></label>
          <label className="text-xs font-semibold text-ink-600">Longitude<input required type="number" min="-180" max="180" step="0.000001" className="input mt-1.5" placeholder="77.2090" value={locationLongitude} onChange={(event) => setLocationLongitude(event.target.value)} /></label>
          <label className="text-xs font-semibold text-ink-600">Allowed radius (metres)<input required type="number" min="25" max="5000" step="25" className="input mt-1.5" value={locationRadius} onChange={(event) => setLocationRadius(event.target.value)} /></label>
          <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-3"><button type="button" className="btn-secondary" onClick={() => void useCurrentLocation()}><LocateFixed size={16} />Use my current location</button><p className="text-[11px] leading-4 text-ink-500">Use this while you are at the office, then save.</p></div>
          <button type="submit" className="btn-primary" disabled={saveLocationMutation.isPending || !locationName.trim() || !locationLatitude || !locationLongitude}>{saveLocationMutation.isPending ? "Saving…" : "Save workplace"}</button>
        </form>
        {locationMessage && <p className="mt-3 text-xs text-ink-600">{locationMessage}</p>}
      </section>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card p-5"><p className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-500">Logged hours</p><p className="mt-3 text-3xl font-bold tabular-nums text-ink-900">{totalHours.toFixed(1)}h</p><p className="mt-1 text-xs text-ink-500">{approvedHours.toFixed(1)}h approved · includes checked-out sessions</p></div>
        <div className="card p-5"><p className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-500">Leave requests</p><p className="mt-3 text-3xl font-bold tabular-nums text-ink-900">{data.leaves.length}</p><p className="mt-1 text-xs text-ink-500">{pendingLeaves} awaiting review</p></div>
        {isReviewer ? <div className="card border-accent/15 bg-accent-soft/30 p-5"><p className="text-[11px] font-bold uppercase tracking-[0.12em] text-accent-dark">Team approvals</p><p className="mt-3 text-3xl font-bold tabular-nums text-ink-900">{data.pending_approvals}</p><p className="mt-1 text-xs text-ink-600">Pending in this workspace</p></div> : <div className="card p-5"><p className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-500">Attendance hours</p><p className="mt-3 text-3xl font-bold tabular-nums text-ink-900">{attendanceHours.toFixed(1)}h</p><p className="mt-1 text-xs text-ink-500">Recorded check-in sessions</p></div>}
      </div>

      {isAdmin ? <section className="card border-primary/15 bg-primary-soft/20 p-5 sm:p-6"><div className="flex items-start gap-3"><div className="rounded-xl bg-white p-2.5 text-primary shadow-sm"><ClipboardCheck size={19} /></div><div><h2 className="panel-header font-semibold text-ink-900">Admin review mode</h2><p className="mt-1.5 max-w-2xl text-xs leading-5 text-ink-600">As the organization owner, you do not apply for personal leave or submit personal work time. You can review and approve team requests below, and record approved time for employees from Payroll.</p></div></div></section> : <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <section id="log-work-time" className="card scroll-mt-6 p-5 sm:p-6">
          <div className="mb-5 flex items-start gap-3"><div className="rounded-xl bg-primary-soft p-2.5 text-primary"><Clock3 size={19} /></div><div><h2 className="panel-header font-semibold text-ink-900">Log work time</h2><p className="mt-1 text-xs text-ink-500">Calling time is captured automatically when you log a call. Use this for events, training, admin work, or anything extra.</p></div></div>
          <form className="grid grid-cols-1 gap-3 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); if (Number(hours) > 0) timeMutation.mutate(); }}>
            <label className="text-xs font-semibold text-ink-600">Date<input required type="date" min={`${month}-01`} max={monthEnd(month)} className="input mt-1.5" value={entryDate} onChange={(event) => setEntryDate(event.target.value)} /></label>
            <label className="text-xs font-semibold text-ink-600">Hours<input required min="0.25" max="24" step="0.25" type="number" className="input mt-1.5" placeholder="e.g. 3.5" value={hours} onChange={(event) => setHours(event.target.value)} /></label>
            <label className="text-xs font-semibold text-ink-600 sm:col-span-2">Category<select className="input mt-1.5" value={category} onChange={(event) => setCategory(event.target.value as TimeEntryCategory)}>{categories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
            <label className="text-xs font-semibold text-ink-600 sm:col-span-2">Description <span className="font-normal text-ink-400">(optional)</span><input className="input mt-1.5" maxLength={500} placeholder="What did you work on?" value={description} onChange={(event) => setDescription(event.target.value)} /></label>
            <button className="btn-primary sm:col-span-2" type="submit" disabled={timeMutation.isPending || !hours}><Send size={16} />{timeMutation.isPending ? "Submitting…" : "Submit time for approval"}</button>
          </form>
        </section>

        <section id="request-leave" className="card scroll-mt-6 p-5 sm:p-6">
          <div className="mb-5 flex items-start gap-3"><div className="rounded-xl bg-accent-soft p-2.5 text-accent-dark"><CalendarClock size={19} /></div><div><h2 className="panel-header font-semibold text-ink-900">Request leave</h2><p className="mt-1 text-xs text-ink-500">Your manager or admin will review the request before it affects payroll.</p></div></div>
          <form className="grid grid-cols-1 gap-3 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); leaveMutation.mutate(); }}>
            <label className="text-xs font-semibold text-ink-600">From<input required type="date" min={`${month}-01`} max={monthEnd(month)} className="input mt-1.5" value={leaveStart} onChange={(event) => setLeaveStart(event.target.value)} /></label>
            <label className="text-xs font-semibold text-ink-600">To<input required type="date" min={`${month}-01`} max={monthEnd(month)} className="input mt-1.5" value={leaveEnd} onChange={(event) => setLeaveEnd(event.target.value)} /></label>
            <label className="text-xs font-semibold text-ink-600 sm:col-span-2">Leave type<select className="input mt-1.5" value={leaveType} onChange={(event) => setLeaveType(event.target.value as (typeof leaveTypes)[number])}>{leaveTypes.map((type) => <option key={type} value={type}>{type[0].toUpperCase() + type.slice(1)}</option>)}</select></label>
            <label className="text-xs font-semibold text-ink-600 sm:col-span-2">Reason<textarea required minLength={2} maxLength={500} rows={3} className="input mt-1.5 resize-none" placeholder="Tell your manager why you need leave" value={leaveReason} onChange={(event) => setLeaveReason(event.target.value)} /></label>
            <button className="btn-primary sm:col-span-2" type="submit" disabled={leaveMutation.isPending || leaveReason.trim().length < 2}><Plus size={16} />{leaveMutation.isPending ? "Submitting…" : "Submit leave request"}</button>
          </form>
        </section>
      </div>}

      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 px-5 py-4"><div><h2 className="flex items-center gap-2 font-semibold text-ink-900"><LogIn size={18} className="text-primary" /> Attendance sessions</h2><p className="mt-1 text-xs text-ink-500">Your location-verified check-in and check-out history for {month}.</p></div><span className="badge bg-primary-soft text-primary-dark">{data.records?.length ?? 0} sessions</span></div>
        {!data.records?.length ? <EmptyState icon={LogIn} title="No attendance sessions" message="Check in from the workplace to start recording your day." /> : <div className="divide-y divide-ink-100">{data.records.map((record) => <div key={record.id} className="flex flex-wrap items-center gap-3 px-5 py-4"><div className={`rounded-lg p-2 ${record.status === "checked_out" ? "bg-success/10 text-success" : "bg-accent-soft text-accent-dark"}`}><Clock3 size={15} /></div><div className="min-w-[190px] flex-1"><p className="font-medium text-ink-800">{formatDate(record.attendance_date)}</p><p className="mt-0.5 text-xs text-ink-500">In {formatDateTime(record.checked_in_at)}{record.checked_out_at ? ` · Out ${formatDateTime(record.checked_out_at)}` : " · Still checked in"}</p></div><span className="text-sm font-semibold tabular-nums text-ink-700">{formatWorkedMinutes(record.worked_minutes)}</span><span className={`badge ${record.status === "checked_out" ? "bg-success/10 text-success" : "bg-accent-soft text-accent-dark"}`}>{record.status === "checked_out" ? "Completed" : "In progress"}</span></div>)}</div>}
      </section>

      {isReviewer && <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 px-5 py-4"><div><h2 className="flex items-center gap-2 font-semibold text-ink-900"><UsersRound size={18} className="text-primary" /> Team attendance</h2><p className="mt-1 text-xs text-ink-500">Location-verified sessions visible to you for {month}. Managers see their telecallers; admins see the full team.</p></div><span className="badge bg-primary-soft text-primary-dark">{teamAttendance?.records.length ?? 0} sessions</span></div>
        {!teamAttendance?.records.length ? <EmptyState icon={UsersRound} title="No team sessions" message="Checked-in team members will appear here after they record attendance." /> : <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-ink-50/70 text-[11px] font-bold uppercase tracking-[0.12em] text-ink-500"><tr><th className="px-5 py-3">Team member</th><th className="px-5 py-3">Date</th><th className="px-5 py-3">Check in</th><th className="px-5 py-3">Check out</th><th className="px-5 py-3">Worked</th><th className="px-5 py-3">Status</th></tr></thead><tbody className="divide-y divide-ink-100">{teamAttendance.records.map((record) => <tr key={record.id} className="text-ink-700"><td className="whitespace-nowrap px-5 py-3 font-medium text-ink-900">{record.user_name ?? "Team member"}</td><td className="whitespace-nowrap px-5 py-3">{formatDate(record.attendance_date)}</td><td className="whitespace-nowrap px-5 py-3 text-xs text-ink-500">{formatDateTime(record.checked_in_at)}</td><td className="whitespace-nowrap px-5 py-3 text-xs text-ink-500">{record.checked_out_at ? formatDateTime(record.checked_out_at) : "—"}</td><td className="whitespace-nowrap px-5 py-3 font-semibold tabular-nums">{formatWorkedMinutes(record.worked_minutes)}</td><td className="whitespace-nowrap px-5 py-3"><span className={`badge ${record.status === "checked_out" ? "bg-success/10 text-success" : "bg-accent-soft text-accent-dark"}`}>{record.status === "checked_out" ? "Completed" : "In progress"}</span></td></tr>)}</tbody></table></div>}
      </section>}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <section className="card overflow-hidden"><div className="border-b border-ink-100 px-5 py-4"><h2 className="font-semibold text-ink-900">{isAdmin ? "Personal work entries" : "My work entries"}</h2><p className="mt-1 text-xs text-ink-500">Work logged for {month}.</p></div>{data.entries.length === 0 ? <EmptyState icon={Clock3} title="No work logged" message={isAdmin ? "Admin accounts cannot submit personal work time." : "Add your first time entry above."} /> : <div className="divide-y divide-ink-100">{data.entries.map((entry) => <div key={entry.id} className="flex items-start gap-3 px-5 py-3.5"><div className="rounded-lg bg-primary-soft p-2 text-primary"><Clock3 size={15} /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium text-ink-800">{categories.find((item) => item.value === entry.category)?.label ?? entry.category}</p><span className={`badge ${statusClass(entry.status)}`}>{entry.status}</span></div><p className="mt-0.5 text-xs text-ink-500">{formatDate(entry.entry_date)} · {entry.hours.toFixed(2)} hours</p>{entry.description && <p className="mt-1 text-xs text-ink-600">{entry.description}</p>}</div></div>)}</div>}</section>
        <section className="card overflow-hidden"><div className="border-b border-ink-100 px-5 py-4"><h2 className="font-semibold text-ink-900">{isAdmin ? "Personal leave requests" : "My leave requests"}</h2><p className="mt-1 text-xs text-ink-500">Requests and decisions for {month}.</p></div>{data.leaves.length === 0 ? <EmptyState icon={CalendarClock} title="No leave requests" message={isAdmin ? "Admin accounts cannot submit personal leave requests." : "You can request leave above when needed."} /> : <div className="divide-y divide-ink-100">{data.leaves.map((leave) => <div key={leave.id} className="flex items-start gap-3 px-5 py-3.5"><div className="rounded-lg bg-accent-soft p-2 text-accent-dark"><CalendarClock size={15} /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium text-ink-800">{leave.leave_type} leave</p><span className={`badge ${statusClass(leave.status)}`}>{leave.status}</span></div><p className="mt-0.5 text-xs text-ink-500">{formatDate(leave.start_date)} – {formatDate(leave.end_date)}</p><p className="mt-1 text-xs text-ink-600">{leave.reason}</p>{leave.reviewed_by_name && <p className="mt-1 text-[11px] text-ink-400">Reviewed by {leave.reviewed_by_name}</p>}</div></div>)}</div>}</section>
      </div>

      {isReviewer && (
        <section id="attendance-approvals" className="card scroll-mt-6 overflow-hidden">
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
