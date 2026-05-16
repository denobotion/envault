import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { setPermission, getPermission, listPermissions, isValidPermission } from '../chmod';
import { writeVaultFile } from '../../vault/vault';

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'envault-chmod-'));
}

function setupVault(vaultPath: string) {
  writeVaultFile(vaultPath, {
    version: 1,
    entries: {
      production: { encrypted: 'abc123', iv: 'iv1', tag: 'tag1', updatedAt: '2024-01-01' },
      staging: { encrypted: 'def456', iv: 'iv2', tag: 'tag2', updatedAt: '2024-01-01' },
    },
  });
}

describe('chmod', () => {
  let tmpDir: string;
  let vaultPath: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    vaultPath = path.join(tmpDir, 'vault.json');
    setupVault(vaultPath);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('isValidPermission', () => {
    it('returns true for valid permissions', () => {
      expect(isValidPermission('read')).toBe(true);
      expect(isValidPermission('write')).toBe(true);
      expect(isValidPermission('admin')).toBe(true);
    });

    it('returns false for invalid permissions', () => {
      expect(isValidPermission('execute')).toBe(false);
      expect(isValidPermission('')).toBe(false);
    });
  });

  describe('setPermission', () => {
    it('sets a permission on an existing env', async () => {
      const entry = await setPermission('production', 'read', { vaultPath });
      expect(entry.env).toBe('production');
      expect(entry.permission).toBe('read');
      expect(entry.updatedAt).toBeDefined();
    });

    it('throws if env does not exist', async () => {
      await expect(setPermission('nonexistent', 'read', { vaultPath })).rejects.toThrow(
        'Environment "nonexistent" not found in vault'
      );
    });

    it('throws for invalid permission', async () => {
      await expect(setPermission('production', 'execute' as any, { vaultPath })).rejects.toThrow(
        'Invalid permission'
      );
    });
  });

  describe('getPermission', () => {
    it('returns null if no permission set', async () => {
      const result = await getPermission('production', { vaultPath });
      expect(result).toBeNull();
    });

    it('returns the permission after it is set', async () => {
      await setPermission('staging', 'write', { vaultPath });
      const result = await getPermission('staging', { vaultPath });
      expect(result).not.toBeNull();
      expect(result!.permission).toBe('write');
    });
  });

  describe('listPermissions', () => {
    it('returns empty array when no permissions exist', async () => {
      const results = await listPermissions({ vaultPath });
      expect(results).toEqual([]);
    });

    it('returns all set permissions', async () => {
      await setPermission('production', 'admin', { vaultPath });
      await setPermission('staging', 'read', { vaultPath });
      const results = await listPermissions({ vaultPath });
      expect(results).toHaveLength(2);
      const envs = results.map((r) => r.env);
      expect(envs).toContain('production');
      expect(envs).toContain('staging');
    });
  });
});
