import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { setEntry } from '../set';
import { generateMasterKey } from '../../keys/masterkey';
import { addKey } from '../../keys/keystore';
import { parseVaultFile } from '../../vault';
import { decrypt } from '../../crypto';

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'envault-set-test-'));
}

describe('setEntry', () => {
  let tmpDir: string;
  let keystoreDir: string;
  const env = 'test';

  beforeEach(async () => {
    tmpDir = makeTmpDir();
    keystoreDir = makeTmpDir();
    const masterKey = generateMasterKey();
    await addKey(env, masterKey, keystoreDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.rmSync(keystoreDir, { recursive: true, force: true });
  });

  it('adds a new key to an empty vault', async () => {
    const result = await setEntry(env, 'DB_URL', 'postgres://localhost/db', {
      vaultDir: tmpDir,
      keystoreDir,
    });

    expect(result.env).toBe(env);
    expect(result.key).toBe('DB_URL');
    expect(result.updated).toBe(false);

    const vault = parseVaultFile(path.join(tmpDir, `${env}.vault`));
    expect(vault.entries).toHaveLength(1);
    expect(vault.entries[0].key).toBe('DB_URL');
  });

  it('updates an existing key', async () => {
    await setEntry(env, 'DB_URL', 'postgres://localhost/db', { vaultDir: tmpDir, keystoreDir });
    const result = await setEntry(env, 'DB_URL', 'postgres://remotehost/db', {
      vaultDir: tmpDir,
      keystoreDir,
    });

    expect(result.updated).toBe(true);
    const vault = parseVaultFile(path.join(tmpDir, `${env}.vault`));
    expect(vault.entries).toHaveLength(1);
  });

  it('stores the value encrypted', async () => {
    const plainValue = 'super-secret-value';
    await setEntry(env, 'SECRET', plainValue, { vaultDir: tmpDir, keystoreDir });

    const vault = parseVaultFile(path.join(tmpDir, `${env}.vault`));
    const entry = vault.entries.find((e) => e.key === 'SECRET')!;
    expect(entry.value).not.toBe(plainValue);
  });

  it('throws when no master key exists for env', async () => {
    await expect(
      setEntry('nonexistent', 'KEY', 'val', { vaultDir: tmpDir, keystoreDir })
    ).rejects.toThrow('No master key found');
  });
});
