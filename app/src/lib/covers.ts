import path from "path";

// Cover images are stored on local disk (on the QNAP this folder is a
// shared folder mounted into the container), replacing Vercel Blob.
export const COVERS_DIR = process.env.COVERS_DIR || "/data/covers";

export const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const MAX_COVER_BYTES = 15 * 1024 * 1024; // 15 MB

// Stored file names are always "<uuid>.<ext>" — anything else is rejected,
// so a request can never reach files outside the covers folder.
const SAFE_NAME = /^[0-9a-f-]{36}\.(jpg|png|webp)$/;

export function isSafeCoverName(name: string): boolean {
  return SAFE_NAME.test(name);
}

export function coverPath(name: string): string {
  return path.join(COVERS_DIR, name);
}

export function coverUrl(name: string): string {
  return `/covers/${name}`;
}

// "/covers/<name>" -> "<name>", or null if it isn't one of our covers.
export function coverNameFromUrl(url: string): string | null {
  const m = /^\/covers\/([^/]+)$/.exec(url || "");
  return m && isSafeCoverName(m[1]) ? m[1] : null;
}

export const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};
