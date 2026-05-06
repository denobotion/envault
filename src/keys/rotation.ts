import { getKey, addKey, loadKeyStore, saveKeyStore } from './keystore';
import { generateMasterKey, validateMasterKey } from './masterkey';
import { decryptFromString } from '../crypto';
import { encryptToString } from '../crypto';
import { parseVaultFile, writeVaultFile, resolveVaultPath } from '../vault';

export interface RotationResult {
  oldKeyId: string;
  newKeyId: string;
  reEncryptedFiles: string[];
}

export async function rotateKey(
  oldKeyId: string,
  vaultPaths: string[],
  keystorePath: string
): Promise<RotationResult> {
  const store = await loadKeyStore(keystorePath);
  const oldKey = getKey(store, oldKeyId);
  if (!oldKey) {
    throw new Error(`Key not found: ${oldKeyId}`);
  }

  const newMasterKey = generateMasterKey();
  const newKeyId = `key_${Date.now()}`;
  const updatedStore = addKey(store, newKeyId, newMasterKey);
  await saveKeyStore(keystorePath, updatedStore);

  const reEncryptedFiles: string[] = [];

  for (const vaultPath of vaultPaths) {
    const resolvedPath = resolveVaultPath(vaultPath);
    try {
      const vault = await parseVaultFile(resolvedPath);
      const decrypted = await decryptFromString(vault.ciphertext, oldKey);
      const newCiphertext = await encryptToString(decrypted, newMasterKey);
      await writeVaultFile(resolvedPath, {
        ...vault,
        ciphertext: newCiphertext,
        keyId: newKeyId,
        rotatedAt: new Date().toISOString(),
      });
      reEncryptedFiles.push(resolvedPath);
    } catch (err) {
      throw new Error(`Failed to re-encrypt ${resolvedPath}: ${(err as Error).message}`);
    }
  }

  return { oldKeyId, newKeyId, reEncryptedFiles };
}

export async function listKeys(keystorePath: string): Promise<{ id: string; createdAt?: string }[]> {
  const store = await loadKeyStore(keystorePath);
  return Object.entries(store.keys).map(([id, entry]) => ({
    id,
    createdAt: (entry as any).createdAt,
  }));
}
