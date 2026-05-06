import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  encryptEnvToVault,
  decryptVaultToEnv,
  parseVaultFile,
  resolveVaultPath,
  VAULT_EXTENSION,
} from '../vault';

const MASTER_KEY = 'test-master-key-1234';
const SAMPLE_ENV = 'DB_HOST=localhost\nDB_PORT=5432\nSECRET=supersecret\n';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'envault-test-'));
}

describe('resolveVaultPath', () => {
  it('appends .vault extension to env file path', () => {
    expect(resolveVaultPath('/project/.env')).toBe(`/project/.env${VAULT_EXTENSION}`);
    expect(resolveVaultPath('/project/.env.production')).toBe(
      `/project/.env.production${VAULT_EXTENSION}`
    );
  });
});

describe('encryptEnvToVault', () => {
  it('creates a vault file with valid structure', async () => {
    const dir = tmpDir();
    const envPath = path.join(dir, '.env');
    const vaultPath = resolveVaultPath(envPath);
    fs.writeFileSync(envPath, SAMPLE_ENV);

    await encryptEnvToVault(envPath, vaultPath, MASTER_KEY);

    expect(fs.existsSync(vaultPath)).toBe(true);
    const vault = parseVaultFile(vaultPath);
    expect(vault.meta.version).toBe(1);
    expect(typeof vault.meta.createdAt).toBe('string');
    expect(typeof vault.payload).toBe('string');
    expect(vault.payload).not.toContain('supersecret');
  });

  it('throws if env file does not exist', async () => {
    const dir = tmpDir();
    await expect(
      encryptEnvToVault(path.join(dir, '.env'), path.join(dir, '.env.vault'), MASTER_KEY)
    ).rejects.toThrow('Env file not found');
  });
});

describe('decryptVaultToEnv', () => {
  it('restores original env file content', async () => {
    const dir = tmpDir();
    const envPath = path.join(dir, '.env');
    const vaultPath = resolveVaultPath(envPath);
    fs.writeFileSync(envPath, SAMPLE_ENV);

    await encryptEnvToVault(envPath, vaultPath, MASTER_KEY);
    fs.unlinkSync(envPath);

    await decryptVaultToEnv(vaultPath, envPath, MASTER_KEY);

    const restored = fs.readFileSync(envPath, 'utf-8');
    expect(restored).toBe(SAMPLE_ENV);
  });

  it('throws if vault file does not exist', async () => {
    const dir = tmpDir();
    await expect(
      decryptVaultToEnv(path.join(dir, '.env.vault'), path.join(dir, '.env'), MASTER_KEY)
    ).rejects.toThrow('Vault file not found');
  });
});
