import { Command } from 'commander';
import { deleteKey } from '../commands/delete';

export function registerDeleteCommands(program: Command): void {
  program
    .command('delete <env> <key>')
    .description('Delete a key from a specific environment in the vault')
    .option('-v, --vault <path>', 'Path to the vault file')
    .option('-k, --keystore <path>', 'Path to the keystore file')
    .action(async (env: string, key: string, options: { vault?: string; keystore?: string }) => {
      try {
        const result = await deleteKey({
          env,
          key,
          vaultPath: options.vault,
          keystorePath: options.keystore,
        });

        if (result.deleted) {
          console.log(`✓ Deleted key '${key}' from environment '${env}'`);
        } else {
          console.warn(`⚠ Key '${key}' not found in environment '${env}', nothing to delete.`);
          process.exitCode = 1;
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`✗ Failed to delete key: ${message}`);
        process.exit(1);
      }
    });
}
