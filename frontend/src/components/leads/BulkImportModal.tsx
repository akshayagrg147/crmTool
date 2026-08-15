import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { UploadCloud, FileSpreadsheet } from "lucide-react";
import { Modal } from "@/components/Modal";
import { useToast } from "@/hooks/useToast";
import { leadsApi } from "@/api/endpoints";
import type { LeadSource } from "@/api/types";

const SOURCES: { value: LeadSource; label: string }[] = [
  { value: "indiamart", label: "IndiaMART" },
  { value: "tradeindia", label: "TradeIndia" },
  { value: "website", label: "Website" },
  { value: "referral", label: "Referral" },
  { value: "manual", label: "Manual" },
];

function parsePreview(text: string): { rows: string[][]; count: number } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const rows = lines.slice(1, 4).map((l) => l.split(","));
  return { rows, count: Math.max(lines.length - 1, 0) };
}

export function BulkImportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<LeadSource>("indiamart");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{ rows: string[][]; count: number } | null>(null);

  const mutation = useMutation({
    mutationFn: () => leadsApi.bulkImport(source, file!),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["lead-categories"] });
      const assignmentSummary = Object.entries(result.assignments)
        .map(([name, count]) => `${name}: ${count}`)
        .join(", ");
      const skippedParts = [
        result.skipped ? `${result.skipped} invalid` : null,
        result.duplicates_skipped ? `${result.duplicates_skipped} duplicate` : null,
      ].filter(Boolean);
      toast(
        `Imported ${result.imported} leads${skippedParts.length ? `, skipped ${skippedParts.join(" + ")} rows` : ""}${
          assignmentSummary ? ` — ${assignmentSummary}` : ""
        }`,
        "success"
      );
      reset();
      onClose();
    },
    onError: () => toast("Import failed. Please check the file and try again.", "error"),
  });

  function reset() {
    setFile(null);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function onFileChange(f: File | null) {
    setFile(f);
    setPreview(null);
    if (f && (f.name.endsWith(".csv") || f.type === "text/csv")) {
      const text = await f.text();
      setPreview(parsePreview(text));
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Bulk Import Leads"
      size="lg"
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" disabled={!file || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "Importing..." : "Confirm & Import"}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div>
          <label className="text-xs font-medium text-ink-500 mb-1.5 block">Source tag for this batch</label>
          <select className="input" value={source} onChange={(e) => setSource(e.target.value as LeadSource)}>
            {SOURCES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-medium text-ink-500 mb-1.5 block">CSV or XLSX file</label>
          <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-ink-100 rounded-xl py-8 cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition">
            <UploadCloud size={28} className="text-ink-300" />
            <span className="text-sm text-ink-500">{file ? file.name : "Click to choose a file, or drag it here"}</span>
            <span className="text-xs text-ink-300">Columns expected: name, phone, city (optional)</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx"
              className="hidden"
              onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>

        {file && !file.name.endsWith(".csv") && (
          <div className="flex items-center gap-2 text-sm text-ink-500 bg-bg rounded-xl px-3.5 py-2.5">
            <FileSpreadsheet size={16} /> XLSX file selected — preview available after import.
          </div>
        )}

        {preview && (
          <div className="rounded-xl border border-ink-100 overflow-hidden">
            <div className="bg-bg px-3.5 py-2 text-xs font-medium text-ink-500">
              Preview (first {preview.rows.length} rows) · {preview.count} rows detected
            </div>
            <table className="w-full text-xs">
              <tbody>
                {preview.rows.map((row, i) => (
                  <tr key={i} className="border-t border-ink-100">
                    {row.map((cell, j) => (
                      <td key={j} className="px-3.5 py-2 text-ink-700">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  );
}
