import { Command } from 'commander';
import { pushEnv, pullEnv, SyncOptions } from '../commands';

export function registerSyncCommands(program: Command): void {
  const sync = program
    .command('sync')
    .description('Sync .env files to/from the vault');

  sync
    .command('push')
    .description('Encrypt local .env and push to vault')
    .option('-e, --env <path>', 'Path to .env file', '.env')
    .option('-v, --vault <path>', 'Path to vault file')
    .option('-p, --profile <name>', 'Key profile to use', 'default')
    .action(async (opts) => {
      const options: SyncOptions = {
        envFile: opts.env,
        vaultFile: opts.vault,
        profile: opts.profile,
      };
      try {
        await pushEnv(options);
      } catch (err: unknown) {
        console.error('✖ Push failed:', (err as Error).message);
        process.exit(1);
      }
    });

  sync
    .command('pull')
    .description('Decrypt vault entry and write to local .env')
    .option('-e, --env <path>', 'Path to .env file', '.env')
    .option('-v, --vault <path>', 'Path to vault file')
    .option('-p, --profile <name>', 'Key profile to use', 'default')
    .action(async (opts) => {
      const options: SyncOptions = {
        envFile: opts.env,
        vaultFile: opts.vault,
        profile: opts.profile,
      };
      try {
        await pullEnv(options);
      } catch (err: unknown) {
        console.error('✖ Pull failed:', (err as Error).message);
        process.exit(1);
      }
    });
}
