import { Pool } from "pg";

// One pool shared across the app. In Next.js dev mode the module can be
// re-evaluated on hot reload, so we stash the pool on `global` to avoid
// opening a new connection pool on every edit.
declare global {
  // eslint-disable-next-line no-var
  var _majlisPool: Pool | undefined;
}

export const pool =
  global._majlisPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
  });

if (process.env.NODE_ENV !== "production") {
  global._majlisPool = pool;
}
