import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { validateEnv, validateAllEnvs } from '../validate';
import { writeVaultFile, resolveVaultPath } from '../../vault';
import { encryptToString } from '../../crypto';

const MASTER_KEY = 'test-master-key-1234567890abcdef';

async function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'envault-validate-'));
}

async function setupVault(vaultPath: string) {
  const val1 = await encryptToString('hello', MASTER_KEY);
  const val2 = await encryptToString('world', MASTER_KEY);
  writeVaultFile(vaultPath, {
    version: 1,
    envs: {
      production: {
        values: { API_KEY: val1, DB_PASS: val2 },
        tags: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    },
  });
}

describe('validateEnv', () => {
  let tmpDir: string;
  let vaultPath: string;

  beforeEach(async () => {
    tmpDir = await makeTmpDir();
    vaultPath = path.join(tmpDir, 'vault.json');
    await setupVault(vaultPath);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns valid results for all keys when master key is correct', async () => {
    const results = await validateEnv('production', MASTER_KEY, { vaultPath });
    expect(results).toHaveLength(2);
    results.forEach((r) => expect(r.valid).toBe(true));
  });

  it('returns invalid results when master key is wrong', async () => {
    const results = await validateEnv('production', 'wrong-key-xxxxxxxxxxxx', { vaultPath });
    expect(results.some((r) => !r.valid)).toBe(true);
  });

  it('throws when env does not exist', async () => {
    await expect(
      validateEnv('staging', MASTER_KEY, { vaultPath })
    ).rejects.toThrow('Environment "staging" not found');
  });

  it('includes env and key in each result', async () => {
    const results = await validateEnv('production', MASTER_KEY, { vaultPath });
    results.forEach((r) => {
      expect(r.env).toBe('production');
      expect(typeof r.key).toBe('string');
    });
  });
});

describe('validateAllEnvs', () => {
  let tmpDir: string;
  let vaultPath: string;

  beforeEach(async () => {
    tmpDir = await makeTmpDir();
    vaultPath = path.join(tmpDir, 'vault.json');
    await setupVault(vaultPath);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns a report for all envs', async () => {
    const report = await validateAllEnvs(MASTER_KEY, { vaultPath });
    expect(Object.keys(report)).toContain('production');
    expect(report['production'].every((r) => r.valid)).toBe(true);
  });
});
