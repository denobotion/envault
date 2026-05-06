import { describe, it, expect } from 'vitest';
import { encrypt, encryptToString } from '../encrypt';

const MASTER_KEY = 'super-secret-master-key-for-tests';
const PLAINTEXT = 'DB_PASSWORD=hunter2\nAPI_KEY=abc123';

describe('encrypt', () => {
  it('returns an object with salt, iv, tag, and ciphertext', () => {
    const result = encrypt(PLAINTEXT, MASTER_KEY);
    expect(result).toHaveProperty('salt');
    expect(result).toHaveProperty('iv');
    expect(result).toHaveProperty('tag');
    expect(result).toHaveProperty('ciphertext');
  });

  it('produces different ciphertext on each call (random IV/salt)', () => {
    const first = encrypt(PLAINTEXT, MASTER_KEY);
    const second = encrypt(PLAINTEXT, MASTER_KEY);
    expect(first.ciphertext).not.toBe(second.ciphertext);
    expect(first.iv).not.toBe(second.iv);
    expect(first.salt).not.toBe(second.salt);
  });

  it('encryptToString returns valid JSON', () => {
    const result = encryptToString(PLAINTEXT, MASTER_KEY);
    expect(() => JSON.parse(result)).not.toThrow();
  });

  it('ciphertext does not contain plaintext', () => {
    const result = encrypt(PLAINTEXT, MASTER_KEY);
    expect(result.ciphertext).not.toContain('hunter2');
    expect(result.ciphertext).not.toContain('DB_PASSWORD');
  });
});
