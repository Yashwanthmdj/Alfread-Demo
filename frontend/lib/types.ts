export type Priority = "High" | "Medium" | "Low";

export type Invoice = {
  id: string;
  customerName: string;
  amount: number;
  dueDate: string;
  daysOverdue: number;
  status: "Overdue" | "Approved" | string;
  approvedAt: string | null;
  priority: Priority | null;
  reason: string | null;
  draftEmail: string | null;
};
