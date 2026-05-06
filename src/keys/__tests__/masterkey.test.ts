import {
  generateMasterKey,
  validateMasterKey,
  resolveMasterKey,
} from '../masterkey';

describe('generateMasterKey', () => {
  it('should generate a 64-character hex string', () => {
    const key = generateMasterKey();
    expect(key).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/.test(key)).toBe(true);
  });

  it('should generate unique keys each time', () => {
    const key1 = generateMasterKey();
    const key2 = generateMasterKey();
    expect(key1).not.toBe(key2);
  });
});

describe('validateMasterKey', () => {
  it('should accept valid 64-char hex keys', () => {
    const key = generateMasterKey();
    expect(validateMasterKey(key)).toBe(true);
  });

  it('should reject keys that are too short', () => {
    expect(validateMasterKey('abc123')).toBe(false);
  });

  it('should reject keys with non-hex characters', () => {
    const bad = 'z'.repeat(64);
    expect(validateMasterKey(bad)).toBe(false);
  });

  it('should accept uppercase hex keys', () => {
    const key = generateMasterKey().toUpperCase();
    expect(validateMasterKey(key)).toBe(true);
  });
});

describe('resolveMasterKey', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should resolve key from environment variable', async () => {
    const key = generateMasterKey();
    process.env.ENVAULT_MASTER_KEY = key;
    const resolved = await resolveMasterKey();
    expect(resolved).toBe(key);
  });

  it('should throw if env var contains invalid key', async () => {
    process.env.ENVAULT_MASTER_KEY = 'invalid-key';
    await expect(resolveMasterKey()).rejects.toThrow('invalid master key');
  });
});
