import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  Mail,
  Pencil,
  Phone,
  ShieldCheck,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { superAdminApi } from "@/api/endpoints";
import { Modal } from "@/components/Modal";
import { PageLoading } from "@/components/Spinner";
import { formatDate } from "@/lib/format";
import type { OrganizationOut } from "@/api/types";

interface OrganizationDetailsModalProps {
  organization: OrganizationOut | null;
  onClose: () => void;
  onEdit?: () => void;
}

function DetailItem({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3 rounded-lg border border-ink-100 bg-[#F8F7F3] px-3.5 py-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
        <Icon size={15} aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-500">{label}</p>
        <div className="mt-1 truncate text-sm font-semibold text-ink-900">{children}</div>
      </div>
    </div>
  );
}

export function OrganizationDetailsModal({ organization, onClose, onEdit }: OrganizationDetailsModalProps) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["organization-details", organization?.id],
    queryFn: () => superAdminApi.getOrganization(organization!.id),
    enabled: !!organization,
  });

  const primaryAdmin = data?.members.find((member) => member.role === "admin");

  return (
    <Modal
      open={!!organization}
      onClose={onClose}
      title={organization ? `${organization.name} details` : "Organization details"}
      size="lg"
      footer={
        <>
          {onEdit && (
            <button className="btn-secondary" onClick={onEdit}>
              <Pencil size={15} aria-hidden="true" /> Edit Organization
            </button>
          )}
          <button className="btn-primary" onClick={onClose}>
            Done
          </button>
        </>
      }
    >
      {isLoading && <PageLoading />}
      {isError && (
        <div className="rounded-lg border border-danger/20 bg-danger/[0.06] px-4 py-3 text-sm text-danger" role="alert">
          We couldn&apos;t load this organization&apos;s details. Please close this view and try again.
        </div>
      )}
      {data && (
        <div>
          <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-primary/10 bg-primary-soft/45 p-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-sm">
                <Building2 size={20} aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h3 className="truncate text-base font-semibold text-ink-900">{data.name}</h3>
                <p className="mt-0.5 text-xs text-ink-500">Organization workspace profile</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="badge border-primary/10 bg-white text-primary capitalize">{data.plan} plan</span>
              <span className={`badge ${data.is_active ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}>
                {data.is_active ? "Active" : "Suspended"}
              </span>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <DetailItem icon={UserRound} label="Primary administrator">
              {primaryAdmin?.name ?? "Not assigned"}
            </DetailItem>
            <DetailItem icon={Phone} label="Contact number">
              {primaryAdmin?.phone ? (
                <a className="text-primary hover:underline" href={`tel:${primaryAdmin.phone}`}>
                  {primaryAdmin.phone}
                </a>
              ) : (
                "Not provided"
              )}
            </DetailItem>
            <DetailItem icon={Mail} label="Administrator email">
              {primaryAdmin?.email ? (
                <a className="text-primary hover:underline" href={`mailto:${primaryAdmin.email}`}>
                  {primaryAdmin.email}
                </a>
              ) : (
                "Not provided"
              )}
            </DetailItem>
            <DetailItem icon={CalendarDays} label="Created">
              {formatDate(data.created_at)}
            </DetailItem>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-ink-100 bg-white px-3.5 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-500">Team members</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-ink-900">{data.user_count}</p>
            </div>
            <div className="rounded-lg border border-ink-100 bg-white px-3.5 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-500">Total leads</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-ink-900">{data.lead_count}</p>
            </div>
            <div className="col-span-2 rounded-lg border border-ink-100 bg-white px-3.5 py-3 sm:col-span-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-500">Access</p>
              <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-ink-900">
                {data.is_active ? <CheckCircle2 size={15} className="text-success" /> : <ShieldCheck size={15} className="text-danger" />}
                {data.is_active ? "Workspace enabled" : "Sign-in blocked"}
              </p>
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-xl border border-ink-100">
            <div className="flex items-center justify-between gap-3 border-b border-ink-100 bg-[#F8F7F3] px-4 py-3">
              <div>
                <h3 className="text-sm font-semibold text-ink-900">Organization contacts</h3>
                <p className="mt-0.5 text-xs text-ink-500">All members and their current access status.</p>
              </div>
              <Users size={17} className="text-ink-500" aria-hidden="true" />
            </div>
            {!data.members.length ? (
              <p className="px-4 py-8 text-center text-sm text-ink-500">No team members found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-sm">
                  <thead>
                    <tr className="border-b border-ink-100 text-left text-[10px] uppercase tracking-[0.12em] text-ink-500">
                      <th className="px-4 py-2.5 font-bold">Name</th>
                      <th className="px-4 py-2.5 font-bold">Role</th>
                      <th className="px-4 py-2.5 font-bold">Phone</th>
                      <th className="px-4 py-2.5 font-bold">Email</th>
                      <th className="px-4 py-2.5 text-right font-bold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.members.map((member) => (
                      <tr key={member.id} className="border-b border-ink-100 last:border-0">
                        <td className="px-4 py-3 font-medium text-ink-900">{member.name}</td>
                        <td className="px-4 py-3 capitalize text-ink-600">{member.role.replace("_", " ")}</td>
                        <td className="px-4 py-3 text-ink-700">{member.phone}</td>
                        <td className="max-w-[180px] truncate px-4 py-3 text-ink-600">{member.email ?? "—"}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={`badge ${member.is_active ? "bg-success/10 text-success" : "bg-ink-100 text-ink-500"}`}>
                            {member.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
