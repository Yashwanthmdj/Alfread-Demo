import type { Invoice } from "./types";

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"
).replace(/\/$/, "");

async function parseError(response: Response): Promise<string> {
  try {
    const body = await response.json();
    if (typeof body?.detail === "string") return body.detail;
    if (Array.isArray(body?.detail)) {
      return body.detail.map((item: { msg?: string }) => item.msg).join(" ");
    }
  } catch {
    /* use fallback */
  }
  return `Request failed with status ${response.status}.`;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = 4000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchInvoices(): Promise<Invoice[]> {
  const response = await fetchWithTimeout(`${API_URL}/invoices`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return response.json();
}

export async function analyzeInvoice(id: string): Promise<Invoice> {
  const response = await fetchWithTimeout(
    `${API_URL}/invoices/${id}/analyze`,
    { method: "POST" },
    45000
  );
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return response.json();
}

export async function approveInvoice(
  id: string,
  draftEmail: string
): Promise<Invoice> {
  const response = await fetch(`${API_URL}/invoices/${id}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ draftEmail }),
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return response.json();
}
