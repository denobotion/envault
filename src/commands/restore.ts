import * as fs from 'fs';
import * as path from 'path';
import { resolveVaultPath, parseVaultFile, writeVaultFile } from '../vault';
import { loadSnapshots, resolveSnapshotPath } from './snapshot';
import { decryptFromString } from '../crypto';
import { getKey } from '../keys';

export interface RestoreOptions {
  vaultPath?: string;
  snapshotDir?: string;
  keystorePath?: string;
}

export async function restoreSnapshot(
  environment: string,
  snapshotId: string,
  options: RestoreOptions = {}
): Promise<{ restoredKeys: number; snapshotTimestamp: string }> {
  const vaultFile = resolveVaultPath(options.vaultPath);
  const snapshotFile = resolveSnapshotPath(options.snapshotDir);

  if (!fs.existsSync(snapshotFile)) {
    throw new Error(`No snapshot file found at ${snapshotFile}`);
  }

  const snapshots = loadSnapshots(snapshotFile);
  const envSnapshots = snapshots[environment];

  if (!envSnapshots || envSnapshots.length === 0) {
    throw new Error(`No snapshots found for environment "${environment}"`);
  }

  const snapshot = envSnapshots.find((s: any) => s.id === snapshotId);
  if (!snapshot) {
    throw new Error(`Snapshot "${snapshotId}" not found for environment "${environment}"`);
  }

  const masterKey = await getKey(environment, options.keystorePath);
  if (!masterKey) {
    throw new Error(`No key found for environment "${environment}"`);
  }

  const vault = fs.existsSync(vaultFile) ? parseVaultFile(vaultFile) : {};

  if (!vault[environment]) {
    vault[environment] = { encrypted: {} };
  }

  const restoredEncrypted: Record<string, string> = {};
  for (const [key, encryptedValue] of Object.entries(snapshot.data as Record<string, string>)) {
    // Verify decryptability before restoring
    await decryptFromString(encryptedValue, masterKey);
    restoredEncrypted[key] = encryptedValue;
  }

  vault[environment].encrypted = restoredEncrypted;
  writeVaultFile(vaultFile, vault);

  return {
    restoredKeys: Object.keys(restoredEncrypted).length,
    snapshotTimestamp: snapshot.timestamp,
  };
}
