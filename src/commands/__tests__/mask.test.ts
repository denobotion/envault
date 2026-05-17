import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { maskValue, maskEnv } from '../mask';
import { writeVaultFile } from '../../vault';
import { encryptToString } from '../../crypto';
import { saveKeyStore } from '../../keys/keystore';

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'envault-mask-'));
}

describe('maskValue', () => {
  it('masks entire value by default', () => {
    expect(maskValue('secret123')).toBe('*********');
  });

  it('reveals first N characters', () => {
    expect(maskValue('secret123', '*', 3)).toBe('sec******');
  });

  it('reveals last N characters', () => {
    expect(maskValue('secret123', '*', 0, 3)).toBe('******123');
  });

  it('reveals first and last characters', () => {
    expect(maskValue('secret123', '*', 2, 2)).toBe('se*****23');
  });

  it('uses custom mask character', () => {
    expect(maskValue('hello', '#')).toBe('#####');
  });

  it('handles empty string', () => {
    expect(maskValue('')).toBe('');
  });

  it('does not exceed string length when reveal counts are large', () => {
    expect(maskValue('hi', '*', 10, 10)).toBe('hi');
  });
});

describe('maskEnv', () => {
  const masterKey = 'test-master-key-32-bytes-padding!';
  let tmpDir: string;
  let keystorePath: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    keystorePath = path.join(tmpDir, 'keystore.json');
    saveKeyStore(keystorePath, {
      keys: { default: { key: masterKey, createdAt: new Date().toISOString() } },
    });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns masked entries for all keys in vault', async () => {
    const enc1 = await encryptToString('mypassword', masterKey);
    const enc2 = await encryptToString('topsecret', masterKey);
    writeVaultFile(path.join(tmpDir, 'default.vault'), {
      version: 1,
      entries: { DB_PASS: enc1, API_KEY: enc2 },
    });

    const results = await maskEnv('default', masterKey, {
      vaultPath: tmpDir,
      keystorePath,
    });

    expect(results).toHaveLength(2);
    const dbPass = results.find((r) => r.key === 'DB_PASS')!;
    expect(dbPass.masked).toBe('**********');
    expect(dbPass.masked).not.toContain('mypassword');
  });

  it('respects revealFirst option', async () => {
    const enc = await encryptToString('secret', masterKey);
    writeVaultFile(path.join(tmpDir, 'default.vault'), {
      version: 1,
      entries: { TOKEN: enc },
    });

    const results = await maskEnv('default', masterKey, {
      vaultPath: tmpDir,
      keystorePath,
      revealFirst: 2,
    });

    expect(results[0].masked).toBe('se****');
  });

  it('throws if key not found in keystore', async () => {
    writeVaultFile(path.join(tmpDir, 'default.vault'), {
      version: 1,
      entries: {},
    });

    await expect(
      maskEnv('default', masterKey, {
        vaultPath: tmpDir,
        keystorePath,
        keyName: 'nonexistent',
      })
    ).rejects.toThrow('Key "nonexistent" not found');
  });
});
