import { parseVaultFile, resolveVaultPath } from '../vault';
import { decryptFromString } from '../crypto';
import { getKey } from '../keys';

export interface LintIssue {
  key: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface LintResult {
  environment: string;
  issues: LintIssue[];
  passed: boolean;
}

const SUSPICIOUS_PATTERNS: Array<{ pattern: RegExp; message: string }> = [
  { pattern: /^(todo|fixme|changeme|replace_?me)$/i, message: 'Value appears to be a placeholder' },
  { pattern: /^(true|false|yes|no|1|0)$/i, message: 'Value is a bare boolean — consider quoting or using a typed config' },
  { pattern: /password|secret|token|key/i, message: 'Key name suggests sensitive data' },
];

const EMPTY_VALUE_RE = /^\s*$/;
const VALID_KEY_RE = /^[A-Z][A-Z0-9_]*$/;

export async function lintVault(
  environment: string,
  masterKey: string,
  vaultDir?: string
): Promise<LintResult> {
  const vaultPath = resolveVaultPath(environment, vaultDir);
  const vault = parseVaultFile(vaultPath);

  const keyEntry = await getKey(environment);
  const encKey = keyEntry?.key ?? masterKey;

  const issues: LintIssue[] = [];

  for (const [encKey_, encValue] of Object.entries(vault.entries)) {
    let key: string;
    let value: string;

    try {
      key = await decryptFromString(encKey_, encKey);
      value = await decryptFromString(encValue, encKey);
    } catch {
      issues.push({ key: '(unreadable)', message: 'Failed to decrypt entry — key may be wrong', severity: 'error' });
      continue;
    }

    if (!VALID_KEY_RE.test(key)) {
      issues.push({ key, message: 'Key does not follow SCREAMING_SNAKE_CASE convention', severity: 'warning' });
    }

    if (EMPTY_VALUE_RE.test(value)) {
      issues.push({ key, message: 'Value is empty', severity: 'warning' });
    }

    for (const { pattern, message } of SUSPICIOUS_PATTERNS) {
      if (pattern.test(value) || (pattern.test(key) && EMPTY_VALUE_RE.test(value))) {
        issues.push({ key, message, severity: 'warning' });
        break;
      }
    }
  }

  return {
    environment,
    issues,
    passed: issues.every((i) => i.severity !== 'error'),
  };
}
