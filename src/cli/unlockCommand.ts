import { Command } from 'commander';
import { unlockEnv } from '../commands/unlock';

export function registerUnlockCommands(program: Command): void {
  program
    .command('unlock <keyName>')
    .description('Decrypt a vault environment and write it to a .env file')
    .option('-e, --env <env>', 'Environment name to unlock', 'default')
    .option('-o, --output <path>', 'Output file path (default: .env.<env>)')
    .option('--keystore-dir <dir>', 'Custom keystore directory')
    .option('--vault <path>', 'Custom vault file path')
    .action(async (keyName: string, opts) => {
      try {
        const result = await unlockEnv(keyName, {
          env: opts.env,
          output: opts.output,
          keystoreDir: opts.keystoreDir,
          vaultPath: opts.vault,
        });

        console.log(
          `✔ Unlocked "${result.env}" → ${result.outputPath} (${result.keyCount} keys)`
        );
      } catch (err: any) {
        console.error(`✖ Unlock failed: ${err.message}`);
        process.exit(1);
      }
    });
}
