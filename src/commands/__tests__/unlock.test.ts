import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { unlockEnv } from '../unlock';
import { writeVaultFile } from '../../vault';
import { addKey } from '../../keys/keystore';
import { encryptToString } from '../../crypto';

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'envault-unlock-'));
}

describe('unlockEnv', () => {
  let tmpDir: string;
  const masterKey = 'test-master-key-unlock-1234567890ab';
  const keyName = 'test-key';

  beforeEach(async () => {
    tmpDir = makeTmpDir();
    await addKey(keyName, masterKey, path.join(tmpDir, 'keystore'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should decrypt and write a .env file', async () => {
    const plaintext = 'DB_HOST=localhost\nDB_PORT=5432\nSECRET=abc123';
    const encrypted = await encryptToString(plaintext, masterKey);

    const vaultPath = path.join(tmpDir, 'vault.json');
    writeVaultFile(vaultPath, {
      version: 1,
      envs: { default: { encrypted, updatedAt: new Date().toISOString() } },
    });

    const outputPath = path.join(tmpDir, '.env.default');
    const result = await unlockEnv(keyName, {
      env: 'default',
      output: outputPath,
      keystoreDir: path.join(tmpDir, 'keystore'),
      vaultPath,
    });

    expect(result.env).toBe('default');
    expect(result.outputPath).toBe(outputPath);
    expect(result.keyCount).toBe(3);
    expect(fs.existsSync(outputPath)).toBe(true);
    const written = fs.readFileSync(outputPath, 'utf-8');
    expect(written).toContain('DB_HOST=localhost');
    expect(written).toContain('SECRET=abc123');
  });

  it('should throw if vault does not exist', async () => {
    await expect(
      unlockEnv(keyName, {
        vaultPath: path.join(tmpDir, 'nonexistent.json'),
        keystoreDir: path.join(tmpDir, 'keystore'),
      })
    ).rejects.toThrow('Vault not found');
  });

  it('should throw if environment is not in vault', async () => {
    const vaultPath = path.join(tmpDir, 'vault.json');
    writeVaultFile(vaultPath, { version: 1, envs: {} });

    await expect(
      unlockEnv(keyName, {
        env: 'staging',
        vaultPath,
        keystoreDir: path.join(tmpDir, 'keystore'),
      })
    ).rejects.toThrow('Environment "staging" not found');
  });

  it('should throw if key is not in keystore', async () => {
    const vaultPath = path.join(tmpDir, 'vault.json');
    writeVaultFile(vaultPath, {
      version: 1,
      envs: { default: { encrypted: 'x', updatedAt: '' } },
    });

    await expect(
      unlockEnv('missing-key', {
        vaultPath,
        keystoreDir: path.join(tmpDir, 'keystore'),
      })
    ).rejects.toThrow('Key "missing-key" not found');
  });
});
