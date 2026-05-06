import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const KEYSTORE_DIR = path.join(os.homedir(), '.envault');
const KEYSTORE_FILE = path.join(KEYSTORE_DIR, 'keys.json');

export interface KeyEntry {
  alias: string;
  key: string;
  createdAt: string;
}

export type KeyStore = Record<string, KeyEntry>;

function ensureKeystoreDir(): void {
  if (!fs.existsSync(KEYSTORE_DIR)) {
    fs.mkdirSync(KEYSTORE_DIR, { recursive: true, mode: 0o700 });
  }
}

export function loadKeyStore(): KeyStore {
  ensureKeystoreDir();
  if (!fs.existsSync(KEYSTORE_FILE)) {
    return {};
  }
  const raw = fs.readFileSync(KEYSTORE_FILE, 'utf-8');
  return JSON.parse(raw) as KeyStore;
}

export function saveKeyStore(store: KeyStore): void {
  ensureKeystoreDir();
  fs.writeFileSync(KEYSTORE_FILE, JSON.stringify(store, null, 2), {
    encoding: 'utf-8',
    mode: 0o600,
  });
}

export function addKey(alias: string, key: string): void {
  const store = loadKeyStore();
  store[alias] = { alias, key, createdAt: new Date().toISOString() };
  saveKeyStore(store);
}

export function getKey(alias: string): string | undefined {
  const store = loadKeyStore();
  return store[alias]?.key;
}

export function removeKey(alias: string): boolean {
  const store = loadKeyStore();
  if (!store[alias]) return false;
  delete store[alias];
  saveKeyStore(store);
  return true;
}

export function listKeys(): KeyEntry[] {
  const store = loadKeyStore();
  return Object.values(store);
}
