import { Command } from 'commander';
import { maskEnv } from '../commands/mask';

export function registerMaskCommands(program: Command): void {
  program
    .command('mask <env>')
    .description('Display vault entries with values masked')
    .option('-k, --key <name>', 'key name to use from keystore', 'default')
    .option('-m, --master-key <key>', 'master key for decryption')
    .option('--char <char>', 'character to use for masking', '*')
    .option('--reveal-first <n>', 'number of leading characters to reveal', '0')
    .option('--reveal-last <n>', 'number of trailing characters to reveal', '0')
    .option('--vault-path <path>', 'custom vault directory path')
    .option('--keystore-path <path>', 'custom keystore path')
    .action(async (env: string, opts) => {
      const masterKey =
        opts.masterKey || process.env.ENVAULT_MASTER_KEY;

      if (!masterKey) {
        console.error(
          'Error: master key required via --master-key or ENVAULT_MASTER_KEY'
        );
        process.exit(1);
      }

      try {
        const entries = await maskEnv(env, masterKey, {
          keyName: opts.key,
          char: opts.char,
          revealFirst: parseInt(opts.revealFirst, 10),
          revealLast: parseInt(opts.revealLast, 10),
          vaultPath: opts.vaultPath,
          keystorePath: opts.keystorePath,
        });

        if (entries.length === 0) {
          console.log(`No entries found in vault "${env}".`);
          return;
        }

        const maxKeyLen = Math.max(...entries.map((e) => e.key.length));
        for (const entry of entries) {
          const padded = entry.key.padEnd(maxKeyLen);
          console.log(`${padded}  ${entry.masked}`);
        }
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });
}
