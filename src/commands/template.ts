import * as fs from 'fs';
import * as path from 'path';
import { parseVaultFile, writeVaultFile, resolveVaultPath } from '../vault';
import { decryptFromString } from '../crypto';
import { getKey } from '../keys';

export interface TemplateResult {
  output: string;
  missing: string[];
}

/**
 * Renders a template string by substituting {{ KEY }} placeholders
 * with decrypted values from the specified vault environment.
 */
export async function renderTemplate(
  templateContent: string,
  env: string,
  masterKey: string,
  vaultPath?: string
): Promise<TemplateResult> {
  const resolvedPath = resolveVaultPath(vaultPath);
  const vault = parseVaultFile(resolvedPath);

  if (!vault.environments[env]) {
    throw new Error(`Environment "${env}" not found in vault.`);
  }

  const encryptedEntries = vault.environments[env];
  const decrypted: Record<string, string> = {};

  for (const [key, encryptedValue] of Object.entries(encryptedEntries)) {
    decrypted[key] = await decryptFromString(encryptedValue, masterKey);
  }

  const missing: string[] = [];
  const placeholder = /\{\{\s*([A-Z0-9_]+)\s*\}\}/g;

  const output = templateContent.replace(placeholder, (_, key) => {
    if (key in decrypted) {
      return decrypted[key];
    }
    missing.push(key);
    return `{{${key}}}`;
  });

  return { output, missing };
}

/**
 * Renders a template file and writes the result to an output path.
 */
export async function renderTemplateFile(
  templatePath: string,
  outputPath: string,
  env: string,
  masterKey: string,
  vaultPath?: string
): Promise<TemplateResult> {
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template file not found: ${templatePath}`);
  }

  const templateContent = fs.readFileSync(templatePath, 'utf-8');
  const result = await renderTemplate(templateContent, env, masterKey, vaultPath);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, result.output, 'utf-8');

  return result;
}
