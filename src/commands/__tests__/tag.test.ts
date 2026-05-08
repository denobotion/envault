import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { addTag, removeTag, listByTag } from '../tag';
import { writeVaultFile } from '../../vault/vault';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'envault-tag-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function makeVault(envs: Record<string, object>) {
  const vaultPath = path.join(tmpDir, '.envault');
  writeVaultFile(vaultPath, { environments: envs });
  return vaultPath;
}

describe('addTag', () => {
  it('adds a tag to an environment', async () => {
    const vaultPath = makeVault({ production: { encrypted: 'abc' } });
    const result = await addTag('production', 'stable', vaultPath);
    expect(result.tags).toContain('stable');
  });

  it('throws if environment does not exist', async () => {
    const vaultPath = makeVault({});
    await expect(addTag('staging', 'beta', vaultPath)).rejects.toThrow(
      'Environment "staging" not found'
    );
  });

  it('throws if tag already exists', async () => {
    const vaultPath = makeVault({ production: { encrypted: 'abc', tags: ['stable'] } });
    await expect(addTag('production', 'stable', vaultPath)).rejects.toThrow(
      'Tag "stable" already exists'
    );
  });
});

describe('removeTag', () => {
  it('removes an existing tag', async () => {
    const vaultPath = makeVault({ production: { encrypted: 'abc', tags: ['stable', 'v2'] } });
    const result = await removeTag('production', 'stable', vaultPath);
    expect(result.tags).not.toContain('stable');
    expect(result.tags).toContain('v2');
  });

  it('throws if tag does not exist', async () => {
    const vaultPath = makeVault({ production: { encrypted: 'abc', tags: [] } });
    await expect(removeTag('production', 'missing', vaultPath)).rejects.toThrow(
      'Tag "missing" does not exist'
    );
  });
});

describe('listByTag', () => {
  it('returns environments matching a tag', async () => {
    const vaultPath = makeVault({
      production: { encrypted: 'abc', tags: ['stable'] },
      staging: { encrypted: 'def', tags: ['beta'] },
      preview: { encrypted: 'ghi', tags: ['stable', 'beta'] },
    });
    const envs = await listByTag('stable', vaultPath);
    expect(envs).toContain('production');
    expect(envs).toContain('preview');
    expect(envs).not.toContain('staging');
  });

  it('returns empty array when no environments match', async () => {
    const vaultPath = makeVault({ production: { encrypted: 'abc', tags: ['stable'] } });
    const envs = await listByTag('nonexistent', vaultPath);
    expect(envs).toHaveLength(0);
  });
});
