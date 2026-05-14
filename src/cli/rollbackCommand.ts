import { Command } from 'commander';
import { rollback } from '../commands/rollback';

export function registerRollbackCommands(program: Command): void {
  program
    .command('rollback <env>')
    .description('Roll back an environment to a previous snapshot from history')
    .option('-k, --key <masterKey>', 'Master key for decryption')
    .option('-v, --vault <path>', 'Path to vault file')
    .option('-s, --steps <n>', 'Number of steps to roll back (default: 1)', '1')
    .action(async (env: string, opts: { key?: string; vault?: string; steps?: string }) => {
      const masterKey = opts.key ?? process.env.ENVAULT_MASTER_KEY ?? '';
      if (!masterKey) {
        console.error('Error: master key is required (--key or ENVAULT_MASTER_KEY)');
        process.exit(1);
      }

      const steps = parseInt(opts.steps ?? '1', 10);
      if (isNaN(steps) || steps < 1) {
        console.error('Error: --steps must be a positive integer');
        process.exit(1);
      }

      try {
        const result = await rollback(masterKey, {
          env,
          vaultPath: opts.vault,
          steps,
        });
        console.log(`✔ Rolled back "${result.env}" by ${steps} step(s).`);
        console.log(`  Restored at : ${result.restoredAt}`);
        console.log(`  Keys loaded : ${result.keyCount}`);
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });
}
