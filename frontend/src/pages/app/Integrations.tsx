import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plug,
  RefreshCw,
  Copy,
  Check,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Download,
  Webhook,
} from "lucide-react";
import { integrationsApi } from "@/api/endpoints";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { Modal } from "@/components/Modal";
import { ConfirmModal } from "@/components/ConfirmModal";
import { PageLoading } from "@/components/Spinner";
import { timeAgo } from "@/lib/format";
import type { IntegrationOut } from "@/api/types";

export function IntegrationsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === "admin";

  const [connecting, setConnecting] = useState<IntegrationOut | null>(null);
  const [disconnecting, setDisconnecting] = useState<IntegrationOut | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<string | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ["integrations"], queryFn: integrationsApi.list });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["integrations"] });
    queryClient.invalidateQueries({ queryKey: ["leads"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const connectMutation = useMutation({
    mutationFn: () => integrationsApi.connect(connecting!.provider, form),
    onSuccess: (result) => {
      invalidate();
      if (result.status === "error") {
        toast(result.last_error ?? "Connected, but the credentials were rejected.", "error");
      } else {
        toast(`${result.label} connected`, "success");
      }
      setConnecting(null);
      setForm({});
    },
    onError: (err: any) => toast(err?.response?.data?.detail ?? "Couldn't save the connection.", "error"),
  });

  const disconnectMutation = useMutation({
    mutationFn: (provider: IntegrationOut["provider"]) => integrationsApi.disconnect(provider),
    onSuccess: () => {
      invalidate();
      toast("Integration disconnected", "success");
      setDisconnecting(null);
    },
    onError: () => toast("Couldn't disconnect.", "error"),
  });

  const syncMutation = useMutation({
    mutationFn: (provider: IntegrationOut["provider"]) => integrationsApi.sync(provider),
    onSuccess: (result) => {
      invalidate();
      toast(result.message, result.imported > 0 ? "success" : "info");
    },
    onError: (err: any) => toast(err?.response?.data?.detail ?? "Sync failed.", "error"),
  });

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 1800);
    });
  }

  if (isLoading || !data) return <PageLoading />;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="page-eyebrow mb-1">Workspace / Connections</p>
        <h1 className="page-title">Lead Sources</h1>
        <p className="page-subtitle max-w-3xl">
          Connect IndiaMART and JustDial so enquiries flow in automatically — no Excel upload needed.
          New leads stay unassigned until an admin or manager explicitly distributes them.
        </p>
      </div>

      {!isAdmin && (
        <div className="flex items-start gap-3 rounded-[10px] border border-warning/25 bg-warning/5 p-4">
          <AlertTriangle size={18} className="text-warning shrink-0 mt-0.5" />
          <p className="text-sm text-ink-700">
            Only an admin can connect or change lead sources. You can see their status here.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {data.map((it) => (
          <div key={it.provider} className="card flex flex-col gap-5 p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[9px] border border-primary/10 bg-primary-soft text-primary">
                  {it.ingestion === "push" ? <Webhook size={18} /> : <Download size={18} />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-ink-900">{it.label}</h2>
                    <StatusPill it={it} />
                  </div>
                  <p className="text-xs text-ink-500 mt-0.5">
                    {it.ingestion === "pull"
                      ? "We check for new leads automatically every few minutes."
                      : "They send leads to your webhook the moment they arrive."}
                  </p>
                </div>
              </div>
            </div>

            {it.is_connected && (
              <div className="grid grid-cols-1 gap-2 text-left sm:grid-cols-3 sm:text-center">
                <Stat label="Imported" value={it.total_imported} />
                <Stat label="Duplicates skipped" value={it.total_duplicates} />
                <Stat
                  label="Last activity"
                  value={it.last_synced_at ? timeAgo(it.last_synced_at) : "—"}
                  small
                />
              </div>
            )}

            {it.last_error && (
              <div className="rounded-lg bg-danger/10 border border-danger/20 px-3 py-2 flex gap-2">
                <AlertTriangle size={14} className="text-danger shrink-0 mt-0.5" />
                <p className="text-xs text-danger">{it.last_error}</p>
              </div>
            )}

            {it.webhook_url && (
              <div>
                <label className="text-xs font-medium text-ink-500 mb-1.5 block">
                  Your webhook URL — give this to {it.label}
                </label>
                <div className="flex gap-2">
                  <input className="input font-mono text-xs" readOnly value={it.webhook_url} />
                  <button
                    className="btn-secondary shrink-0"
                    onClick={() => copy(it.webhook_url!, it.provider)}
                    title="Copy"
                    aria-label={`Copy ${it.label} webhook URL`}
                  >
                    {copied === it.provider ? <Check size={15} /> : <Copy size={15} />}
                  </button>
                </div>
                <p className="text-xs text-ink-500 mt-1.5">
                  Treat this like a password — anyone with it can post leads into your account.
                </p>
              </div>
            )}

            <p className="text-xs text-ink-500">{it.setup_hint}</p>

            <div className="flex flex-wrap items-center gap-2 mt-auto pt-1">
              {isAdmin && (
                <button
                  className="btn-primary text-sm"
                  onClick={() => {
                    setConnecting(it);
                    setForm({});
                  }}
                >
                  <Plug size={15} /> {it.is_connected ? "Update credentials" : "Connect"}
                </button>
              )}
              {isAdmin && it.is_connected && it.ingestion === "pull" && (
                <button
                  className="btn-secondary text-sm"
                  disabled={syncMutation.isPending}
                  onClick={() => syncMutation.mutate(it.provider)}
                >
                  <RefreshCw size={15} className={syncMutation.isPending && syncMutation.variables === it.provider ? "animate-spin" : ""} />
                  {syncMutation.isPending && syncMutation.variables === it.provider ? "Syncing..." : "Sync now"}
                </button>
              )}
              {isAdmin && it.is_connected && (
                <button className="btn-ghost text-sm text-danger" onClick={() => setDisconnecting(it)}>
                  Disconnect
                </button>
              )}
              {it.docs_url && (
                <a
                  href={it.docs_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-ghost text-sm ml-auto"
                >
                  Docs <ExternalLink size={13} />
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      <Modal
        open={!!connecting}
        onClose={() => setConnecting(null)}
        title={`Connect ${connecting?.label ?? ""}`}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setConnecting(null)}>
              Cancel
            </button>
            <button
              className="btn-primary"
              disabled={connectMutation.isPending}
              onClick={() => connectMutation.mutate()}
            >
              {connectMutation.isPending ? "Saving..." : "Save & connect"}
            </button>
          </>
        }
      >
        {connecting && (
          <div className="flex flex-col gap-3.5">
            <p className="text-sm text-ink-500">{connecting.setup_hint}</p>
            {connecting.credential_fields.map((f) => (
              <div key={f.key}>
                <label htmlFor={`credential-${connecting.provider}-${f.key}`} className="text-xs font-medium text-ink-500 mb-1.5 block">
                  {f.label}
                  {!f.required && <span className="text-ink-300"> (optional)</span>}
                </label>
                <input
                  id={`credential-${connecting.provider}-${f.key}`}
                  className="input"
                  type={f.secret ? "password" : "text"}
                  autoComplete="off"
                  placeholder={connecting.masked_credentials[f.key] || ""}
                  value={form[f.key] ?? ""}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                />
                {f.help && <p className="text-xs text-ink-500 mt-1">{f.help}</p>}
              </div>
            ))}
            {connecting.is_connected && (
              <p className="text-xs text-ink-500">
                Leave a field blank to keep the value you already saved.
              </p>
            )}
          </div>
        )}
      </Modal>

      <ConfirmModal
        open={!!disconnecting}
        onClose={() => setDisconnecting(null)}
        onConfirm={() => disconnecting && disconnectMutation.mutate(disconnecting.provider)}
        title={`Disconnect ${disconnecting?.label ?? ""}?`}
        message="New leads will stop arriving from this platform. Leads already imported are kept. You can reconnect at any time, but the webhook URL will be regenerated."
        confirmLabel="Disconnect"
        isLoading={disconnectMutation.isPending}
      />
    </div>
  );
}

function StatusPill({ it }: { it: IntegrationOut }) {
  if (!it.is_connected) return <span className="badge bg-ink-300/20 text-ink-500">Not connected</span>;
  if (it.status === "error") {
    return (
      <span className="badge bg-danger/10 text-danger">
        <AlertTriangle size={11} /> Needs attention
      </span>
    );
  }
  if (!it.is_enabled) return <span className="badge bg-warning/10 text-warning">Paused</span>;
  return (
    <span className="badge bg-success/10 text-success">
      <CheckCircle2 size={11} /> Connected
    </span>
  );
}

function Stat({ label, value, small }: { label: string; value: string | number; small?: boolean }) {
  return (
    <div className="rounded-lg border border-ink-100 bg-[#F8F7F3] px-3 py-2.5">
      <p className={`font-semibold text-ink-900 tabular-nums ${small ? "text-xs" : "text-lg"}`}>{value}</p>
      <p className="text-[11px] text-ink-500 mt-0.5">{label}</p>
    </div>
  );
}
