import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const KEYSTORE_FILE = path.join(os.homedir(), '.envault', 'keys.json');

let addKey: typeof import('../keystore').addKey;
let getKey: typeof import('../keystore').getKey;
let removeKey: typeof import('../keystore').removeKey;
let listKeys: typeof import('../keystore').listKeys;
let loadKeyStore: typeof import('../keystore').loadKeyStore;
let saveKeyStore: typeof import('../keystore').saveKeyStore;

beforeEach(() => {
  jest.resetModules();
  // Provide a clean in-memory store for each test
  const mod = require('../keystore');
  addKey = mod.addKey;
  getKey = mod.getKey;
  removeKey = mod.removeKey;
  listKeys = mod.listKeys;
  loadKeyStore = mod.loadKeyStore;
  saveKeyStore = mod.saveKeyStore;

  // Reset keystore file before each test
  if (fs.existsSync(KEYSTORE_FILE)) {
    fs.writeFileSync(KEYSTORE_FILE, JSON.stringify({}), { mode: 0o600 });
  }
});

describe('keystore', () => {
  it('should add and retrieve a key by alias', () => {
    addKey('production', 'supersecretkey123');
    const key = getKey('production');
    expect(key).toBe('supersecretkey123');
  });

  it('should return undefined for a missing alias', () => {
    const key = getKey('nonexistent');
    expect(key).toBeUndefined();
  });

  it('should list all stored keys', () => {
    addKey('dev', 'devkey');
    addKey('staging', 'stagingkey');
    const keys = listKeys();
    const aliases = keys.map((k) => k.alias);
    expect(aliases).toContain('dev');
    expect(aliases).toContain('staging');
  });

  it('should remove a key and return true', () => {
    addKey('temp', 'tempkey');
    const removed = removeKey('temp');
    expect(removed).toBe(true);
    expect(getKey('temp')).toBeUndefined();
  });

  it('should return false when removing a non-existent key', () => {
    const removed = removeKey('ghost');
    expect(removed).toBe(false);
  });

  it('should overwrite an existing key with the same alias', () => {
    addKey('myenv', 'oldkey');
    addKey('myenv', 'newkey');
    expect(getKey('myenv')).toBe('newkey');
    expect(listKeys().filter((k) => k.alias === 'myenv')).toHaveLength(1);
  });
});
