import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { mergeEnvIntoVault } from '../merge';
import { parseVaultFile, writeVaultFile } from '../../vault';
import { encryptToString, decryptFromString } from '../../crypto';
import { addKey, loadKeyStore, saveKeyStore } from '../../keys';

let tmpDir: string;
let vaultPath: string;
let keystorePath: string;
let envFilePath: string;
const MASTER_KEY = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

beforeEach(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'envault-merge-'));
  vaultPath = path.join(tmpDir, 'vault.json');
  keystorePath = path.join(tmpDir, 'keystore.json');
  envFilePath = path.join(tmpDir, '.env');

  const store = { keys: {} };
  store.keys['default'] = MASTER_KEY;
  fs.writeFileSync(keystorePath, JSON.stringify(store));

  fs.writeFileSync(envFilePath, 'API_KEY=abc123\nDB_URL=postgres://localhost/test\n# comment\nEMPTY=\n');
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('merges new keys into a fresh vault', async () => {
  const result = await mergeEnvIntoVault(envFilePath, 'production', 'default', {
    vaultPath,
    keystorePath,
  });

  expect(result.added).toContain('API_KEY');
  expect(result.added).toContain('DB_URL');
  expect(result.skipped).toHaveLength(0);
  expect(result.overwritten).toHaveLength(0);

  const vault = parseVaultFile(vaultPath);
  expect(vault.environments['production'].entries).toHaveLength(3);
});

test('skips existing keys when overwrite is false', async () => {
  await mergeEnvIntoVault(envFilePath, 'production', 'default', { vaultPath, keystorePath });

  fs.writeFileSync(envFilePath, 'API_KEY=newvalue\nNEW_KEY=hello\n');
  const result = await mergeEnvIntoVault(envFilePath, 'production', 'default', {
    vaultPath,
    keystorePath,
    overwrite: false,
  });

  expect(result.skipped).toContain('API_KEY');
  expect(result.added).toContain('NEW_KEY');
});

test('overwrites existing keys when overwrite is true', async () => {
  await mergeEnvIntoVault(envFilePath, 'production', 'default', { vaultPath, keystorePath });

  fs.writeFileSync(envFilePath, 'API_KEY=newvalue\n');
  const result = await mergeEnvIntoVault(envFilePath, 'production', 'default', {
    vaultPath,
    keystorePath,
    overwrite: true,
  });

  expect(result.overwritten).toContain('API_KEY');
  expect(result.skipped).toHaveLength(0);
});

test('throws if env file does not exist', async () => {
  await expect(
    mergeEnvIntoVault('/nonexistent/.env', 'production', 'default', { vaultPath, keystorePath })
  ).rejects.toThrow('Env file not found');
});

test('throws if master key alias is not found', async () => {
  await expect(
    mergeEnvIntoVault(envFilePath, 'production', 'missing-key', { vaultPath, keystorePath })
  ).rejects.toThrow("Master key 'missing-key' not found");
});
