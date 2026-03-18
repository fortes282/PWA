/**
 * SQLite database backup utility.
 * Creates a timestamped copy of the database file and rotates old backups.
 */

import { copyFileSync, existsSync, mkdirSync, readdirSync, unlinkSync, statSync } from "fs";
import { join, basename } from "path";

export interface BackupResult {
  success: boolean;
  path?: string;
  sizeBytes?: number;
  error?: string;
  rotated?: number;
}

const DEFAULT_MAX_BACKUPS = 30; // keep last 30 backups
const BACKUP_PREFIX = "pristav-backup-";

export function backupDatabase(
  dbPath?: string,
  backupDir?: string,
  maxBackups = DEFAULT_MAX_BACKUPS,
): BackupResult {
  const sourcePath = dbPath || process.env.DATABASE_PATH || join(process.cwd(), "data", "pristav.db");

  if (!existsSync(sourcePath)) {
    return { success: false, error: `Database file not found: ${sourcePath}` };
  }

  const targetDir = backupDir || join(sourcePath, "..", "backups");
  mkdirSync(targetDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").replace("T", "_").slice(0, 19);
  const backupName = `${BACKUP_PREFIX}${timestamp}.db`;
  const backupPath = join(targetDir, backupName);

  try {
    copyFileSync(sourcePath, backupPath);
    const stat = statSync(backupPath);

    // Rotate old backups
    const rotated = rotateBackups(targetDir, maxBackups);

    return {
      success: true,
      path: backupPath,
      sizeBytes: stat.size,
      rotated,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function rotateBackups(dir: string, maxBackups: number): number {
  const files = readdirSync(dir)
    .filter((f) => f.startsWith(BACKUP_PREFIX) && f.endsWith(".db"))
    .sort()
    .reverse();

  let removed = 0;
  while (files.length > maxBackups) {
    const oldest = files.pop()!;
    try {
      unlinkSync(join(dir, oldest));
      removed++;
    } catch {
      /* ignore */
    }
  }

  return removed;
}

/**
 * List existing backups.
 */
export function listBackups(dbPath?: string, backupDir?: string) {
  const sourcePath = dbPath || process.env.DATABASE_PATH || join(process.cwd(), "data", "pristav.db");
  const targetDir = backupDir || join(sourcePath, "..", "backups");

  if (!existsSync(targetDir)) return [];

  return readdirSync(targetDir)
    .filter((f) => f.startsWith(BACKUP_PREFIX) && f.endsWith(".db"))
    .sort()
    .reverse()
    .map((f) => {
      const stat = statSync(join(targetDir, f));
      return {
        name: f,
        path: join(targetDir, f),
        sizeBytes: stat.size,
        sizeMB: parseFloat((stat.size / (1024 * 1024)).toFixed(2)),
        created: stat.mtime.toISOString(),
      };
    });
}
