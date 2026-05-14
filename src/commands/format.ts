import { parseVaultFile, writeVaultFile, resolveVaultPath } from '../vault';
import { decryptFromString } from '../crypto';
import { getKey } from '../keys';

export interface FormatOptions {
  vaultPath?: string;
  keystorePath?: string;
  sort?: boolean;
  stripBlanks?: boolean;
}

export interface FormatResult {
  environment: string;
  keysReordered: number;
  blankLinesRemoved: number;
}

export async function formatVault(
  environment: string,
  options: FormatOptions = {}
): Promise<FormatResult> {
  const vaultPath = resolveVaultPath(options.vaultPath);
  const vault = parseVaultFile(vaultPath);

  if (!vault.environments[environment]) {
    throw new Error(`Environment "${environment}" not found in vault.`);
  }

  const entry = vault.environments[environment];
  const masterKey = await getKey(environment, options.keystorePath);
  const plaintext = await decryptFromString(entry.ciphertext, masterKey);

  const lines = plaintext.split('\n');
  const kvLines: string[] = [];
  const commentLines: string[] = [];
  let blankLinesRemoved = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '') {
      if (options.stripBlanks) {
        blankLinesRemoved++;
      } else {
        kvLines.push(line);
      }
    } else if (trimmed.startsWith('#')) {
      commentLines.push(line);
    } else {
      kvLines.push(line);
    }
  }

  let finalLines = options.sort
    ? [...commentLines, ...kvLines.filter(l => l.trim()).sort()]
    : lines.filter(l => !options.stripBlanks || l.trim() !== '');

  const keysReordered = options.sort ? kvLines.filter(l => l.trim() && !l.trim().startsWith('#')).length : 0;

  const formatted = finalLines.join('\n').trimEnd() + '\n';

  const { encryptToString } = await import('../crypto');
  const newCiphertext = await encryptToString(formatted, masterKey);

  vault.environments[environment] = {
    ...entry,
    ciphertext: newCiphertext,
    updatedAt: new Date().toISOString(),
  };

  writeVaultFile(vaultPath, vault);

  return { environment, keysReordered, blankLinesRemoved };
}
