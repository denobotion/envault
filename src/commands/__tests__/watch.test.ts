import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { watchEnvFile } from '../watch';
import { generateMasterKey } from '../../keys/masterkey';
import { parseVaultFile } from '../../vault';
import { decrypt } from '../../crypto';

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'envault-watch-'));
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('watchEnvFile', () => {
  let tmpDir: string;
  let masterKey: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    masterKey = generateMasterKey();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('throws if the watched file does not exist', async () => {
    const missing = path.join(tmpDir, 'missing.env');
    await expect(
      watchEnvFile(missing, masterKey, { env: 'test' })
    ).rejects.toThrow('File not found');
  });

  it('syncs file content to vault on change', async () => {
    const envFile = path.join(tmpDir, '.env');
    const vaultFile = path.join(tmpDir, 'vault.json');
    fs.writeFileSync(envFile, 'FOO=bar\n');

    const stop = await watchEnvFile(envFile, masterKey, {
      env: 'staging',
      vaultPath: vaultFile,
      debounceMs: 50,
    });

    fs.writeFileSync(envFile, 'FOO=updated\n');
    await wait(200);
    stop();

    expect(fs.existsSync(vaultFile)).toBe(true);
    const vault = parseVaultFile(fs.readFileSync(vaultFile, 'utf-8'));
    expect(vault.entries['staging']).toBeDefined();
    expect(vault.entries['staging'].updatedAt).toBeTruthy();

    const entry = vault.entries['staging'];
    const keyBuffer = Buffer.from(masterKey, 'hex');
    const decrypted = await decrypt(
      { ciphertext: entry.ciphertext, iv: entry.iv, tag: entry.tag },
      keyBuffer
    );
    expect(decrypted).toBe('FOO=updated\n');
  });

  it('returns a stop function that closes the watcher', async () => {
    const envFile = path.join(tmpDir, '.env');
    const vaultFile = path.join(tmpDir, 'vault.json');
    fs.writeFileSync(envFile, 'A=1\n');

    const stop = await watchEnvFile(envFile, masterKey, {
      env: 'prod',
      vaultPath: vaultFile,
      debounceMs: 50,
    });

    expect(typeof stop).toBe('function');
    expect(() => stop()).not.toThrow();
  });
});
