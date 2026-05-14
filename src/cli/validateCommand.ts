import { Command } from 'commander';
import { validateEnv, validateAllEnvs } from '../commands/validate';

export function registerValidateCommands(program: Command): void {
  program
    .command('validate [env]')
    .description('Validate that all encrypted values in an env (or all envs) can be decrypted with the given master key')
    .requiredOption('-k, --key <masterKey>', 'Master key used for decryption')
    .option('-v, --vault <path>', 'Path to vault file')
    .option('--json', 'Output results as JSON')
    .action(async (env: string | undefined, opts) => {
      try {
        const options = { vaultPath: opts.vault };

        if (env) {
          const results = await validateEnv(env, opts.key, options);
          if (opts.json) {
            console.log(JSON.stringify(results, null, 2));
          } else {
            let allValid = true;
            for (const r of results) {
              const status = r.valid ? '✔' : '✘';
              const detail = r.error ? ` (${r.error})` : '';
              console.log(`  ${status}  ${r.key}${detail}`);
              if (!r.valid) allValid = false;
            }
            if (allValid) {
              console.log(`\nAll keys in "${env}" are valid.`);
            } else {
              console.error(`\nSome keys in "${env}" failed validation.`);
              process.exit(1);
            }
          }
        } else {
          const report = await validateAllEnvs(opts.key, options);
          if (opts.json) {
            console.log(JSON.stringify(report, null, 2));
          } else {
            let globalValid = true;
            for (const [envName, results] of Object.entries(report)) {
              const failed = results.filter((r) => !r.valid);
              const status = failed.length === 0 ? '✔' : '✘';
              console.log(`${status}  ${envName}: ${results.length - failed.length}/${results.length} valid`);
              if (failed.length > 0) globalValid = false;
            }
            if (!globalValid) process.exit(1);
          }
        }
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });
}
