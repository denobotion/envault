import { createDecipheriv, scryptSync } from 'crypto';
import { EncryptedPayload } from './encrypt';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;

function deriveKey(masterKey: string, salt: Buffer): Buffer {
  return scryptSync(masterKey, salt, KEY_LENGTH);
}

export function decrypt(payload: EncryptedPayload, masterKey: string): string {
  const salt = Buffer.from(payload.salt, 'hex');
  const iv = Buffer.from(payload.iv, 'hex');
  const tag = Buffer.from(payload.tag, 'hex');
  const ciphertext = Buffer.from(payload.ciphertext, 'hex');

  const key = deriveKey(masterKey, salt);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

export function decryptFromString(encoded: string, masterKey: string): string {
  let payload: EncryptedPayload;
  try {
    payload = JSON.parse(encoded) as EncryptedPayload;
  } catch {
    throw new Error('Invalid encrypted payload: could not parse JSON');
  }

  if (!payload.salt || !payload.iv || !payload.tag || !payload.ciphertext) {
    throw new Error('Invalid encrypted payload: missing required fields');
  }

  return decrypt(payload, masterKey);
}
