import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { diffEnvWithVault, DiffEntry } from '../diff';
import { writeVaultFile } from '../../vault';
import { addKey } from '../../keys';
import { encryptToString } from '../../crypto';
import { generateMasterKey } from '../../keys/masterkey';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'envault-diff-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

async function setupVault(environment: string, masterKey: string, envContent: string) {
  const envPath = path.join(tmpDir, '.env');
  const vaultPath = path.join(tmpDir, '.env.vault');
  const encrypted = await encryptToString(envContent, masterKey);
  writeVaultFile(vaultPath, {
    version: 1,
    environments: {
      [environment]: { encrypted, updatedAt: new Date().toISOString() }
    }
  });
  const keystorePath = path.join(tmpDir, '.keystore.json');
  await addKey(environment, masterKey, keystorePath);
  return { envPath, vaultPath, keystorePath };
}

test('detects added keys (in local but not vault)', async () => {
  const masterKey = generateMasterKey();
  const { envPath, keystorePath } = await setupVault('dev', masterKey, 'FOO=bar\n');
  fs.writeFileSync(envPath, 'FOO=bar\nNEW_KEY=newval\n');
  const diff = await diffEnvWithVault(envPath, 'dev', keystorePath);
  const added = diff.filter(d => d.status === 'added');
  expect(added).toHaveLength(1);
  expect(added[0].key).toBe('NEW_KEY');
});

test('detects removed keys (in vault but not local)', async () => {
  const masterKey = generateMasterKey();
  const { envPath, keystorePath } = await setupVault('dev', masterKey, 'FOO=bar\nOLD_KEY=oldval\n');
  fs.writeFileSync(envPath, 'FOO=bar\n');
  const diff = await diffEnvWithVault(envPath, 'dev', keystorePath);
  const removed = diff.filter(d => d.status === 'removed');
  expect(removed).toHaveLength(1);
  expect(removed[0].key).toBe('OLD_KEY');
});

test('detects changed values', async () => {
  const masterKey = generateMasterKey();
  const { envPath, keystorePath } = await setupVault('dev', masterKey, 'FOO=original\n');
  fs.writeFileSync(envPath, 'FOO=modified\n');
  const diff = await diffEnvWithVault(envPath, 'dev', keystorePath);
  const changed = diff.filter(d => d.status === 'changed');
  expect(changed).toHaveLength(1);
  expect(changed[0].key).toBe('FOO');
  expect(changed[0].localValue).toBe('modified');
  expect(changed[0].vaultValue).toBe('original');
});

test('marks unchanged keys correctly', async () => {
  const masterKey = generateMasterKey();
  const { envPath, keystorePath } = await setupVault('dev', masterKey, 'FOO=bar\n');
  fs.writeFileSync(envPath, 'FOO=bar\n');
  const diff = await diffEnvWithVault(envPath, 'dev', keystorePath);
  expect(diff.every(d => d.status === 'unchanged')).toBe(true);
});

test('throws if vault file missing', async () => {
  const envPath = path.join(tmpDir, '.env');
  fs.writeFileSync(envPath, 'FOO=bar\n');
  await expect(diffEnvWithVault(envPath, 'dev')).rejects.toThrow('Vault file not found');
});
