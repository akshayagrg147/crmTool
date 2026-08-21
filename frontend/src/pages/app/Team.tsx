import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Users2 } from "lucide-react";
import { usersApi } from "@/api/endpoints";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { EmptyState } from "@/components/EmptyState";
import { TableSkeleton } from "@/components/Spinner";
import { ConfirmModal } from "@/components/ConfirmModal";
import { AddMemberModal } from "@/components/team/AddMemberModal";
import { initials, formatDate } from "@/lib/format";
import type { TeamMemberOut, UserRole } from "@/api/types";

const roleBadgeClasses: Record<UserRole, string> = {
  super_admin: "bg-badge-indigo/10 text-badge-indigo",
  admin: "bg-primary/10 text-primary",
  manager: "bg-badge-teal/10 text-badge-teal",
  telecaller: "bg-badge-pink/10 text-badge-pink",
};

const roleLabels: Record<UserRole, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  manager: "Manager",
  telecaller: "Telecaller",
};

export function TeamPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === "admin";

  const [showAdd, setShowAdd] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<TeamMemberOut | null>(null);

  const { data: team, isLoading } = useQuery({ queryKey: ["team"], queryFn: usersApi.list });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) => usersApi.update(id, { is_active }),
    onMutate: async ({ id, is_active }) => {
      await queryClient.cancelQueries({ queryKey: ["team"] });
      const prev = queryClient.getQueryData<TeamMemberOut[]>(["team"]);
      queryClient.setQueryData<TeamMemberOut[]>(["team"], (old) =>
        old?.map((m) => (m.id === id ? { ...m, is_active } : m))
      );
      return { prev };
    },
    onError: (err: any, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["team"], ctx.prev);
      toast(err?.response?.data?.detail ?? "Couldn't update status.", "error");
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["team"] }),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => usersApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast("Team member removed. Their open leads moved to Unassigned.", "success");
      setRemoveTarget(null);
    },
    onError: (err: any) => toast(err?.response?.data?.detail ?? "Couldn't remove team member.", "error"),
  });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="page-eyebrow mb-1">Workspace / People</p>
          <h1 className="page-title">Team</h1>
          <p className="page-subtitle">{team?.length ?? 0} members across your organization</p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <button className="btn-primary text-sm" onClick={() => setShowAdd(true)}>
              <Plus size={16} /> Add Team Member
            </button>
          </div>
        )}
      </div>

      <div className="card">
        {isLoading ? (
          <TableSkeleton rows={4} cols={4} />
        ) : !team?.length ? (
          <EmptyState icon={Users2} title="No team members yet" message="Add your first team member to get started." />
        ) : (
          <>
          <div className="hidden overflow-x-auto scroll-shadow-x md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-ink-500 text-xs uppercase tracking-wide">
                  <th className="font-medium px-5 py-3">Member</th>
                  <th className="font-medium px-5 py-3">Role</th>
                  <th className="font-medium px-5 py-3">City</th>
                  <th className="font-medium px-5 py-3">Contact</th>
                  <th className="font-medium px-5 py-3">Active Leads</th>
                  <th className="font-medium px-5 py-3">Joined</th>
                  <th className="font-medium px-5 py-3">Status</th>
                  {isAdmin && <th className="font-medium px-5 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {team.map((m) => (
                  <tr
                    key={m.id}
                    className="border-t border-ink-100 transition-colors duration-150 hover:bg-bg/60"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-full bg-gradient-primary text-white flex items-center justify-center text-[11px] font-semibold shrink-0">
                          {initials(m.name)}
                        </div>
                        <p className="font-medium text-ink-900">{m.name}</p>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`badge ${roleBadgeClasses[m.role]}`}>{roleLabels[m.role]}</span>
                    </td>
                    <td className="px-5 py-3 text-ink-700">
                      {m.city ? `${m.city}${m.state ? `, ${m.state}` : ""}` : "—"}
                    </td>
                    <td className="px-5 py-3 text-ink-700">
                      <p>{m.phone}</p>
                      {m.email && <p className="text-xs text-ink-500">{m.email}</p>}
                    </td>
                    <td className="px-5 py-3 text-ink-700">{m.active_leads_count}</td>
                    <td className="px-5 py-3 text-ink-500">{formatDate(m.created_at)}</td>
                    <td className="px-5 py-3">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={m.is_active}
                        aria-label={`${m.is_active ? "Deactivate" : "Activate"} ${m.name}`}
                        disabled={!isAdmin && user?.role !== "manager"}
                        onClick={() => toggleMutation.mutate({ id: m.id, is_active: !m.is_active })}
                        className={`relative h-6 w-11 rounded-pill transition ${
                          m.is_active ? "bg-success" : "bg-ink-100"
                        } disabled:opacity-50`}
                      >
                        <span
                          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
                            m.is_active ? "left-5" : "left-0.5"
                          }`}
                        />
                      </button>
                    </td>
                    {isAdmin && (
                      <td className="px-5 py-3 text-right">
                        <button
                          className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-danger hover:bg-danger/10"
                          aria-label={`Remove ${m.name}`}
                          onClick={() => setRemoveTarget(m)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="divide-y divide-ink-100 md:hidden">
            {team.map((m) => (
              <article key={m.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-bold text-white">
                    {initials(m.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold text-ink-900">{m.name}</h2>
                      <span className={`badge ${roleBadgeClasses[m.role]}`}>{roleLabels[m.role]}</span>
                    </div>
                    <p className="mt-1 text-xs text-ink-500">{m.phone}{m.email ? ` · ${m.email}` : ""}</p>
                  </div>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 rounded-lg border border-ink-100 bg-[#F8F7F3] p-3 text-xs">
                  <div><dt className="text-ink-400">Location</dt><dd className="mt-0.5 font-medium text-ink-700">{m.city ? `${m.city}${m.state ? `, ${m.state}` : ""}` : "—"}</dd></div>
                  <div><dt className="text-ink-400">Active leads</dt><dd className="mt-0.5 font-medium text-ink-700">{m.active_leads_count}</dd></div>
                  <div><dt className="text-ink-400">Joined</dt><dd className="mt-0.5 font-medium text-ink-700">{formatDate(m.created_at)}</dd></div>
                  <div><dt className="text-ink-400">Status</dt><dd className="mt-0.5 font-medium text-ink-700">{m.is_active ? "Active" : "Inactive"}</dd></div>
                </dl>
                <div className="mt-3 flex items-center justify-between">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={m.is_active}
                    disabled={!isAdmin && user?.role !== "manager"}
                    onClick={() => toggleMutation.mutate({ id: m.id, is_active: !m.is_active })}
                    className="btn-secondary min-h-10 text-xs"
                  >
                    <span className={`h-2 w-2 rounded-full ${m.is_active ? "bg-success" : "bg-ink-300"}`} />
                    {m.is_active ? "Active" : "Inactive"}
                  </button>
                  {isAdmin && (
                    <button className="btn-ghost min-h-10 text-danger" aria-label={`Remove ${m.name}`} onClick={() => setRemoveTarget(m)}>
                      <Trash2 size={16} /> Remove
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
          </>
        )}
      </div>

      <AddMemberModal open={showAdd} onClose={() => setShowAdd(false)} />
      <ConfirmModal
        open={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        onConfirm={() => removeTarget && removeMutation.mutate(removeTarget.id)}
        title="Remove team member?"
        message={`${removeTarget?.name}'s open leads will be moved to Unassigned. Their call history is kept. This cannot be undone.`}
        confirmLabel="Remove Member"
        isLoading={removeMutation.isPending}
      />
    </div>
  );
}
