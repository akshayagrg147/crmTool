import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Plus, Users, Contact, TrendingUp, PlayCircle, PauseCircle, LogIn, Eye, Pencil, Trash2 } from "lucide-react";
import { superAdminApi } from "@/api/endpoints";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { KpiCard } from "@/components/KpiCard";
import { EmptyState } from "@/components/EmptyState";
import { PageLoading } from "@/components/Spinner";
import { ConfirmModal } from "@/components/ConfirmModal";
import { CreateOrgModal } from "@/components/super-admin/CreateOrgModal";
import { OrganizationDetailsModal } from "@/components/super-admin/OrganizationDetailsModal";
import { EditOrganizationModal } from "@/components/super-admin/EditOrganizationModal";
import { DeleteOrganizationModal } from "@/components/super-admin/DeleteOrganizationModal";
import { formatDate } from "@/lib/format";
import type { OrganizationOut } from "@/api/types";

export function OrganizationsPage() {
  const { toast } = useToast();
  const { startImpersonation } = useAuth();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [suspendTarget, setSuspendTarget] = useState<OrganizationOut | null>(null);
  const [detailsTarget, setDetailsTarget] = useState<OrganizationOut | null>(null);
  const [editTarget, setEditTarget] = useState<OrganizationOut | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<OrganizationOut | null>(null);

  const { data: stats } = useQuery({ queryKey: ["platform-stats"], queryFn: superAdminApi.stats });
  const { data: orgs, isLoading } = useQuery({ queryKey: ["organizations"], queryFn: superAdminApi.listOrganizations });

  const suspendMutation = useMutation({
    mutationFn: (id: string) => superAdminApi.suspend(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      queryClient.invalidateQueries({ queryKey: ["organization-details", id] });
      queryClient.invalidateQueries({ queryKey: ["platform-stats"] });
      toast("Organization suspended", "success");
      setSuspendTarget(null);
    },
    onError: () => toast("Couldn't suspend organization.", "error"),
  });

  const reactivateMutation = useMutation({
    mutationFn: (id: string) => superAdminApi.reactivate(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      queryClient.invalidateQueries({ queryKey: ["organization-details", id] });
      queryClient.invalidateQueries({ queryKey: ["platform-stats"] });
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

  const deleteMutation = useMutation({
    mutationFn: (org: OrganizationOut) => superAdminApi.deleteOrganization(org.id, org.name),
    onSuccess: (_, org) => {
      queryClient.removeQueries({ queryKey: ["organization-details", org.id] });
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      queryClient.invalidateQueries({ queryKey: ["platform-stats"] });
      toast(`${org.name} permanently deleted`, "success");
      setDeleteTarget(null);
      setDetailsTarget(null);
      setEditTarget(null);
    },
    onError: (err: any) => toast(err?.response?.data?.detail ?? "Couldn't delete organization.", "error"),
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="page-eyebrow mb-1">Platform / Accounts</p>
          <h1 className="page-title">Organizations</h1>
          <p className="page-subtitle">Manage every client organization on the platform.</p>
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
          <>
          <div className="hidden overflow-x-auto scroll-shadow-x md:block">
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
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary-soft text-primary">
                          {org.logo_url ? <img src={org.logo_url} alt="" className="max-h-full max-w-full bg-white object-contain p-1" /> : <Building2 size={17} aria-hidden="true" />}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-ink-900">{org.name}</p>
                          <p className="text-xs text-ink-500 capitalize">{org.plan} plan</p>
                        </div>
                      </div>
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
                          title="View organization details"
                          aria-label={`View details for ${org.name}`}
                          className="rounded-full p-1.5 text-primary hover:bg-primary/10"
                          onClick={() => setDetailsTarget(org)}
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          title="Edit organization"
                          aria-label={`Edit ${org.name}`}
                          className="rounded-full p-1.5 text-ink-600 hover:bg-primary/10 hover:text-primary"
                          onClick={() => setEditTarget(org)}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          title="Impersonate org admin"
                          aria-label={`Open ${org.name} as organization admin`}
                          disabled={!org.is_active}
                          className="p-1.5 rounded-full hover:bg-primary/10 text-primary disabled:opacity-30"
                          onClick={() => impersonateMutation.mutate(org)}
                        >
                          <LogIn size={16} />
                        </button>
                        {org.is_active ? (
                          <button
                          title="Suspend"
                          aria-label={`Suspend ${org.name}`}
                            className="p-1.5 rounded-full hover:bg-danger/10 text-danger"
                            onClick={() => setSuspendTarget(org)}
                          >
                            <PauseCircle size={16} />
                          </button>
                        ) : (
                          <button
                          title="Reactivate"
                          aria-label={`Reactivate ${org.name}`}
                            className="p-1.5 rounded-full hover:bg-success/10 text-success"
                            onClick={() => reactivateMutation.mutate(org.id)}
                          >
                            <PlayCircle size={16} />
                          </button>
                        )}
                        <button
                          title="Delete permanently"
                          aria-label={`Delete ${org.name} permanently`}
                          className="rounded-full p-1.5 text-danger hover:bg-danger/10"
                          onClick={() => setDeleteTarget(org)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="divide-y divide-ink-100 md:hidden">
            {orgs.map((org) => (
              <article key={org.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary-soft text-primary">
                    {org.logo_url ? <img src={org.logo_url} alt="" className="max-h-full max-w-full bg-white object-contain p-1" /> : <Building2 size={18} aria-hidden="true" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h2 className="font-semibold text-ink-900">{org.name}</h2>
                      <span className={`badge ${org.is_active ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}>{org.is_active ? "Active" : "Suspended"}</span>
                    </div>
                    <p className="mt-0.5 text-xs capitalize text-ink-500">{org.plan} plan · Created {formatDate(org.created_at)}</p>
                  </div>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 rounded-lg border border-ink-100 bg-[#F8F7F3] p-3 text-xs">
                  <div><dt className="text-ink-400">Users</dt><dd className="mt-0.5 text-lg font-bold text-ink-900">{org.user_count}</dd></div>
                  <div><dt className="text-ink-400">Leads</dt><dd className="mt-0.5 text-lg font-bold text-ink-900">{org.lead_count}</dd></div>
                </dl>
                <div className="mt-3 flex flex-wrap justify-end gap-2">
                  <button className="btn-secondary text-xs" onClick={() => setDetailsTarget(org)}><Eye size={15} /> View details</button>
                  <button className="btn-secondary text-xs" onClick={() => setEditTarget(org)}><Pencil size={15} /> Edit</button>
                  <button disabled={!org.is_active} className="btn-secondary text-xs" onClick={() => impersonateMutation.mutate(org)}><LogIn size={15} /> Open account</button>
                  {org.is_active ? (
                    <button className="btn-ghost min-h-10 text-xs text-danger" onClick={() => setSuspendTarget(org)}><PauseCircle size={15} /> Suspend</button>
                  ) : (
                    <button className="btn-ghost min-h-10 text-xs text-success" onClick={() => reactivateMutation.mutate(org.id)}><PlayCircle size={15} /> Reactivate</button>
                  )}
                  <button className="btn-ghost min-h-10 text-xs text-danger" onClick={() => setDeleteTarget(org)}><Trash2 size={15} /> Delete</button>
                </div>
              </article>
            ))}
          </div>
          </>
        )}
      </div>

      <CreateOrgModal open={showCreate} onClose={() => setShowCreate(false)} />
      <OrganizationDetailsModal
        organization={detailsTarget}
        onClose={() => setDetailsTarget(null)}
        onEdit={() => {
          setEditTarget(detailsTarget);
          setDetailsTarget(null);
        }}
      />
      <EditOrganizationModal organization={editTarget} onClose={() => setEditTarget(null)} />
      <DeleteOrganizationModal
        organization={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
        isLoading={deleteMutation.isPending}
      />
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
