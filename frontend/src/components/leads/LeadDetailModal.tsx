import { useQuery } from "@tanstack/react-query";
import { Phone, MapPin, Clock, Package, ShieldAlert, IndianRupee, Stethoscope, FileBadge, Pencil } from "lucide-react";
import { Modal } from "@/components/Modal";
import { callsApi } from "@/api/endpoints";
import { StatusBadge, SourceBadge, CategoryBadge, DndBadge } from "@/components/StatusBadge";
import { formatCallbackTime, formatMinutes, timeAgo, formatCurrencyFull } from "@/lib/format";
import type { LeadOut } from "@/api/types";

export function LeadDetailModal({
  open,
  onClose,
  lead,
  onEdit,
}: {
  open: boolean;
  onClose: () => void;
  lead: LeadOut | null;
  onEdit?: () => void;
}) {
  const { data: history, isLoading } = useQuery({
    queryKey: ["call-history", lead?.id],
    queryFn: () => callsApi.history(lead!.id),
    enabled: open && !!lead,
  });

  if (!lead) return null;

  const isOverCredit =
    lead.outstanding_amount != null && lead.credit_limit != null && lead.outstanding_amount > lead.credit_limit;
  const isCallbackOverdue = lead.next_follow_up_at != null && new Date(lead.next_follow_up_at) < new Date();

  return (
    <Modal open={open} onClose={onClose} title={lead.name} size="lg">
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={lead.status} />
          <SourceBadge source={lead.source} />
          <CategoryBadge category={lead.category} />
          {lead.dnd && <DndBadge />}
          {onEdit && (
            <button onClick={onEdit} className="btn-secondary text-xs px-3 py-1.5 ml-auto">
              <Pencil size={13} /> Edit
            </button>
          )}
        </div>

        {lead.next_follow_up_at && (
          <div
            className={`rounded-xl border p-3.5 flex items-center gap-2.5 ${
              isCallbackOverdue ? "border-danger/30 bg-danger/5" : "border-warning/30 bg-warning/5"
            }`}
          >
            <Clock size={16} className={isCallbackOverdue ? "text-danger" : "text-warning"} />
            <div>
              <p className={`text-sm font-semibold ${isCallbackOverdue ? "text-danger" : "text-warning"}`}>
                {isCallbackOverdue ? "Pending — call back is overdue" : "Call back scheduled"}
              </p>
              <p className="text-xs text-ink-500">
                {isCallbackOverdue
                  ? `Was due ${formatCallbackTime(lead.next_follow_up_at)}`
                  : formatCallbackTime(lead.next_follow_up_at)}
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2 text-ink-700">
            <Phone size={15} className="text-ink-300" /> {lead.phone}
          </div>
          {lead.city && (
            <div className="flex items-center gap-2 text-ink-700">
              <MapPin size={15} className="text-ink-300" /> {lead.city}
              {lead.state && `, ${lead.state}`}
            </div>
          )}
          {lead.product_name && (
            <div className="flex items-center gap-2 text-ink-700">
              <Package size={15} className="text-ink-300" /> {lead.product_name}
            </div>
          )}
          {lead.specialty && (
            <div className="flex items-center gap-2 text-ink-700">
              <Stethoscope size={15} className="text-ink-300" /> {lead.specialty}
            </div>
          )}
          {lead.drug_license_number && (
            <div className="flex items-center gap-2 text-ink-700">
              <FileBadge size={15} className="text-ink-300" /> DL: {lead.drug_license_number}
            </div>
          )}
          <div className="flex items-center gap-2 text-ink-700 col-span-2">
            <Clock size={15} className="text-ink-300" /> Last contacted {timeAgo(lead.last_contacted_at)}
          </div>
        </div>

        {(lead.credit_limit != null || lead.outstanding_amount != null) && (
          <div className={`rounded-xl border p-3.5 ${isOverCredit ? "border-warning/30 bg-warning/5" : "border-ink-100 bg-bg"}`}>
            <div className="flex items-center gap-2 mb-2">
              <IndianRupee size={15} className={isOverCredit ? "text-warning" : "text-ink-500"} />
              <p className="text-sm font-semibold text-ink-900">Credit Standing</p>
              {isOverCredit && (
                <span className="badge bg-warning/10 text-warning ml-auto">
                  <ShieldAlert size={12} /> Over Credit Limit
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-ink-500">Credit limit</p>
                <p className="font-medium text-ink-900">
                  {lead.credit_limit != null ? formatCurrencyFull(lead.credit_limit) : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-ink-500">Outstanding</p>
                <p className={`font-medium ${isOverCredit ? "text-warning" : "text-ink-900"}`}>
                  {lead.outstanding_amount != null ? formatCurrencyFull(lead.outstanding_amount) : "—"}
                </p>
              </div>
            </div>
          </div>
        )}

        {lead.notes && (
          <div className="bg-bg rounded-xl px-3.5 py-2.5 text-sm text-ink-700">{lead.notes}</div>
        )}

        <div>
          <h4 className="text-sm font-semibold text-ink-900 mb-3">Call History</h4>
          {isLoading ? (
            <p className="text-sm text-ink-500">Loading...</p>
          ) : !history?.length ? (
            <p className="text-sm text-ink-500">No calls logged yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {history.map((call) => (
                <div key={call.id} className="flex gap-3 border-l-2 border-ink-100 pl-3.5">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <StatusBadge status={call.outcome} />
                      <span className="text-xs text-ink-500">{formatMinutes(call.duration_minutes)}</span>
                      {call.order_value != null && (
                        <span className="badge bg-success/10 text-success">
                          {formatCurrencyFull(call.order_value)}
                          {call.product_name && ` · ${call.product_name}`}
                        </span>
                      )}
                    </div>
                    {call.notes && <p className="text-sm text-ink-700 mt-1">{call.notes}</p>}
                    {call.next_follow_up_at && (
                      <p className="text-xs text-warning mt-1 flex items-center gap-1">
                        <Clock size={11} /> Asked to call back {formatCallbackTime(call.next_follow_up_at)}
                      </p>
                    )}
                    <p className="text-xs text-ink-300 mt-1">
                      {call.logged_by_name ?? "Unknown"} · {timeAgo(call.created_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
