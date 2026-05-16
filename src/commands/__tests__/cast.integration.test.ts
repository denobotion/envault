import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { castEntry } from '../cast';
import { saveKeyStore } from '../../keys/keystore';
import { encryptToString, decryptFromString } from '../../crypto';
import { writeVaultFile, parseVaultFile } from '../../vault/vault';

const MASTER_KEY = 'b'.repeat(64);

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'envault-cast-int-'));
}

describe('castEntry integration', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    saveKeyStore({ keys: { default: MASTER_KEY } }, path.join(tmpDir, 'keystore.json'));
  });

  afterEach(() => fs.rmSync(tmpDir, { recursive: true }));

  it('round-trips number cast correctly', async () => {
    writeVaultFile(path.join(tmpDir, '.envault'), {
      version: 1,
      entries: [{ key: 'TIMEOUT', value: encryptToString('30', MASTER_KEY) }],
    });

    const result = await castEntry('TIMEOUT', 'number', { vaultDir: tmpDir });
    expect(result.newValue).toBe('30');

    const vault = parseVaultFile(path.join(tmpDir, '.envault'));
    const entry = vault.entries.find((e) => e.key === 'TIMEOUT')!;
    expect(decryptFromString(entry.value, MASTER_KEY)).toBe('30');
  });

  it('round-trips json cast on a plain value', async () => {
    writeVaultFile(path.join(tmpDir, '.envault'), {
      version: 1,
      entries: [{ key: 'CONFIG', value: encryptToString('hello', MASTER_KEY) }],
    });

    const result = await castEntry('CONFIG', 'json', { vaultDir: tmpDir });
    expect(result.newValue).toBe('"hello"');

    const vault = parseVaultFile(path.join(tmpDir, '.envault'));
    const entry = vault.entries.find((e) => e.key === 'CONFIG')!;
    expect(decryptFromString(entry.value, MASTER_KEY)).toBe('"hello"');
  });

  it('preserves other entries when casting one', async () => {
    writeVaultFile(path.join(tmpDir, '.envault'), {
      version: 1,
      entries: [
        { key: 'A', value: encryptToString('1', MASTER_KEY) },
        { key: 'B', value: encryptToString('hello', MASTER_KEY) },
      ],
    });

    await castEntry('A', 'boolean', { vaultDir: tmpDir });

    const vault = parseVaultFile(path.join(tmpDir, '.envault'));
    expect(vault.entries).toHaveLength(2);
    const b = vault.entries.find((e) => e.key === 'B')!;
    expect(decryptFromString(b.value, MASTER_KEY)).toBe('hello');
  });
});
