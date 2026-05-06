import type { Command } from 'commander';
import { rotateKey, listKeys } from '../keys/rotation';
import * as path from 'path';
import * as os from 'os';

const DEFAULT_KEYSTORE = path.join(os.homedir(), '.envault', 'keystore.json');

export function registerRotateCommands(program: Command): void {
  const rotate = program.command('rotate').description('Key rotation commands');

  rotate
    .command('key <keyId> [vaults...]')
    .description('Rotate a master key and re-encrypt specified vault files')
    .option('--keystore <path>', 'Path to keystore', DEFAULT_KEYSTORE)
    .action(async (keyId: string, vaults: string[], options: { keystore: string }) => {
      if (vaults.length === 0) {
        console.error('Error: At least one vault path must be provided.');
        process.exit(1);
      }
      try {
        const result = await rotateKey(keyId, vaults, options.keystore);
        console.log(`✔ Key rotated successfully.`);
        console.log(`  Old key: ${result.oldKeyId}`);
        console.log(`  New key: ${result.newKeyId}`);
        console.log(`  Re-encrypted files (${result.reEncryptedFiles.length}):`);
        result.reEncryptedFiles.forEach((f) => console.log(`    - ${f}`));
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`);
        process.exit(1);
      }
    });

  rotate
    .command('list')
    .description('List all stored key IDs')
    .option('--keystore <path>', 'Path to keystore', DEFAULT_KEYSTORE)
    .action(async (options: { keystore: string }) => {
      try {
        const keys = await listKeys(options.keystore);
        if (keys.length === 0) {
          console.log('No keys found in keystore.');
          return;
        }
        console.log('Stored keys:');
        keys.forEach((k) => {
          const created = k.createdAt ? ` (created: ${k.createdAt})` : '';
          console.log(`  - ${k.id}${created}`);
        });
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`);
        process.exit(1);
      }
    });
}
