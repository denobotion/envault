import { describe, it, expect } from 'vitest';
import { encrypt, encryptToString } from '../encrypt';
import { decrypt, decryptFromString } from '../decrypt';

const MASTER_KEY = 'super-secret-master-key-for-tests';
const PLAINTEXT = 'DB_PASSWORD=hunter2\nAPI_KEY=abc123\nPORT=5432';

describe('decrypt', () => {
  it('correctly decrypts an encrypted payload', () => {
    const payload = encrypt(PLAINTEXT, MASTER_KEY);
    const result = decrypt(payload, MASTER_KEY);
    expect(result).toBe(PLAINTEXT);
  });

  it('decryptFromString round-trips with encryptToString', () => {
    const encoded = encryptToString(PLAINTEXT, MASTER_KEY);
    const result = decryptFromString(encoded, MASTER_KEY);
    expect(result).toBe(PLAINTEXT);
  });

  it('throws on wrong master key', () => {
    const payload = encrypt(PLAINTEXT, MASTER_KEY);
    expect(() => decrypt(payload, 'wrong-key')).toThrow();
  });

  it('throws on invalid JSON string', () => {
    expect(() => decryptFromString('not-json', MASTER_KEY)).toThrow(
      'Invalid encrypted payload: could not parse JSON'
    );
  });

  it('throws on missing fields in payload', () => {
    const incomplete = JSON.stringify({ salt: 'abc' });
    expect(() => decryptFromString(incomplete, MASTER_KEY)).toThrow(
      'Invalid encrypted payload: missing required fields'
    );
  });
});
