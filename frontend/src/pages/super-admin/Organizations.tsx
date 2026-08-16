import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Plus, Users, Contact, TrendingUp, PlayCircle, PauseCircle, LogIn } from "lucide-react";
import { superAdminApi } from "@/api/endpoints";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { KpiCard } from "@/components/KpiCard";
import { EmptyState } from "@/components/EmptyState";
import { PageLoading } from "@/components/Spinner";
import { ConfirmModal } from "@/components/ConfirmModal";
import { CreateOrgModal } from "@/components/super-admin/CreateOrgModal";
import { formatDate } from "@/lib/format";
import type { OrganizationOut } from "@/api/types";

export function OrganizationsPage() {
  const { toast } = useToast();
  const { startImpersonation } = useAuth();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [suspendTarget, setSuspendTarget] = useState<OrganizationOut | null>(null);

  const { data: stats } = useQuery({ queryKey: ["platform-stats"], queryFn: superAdminApi.stats });
  const { data: orgs, isLoading } = useQuery({ queryKey: ["organizations"], queryFn: superAdminApi.listOrganizations });

  const suspendMutation = useMutation({
    mutationFn: (id: string) => superAdminApi.suspend(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      toast("Organization suspended", "success");
      setSuspendTarget(null);
    },
    onError: () => toast("Couldn't suspend organization.", "error"),
  });

  const reactivateMutation = useMutation({
    mutationFn: (id: string) => superAdminApi.reactivate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      toast("Organization reactivated", "success");
    },
    onError: () => toast("Couldn't reactivate organization.", "error"),
  });

  const impersonateMutation = useMutation({
    mutationFn: (org: OrganizationOut) => superAdminApi.impersonate(org.id).then((tokens) => ({ tokens, org })),
    onSuccess: ({ tokens, org }) => {
      toast("Signing in as org admin...", "info");
      startImpersonation(tokens.access_token, org.name);
    },
    onError: (err: any) => toast(err?.response?.data?.detail ?? "Couldn't impersonate this organization.", "error"),
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="page-eyebrow mb-1">Platform / Accounts</p>
          <h1 className="text-2xl font-display font-semibold text-ink-900">Organizations</h1>
          <p className="text-sm text-ink-500 mt-0.5">Manage every client organization on the platform.</p>
        </div>
        <button className="btn-primary text-sm" onClick={() => setShowCreate(true)}>
          <Plus size={16} /> New Organization
        </button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Total Organizations" value={String(stats.total_organizations)} icon={Building2} color="orange" />
          <KpiCard label="Active Organizations" value={String(stats.active_organizations)} icon={TrendingUp} color="teal" />
          <KpiCard label="Total Users" value={String(stats.total_users)} icon={Users} color="indigo" />
          <KpiCard label="Total Leads" value={String(stats.total_leads)} icon={Contact} color="pink" />
        </div>
      )}

      <div className="card">
        {isLoading ? (
          <PageLoading />
        ) : !orgs?.length ? (
          <EmptyState
            icon={Building2}
            title="No organizations yet"
            message="Create your first client organization to get started."
            action={
              <button className="btn-primary text-sm" onClick={() => setShowCreate(true)}>
                <Plus size={16} /> New Organization
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto scroll-shadow-x">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-ink-500 text-xs uppercase tracking-wide">
                  <th className="font-medium px-5 py-3">Organization</th>
                  <th className="font-medium px-5 py-3">Status</th>
                  <th className="font-medium px-5 py-3">Users</th>
                  <th className="font-medium px-5 py-3">Leads</th>
                  <th className="font-medium px-5 py-3">Created</th>
                  <th className="font-medium px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orgs.map((org) => (
                  <tr key={org.id} className="border-t border-ink-100 hover:bg-bg/60">
                    <td className="px-5 py-3">
                      <p className="font-medium text-ink-900">{org.name}</p>
                      <p className="text-xs text-ink-500 capitalize">{org.plan} plan</p>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`badge ${org.is_active ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}>
                        {org.is_active ? "Active" : "Suspended"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-ink-700">{org.user_count}</td>
                    <td className="px-5 py-3 text-ink-700">{org.lead_count}</td>
                    <td className="px-5 py-3 text-ink-500">{formatDate(org.created_at)}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          title="Impersonate org admin"
                          disabled={!org.is_active}
                          className="p-1.5 rounded-full hover:bg-primary/10 text-primary disabled:opacity-30"
                          onClick={() => impersonateMutation.mutate(org)}
                        >
                          <LogIn size={16} />
                        </button>
                        {org.is_active ? (
                          <button
                            title="Suspend"
                            className="p-1.5 rounded-full hover:bg-danger/10 text-danger"
                            onClick={() => setSuspendTarget(org)}
                          >
                            <PauseCircle size={16} />
                          </button>
                        ) : (
                          <button
                            title="Reactivate"
                            className="p-1.5 rounded-full hover:bg-success/10 text-success"
                            onClick={() => reactivateMutation.mutate(org.id)}
                          >
                            <PlayCircle size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CreateOrgModal open={showCreate} onClose={() => setShowCreate(false)} />
      <ConfirmModal
        open={!!suspendTarget}
        onClose={() => setSuspendTarget(null)}
        onConfirm={() => suspendTarget && suspendMutation.mutate(suspendTarget.id)}
        title="Suspend organization?"
        message={`Users in "${suspendTarget?.name}" will be blocked from logging in until you reactivate the organization. Data is preserved.`}
        confirmLabel="Suspend Organization"
        isLoading={suspendMutation.isPending}
      />
    </div>
  );
}
