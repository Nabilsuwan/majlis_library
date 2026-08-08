import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET() {
  try {
    const result = await pool.query("SELECT count(*) FROM books");
    return NextResponse.json({
      status: "ok",
      books_in_catalog: Number(result.rows[0].count),
    });
  } catch (err) {
    return NextResponse.json(
      { status: "error", message: (err as Error).message },
      { status: 500 }
    );
  }
}
