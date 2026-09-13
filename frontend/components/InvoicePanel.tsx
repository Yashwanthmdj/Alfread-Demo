"use client";

import { useEffect, useState } from "react";

import { PriorityBadge } from "@/components/PriorityBadge";
import type { Invoice } from "@/lib/types";
import { formatCurrency, formatDate, formatTimestamp } from "@/lib/format";

type InvoicePanelProps = {
  invoice: Invoice;
  onClose: () => void;
  onApprove: (id: string, draftEmail: string) => Promise<void>;
};

export function InvoicePanel({ invoice, onClose, onApprove }: InvoicePanelProps) {
  const [draft, setDraft] = useState(invoice.draftEmail ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const approved = invoice.status === "Approved";

  useEffect(() => {
    setDraft(invoice.draftEmail ?? "");
    setError(null);
  }, [invoice.id, invoice.draftEmail]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleApprove() {
    setSaving(true);
    setError(null);
    try {
      await onApprove(invoice.id, draft);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approval failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button
        type="button"
        aria-label="Close invoice details"
        className="absolute inset-0 bg-ink/25 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <aside className="relative flex h-full w-full max-w-xl flex-col overflow-y-auto bg-[#fbfaf6] shadow-panel">
        <div className="flex items-start justify-between gap-4 border-b border-stone-200/80 px-6 py-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-stone-500">
              {invoice.id}
            </p>
            <h2 className="mt-1 font-serif text-3xl leading-tight text-ink">
              {invoice.customerName}
            </h2>
            <p className="mt-2 text-sm text-stone-600">
              {formatCurrency(invoice.amount)} · due {formatDate(invoice.dueDate)} ·{" "}
              {invoice.daysOverdue} days overdue
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-3 py-1 text-sm text-stone-500 transition hover:bg-stone-100 hover:text-ink"
          >
            Close
          </button>
        </div>

        <div className="space-y-6 px-6 py-6">
          <section className="rounded-2xl border border-stone-200 bg-white p-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-ink">Alfred’s assessment</h3>
              <PriorityBadge priority={invoice.priority} />
            </div>
            <p className="mt-3 text-[15px] leading-relaxed text-stone-700">
              {invoice.reason ??
                "Alfred is still reviewing this invoice. The priority and draft will appear here in a moment."}
            </p>
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ink">Draft reminder</h3>
              <span className="text-xs text-stone-500">Editable before approval</span>
            </div>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              readOnly={approved}
              rows={12}
              className="min-h-[240px] w-full resize-y rounded-2xl border border-stone-200 bg-white px-4 py-3 text-[15px] leading-relaxed text-ink outline-none ring-pine/20 transition focus:ring-4 disabled:bg-stone-50"
            />
          </section>

          {approved ? (
            <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              <span className="mt-0.5 text-base">✓</span>
              <div>
                <p className="font-semibold">Approved</p>
                <p className="mt-0.5 text-emerald-800/80">
                  Marked approved {formatTimestamp(invoice.approvedAt)}. No email
                  was sent — this is a human-approval demo.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {error ? (
                <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">
                  {error}
                </p>
              ) : null}
              <button
                type="button"
                onClick={handleApprove}
                disabled={saving || !draft.trim()}
                className="w-full rounded-full bg-pine px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#173d2e] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Approving…" : "Approve & Send"}
              </button>
              <p className="text-center text-xs leading-relaxed text-stone-500">
                Nothing is sent automatically. Approval is a manual click and only
                updates status in this prototype.
              </p>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
