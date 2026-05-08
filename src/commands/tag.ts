import { loadKeyStore, saveKeyStore } from '../keys/keystore';
import { resolveVaultPath, parseVaultFile, writeVaultFile } from '../vault/vault';

export interface TagResult {
  environment: string;
  tags: string[];
}

export async function addTag(
  environment: string,
  tag: string,
  vaultPath?: string
): Promise<TagResult> {
  const resolvedPath = resolveVaultPath(vaultPath);
  const vault = parseVaultFile(resolvedPath);

  if (!vault.environments[environment]) {
    throw new Error(`Environment "${environment}" not found in vault`);
  }

  const meta = vault.environments[environment];
  const existingTags: string[] = meta.tags ?? [];

  if (existingTags.includes(tag)) {
    throw new Error(`Tag "${tag}" already exists on environment "${environment}"`);
  }

  meta.tags = [...existingTags, tag];
  vault.environments[environment] = meta;
  writeVaultFile(resolvedPath, vault);

  return { environment, tags: meta.tags };
}

export async function removeTag(
  environment: string,
  tag: string,
  vaultPath?: string
): Promise<TagResult> {
  const resolvedPath = resolveVaultPath(vaultPath);
  const vault = parseVaultFile(resolvedPath);

  if (!vault.environments[environment]) {
    throw new Error(`Environment "${environment}" not found in vault`);
  }

  const meta = vault.environments[environment];
  const existingTags: string[] = meta.tags ?? [];

  if (!existingTags.includes(tag)) {
    throw new Error(`Tag "${tag}" does not exist on environment "${environment}"`);
  }

  meta.tags = existingTags.filter((t) => t !== tag);
  vault.environments[environment] = meta;
  writeVaultFile(resolvedPath, vault);

  return { environment, tags: meta.tags };
}

export async function listByTag(
  tag: string,
  vaultPath?: string
): Promise<string[]> {
  const resolvedPath = resolveVaultPath(vaultPath);
  const vault = parseVaultFile(resolvedPath);

  return Object.entries(vault.environments)
    .filter(([, meta]) => Array.isArray(meta.tags) && meta.tags.includes(tag))
    .map(([env]) => env);
}
