"use client";

import { useEffect, useMemo, useState } from "react";

import { InvoicePanel } from "@/components/InvoicePanel";
import { PriorityBadge } from "@/components/PriorityBadge";
import { approveInvoice, fetchInvoices } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import { localAnalyze } from "@/lib/localAnalyze";
import { SAMPLE_INVOICES } from "@/lib/sampleInvoices";
import type { Invoice } from "@/lib/types";

type Filter = "review" | "approved";

export default function DashboardPage() {
  const [invoices, setInvoices] = useState<Invoice[]>(() =>
    SAMPLE_INVOICES.map(localAnalyze)
  );
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("review");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function syncFromApi() {
      try {
        const data = await fetchInvoices();
        if (cancelled || !data.length) return;
        setInvoices(
          data.map((invoice) =>
            invoice.priority && invoice.reason && invoice.draftEmail
              ? invoice
              : localAnalyze(invoice)
          )
        );
        setError(null);
      } catch {
        if (!cancelled) {
          setError(null);
        }
      }
    }

    syncFromApi();
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = invoices.find((invoice) => invoice.id === selectedId) ?? null;
  const awaiting = invoices.filter((invoice) => invoice.status !== "Approved");
  const approved = invoices.filter((invoice) => invoice.status === "Approved");
  const visible = filter === "review" ? awaiting : approved;

  const stats = useMemo(() => {
    const outstanding = awaiting.reduce((sum, invoice) => sum + invoice.amount, 0);
    const high = awaiting.filter((invoice) => invoice.priority === "High").length;
    return {
      outstanding,
      high,
      awaiting: awaiting.length,
      approved: approved.length,
    };
  }, [awaiting, approved]);

  async function handleApprove(id: string, draftEmail: string) {
    try {
      const updated = await approveInvoice(id, draftEmail);
      setInvoices((current) =>
        current.map((invoice) => (invoice.id === id ? { ...invoice, ...updated } : invoice))
      );
    } catch {
      setInvoices((current) =>
        current.map((invoice) =>
          invoice.id === id
            ? {
                ...invoice,
                status: "Approved",
                approvedAt: new Date().toISOString(),
                draftEmail,
              }
            : invoice
        )
      );
    }
  }

  return (
    <div className="mx-auto min-h-screen max-w-6xl px-5 pb-16 pt-8 sm:px-8">
      <header className="flex flex-col gap-6 border-b border-stone-200/80 pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white/70 px-3 py-1 text-xs font-medium text-stone-600">
            <span className="h-1.5 w-1.5 rounded-full bg-pine" />
            Human approval required
          </div>
          <h1 className="font-serif text-4xl tracking-tight text-ink sm:text-5xl">
            Alfred <span className="italic text-pine">Mini</span>
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-stone-600 sm:text-[15px]">
            An accounts receivable assistant. Alfred ranks overdue invoices and
            drafts reminder emails. Nothing goes out until you approve it.
          </p>
        </div>
        <p className="text-xs uppercase tracking-[0.18em] text-stone-400">
          Finance assistant
        </p>
      </header>

      {error ? (
        <div className="mt-8 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm leading-relaxed text-rose-900">
          <p className="font-semibold">Alfred could not start</p>
          <p className="mt-1">{error}</p>
        </div>
      ) : null}

      <section className="mt-8 grid gap-3 sm:grid-cols-3">
        <Stat
          label="Overdue balance"
          value={formatCurrency(stats.outstanding)}
        />
        <Stat
          label="High priority"
          value={String(stats.high)}
          hint="Needs attention first"
        />
        <Stat
          label="Awaiting review"
          value={String(stats.awaiting)}
          hint={`${stats.approved} already approved`}
        />
      </section>

      <section className="mt-10">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="inline-flex rounded-full border border-stone-200 bg-white p-1">
            <FilterButton
              active={filter === "review"}
              onClick={() => setFilter("review")}
              label={`Needs review (${stats.awaiting})`}
            />
            <FilterButton
              active={filter === "approved"}
              onClick={() => setFilter("approved")}
              label={`Approved (${stats.approved})`}
            />
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
          {visible.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <p className="font-serif text-2xl text-ink">
                {filter === "review" ? "Nothing left to review" : "No approvals yet"}
              </p>
              <p className="mt-2 text-sm text-stone-500">
                {filter === "review"
                  ? "Every overdue invoice has been approved in this session."
                  : "Open an invoice and click Approve & Send to record a human decision."}
              </p>
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-stone-200 bg-[#faf8f3] text-xs uppercase tracking-[0.12em] text-stone-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Customer</th>
                  <th className="hidden px-5 py-3 font-medium md:table-cell">Due</th>
                  <th className="px-5 py-3 font-medium">Amount</th>
                  <th className="px-5 py-3 font-medium">Overdue</th>
                  <th className="px-5 py-3 font-medium">Priority</th>
                  <th className="hidden px-5 py-3 font-medium sm:table-cell">Status</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((invoice) => (
                  <tr
                    key={invoice.id}
                    onClick={() => setSelectedId(invoice.id)}
                    className="cursor-pointer border-b border-stone-100 last:border-0 transition hover:bg-[#f7f4ee]"
                  >
                    <td className="px-5 py-4">
                      <p className="font-medium text-ink">{invoice.customerName}</p>
                      <p className="text-xs text-stone-500">{invoice.id}</p>
                    </td>
                    <td className="hidden px-5 py-4 text-stone-600 md:table-cell">
                      {formatDate(invoice.dueDate)}
                    </td>
                    <td className="px-5 py-4 font-medium text-ink">
                      {formatCurrency(invoice.amount)}
                    </td>
                    <td className="px-5 py-4 text-stone-700">{invoice.daysOverdue} days</td>
                    <td className="px-5 py-4">
                      <PriorityBadge priority={invoice.priority} />
                    </td>
                    <td className="hidden px-5 py-4 sm:table-cell">
                      {invoice.status === "Approved" ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100">
                            ✓
                          </span>
                          Approved
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-stone-500">Review</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <p className="mt-8 text-center text-xs leading-relaxed text-stone-400">
        A human-in-the-loop prototype. Inspired by Alfred AI’s approach to
        automating finance workflows with approval before any action is taken.
      </p>

      {selected ? (
        <InvoicePanel
          invoice={selected}
          onClose={() => setSelectedId(null)}
          onApprove={handleApprove}
        />
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white px-5 py-4">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-stone-500">
        {label}
      </p>
      <p className="mt-2 font-serif text-3xl text-ink">{value}</p>
      {hint ? <p className="mt-1 text-xs text-stone-500">{hint}</p> : null}
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
        active ? "bg-ink text-white" : "text-stone-600 hover:text-ink"
      }`}
    >
      {label}
    </button>
  );
}
