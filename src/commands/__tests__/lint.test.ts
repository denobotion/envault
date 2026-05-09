import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { lintVault } from '../lint';
import { encryptToString } from '../../crypto';
import { writeVaultFile } from '../../vault';

const MASTER_KEY = 'test-master-key-1234567890abcdef';

async function makeTmpDir(): Promise<string> {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'envault-lint-'));
}

async function buildVaultEntries(
  pairs: Record<string, string>,
  key: string
): Promise<Record<string, string>> {
  const entries: Record<string, string> = {};
  for (const [k, v] of Object.entries(pairs)) {
    const encKey = await encryptToString(k, key);
    const encVal = await encryptToString(v, key);
    entries[encKey] = encVal;
  }
  return entries;
}

describe('lintVault', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'envault-lint-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('passes a clean vault with no issues', async () => {
    const entries = await buildVaultEntries({ DATABASE_URL: 'postgres://localhost/db' }, MASTER_KEY);
    writeVaultFile('production', { version: 1, entries }, tmpDir);

    const result = await lintVault('production', MASTER_KEY, tmpDir);
    expect(result.passed).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('flags empty values as warnings', async () => {
    const entries = await buildVaultEntries({ API_KEY: '' }, MASTER_KEY);
    writeVaultFile('staging', { version: 1, entries }, tmpDir);

    const result = await lintVault('staging', MASTER_KEY, tmpDir);
    const issue = result.issues.find((i) => i.message.includes('empty'));
    expect(issue).toBeDefined();
    expect(issue?.severity).toBe('warning');
  });

  it('flags keys that do not follow SCREAMING_SNAKE_CASE', async () => {
    const entries = await buildVaultEntries({ myApiKey: 'somevalue' }, MASTER_KEY);
    writeVaultFile('dev', { version: 1, entries }, tmpDir);

    const result = await lintVault('dev', MASTER_KEY, tmpDir);
    const issue = result.issues.find((i) => i.message.includes('SCREAMING_SNAKE_CASE'));
    expect(issue).toBeDefined();
  });

  it('flags placeholder values', async () => {
    const entries = await buildVaultEntries({ SECRET_TOKEN: 'changeme' }, MASTER_KEY);
    writeVaultFile('test', { version: 1, entries }, tmpDir);

    const result = await lintVault('test', MASTER_KEY, tmpDir);
    const issue = result.issues.find((i) => i.message.includes('placeholder'));
    expect(issue).toBeDefined();
    expect(issue?.severity).toBe('warning');
  });

  it('still passes (no errors) when only warnings exist', async () => {
    const entries = await buildVaultEntries({ bad_key: '' }, MASTER_KEY);
    writeVaultFile('qa', { version: 1, entries }, tmpDir);

    const result = await lintVault('qa', MASTER_KEY, tmpDir);
    expect(result.passed).toBe(true);
    expect(result.issues.length).toBeGreaterThan(0);
  });
});
