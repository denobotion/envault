import { Command } from 'commander';
import * as path from 'path';
import { mergeEnvIntoVault } from '../commands/merge';

export function registerMergeCommands(program: Command): void {
  program
    .command('merge <envFile> <environment>')
    .description('Merge a .env file into a vault environment')
    .option('-k, --key <alias>', 'master key alias to use for encryption', 'default')
    .option('-v, --vault <path>', 'path to vault file')
    .option('--overwrite', 'overwrite existing keys with incoming values', false)
    .action(async (envFile: string, environment: string, opts) => {
      try {
        const result = await mergeEnvIntoVault(
          path.resolve(envFile),
          environment,
          opts.key,
          {
            vaultPath: opts.vault,
            overwrite: opts.overwrite,
          }
        );

        if (result.added.length > 0) {
          console.log(`Added (${result.added.length}): ${result.added.join(', ')}`);
        }
        if (result.overwritten.length > 0) {
          console.log(`Overwritten (${result.overwritten.length}): ${result.overwritten.join(', ')}`);
        }
        if (result.skipped.length > 0) {
          console.log(`Skipped (${result.skipped.length}): ${result.skipped.join(', ')}`);
        }

        const total = result.added.length + result.overwritten.length;
        console.log(`\nMerge complete. ${total} key(s) written to '${environment}'.`);
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });
}
