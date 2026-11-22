import { pool } from "@/lib/db";
import { headers } from "next/headers";

// Book ID "123" = the title; copy code "123-2" = its second physical copy.
export function parseCopyCode(code: string): { bookNumber: number; copyNumber: number | null } | null {
  const m = /^(\d{1,7})(?:-(\d{1,4}))?$/.exec((code || "").trim());
  if (!m) return null;
  return { bookNumber: Number(m[1]), copyNumber: m[2] ? Number(m[2]) : null };
}

export function copyCode(bookNumber: number, copyNumber: number): string {
  return `${bookNumber}-${copyNumber}`;
}

// Shelf box code, e.g. "C12": level letter counted from the bottom (A-F),
// box number counted from the right, continuous around the room.
const LEVEL_NAMES: Record<string, string> = {
  A: "الأول من الأسفل",
  B: "الثاني من الأسفل",
  C: "الثالث من الأسفل",
  D: "الرابع من الأسفل",
  E: "الخامس من الأسفل",
  F: "السادس من الأسفل",
};

export function describeShelf(code: string, wall?: number | null): string {
  const m = /^([A-F])(\d+)$/.exec(code || "");
  if (!m) return code;
  const wallText = wall ? `الجدار ${wall} · ` : "";
  return `${wallText}المستوى ${m[1]} (${LEVEL_NAMES[m[1]]}) · الخانة ${m[2]} من اليمين`;
}

export type ShelfOption = { code: string; wall: number; level: string; box_no: number };

export async function getShelfOptions(): Promise<ShelfOption[]> {
  const { rows } = await pool.query(
    `SELECT code, wall, level, box_no FROM shelf_boxes
     WHERE is_active ORDER BY wall, level, box_no`
  );
  return rows;
}

// NFC tag serials arrive as "04:4c:a2:72:d9:2a:81" (Web NFC) or
// "04:4C:A2:72:D9:2A:81" (NFC Tools); store them one way.
export function normalizeTagUid(raw: string): string | null {
  const hex = (raw || "").replace(/[^0-9a-fA-F]/g, "").toUpperCase();
  if (hex.length < 8 || hex.length > 20 || hex.length % 2) return null;
  return hex.match(/.{2}/g)!.join(":");
}

// The address written into tags. PUBLIC_BASE_URL fixes it (e.g. the
// Tailscale name); otherwise it is the address the page was opened at.
export async function siteBaseUrl(): Promise<string> {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || "http";
  return `${proto}://${host}`;
}
