import * as fs from 'fs';
import * as path from 'path';
import { resolveVaultPath, parseVaultFile, writeVaultFile } from '../vault';

export interface PinEntry {
  env: string;
  key: string;
  pinnedAt: string;
}

export function resolvePinPath(vaultDir: string): string {
  return path.join(vaultDir, '.pins.json');
}

export function loadPins(vaultDir: string): PinEntry[] {
  const pinPath = resolvePinPath(vaultDir);
  if (!fs.existsSync(pinPath)) return [];
  try {
    return JSON.parse(fs.readFileSync(pinPath, 'utf-8'));
  } catch {
    return [];
  }
}

export function savePins(vaultDir: string, pins: PinEntry[]): void {
  const pinPath = resolvePinPath(vaultDir);
  fs.writeFileSync(pinPath, JSON.stringify(pins, null, 2), 'utf-8');
}

export async function pinKey(
  vaultDir: string,
  env: string,
  key: string,
  masterKey: string
): Promise<void> {
  const vaultPath = resolveVaultPath(vaultDir, env);
  const vault = parseVaultFile(vaultPath);
  if (!vault.entries[key]) {
    throw new Error(`Key "${key}" not found in environment "${env}"`);
  }
  const pins = loadPins(vaultDir);
  const existing = pins.find((p) => p.env === env && p.key === key);
  if (existing) {
    throw new Error(`Key "${key}" in "${env}" is already pinned`);
  }
  pins.push({ env, key, pinnedAt: new Date().toISOString() });
  savePins(vaultDir, pins);
}

export async function unpinKey(
  vaultDir: string,
  env: string,
  key: string
): Promise<void> {
  const pins = loadPins(vaultDir);
  const index = pins.findIndex((p) => p.env === env && p.key === key);
  if (index === -1) {
    throw new Error(`Key "${key}" in "${env}" is not pinned`);
  }
  pins.splice(index, 1);
  savePins(vaultDir, pins);
}

export function listPins(vaultDir: string): PinEntry[] {
  return loadPins(vaultDir);
}

export function isPinned(vaultDir: string, env: string, key: string): boolean {
  const pins = loadPins(vaultDir);
  return pins.some((p) => p.env === env && p.key === key);
}
