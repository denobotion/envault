import { Command } from 'commander';
import { loadKeyStore } from '../keys/keystore';
import { resolveVaultPath, parseVaultFile } from '../vault/vault';
import * as path from 'path';
import * as fs from 'fs';

export function registerListCommands(program: Command): void {
  program
    .command('list')
    .description('List all environments stored in the vault')
    .option('-v, --vault <path>', 'Path to vault file', '.envault')
    .option('--show-keys', 'Show key names available in keystore')
    .action(async (options) => {
      try {
        const vaultPath = resolveVaultPath(options.vault);

        if (!fs.existsSync(vaultPath)) {
          console.log('No vault file found at:', vaultPath);
          console.log('Run `envault init` to create one.');
          process.exit(0);
        }

        const vault = parseVaultFile(vaultPath);
        const environments = Object.keys(vault.environments || {});

        if (environments.length === 0) {
          console.log('No environments found in vault.');
          console.log('Use `envault sync` to add one.');
        } else {
          console.log(`Environments in vault (${path.resolve(vaultPath)}):\n`);
          environments.forEach((env) => {
            const entry = vault.environments[env];
            const updatedAt = entry.updatedAt
              ? new Date(entry.updatedAt).toLocaleString()
              : 'unknown';
            console.log(`  • ${env}  (last updated: ${updatedAt})`);
          });
        }

        if (options.showKeys) {
          const keystore = await loadKeyStore();
          const keyNames = Object.keys(keystore);
          console.log(`\nAvailable keys in keystore:\n`);
          if (keyNames.length === 0) {
            console.log('  (none)');
          } else {
            keyNames.forEach((k) => console.log(`  • ${k}`));
          }
        }
      } catch (err: any) {
        console.error('Error listing environments:', err.message);
        process.exit(1);
      }
    });
}
