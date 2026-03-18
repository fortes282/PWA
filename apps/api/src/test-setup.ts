import { rawSqlite, applyRuntimeMigrations } from "./db/index.js";

// Patch rawSqlite.exec to auto-apply column migrations after CREATE TABLE.
// Re-entrancy guard prevents infinite recursion (applyRuntimeMigrations also
// calls exec for CREATE TABLE statements).
const _orig = rawSqlite.exec.bind(rawSqlite);
let _inMigration = false;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(rawSqlite as any).exec = (sql: string) => {
  const result = _orig(sql);
  if (!_inMigration && /CREATE\s+TABLE/i.test(sql)) {
    _inMigration = true;
    try {
      applyRuntimeMigrations();
    } catch {
      // ignore
    } finally {
      _inMigration = false;
    }
  }
  return result;
};
