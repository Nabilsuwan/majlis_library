import { pool } from "@/lib/db";
import { headers } from "next/headers";

export type Library = "majlis" | "sheikh";

export const LIBRARY_NAMES: Record<Library, string> = {
  majlis: "مكتبة المجلس",
  sheikh: "مكتبة الشيخ",
};

// Book ID: Majlis "123", Sheikh "S-12". Copy code adds the copy: "123-2", "S-12-2".
export function bookCode(bookNumber: number, library: string = "majlis"): string {
  return library === "sheikh" ? `S-${bookNumber}` : `${bookNumber}`;
}

export function copyCode(bookNumber: number, copyNumber: number, library: string = "majlis"): string {
  return `${bookCode(bookNumber, library)}-${copyNumber}`;
}

export function parseCopyCode(
  code: string
): { library: Library; bookNumber: number; copyNumber: number | null } | null {
  const m = /^(S-?)?(\d{1,7})(?:-(\d{1,4}))?$/i.exec((code || "").trim());
  if (!m) return null;
  return {
    library: m[1] ? "sheikh" : "majlis",
    bookNumber: Number(m[2]),
    copyNumber: m[3] ? Number(m[3]) : null,
  };
}

export const BOOK_CODE_PATTERN = /^\s*(S-?)?\d{1,7}(-\d{1,4})?\s*$/i;

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
