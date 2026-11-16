// Downloads every cover still stored on Vercel Blob into the NAS covers
// folder and points the database at the local copy.
// Run AFTER migrate-db.sh, while Vercel Blob still exists:
//
//   docker compose exec app node scripts/migrate-covers.mjs
//
// Safe to re-run: covers already moved are skipped.
import pg from "pg";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

const COVERS_DIR = process.env.COVERS_DIR || "/data/covers";
const EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
await mkdir(COVERS_DIR, { recursive: true });

const moved = new Map(); // old URL -> new URL (same image may be in both tables)
let ok = 0, failed = 0;

async function localCopy(url) {
  if (moved.has(url)) return moved.get(url);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const type = (res.headers.get("content-type") || "").split(";")[0];
  const ext = EXT[type] || "jpg";
  const name = `${randomUUID()}.${ext}`;
  await writeFile(path.join(COVERS_DIR, name), Buffer.from(await res.arrayBuffer()));
  const newUrl = `/covers/${name}`;
  moved.set(url, newUrl);
  return newUrl;
}

for (const table of ["books", "intake_submissions"]) {
  const { rows } = await pool.query(
    `SELECT id, cover_image_url FROM ${table} WHERE cover_image_url LIKE 'http%'`
  );
  console.log(`${table}: ${rows.length} cover(s) to move`);
  for (const row of rows) {
    try {
      const newUrl = await localCopy(row.cover_image_url);
      await pool.query(`UPDATE ${table} SET cover_image_url = $1 WHERE id = $2`, [
        newUrl,
        row.id,
      ]);
      ok++;
    } catch (err) {
      failed++;
      console.log(`  FAILED ${table} ${row.id}: ${row.cover_image_url} (${err.message})`);
    }
  }
}

console.log(`Done: ${ok} moved, ${failed} failed.`);
await pool.end();
process.exit(failed ? 1 : 0);
