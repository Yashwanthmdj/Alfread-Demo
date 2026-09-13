import { formatCurrency, formatDate } from "./format";
import type { Invoice, Priority } from "./types";

export function localAnalyze(invoice: Invoice): Invoice {
  const priority: Priority =
    invoice.amount >= 40000 || invoice.daysOverdue >= 30
      ? "High"
      : invoice.amount >= 10000 || invoice.daysOverdue >= 10
        ? "Medium"
        : "Low";

  const reason =
    priority === "High"
      ? `${invoice.customerName} has ${formatCurrency(invoice.amount)} outstanding for ${invoice.daysOverdue} days, so this should be worked first.`
      : priority === "Medium"
        ? `${invoice.customerName} is ${invoice.daysOverdue} days past due on ${formatCurrency(invoice.amount)} and needs a timely reminder.`
        : `${invoice.customerName} is only ${invoice.daysOverdue} days late on a smaller balance of ${formatCurrency(invoice.amount)}.`;

  const draftEmail = `Dear ${invoice.customerName} Accounts Payable,

I hope you are well. I am writing about invoice ${invoice.id} for ${formatCurrency(invoice.amount)}, which was due on ${formatDate(invoice.dueDate)} and is now ${invoice.daysOverdue} days overdue.

Please arrange payment at your earliest convenience, or let us know if this invoice is already in process. We are happy to resend the original invoice or supporting documents if that would help.

Thank you for your partnership.

Kind regards,
Accounts Receivable
Alfred Mini`;

  return {
    ...invoice,
    priority,
    reason,
    draftEmail,
  };
}
