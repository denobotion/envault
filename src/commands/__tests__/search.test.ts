import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { searchKeys } from '../search';
import { writeVaultFile } from '../../vault';
import { encryptToString } from '../../crypto';
import { saveKeyStore } from '../../keys';

const MASTER_KEY = 'test-master-key-1234567890abcdef';

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'envault-search-'));
}

function setupVault(tmpDir: string) {
  const vaultPath = path.join(tmpDir, 'vault.json');
  const keystorePath = path.join(tmpDir, 'keystore.json');

  const prodEnv = 'DATABASE_URL=postgres://prod\nAPI_KEY=secret-prod\nDEBUG=false';
  const devEnv = 'DATABASE_URL=postgres://dev\nAPI_KEY=secret-dev\nDEBUG=true';

  saveKeyStore({ 'default': MASTER_KEY }, keystorePath);

  writeVaultFile(vaultPath, {
    version: 1,
    environments: {
      production: { keyAlias: 'default', ciphertext: encryptToString(prodEnv, MASTER_KEY) },
      development: { keyAlias: 'default', ciphertext: encryptToString(devEnv, MASTER_KEY) },
    },
  });

  return { vaultPath, keystorePath };
}

describe('searchKeys', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('finds matching keys across all environments', async () => {
    const { vaultPath, keystorePath } = setupVault(tmpDir);
    const matches = await searchKeys('API_KEY', MASTER_KEY, { vaultPath, keystorePath });
    expect(matches).toHaveLength(2);
    expect(matches.map(m => m.environment).sort()).toEqual(['development', 'production']);
  });

  it('hides values by default', async () => {
    const { vaultPath, keystorePath } = setupVault(tmpDir);
    const matches = await searchKeys('API_KEY', MASTER_KEY, { vaultPath, keystorePath });
    expect(matches.every(m => m.value === '***')).toBe(true);
  });

  it('shows values when showValues is true', async () => {
    const { vaultPath, keystorePath } = setupVault(tmpDir);
    const matches = await searchKeys('API_KEY', MASTER_KEY, { vaultPath, keystorePath, showValues: true });
    expect(matches.map(m => m.value).sort()).toEqual(['secret-dev', 'secret-prod']);
  });

  it('filters by environment', async () => {
    const { vaultPath, keystorePath } = setupVault(tmpDir);
    const matches = await searchKeys('DATABASE_URL', MASTER_KEY, { vaultPath, keystorePath, environment: 'production' });
    expect(matches).toHaveLength(1);
    expect(matches[0].environment).toBe('production');
  });

  it('supports regex patterns', async () => {
    const { vaultPath, keystorePath } = setupVault(tmpDir);
    const matches = await searchKeys('DATABASE|DEBUG', MASTER_KEY, { vaultPath, keystorePath, environment: 'development' });
    expect(matches).toHaveLength(2);
  });

  it('throws on invalid regex', async () => {
    const { vaultPath, keystorePath } = setupVault(tmpDir);
    await expect(searchKeys('[invalid', MASTER_KEY, { vaultPath, keystorePath })).rejects.toThrow('Invalid search pattern');
  });

  it('returns empty array when no keys match', async () => {
    const { vaultPath, keystorePath } = setupVault(tmpDir);
    const matches = await searchKeys('NONEXISTENT_KEY', MASTER_KEY, { vaultPath, keystorePath });
    expect(matches).toHaveLength(0);
  });
});
