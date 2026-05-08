import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { pruneVault } from '../prune';
import { writeVaultFile } from '../../vault';
import { generateMasterKey } from '../../keys/masterkey';
import { encryptToString } from '../../crypto';
import { addKey } from '../../keys';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'envault-prune-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

async function makeVault(vaultPath: string, masterKey: string) {
  const goodEncrypted = await encryptToString('KEY=value', masterKey);
  const badEncrypted = 'aW52YWxpZC1iYXNlNjQ='; // not encrypted with the key
  writeVaultFile(vaultPath, {
    version: 1,
    environments: {
      production: { encrypted: goodEncrypted, tags: [] },
      staging: { encrypted: badEncrypted, tags: [] },
    },
  });
}

test('removes environments that cannot be decrypted', async () => {
  const vaultPath = path.join(tmpDir, '.envault');
  const masterKey = generateMasterKey();
  await addKey('default', masterKey);
  await makeVault(vaultPath, masterKey);

  const result = await pruneVault({ vaultPath, keyName: 'default' });

  expect(result.removed).toContain('staging');
  expect(result.kept).toContain('production');
});

test('dry-run does not modify the vault', async () => {
  const vaultPath = path.join(tmpDir, '.envault');
  const masterKey = generateMasterKey();
  await addKey('default', masterKey);
  await makeVault(vaultPath, masterKey);

  const before = fs.readFileSync(vaultPath, 'utf8');
  await pruneVault({ vaultPath, keyName: 'default', dryRun: true });
  const after = fs.readFileSync(vaultPath, 'utf8');

  expect(before).toEqual(after);
});

test('throws when vault file does not exist', async () => {
  await expect(
    pruneVault({ vaultPath: path.join(tmpDir, 'missing.envault') })
  ).rejects.toThrow('Vault file not found');
});

test('returns empty removed list when all environments are valid', async () => {
  const vaultPath = path.join(tmpDir, '.envault');
  const masterKey = generateMasterKey();
  await addKey('default', masterKey);
  const encrypted = await encryptToString('KEY=value', masterKey);
  writeVaultFile(vaultPath, {
    version: 1,
    environments: { production: { encrypted, tags: [] } },
  });

  const result = await pruneVault({ vaultPath, keyName: 'default' });

  expect(result.removed).toHaveLength(0);
  expect(result.kept).toEqual(['production']);
});
