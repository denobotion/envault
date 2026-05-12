import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getVaultStats } from '../stats';
import * as vault from '../../vault';
import * as crypto from '../../crypto';
import * as keys from '../../keys';

vi.mock('../../vault');
vi.mock('../../crypto');
vi.mock('../../keys');

const mockVault = {
  ciphertext: 'encrypted-data',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-06-01T00:00:00.000Z',
};

const mockEnvContent = [
  'DB_HOST=localhost',
  'DB_PORT=5432',
  'DB_PASS=supersecret',
  'EMPTY_VAR=',
  '# a comment',
  'API_KEY=abc123',
].join('\n');

beforeEach(() => {
  vi.mocked(vault.resolveVaultPath).mockReturnValue('/tmp/test.vault');
  vi.mocked(vault.parseVaultFile).mockReturnValue(mockVault as any);
  vi.mocked(keys.getKey).mockResolvedValue('master-key-abc');
  vi.mocked(crypto.decryptFromString).mockResolvedValue(mockEnvContent);
});

describe('getVaultStats', () => {
  it('returns correct key count', async () => {
    const stats = await getVaultStats('production', '/tmp/keystore');
    expect(stats.totalKeys).toBe(4);
  });

  it('counts empty values correctly', async () => {
    const stats = await getVaultStats('production', '/tmp/keystore');
    expect(stats.emptyValues).toBe(1);
  });

  it('calculates avgValueLength', async () => {
    const stats = await getVaultStats('production', '/tmp/keystore');
    expect(stats.avgValueLength).toBeGreaterThan(0);
  });

  it('includes createdAt and updatedAt from vault', async () => {
    const stats = await getVaultStats('production', '/tmp/keystore');
    expect(stats.createdAt).toBe('2024-01-01T00:00:00.000Z');
    expect(stats.updatedAt).toBe('2024-06-01T00:00:00.000Z');
  });

  it('throws when no key found for environment', async () => {
    vi.mocked(keys.getKey).mockResolvedValue(null);
    await expect(getVaultStats('staging', '/tmp/keystore')).rejects.toThrow(
      'No key found for environment: staging'
    );
  });

  it('returns zero avgValueLength when no keys present', async () => {
    vi.mocked(crypto.decryptFromString).mockResolvedValue('# only a comment\n');
    const stats = await getVaultStats('production', '/tmp/keystore');
    expect(stats.totalKeys).toBe(0);
    expect(stats.avgValueLength).toBe(0);
  });
});
