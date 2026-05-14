import * as fs from 'fs';
import * as path from 'path';
import { resolveVaultPath, parseVaultFile } from '../vault';

export interface HistoryEntry {
  timestamp: string;
  action: string;
  environment: string;
  keyCount: number;
  tags: string[];
}

export function resolveHistoryPath(vaultPath: string): string {
  return path.join(path.dirname(vaultPath), '.envault-history.json');
}

export function loadHistory(vaultPath: string): HistoryEntry[] {
  const historyPath = resolveHistoryPath(vaultPath);
  if (!fs.existsSync(historyPath)) return [];
  try {
    const raw = fs.readFileSync(historyPath, 'utf-8');
    return JSON.parse(raw) as HistoryEntry[];
  } catch {
    return [];
  }
}

export function saveHistory(vaultPath: string, entries: HistoryEntry[]): void {
  const historyPath = resolveHistoryPath(vaultPath);
  fs.writeFileSync(historyPath, JSON.stringify(entries, null, 2), 'utf-8');
}

export function recordHistory(
  vaultPath: string,
  action: string,
  environment: string,
  masterKey: string
): void {
  const vault = parseVaultFile(vaultPath);
  const envEntry = vault.environments[environment];
  const keyCount = envEntry ? Object.keys(envEntry.secrets ?? {}).length : 0;
  const tags: string[] = envEntry?.tags ?? [];

  const entries = loadHistory(vaultPath);
  entries.push({
    timestamp: new Date().toISOString(),
    action,
    environment,
    keyCount,
    tags,
  });
  saveHistory(vaultPath, entries);
}

export function listHistory(
  vaultDir: string,
  environment?: string,
  limit = 20
): HistoryEntry[] {
  const vaultPath = resolveVaultPath(vaultDir);
  const entries = loadHistory(vaultPath);
  const filtered = environment
    ? entries.filter((e) => e.environment === environment)
    : entries;
  return filtered.slice(-limit).reverse();
}
