import { cookies } from "next/headers";
import { verifySessionToken, type SessionPayload } from "@/lib/auth";

// For API routes: /api/* is not covered by the /staff middleware, so each
// staff-only route must check the session itself.
export async function getStaffSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("majlis_session")?.value;
  return token ? await verifySessionToken(token) : null;
}
