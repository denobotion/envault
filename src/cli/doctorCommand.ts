import { Command } from 'commander';
import { runDoctor, DoctorCheck } from '../commands/doctor';
import * as os from 'os';
import * as path from 'path';

const DEFAULT_KEYSTORE = path.join(os.homedir(), '.envault', 'keystore.json');

function formatCheck(check: DoctorCheck): string {
  const icon = check.status === 'ok' ? '✔' : check.status === 'warn' ? '⚠' : '✘';
  return `  ${icon}  [${check.status.toUpperCase()}] ${check.name}: ${check.message}`;
}

export function registerDoctorCommands(program: Command): void {
  program
    .command('doctor')
    .description('Run health checks on the vault and keystore')
    .option('-v, --vault <path>', 'Path to vault file', '.envault')
    .option('-k, --keystore <path>', 'Path to keystore file', DEFAULT_KEYSTORE)
    .option('--json', 'Output results as JSON')
    .action(async (opts) => {
      try {
        const result = await runDoctor(opts.vault, opts.keystore);

        if (opts.json) {
          console.log(JSON.stringify(result, null, 2));
          process.exit(result.healthy ? 0 : 1);
          return;
        }

        console.log('\nenvault doctor\n');
        for (const check of result.checks) {
          console.log(formatCheck(check));
        }
        console.log();

        if (result.healthy) {
          console.log('✔ All checks passed. Vault is healthy.');
        } else {
          console.log('✘ One or more checks failed. Review errors above.');
        }
        console.log();

        process.exit(result.healthy ? 0 : 1);
      } catch (err: any) {
        console.error('Doctor failed:', err.message);
        process.exit(1);
      }
    });
}
