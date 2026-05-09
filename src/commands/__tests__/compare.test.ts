import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { compareEnvs } from '../compare';
import { writeVaultFile } from '../../vault';
import { generateMasterKey } from '../../keys/masterkey';
import { encryptToString } from '../../crypto';
import { addKey } from '../../keys/keystore';

const SALT = 'testsalt1234567890123456789012';

async function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'envault-compare-'));
}

async function setupVault(tmpDir: string, masterKey: string) {
  const vaultPath = path.join(tmpDir, 'vault.json');
  const keyId = 'key-001';

  await addKey(masterKey, keyId, tmpDir);
  const envKey = await import('../../keys').then(m => m.getKey(masterKey, keyId, tmpDir));

  const sourcePlain = 'API_URL=https://dev.example.com\nDEBUG=true\nSHARED=same';
  const targetPlain = 'API_URL=https://prod.example.com\nSECRET=topsecret\nSHARED=same';

  const sourceCipher = await encryptToString(sourcePlain, envKey);
  const targetCipher = await encryptToString(targetPlain, envKey);

  writeVaultFile(vaultPath, {
    version: 1,
    envs: {
      dev: { keyId, ciphertext: sourceCipher, updatedAt: new Date().toISOString() },
      prod: { keyId, ciphertext: targetCipher, updatedAt: new Date().toISOString() },
    },
  });

  return vaultPath;
}

describe('compareEnvs', () => {
  let tmpDir: string;
  let masterKey: string;
  let vaultPath: string;

  beforeAll(async () => {
    tmpDir = await makeTmpDir();
    masterKey = generateMasterKey();
    vaultPath = await setupVault(tmpDir, masterKey);
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns correct source and target labels', async () => {
    const result = await compareEnvs('dev', 'prod', masterKey, vaultPath);
    expect(result.source).toBe('dev');
    expect(result.target).toBe('prod');
  });

  it('identifies keys only in source', async () => {
    const result = await compareEnvs('dev', 'prod', masterKey, vaultPath);
    const entry = result.entries.find(e => e.key === 'DEBUG');
    expect(entry?.status).toBe('only_in_source');
    expect(entry?.sourceValue).toBe('true');
  });

  it('identifies keys only in target', async () => {
    const result = await compareEnvs('dev', 'prod', masterKey, vaultPath);
    const entry = result.entries.find(e => e.key === 'SECRET');
    expect(entry?.status).toBe('only_in_target');
    expect(entry?.targetValue).toBe('topsecret');
  });

  it('identifies keys that differ between envs', async () => {
    const result = await compareEnvs('dev', 'prod', masterKey, vaultPath);
    const entry = result.entries.find(e => e.key === 'API_URL');
    expect(entry?.status).toBe('different');
  });

  it('identifies keys that are the same in both envs', async () => {
    const result = await compareEnvs('dev', 'prod', masterKey, vaultPath);
    const entry = result.entries.find(e => e.key === 'SHARED');
    expect(entry?.status).toBe('same');
  });

  it('throws when source env does not exist', async () => {
    await expect(compareEnvs('missing', 'prod', masterKey, vaultPath)).rejects.toThrow(
      'Environment "missing" not found'
    );
  });

  it('throws when target env does not exist', async () => {
    await expect(compareEnvs('dev', 'missing', masterKey, vaultPath)).rejects.toThrow(
      'Environment "missing" not found'
    );
  });
});
