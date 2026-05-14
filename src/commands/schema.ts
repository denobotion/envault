import * as fs from 'fs';
import * as path from 'path';
import { parseVaultFile, resolveVaultPath } from '../vault';
import { getKey } from '../keys';
import { decryptFromString } from '../crypto';

export interface SchemaField {
  key: string;
  required: boolean;
  description?: string;
  example?: string;
}

export interface EnvSchema {
  fields: SchemaField[];
  generatedAt: string;
  environment: string;
}

export async function generateSchema(
  environment: string,
  keystorePath: string,
  vaultPath?: string
): Promise<EnvSchema> {
  const resolvedVault = resolveVaultPath(vaultPath);
  const vault = parseVaultFile(resolvedVault);

  const entry = vault.environments[environment];
  if (!entry) {
    throw new Error(`Environment "${environment}" not found in vault.`);
  }

  const masterKey = await getKey(keystorePath, environment);
  if (!masterKey) {
    throw new Error(`No key found for environment "${environment}".`);
  }

  const decrypted = await decryptFromString(entry.encrypted, masterKey);
  const lines = decrypted.split('\n').filter(Boolean);

  const fields: SchemaField[] = lines
    .filter((line) => !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const eqIndex = line.indexOf('=');
      const key = line.slice(0, eqIndex).trim();
      return { key, required: true };
    });

  return {
    fields,
    generatedAt: new Date().toISOString(),
    environment,
  };
}

export async function validateAgainstSchema(
  schema: EnvSchema,
  dotenvContent: string
): Promise<{ missing: string[]; extra: string[] }> {
  const presentKeys = new Set(
    dotenvContent
      .split('\n')
      .filter((l) => !l.startsWith('#') && l.includes('='))
      .map((l) => l.slice(0, l.indexOf('=')).trim())
  );

  const schemaKeys = new Set(schema.fields.filter((f) => f.required).map((f) => f.key));

  const missing = [...schemaKeys].filter((k) => !presentKeys.has(k));
  const extra = [...presentKeys].filter((k) => !schemaKeys.has(k));

  return { missing, extra };
}
