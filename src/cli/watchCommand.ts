import { Command } from 'commander';
import * as path from 'path';
import { watchEnvFile } from '../commands/watch';
import { getKey, loadKeyStore } from '../keys';

export function registerWatchCommands(program: Command): void {
  program
    .command('watch <file>')
    .description('Watch a .env file and auto-sync changes to the vault')
    .requiredOption('-e, --env <name>', 'Environment name to update in the vault')
    .option('-k, --key-name <name>', 'Key name to use from keystore', 'default')
    .option('--vault <path>', 'Path to vault file')
    .option('--keystore <path>', 'Path to keystore file')
    .option('--debounce <ms>', 'Debounce delay in milliseconds', '300')
    .action(async (file: string, opts) => {
      try {
        const keystorePath = opts.keystore;
        const keystore = await loadKeyStore(keystorePath);
        const masterKey = getKey(keystore, opts.keyName);

        if (!masterKey) {
          console.error(`Key "${opts.keyName}" not found in keystore.`);
          process.exit(1);
        }

        const debounceMs = parseInt(opts.debounce, 10);
        const absFile = path.resolve(file);

        console.log(`Watching ${absFile} for changes (env: ${opts.env})...`);
        console.log('Press Ctrl+C to stop.');

        const stop = await watchEnvFile(absFile, masterKey, {
          env: opts.env,
          vaultPath: opts.vault,
          keystorePath,
          debounceMs,
        });

        process.on('SIGINT', () => {
          stop();
          console.log('\nStopped watching.');
          process.exit(0);
        });
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });
}
