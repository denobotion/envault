import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { encryptFile, decryptFile } from '../encrypt-file';
import { generateMasterKey } from '../../keys/masterkey';
import { parseVaultFile } from '../../vault';

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'envault-encfile-'));
}

describe('encryptFile', () => {
  let tmpDir: string;
  let masterKey: string;
  let vaultPath: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    masterKey = generateMasterKey();
    vaultPath = path.join(tmpDir, 'vault.json');
    fs.writeFileSync(vaultPath, JSON.stringify({}));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('encrypts a file and stores it in the vault under the default env', async () => {
    const filePath = path.join(tmpDir, '.env');
    fs.writeFileSync(filePath, 'SECRET=hello');

    const result = await encryptFile(filePath, masterKey, { vaultPath });

    expect(result.env).toBe('default');
    expect(result.key).toBe('.env');

    const vault = parseVaultFile(vaultPath);
    expect(vault['default']['.env']).toBeDefined();
    expect(typeof vault['default']['.env']).toBe('string');
  });

  it('stores the entry under a custom env and outputKey', async () => {
    const filePath = path.join(tmpDir, 'config.env');
    fs.writeFileSync(filePath, 'PORT=3000');

    const result = await encryptFile(filePath, masterKey, {
      vaultPath,
      env: 'production',
      outputKey: 'app-config',
    });

    expect(result.env).toBe('production');
    expect(result.key).toBe('app-config');

    const vault = parseVaultFile(vaultPath);
    expect(vault['production']['app-config']).toBeDefined();
  });

  it('throws if the source file does not exist', async () => {
    await expect(
      encryptFile(path.join(tmpDir, 'missing.env'), masterKey, { vaultPath })
    ).rejects.toThrow('File not found');
  });

  it('throws if the source file is empty', async () => {
    const filePath = path.join(tmpDir, 'empty.env');
    fs.writeFileSync(filePath, '   ');

    await expect(
      encryptFile(filePath, masterKey, { vaultPath })
    ).rejects.toThrow('File is empty');
  });
});

describe('decryptFile', () => {
  let tmpDir: string;
  let masterKey: string;
  let vaultPath: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    masterKey = generateMasterKey();
    vaultPath = path.join(tmpDir, 'vault.json');
    fs.writeFileSync(vaultPath, JSON.stringify({}));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('round-trips: encrypts then decrypts to original content', async () => {
    const original = 'DB_URL=postgres://localhost/mydb\nSECRET=abc123';
    const srcFile = path.join(tmpDir, '.env');
    fs.writeFileSync(srcFile, original);

    await encryptFile(srcFile, masterKey, { vaultPath });

    const outFile = path.join(tmpDir, 'output.env');
    await decryptFile(outFile, masterKey, { vaultPath, key: '.env' });

    expect(fs.readFileSync(outFile, 'utf-8')).toBe(original);
  });

  it('throws when the key does not exist in the vault', async () => {
    await expect(
      decryptFile(path.join(tmpDir, 'out.env'), masterKey, {
        vaultPath,
        key: 'nonexistent',
      })
    ).rejects.toThrow('Key "nonexistent" not found');
  });
});
