import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { auditVault } from '../audit';
import { writeVaultFile } from '../../vault';
import { saveKeyStore } from '../../keys';
import { generateMasterKey } from '../../keys/masterkey';
import { encryptToString } from '../../crypto';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'envault-audit-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

async function setupVault(env: string, data: Record<string, string>, masterKey: string) {
  const encrypted: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) {
    encrypted[k] = await encryptToString(v, masterKey);
  }
  writeVaultFile(tmpDir, env, encrypted);
}

test('returns decryptable entries for valid vault', async () => {
  const masterKey = generateMasterKey();
  const env = 'staging';
  await saveKeyStore(path.join(tmpDir, 'keys.json'), { [env]: masterKey });
  await setupVault(env, { DB_URL: 'postgres://localhost', API_KEY: 'secret' }, masterKey);

  const result = await auditVault(env, path.join(tmpDir, 'keys.json'), tmpDir);

  expect(result.entries).toHaveLength(2);
  result.entries.forEach(e => {
    expect(e.decryptable).toBe(true);
    expect(e.error).toBeUndefined();
  });
});

test('detects undecryptable entry when key is wrong', async () => {
  const masterKey = generateMasterKey();
  const wrongKey = generateMasterKey();
  const env = 'staging';
  await saveKeyStore(path.join(tmpDir, 'keys.json'), { [env]: wrongKey });
  await setupVault(env, { DB_URL: 'postgres://localhost' }, masterKey);

  const result = await auditVault(env, path.join(tmpDir, 'keys.json'), tmpDir);

  expect(result.entries[0].decryptable).toBe(false);
  expect(result.entries[0].error).toBeDefined();
});

test('reports missingInVault when .env has extra keys', async () => {
  const masterKey = generateMasterKey();
  const env = 'staging';
  await saveKeyStore(path.join(tmpDir, 'keys.json'), { [env]: masterKey });
  await setupVault(env, { DB_URL: 'postgres://localhost' }, masterKey);

  const envPath = path.resolve(process.cwd(), `.env.${env}`);
  fs.writeFileSync(envPath, 'DB_URL=postgres://localhost\nEXTRA_KEY=value\n');

  try {
    const result = await auditVault(env, path.join(tmpDir, 'keys.json'), tmpDir);
    expect(result.missingInVault).toContain('EXTRA_KEY');
  } finally {
    if (fs.existsSync(envPath)) fs.unlinkSync(envPath);
  }
});

test('throws if vault file does not exist', async () => {
  await expect(auditVault('ghost', path.join(tmpDir, 'keys.json'), tmpDir)).rejects.toThrow(
    'Vault file not found'
  );
});
