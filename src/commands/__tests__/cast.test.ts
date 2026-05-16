import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { castValue, castEntry } from '../cast';
import { saveKeyStore } from '../../keys/keystore';
import { encryptToString } from '../../crypto';
import { writeVaultFile } from '../../vault/vault';

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'envault-cast-'));
}

const MASTER_KEY = 'a'.repeat(64);

describe('castValue', () => {
  it('casts to number', () => {
    expect(castValue('42', 'number')).toBe('42');
  });

  it('throws on invalid number', () => {
    expect(() => castValue('abc', 'number')).toThrow();
  });

  it('casts truthy boolean values', () => {
    expect(castValue('yes', 'boolean')).toBe('true');
    expect(castValue('1', 'boolean')).toBe('true');
    expect(castValue('false', 'boolean')).toBe('false');
  });

  it('throws on invalid boolean', () => {
    expect(() => castValue('maybe', 'boolean')).toThrow();
  });

  it('returns valid json as-is', () => {
    expect(castValue('{"a":1}', 'json')).toBe('{"a":1}');
  });

  it('wraps plain string as json string', () => {
    expect(castValue('hello', 'json')).toBe('"hello"');
  });

  it('returns string unchanged', () => {
    expect(castValue('hello', 'string')).toBe('hello');
  });
});

describe('castEntry', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    const ksPath = path.join(tmpDir, 'keystore.json');
    saveKeyStore({ keys: { default: MASTER_KEY } }, ksPath);
    const vault = {
      version: 1,
      entries: [{ key: 'PORT', value: encryptToString('8080', MASTER_KEY) }],
    };
    writeVaultFile(path.join(tmpDir, '.envault'), vault);
  });

  afterEach(() => fs.rmSync(tmpDir, { recursive: true }));

  it('casts an entry to number type', async () => {
    const result = await castEntry('PORT', 'number', { vaultDir: tmpDir });
    expect(result.oldValue).toBe('8080');
    expect(result.newValue).toBe('8080');
  });

  it('throws when key does not exist', async () => {
    await expect(castEntry('MISSING', 'string', { vaultDir: tmpDir })).rejects.toThrow();
  });
});
