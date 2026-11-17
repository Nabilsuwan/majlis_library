import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  const cookieStore = await cookies();
  cookieStore.delete("majlis_session");
  // Relative redirect, so it works whatever address the site is opened at
  // (office IP, Tailscale IP, or a name).
  return new NextResponse(null, {
    status: 303,
    headers: { Location: "/staff/login" },
  });
}
