import { loadKeyStore } from '../keys/keystore';
import { parseVaultFile, writeVaultFile, resolveVaultPath } from '../vault/vault';

export type VaultPermission = 'read' | 'write' | 'admin';

export interface ChmodEntry {
  env: string;
  permission: VaultPermission;
  updatedAt: string;
}

export interface ChmodOptions {
  keystorePath?: string;
  vaultPath?: string;
}

const VALID_PERMISSIONS: VaultPermission[] = ['read', 'write', 'admin'];

export function isValidPermission(perm: string): perm is VaultPermission {
  return VALID_PERMISSIONS.includes(perm as VaultPermission);
}

export async function setPermission(
  env: string,
  permission: VaultPermission,
  options: ChmodOptions = {}
): Promise<ChmodEntry> {
  const vaultPath = resolveVaultPath(options.vaultPath);
  const vault = parseVaultFile(vaultPath);

  if (!vault.entries[env]) {
    throw new Error(`Environment "${env}" not found in vault`);
  }

  if (!isValidPermission(permission)) {
    throw new Error(`Invalid permission "${permission}". Must be one of: ${VALID_PERMISSIONS.join(', ')}`);
  }

  if (!vault.permissions) {
    vault.permissions = {};
  }

  const entry: ChmodEntry = {
    env,
    permission,
    updatedAt: new Date().toISOString(),
  };

  vault.permissions[env] = entry;
  writeVaultFile(vaultPath, vault);

  return entry;
}

export async function getPermission(
  env: string,
  options: ChmodOptions = {}
): Promise<ChmodEntry | null> {
  const vaultPath = resolveVaultPath(options.vaultPath);
  const vault = parseVaultFile(vaultPath);

  if (!vault.permissions || !vault.permissions[env]) {
    return null;
  }

  return vault.permissions[env] as ChmodEntry;
}

export async function listPermissions(
  options: ChmodOptions = {}
): Promise<ChmodEntry[]> {
  const vaultPath = resolveVaultPath(options.vaultPath);
  const vault = parseVaultFile(vaultPath);

  if (!vault.permissions) {
    return [];
  }

  return Object.values(vault.permissions) as ChmodEntry[];
}
