import { pool } from "@/lib/db";
import { NextResponse } from "next/server";
import { parseCopyCode } from "@/lib/copies";

// Staff "go to book #": /staff/find?n=123 or 123-2 opens that book's edit page.
export async function GET(request: Request) {
  const n = new URL(request.url).searchParams.get("n") || "";
  const parsed = parseCopyCode(n);
  let location = "/staff/books?notfound=1";
  if (parsed) {
    const { rows } = await pool.query("SELECT id FROM books WHERE library = $1 AND book_number = $2", [parsed.library, parsed.bookNumber]);
    if (rows[0]) location = `/staff/books/${rows[0].id}/edit#copies`;
  }
  return new NextResponse(null, { status: 303, headers: { Location: location } });
}
