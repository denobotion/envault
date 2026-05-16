import { Command } from 'commander';
import { setEntry } from '../commands/set';
import * as path from 'path';
import * as os from 'os';

export function registerSetCommands(program: Command): void {
  program
    .command('set <env> <key> <value>')
    .description('Set or update a key-value pair in the specified vault environment')
    .option('-d, --vault-dir <dir>', 'directory containing vault files', process.cwd())
    .option(
      '-k, --keystore-dir <dir>',
      'directory containing the keystore',
      path.join(os.homedir(), '.envault')
    )
    .action(async (env: string, key: string, value: string, opts) => {
      try {
        const result = await setEntry(env, key, value, {
          vaultDir: opts.vaultDir,
          keystoreDir: opts.keystoreDir,
        });

        if (result.updated) {
          console.log(`✔ Updated "${result.key}" in environment "${result.env}"`);
        } else {
          console.log(`✔ Added "${result.key}" to environment "${result.env}"`);
        }
      } catch (err: any) {
        console.error(`✖ ${err.message}`);
        process.exit(1);
      }
    });
}
