import { readFile } from "fs/promises";
import { CONTENT_TYPES, coverPath, isSafeCoverName } from "@/lib/covers";

// Public: serves cover images from the covers folder (book pages show them).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  if (!isSafeCoverName(name)) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const data = await readFile(coverPath(name));
    const ext = name.split(".").pop() as string;
    return new Response(new Uint8Array(data), {
      headers: {
        "content-type": CONTENT_TYPES[ext] || "application/octet-stream",
        // File names are random and never reused, so they can be cached forever.
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
