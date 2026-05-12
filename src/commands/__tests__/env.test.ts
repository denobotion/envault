import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { exportEnvVars } from '../env';
import { writeVaultFile } from '../../vault';
import { encryptToString } from '../../crypto';
import { addKey } from '../../keys';

async function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'envault-env-test-'));
}

async function setupVault(tmpDir: string, masterKey: string) {
  const plaintext = 'DB_URL=postgres://localhost/test\nAPI_KEY=secret123\nDEBUG=true';
  const ciphertext = await encryptToString(plaintext, masterKey);
  const vaultPath = path.join(tmpDir, 'vault.env.enc');
  writeVaultFile(vaultPath, {
    version: 1,
    environments: {
      default: { ciphertext, createdAt: new Date().toISOString() },
    },
  });
  return vaultPath;
}

describe('exportEnvVars', () => {
  let tmpDir: string;
  const masterKey = 'a'.repeat(64);
  const keystorePath = '';

  beforeEach(async () => {
    tmpDir = await makeTmpDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('exports bash-style export statements by default', async () => {
    const vaultPath = await setupVault(tmpDir, masterKey);
    const ksPath = path.join(tmpDir, 'keystore.json');
    await addKey('default', masterKey, ksPath);
    const result = await exportEnvVars({ vaultPath, keystorePath: ksPath, shell: 'bash' });
    expect(result.output).toContain('export DB_URL=postgres://localhost/test');
    expect(result.output).toContain('export API_KEY=secret123');
    expect(result.count).toBe(3);
  });

  it('exports fish shell format', async () => {
    const vaultPath = await setupVault(tmpDir, masterKey);
    const ksPath = path.join(tmpDir, 'keystore.json');
    await addKey('default', masterKey, ksPath);
    const result = await exportEnvVars({ vaultPath, keystorePath: ksPath, shell: 'fish' });
    expect(result.output).toContain('set -x DB_URL postgres://localhost/test;');
    expect(result.count).toBe(3);
  });

  it('exports JSON format', async () => {
    const vaultPath = await setupVault(tmpDir, masterKey);
    const ksPath = path.join(tmpDir, 'keystore.json');
    await addKey('default', masterKey, ksPath);
    const result = await exportEnvVars({ vaultPath, keystorePath: ksPath, shell: 'json' });
    const parsed = JSON.parse(result.output);
    expect(parsed.DB_URL).toBe('postgres://localhost/test');
    expect(parsed.API_KEY).toBe('secret123');
  });

  it('filters by requested keys', async () => {
    const vaultPath = await setupVault(tmpDir, masterKey);
    const ksPath = path.join(tmpDir, 'keystore.json');
    await addKey('default', masterKey, ksPath);
    const result = await exportEnvVars({ vaultPath, keystorePath: ksPath, keys: ['API_KEY'] });
    expect(result.count).toBe(1);
    expect(result.output).toContain('API_KEY');
    expect(result.output).not.toContain('DB_URL');
  });

  it('throws if vault does not exist', async () => {
    const ksPath = path.join(tmpDir, 'keystore.json');
    await addKey('default', masterKey, ksPath);
    await expect(
      exportEnvVars({ vaultPath: path.join(tmpDir, 'missing.enc'), keystorePath: ksPath })
    ).rejects.toThrow('Vault not found');
  });

  it('throws if environment not found', async () => {
    const vaultPath = await setupVault(tmpDir, masterKey);
    const ksPath = path.join(tmpDir, 'keystore.json');
    await addKey('default', masterKey, ksPath);
    await expect(
      exportEnvVars({ vaultPath, keystorePath: ksPath, environment: 'staging' })
    ).rejects.toThrow('Environment "staging" not found');
  });
});
