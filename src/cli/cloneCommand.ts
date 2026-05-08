import { Command } from 'commander';
import { cloneEnvironment } from '../commands/clone';

export function registerCloneCommands(program: Command): void {
  program
    .command('clone <source> <target>')
    .description('Clone an existing environment into a new one')
    .option('-k, --key <masterKey>', 'Master key for decryption/re-encryption')
    .option('--vault-dir <dir>', 'Custom vault directory')
    .option('--keystore-dir <dir>', 'Custom keystore directory')
    .action(async (source: string, target: string, opts) => {
      const masterKey = opts.key || process.env.ENVAULT_MASTER_KEY;

      if (!masterKey) {
        console.error('Error: Master key is required. Use --key or set ENVAULT_MASTER_KEY.');
        process.exit(1);
      }

      try {
        await cloneEnvironment(source, target, masterKey, {
          vaultDir: opts.vaultDir,
          keystoreDir: opts.keystoreDir,
        });
        console.log(`Environment "${source}" successfully cloned to "${target}".`);
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });
}
