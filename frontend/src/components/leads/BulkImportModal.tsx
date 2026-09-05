import axios from "axios";
import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, FileSpreadsheet, Info, UploadCloud, XCircle } from "lucide-react";
import { Modal } from "@/components/Modal";
import { useToast } from "@/hooks/useToast";
import { leadsApi } from "@/api/endpoints";
import type { BulkImportIssue, BulkImportResult, LeadSource } from "@/api/types";

const SOURCES: { value: LeadSource; label: string }[] = [
  { value: "indiamart", label: "IndiaMART" },
  { value: "justdial", label: "JustDial" },
  { value: "tradeindia", label: "TradeIndia" },
  { value: "website", label: "Website" },
  { value: "referral", label: "Referral" },
  { value: "manual", label: "Manual" },
];

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

function parsePreview(text: string): { rows: string[][]; count: number } {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const rows = lines.slice(1, 4).map((line) => line.split(","));
  return { rows, count: Math.max(lines.length - 1, 0) };
}

function getImportError(error: unknown): { message: string; issues: BulkImportIssue[] } {
  if (!axios.isAxiosError(error)) {
    return { message: "The import could not be completed. Check the file and try again.", issues: [] };
  }

  const detail = error.response?.data?.detail;
  if (detail && typeof detail === "object") {
    const message = typeof detail.message === "string" ? detail.message : "The file could not be imported.";
    const issues = Array.isArray(detail.issues) ? (detail.issues as BulkImportIssue[]) : [];
    return { message, issues };
  }
  if (typeof detail === "string") return { message: detail, issues: [] };
  if (error.response?.status === 401) return { message: "Your session expired. Sign in again and retry the import.", issues: [] };
  if (error.response?.status === 403) return { message: "You do not have permission to import leads.", issues: [] };
  if (!error.response) return { message: "The server could not be reached. Check that the API is running and try again.", issues: [] };
  return { message: `The import failed (HTTP ${error.response.status}). Please try again.`, issues: [] };
}

function issueLocation(issue: BulkImportIssue): string {
  const parts = [issue.row ? `Row ${issue.row}` : null, issue.field ? `column “${issue.field}”` : null].filter(Boolean);
  return parts.length ? `${parts.join(" · ")}: ` : "";
}

export function BulkImportModal({
  open,
  onClose,
  assignToCurrentUser = false,
}: {
  open: boolean;
  onClose: () => void;
  /** Telecaller uploads are automatically assigned to that signed-in user. */
  assignToCurrentUser?: boolean;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<LeadSource>(assignToCurrentUser ? "manual" : "indiamart");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{ rows: string[][]; count: number } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorIssues, setErrorIssues] = useState<BulkImportIssue[]>([]);
  const [result, setResult] = useState<BulkImportResult | null>(null);

  const mutation = useMutation({
    mutationFn: () => leadsApi.bulkImport(source, file!),
    onSuccess: (importResult) => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["lead-categories"] });
      queryClient.invalidateQueries({ queryKey: ["lead-cities"] });
      setErrorMessage(null);
      setErrorIssues([]);

      if (importResult.issue_count > 0) {
        setResult(importResult);
        toast(
          importResult.imported > 0
            ? `Imported ${importResult.imported} leads with ${importResult.issue_count} issue(s) to review.`
            : `No leads were imported. ${importResult.issue_count} issue(s) need attention.`,
          importResult.imported > 0 ? "info" : "error"
        );
        return;
      }

      const assignmentSummary = Object.entries(importResult.assignments)
        .map(([name, count]) => `${name}: ${count}`)
        .join(", ");
      toast(
        `Imported ${importResult.imported} lead${importResult.imported === 1 ? "" : "s"}${
          assignmentSummary ? ` — ${assignmentSummary}` : ""
        }`,
        "success"
      );
      reset();
      onClose();
    },
    onError: (error) => {
      const parsed = getImportError(error);
      setErrorMessage(parsed.message);
      setErrorIssues(parsed.issues);
      setResult(null);
      toast(parsed.message, "error");
    },
  });

  function reset() {
    setFile(null);
    setPreview(null);
    setErrorMessage(null);
    setErrorIssues([]);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function onFileChange(nextFile: File | null) {
    setErrorMessage(null);
    setErrorIssues([]);
    setResult(null);
    setPreview(null);

    if (!nextFile) {
      setFile(null);
      return;
    }
    const isCsv = nextFile.name.toLowerCase().endsWith(".csv") || nextFile.type === "text/csv";
    const isXlsx = nextFile.name.toLowerCase().endsWith(".xlsx");
    if (!isCsv && !isXlsx) {
      setFile(null);
      setErrorMessage("Unsupported file type. Choose a CSV or XLSX file.");
      return;
    }
    if (nextFile.size > MAX_FILE_SIZE_BYTES) {
      setFile(null);
      setErrorMessage("This file is larger than 10 MB. Split it into smaller files and try again.");
      return;
    }

    setFile(nextFile);
    if (isCsv) {
      const text = await nextFile.text();
      setPreview(parsePreview(text));
    }
  }

  const visibleIssues = result?.issues ?? errorIssues;
  const hasResultIssues = Boolean(result && result.issue_count > 0);

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title={assignToCurrentUser ? "Upload My Leads" : "Bulk Import Leads"}
      size="lg"
      footer={
        <>
          <button
            className="btn-ghost"
            onClick={() => {
              reset();
              onClose();
            }}
          >
            {hasResultIssues ? "Done" : "Cancel"}
          </button>
          {hasResultIssues ? (
            <button className="btn-primary" onClick={reset}>
              Import another file
            </button>
          ) : (
            <button className="btn-primary" disabled={!file || mutation.isPending} onClick={() => mutation.mutate()}>
              {mutation.isPending
                ? "Checking file..."
                : assignToCurrentUser
                  ? "Upload & Assign to Me"
                  : "Confirm & Import"}
            </button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {assignToCurrentUser && (
          <div className="rounded-xl border border-primary/20 bg-primary-soft/40 px-3.5 py-3 text-sm text-ink-700">
            Every valid lead in this file will be assigned to you automatically. Admins and managers can see these leads in the shared workspace queue.
          </div>
        )}
        {!assignToCurrentUser && (
          <div>
            <label className="text-xs font-medium text-ink-500 mb-1.5 block">Source tag for this batch</label>
            <select className="input" value={source} onChange={(e) => setSource(e.target.value as LeadSource)} disabled={mutation.isPending}>
              {SOURCES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="text-xs font-medium text-ink-500 mb-1.5 block">CSV or XLSX file</label>
          <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-ink-100 rounded-xl py-8 cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition">
            <UploadCloud size={28} className="text-ink-300" />
            <span className="text-sm text-ink-500">{file ? file.name : "Click to choose a file"}</span>
            <span className="text-xs text-ink-300">Required: name, phone · Headers ignore case and spacing · Optional: city, category · Max 10 MB</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(e) => void onFileChange(e.target.files?.[0] ?? null)}
              disabled={mutation.isPending}
            />
          </label>
        </div>

        {file && !file.name.toLowerCase().endsWith(".csv") && (
          <div className="flex items-center gap-2 text-sm text-ink-500 bg-bg rounded-xl px-3.5 py-2.5">
            <FileSpreadsheet size={16} /> XLSX selected. The server will validate the first worksheet before importing.
          </div>
        )}

        {preview && (
          <div className="overflow-hidden rounded-[10px] border border-ink-100">
            <div className="bg-bg px-3.5 py-2 text-xs font-medium text-ink-500">
              Preview (first {preview.rows.length} rows) · {preview.count} data row{preview.count === 1 ? "" : "s"} detected
            </div>
            <div className="overflow-x-auto"><table className="min-w-full text-xs">
              <tbody>
                {preview.rows.map((row, rowIndex) => (
                  <tr key={rowIndex} className="border-t border-ink-100">
                    {row.map((cell, cellIndex) => (
                      <td key={cellIndex} className="px-3.5 py-2 text-ink-700">
                        {cell || <span className="text-ink-300">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>
        )}

        {errorMessage && (
          <div role="alert" className="rounded-xl border border-danger/20 bg-danger/5 px-3.5 py-3 flex items-start gap-2.5">
            <XCircle size={18} className="text-danger shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-danger">Import failed</p>
              <p className="text-sm text-ink-700 mt-0.5">{errorMessage}</p>
            </div>
          </div>
        )}

        {result && (
          <div className={`rounded-xl border px-3.5 py-3 ${result.imported > 0 ? "border-primary/20 bg-primary/5" : "border-danger/20 bg-danger/5"}`}>
            <div className="flex items-start gap-2.5">
              {result.imported > 0 ? <CheckCircle2 size={18} className="text-primary shrink-0 mt-0.5" /> : <AlertCircle size={18} className="text-danger shrink-0 mt-0.5" />}
              <div>
                <p className="text-sm font-semibold text-ink-900">
                  {result.imported > 0 ? `${result.imported} lead${result.imported === 1 ? "" : "s"} imported` : "No leads imported"}
                </p>
                <p className="text-sm text-ink-600 mt-0.5">
                  {result.issue_count} issue{result.issue_count === 1 ? "" : "s"} found
                  {result.skipped + result.duplicates_skipped > 0 ? ` · ${result.skipped + result.duplicates_skipped} row(s) skipped` : ""}
                  {assignToCurrentUser && result.imported > 0 ? " · Assigned to you" : ""}.
                </p>
              </div>
            </div>
          </div>
        )}

        {visibleIssues.length > 0 && (
          <div className="rounded-xl border border-ink-100 overflow-hidden">
            <div className="bg-bg px-3.5 py-2.5 flex items-center gap-2">
              <Info size={15} className="text-secondary" />
              <p className="text-xs font-semibold text-ink-700">What needs attention</p>
            </div>
            <ul className="max-h-52 overflow-y-auto divide-y divide-ink-100">
              {visibleIssues.map((issue, index) => (
                <li key={`${issue.code}-${issue.row ?? "file"}-${index}`} className="px-3.5 py-2.5 flex items-start gap-2">
                  {issue.severity === "warning" ? <AlertCircle size={14} className="text-secondary shrink-0 mt-0.5" /> : <XCircle size={14} className="text-danger shrink-0 mt-0.5" />}
                  <p className="text-xs text-ink-700 leading-relaxed">
                    <span className="font-semibold">{issueLocation(issue)}</span>
                    {issue.message}
                  </p>
                </li>
              ))}
            </ul>
            {((result?.issues_truncated ?? false) || (errorIssues.length > visibleIssues.length)) && (
              <p className="px-3.5 py-2.5 text-xs text-ink-500 border-t border-ink-100">Only the first 100 issues are shown. Fix these rows and upload again to see any remaining issues.</p>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
