import * as fs from 'fs';
import * as path from 'path';
import { parseVaultFile, writeVaultFile, resolveVaultPath } from '../vault';
import { getKey } from '../keys';
import { decryptFromString, encryptToString } from '../crypto';

export interface SnapshotEntry {
  label: string;
  timestamp: string;
  entries: Record<string, string>;
}

export function resolveSnapshotPath(vaultPath: string): string {
  const dir = path.dirname(vaultPath);
  const base = path.basename(vaultPath, path.extname(vaultPath));
  return path.join(dir, `${base}.snapshots.json`);
}

export function loadSnapshots(snapshotPath: string): SnapshotEntry[] {
  if (!fs.existsSync(snapshotPath)) return [];
  try {
    return JSON.parse(fs.readFileSync(snapshotPath, 'utf-8'));
  } catch {
    return [];
  }
}

export function saveSnapshots(snapshotPath: string, snapshots: SnapshotEntry[]): void {
  fs.writeFileSync(snapshotPath, JSON.stringify(snapshots, null, 2), 'utf-8');
}

export async function createSnapshot(
  env: string,
  label: string,
  keystorePath: string,
  vaultDir: string
): Promise<SnapshotEntry> {
  const vaultPath = resolveVaultPath(vaultDir, env);
  const vault = parseVaultFile(vaultPath);
  const masterKey = getKey(keystorePath, env);
  if (!masterKey) throw new Error(`No key found for environment: ${env}`);

  const decrypted: Record<string, string> = {};
  for (const [k, v] of Object.entries(vault.entries)) {
    decrypted[k] = decryptFromString(v, masterKey);
  }

  const snapshot: SnapshotEntry = {
    label,
    timestamp: new Date().toISOString(),
    entries: decrypted,
  };

  const snapshotPath = resolveSnapshotPath(vaultPath);
  const snapshots = loadSnapshots(snapshotPath);
  snapshots.push(snapshot);
  saveSnapshots(snapshotPath, snapshots);

  return snapshot;
}

export async function restoreSnapshot(
  env: string,
  label: string,
  keystorePath: string,
  vaultDir: string
): Promise<void> {
  const vaultPath = resolveVaultPath(vaultDir, env);
  const snapshotPath = resolveSnapshotPath(vaultPath);
  const snapshots = loadSnapshots(snapshotPath);
  const snapshot = snapshots.find((s) => s.label === label);
  if (!snapshot) throw new Error(`Snapshot not found: ${label}`);

  const masterKey = getKey(keystorePath, env);
  if (!masterKey) throw new Error(`No key found for environment: ${env}`);

  const vault = parseVaultFile(vaultPath);
  const encrypted: Record<string, string> = {};
  for (const [k, v] of Object.entries(snapshot.entries)) {
    encrypted[k] = encryptToString(v, masterKey);
  }

  vault.entries = encrypted;
  writeVaultFile(vaultPath, vault);
}

export function listSnapshots(
  env: string,
  vaultDir: string
): SnapshotEntry[] {
  const vaultPath = resolveVaultPath(vaultDir, env);
  const snapshotPath = resolveSnapshotPath(vaultPath);
  return loadSnapshots(snapshotPath);
}
