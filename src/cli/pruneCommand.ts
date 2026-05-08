import { Command } from 'commander';
import { pruneVault } from '../commands/prune';

export function registerPruneCommands(program: Command): void {
  program
    .command('prune')
    .description('Remove environments from the vault that cannot be decrypted with the current key')
    .option('-v, --vault <path>', 'Path to the vault file')
    .option('-k, --key <name>', 'Master key name to use for validation', 'default')
    .option('-n, --dry-run', 'Preview which environments would be removed without modifying the vault')
    .action(async (opts) => {
      try {
        const result = await pruneVault({
          vaultPath: opts.vault,
          keyName: opts.key,
          dryRun: opts.dryRun ?? false,
        });

        if (result.errors.length > 0) {
          result.errors.forEach((e) => console.error(`  error: ${e}`));
        }

        if (result.removed.length === 0) {
          console.log('No orphaned environments found. Vault is clean.');
          return;
        }

        const prefix = opts.dryRun ? '[dry-run] Would remove' : 'Removed';
        console.log(`${prefix} ${result.removed.length} environment(s):`);
        result.removed.forEach((name) => console.log(`  - ${name}`));

        if (!opts.dryRun) {
          console.log(`Kept ${result.kept.length} environment(s).`);
        }
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });
}
