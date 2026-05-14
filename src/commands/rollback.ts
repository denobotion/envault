import * as fs from 'fs';
import * as path from 'path';
import { resolveVaultPath, parseVaultFile, writeVaultFile } from '../vault';
import { loadHistory, recordHistory } from './history';
import { getKey } from '../keys';
import { decryptFromString, encryptToString } from '../crypto';

export interface RollbackOptions {
  vaultPath?: string;
  keystorePath?: string;
  env: string;
  steps?: number;
}

export interface RollbackResult {
  env: string;
  restoredAt: string;
  previousValue: string;
  keyCount: number;
}

export async function rollback(
  masterKey: string,
  options: RollbackOptions
): Promise<RollbackResult> {
  const vaultFile = resolveVaultPath(options.vaultPath);
  const vault = parseVaultFile(vaultFile);

  if (!vault[options.env]) {
    throw new Error(`Environment "${options.env}" not found in vault.`);
  }

  const history = loadHistory(options.vaultPath);
  const envHistory = history.filter((h) => h.env === options.env);

  if (envHistory.length < 2) {
    throw new Error(`No previous version found for environment "${options.env}".`);
  }

  const steps = options.steps ?? 1;
  const targetIndex = envHistory.length - 1 - steps;

  if (targetIndex < 0) {
    throw new Error(
      `Cannot roll back ${steps} step(s); only ${envHistory.length - 1} prior version(s) available.`
    );
  }

  const targetEntry = envHistory[targetIndex];
  const keyName = vault[options.env].key;
  const derivedKey = await getKey(keyName, options.keystorePath);
  const activeKey = derivedKey ?? masterKey;

  const decrypted = await decryptFromString(targetEntry.snapshot, activeKey);
  const reEncrypted = await encryptToString(decrypted, masterKey);

  vault[options.env].data = reEncrypted;
  vault[options.env].updatedAt = new Date().toISOString();
  writeVaultFile(vaultFile, vault);

  recordHistory(options.env, reEncrypted, options.vaultPath);

  const lines = decrypted.split('\n').filter((l) => l.trim() && !l.startsWith('#'));

  return {
    env: options.env,
    restoredAt: vault[options.env].updatedAt,
    previousValue: targetEntry.snapshot.slice(0, 12) + '...',
    keyCount: lines.length,
  };
}
