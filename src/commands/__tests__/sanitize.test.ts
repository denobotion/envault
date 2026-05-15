import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { sanitizeVault } from '../sanitize';
import { writeVaultFile, resolveVaultPath } from '../../vault';
import { encryptToString } from '../../crypto';
import { saveKeyStore } from '../../keys';

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'envault-sanitize-'));
}

function makeEncEntry(key: string, value: string, masterKey: string): [string, string] {
  return [encryptToString(key, masterKey), encryptToString(value, masterKey)];
}

describe('sanitizeVault', () => {
  let tmpDir: string;
  let keystorePath: string;
  const env = 'test';
  const masterKey = 'a'.repeat(64);

  beforeEach(() => {
    tmpDir = makeTmpDir();
    keystorePath = path.join(tmpDir, 'keystore.json');
    saveKeyStore(keystorePath, { [env]: masterKey });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function setupVault(entries: Record<string, string>) {
    const encEntries: Record<string, string> = {};
    for (const [k, v] of Object.entries(entries)) {
      const [ek, ev] = makeEncEntry(k, v, masterKey);
      encEntries[ek] = ev;
    }
    const vaultPath = resolveVaultPath(tmpDir, env);
    writeVaultFile(vaultPath, { version: 1, environment: env, entries: encEntries });
  }

  it('removes placeholder values', async () => {
    setupVault({ DB_HOST: 'localhost', API_KEY: 'REPLACE_ME' });
    const result = await sanitizeVault(env, keystorePath, tmpDir, false);
    expect(result.removed).toContain('API_KEY');
    expect(result.removed).not.toContain('DB_HOST');
  });

  it('flags sensitive keys with short values', async () => {
    setupVault({ SECRET_KEY: 'abc', DB_PASSWORD: 'short' });
    const result = await sanitizeVault(env, keystorePath, tmpDir, true);
    expect(result.updated.length).toBeGreaterThan(0);
  });

  it('dry run does not modify vault file', async () => {
    setupVault({ TOKEN: 'TODO', DB_URL: 'postgres://localhost' });
    const vaultPath = resolveVaultPath(tmpDir, env);
    const before = fs.readFileSync(vaultPath, 'utf-8');
    await sanitizeVault(env, keystorePath, tmpDir, true);
    const after = fs.readFileSync(vaultPath, 'utf-8');
    expect(before).toBe(after);
  });

  it('returns correct totals', async () => {
    setupVault({ A: 'value1', B: 'CHANGEME', C: 'value3' });
    const result = await sanitizeVault(env, keystorePath, tmpDir, false);
    expect(result.total).toBe(3);
    expect(result.removed).toHaveLength(1);
  });

  it('throws if no key found for environment', async () => {
    setupVault({ X: 'y' });
    await expect(sanitizeVault('nonexistent', keystorePath, tmpDir)).rejects.toThrow(
      'No key found for environment: nonexistent'
    );
  });
});
