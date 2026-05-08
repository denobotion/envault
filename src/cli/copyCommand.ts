import { Command } from 'commander';
import { copyEnv } from '../commands/copy';
import { getKey } from '../keys/keystore';

export function registerCopyCommands(program: Command): void {
  program
    .command('copy <source> <destination>')
    .description('Copy an environment from one vault entry to another')
    .option('-k, --key-name <name>', 'key name to use for encryption', 'default')
    .option('-v, --vault <path>', 'path to vault file')
    .action(async (source: string, destination: string, options: { keyName: string; vault?: string }) => {
      try {
        const masterKey = await getKey(options.keyName);
        if (!masterKey) {
          console.error(`Error: No key found with name "${options.keyName}". Run "envault init" first.`);
          process.exit(1);
        }

        await copyEnv({
          source,
          destination,
          masterKey,
          vaultPath: options.vault,
        });

        console.log(`✓ Copied environment "${source}" to "${destination}" successfully.`);
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });
}
