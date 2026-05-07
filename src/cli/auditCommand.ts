import { Command } from 'commander';
import * as path from 'path';
import { auditVault, AuditEntry } from '../commands/audit';

function formatEntry(entry: AuditEntry): string {
  const status = entry.decryptable ? '\x1b[32m✔\x1b[0m' : '\x1b[31m✘\x1b[0m';
  const detail = entry.error ? ` (${entry.error})` : '';
  return `  ${status} ${entry.key}${detail}`;
}

export function registerAuditCommands(program: Command): void {
  program
    .command('audit <env>')
    .description('Audit a vault: verify all entries are decryptable and compare with local .env file')
    .option(
      '--vault-dir <dir>',
      'Directory where vault files are stored',
      path.join(process.cwd(), '.envault')
    )
    .option(
      '--keystore <path>',
      'Path to keystore file',
      path.join(process.env.HOME || '~', '.envault', 'keys.json')
    )
    .action(async (env: string, opts: { vaultDir: string; keystore: string }) => {
      try {
        const result = await auditVault(env, opts.keystore, opts.vaultDir);

        console.log(`\nAudit for environment: \x1b[1m${env}\x1b[0m`);
        console.log(`Vault: ${result.vaultPath}\n`);

        console.log('Encrypted entries:');
        result.entries.forEach(e => console.log(formatEntry(e)));

        const allOk = result.entries.every(e => e.decryptable);
        const badCount = result.entries.filter(e => !e.decryptable).length;

        if (badCount > 0) {
          console.log(`\n\x1b[31m${badCount} entry(s) could not be decrypted.\x1b[0m`);
        } else {
          console.log(`\n\x1b[32mAll ${result.entries.length} entries are decryptable.\x1b[0m`);
        }

        if (result.missingInEnv.length > 0) {
          console.log(`\n\x1b[33mKeys in vault but missing in .env.${env}:\x1b[0m`);
          result.missingInEnv.forEach(k => console.log(`  - ${k}`));
        }

        if (result.missingInVault.length > 0) {
          console.log(`\n\x1b[33mKeys in .env.${env} but missing in vault:\x1b[0m`);
          result.missingInVault.forEach(k => console.log(`  - ${k}`));
        }

        if (!allOk) process.exit(1);
      } catch (err) {
        console.error('Audit failed:', err instanceof Error ? err.message : err);
        process.exit(1);
      }
    });
}
