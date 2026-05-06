import fs from 'fs';
import os from 'os';
import path from 'path';
import { pushEnv, pullEnv } from '../sync';
import { addKey } from '../../keys';

// Use a temp dir for all file I/O
let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'envault-sync-test-'));
  // Point keystore to temp dir
  process.env.ENVAULT_KEYSTORE_DIR = tmpDir;
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.ENVAULT_KEYSTORE_DIR;
});

const MASTER_KEY = 'super-secret-master-key-for-tests';
const ENV_CONTENT = 'DB_HOST=localhost\nDB_PORT=5432\nSECRET=abc123\n';

describe('pushEnv', () => {
  it('encrypts and writes env content to vault', async () => {
    addKey('default', MASTER_KEY);
    const envFile = path.join(tmpDir, '.env');
    const vaultFile = path.join(tmpDir, '.envault');
    fs.writeFileSync(envFile, ENV_CONTENT);

    await pushEnv({ envFile, vaultFile, profile: 'default' });

    expect(fs.existsSync(vaultFile)).toBe(true);
    const raw = JSON.parse(fs.readFileSync(vaultFile, 'utf-8'));
    expect(raw.entries['default']).toBeDefined();
    expect(raw.entries['default'].encrypted).not.toContain('DB_HOST');
  });

  it('throws if env file does not exist', async () => {
    addKey('default', MASTER_KEY);
    await expect(
      pushEnv({ envFile: path.join(tmpDir, 'missing.env'), vaultFile: path.join(tmpDir, '.envault') })
    ).rejects.toThrow('Env file not found');
  });

  it('throws if no key for profile', async () => {
    const envFile = path.join(tmpDir, '.env');
    fs.writeFileSync(envFile, ENV_CONTENT);
    await expect(
      pushEnv({ envFile, vaultFile: path.join(tmpDir, '.envault'), profile: 'nokey' })
    ).rejects.toThrow('No key found for profile');
  });
});

describe('pullEnv', () => {
  it('decrypts vault entry and writes env file', async () => {
    addKey('default', MASTER_KEY);
    const envFile = path.join(tmpDir, '.env');
    const vaultFile = path.join(tmpDir, '.envault');
    fs.writeFileSync(envFile, ENV_CONTENT);

    await pushEnv({ envFile, vaultFile, profile: 'default' });
    fs.unlinkSync(envFile);

    await pullEnv({ envFile, vaultFile, profile: 'default' });

    expect(fs.existsSync(envFile)).toBe(true);
    expect(fs.readFileSync(envFile, 'utf-8')).toBe(ENV_CONTENT);
  });

  it('throws if vault file does not exist', async () => {
    addKey('default', MASTER_KEY);
    await expect(
      pullEnv({ envFile: path.join(tmpDir, '.env'), vaultFile: path.join(tmpDir, 'missing.envault') })
    ).rejects.toThrow('Vault file not found');
  });

  it('throws if profile entry missing in vault', async () => {
    addKey('default', MASTER_KEY);
    const envFile = path.join(tmpDir, '.env');
    const vaultFile = path.join(tmpDir, '.envault');
    fs.writeFileSync(envFile, ENV_CONTENT);
    await pushEnv({ envFile, vaultFile, profile: 'default' });

    await expect(
      pullEnv({ envFile, vaultFile, profile: 'staging' })
    ).rejects.toThrow('No entry for profile');
  });
});
