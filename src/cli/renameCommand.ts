import { Command } from 'commander';
import { renameKey } from '../commands/rename';

export function registerRenameCommands(program: Command): void {
  program
    .command('rename <masterKey> <oldKey> <newKey>')
    .description('Rename a key in the vault without changing its value')
    .option('-e, --env <env>', 'target environment', 'default')
    .option('-v, --vault <path>', 'path to vault file')
    .action(async (masterKey: string, oldKey: string, newKey: string, opts) => {
      try {
        const result = await renameKey(masterKey, oldKey, newKey, {
          env: opts.env,
          vaultPath: opts.vault,
        });
        console.log(
          `✔ Renamed "${result.oldKey}" → "${result.newKey}" in environment "${result.env}".`
        );
      } catch (err: any) {
        console.error(`✖ Error: ${err.message}`);
        process.exit(1);
      }
    });
}
