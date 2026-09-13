import type { Priority } from "@/lib/types";

const styles: Record<Priority, string> = {
  High: "bg-rose-50 text-rose-800 ring-rose-200",
  Medium: "bg-amber-50 text-amber-800 ring-amber-200",
  Low: "bg-emerald-50 text-emerald-800 ring-emerald-200",
};

export function PriorityBadge({
  priority,
}: {
  priority: Priority | null;
}) {
  if (!priority) {
    return (
      <span className="inline-flex items-center rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-500 ring-1 ring-inset ring-stone-200">
        Pending
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide ring-1 ring-inset ${styles[priority]}`}
    >
      {priority}
    </span>
  );
}
