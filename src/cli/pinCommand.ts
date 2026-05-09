import { Command } from 'commander';
import { pinKey, unpinKey, listPins } from '../commands/pin';

export function registerPinCommands(program: Command): void {
  const pin = program.command('pin').description('Manage pinned keys that are protected from deletion or overwrite');

  pin
    .command('add <env> <key>')
    .description('Pin a key in an environment to protect it')
    .option('-d, --vault-dir <dir>', 'Vault directory', process.cwd())
    .option('-k, --master-key <key>', 'Master key', process.env.ENVAULT_MASTER_KEY)
    .action(async (env: string, key: string, opts: { vaultDir: string; masterKey?: string }) => {
      const masterKey = opts.masterKey;
      if (!masterKey) {
        console.error('Error: master key is required (--master-key or ENVAULT_MASTER_KEY)');
        process.exit(1);
      }
      try {
        await pinKey(opts.vaultDir, env, key, masterKey);
        console.log(`Pinned "${key}" in environment "${env}"`);
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });

  pin
    .command('remove <env> <key>')
    .description('Unpin a key in an environment')
    .option('-d, --vault-dir <dir>', 'Vault directory', process.cwd())
    .action(async (env: string, key: string, opts: { vaultDir: string }) => {
      try {
        await unpinKey(opts.vaultDir, env, key);
        console.log(`Unpinned "${key}" in environment "${env}"`);
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });

  pin
    .command('list')
    .description('List all pinned keys')
    .option('-d, --vault-dir <dir>', 'Vault directory', process.cwd())
    .action((opts: { vaultDir: string }) => {
      const pins = listPins(opts.vaultDir);
      if (pins.length === 0) {
        console.log('No pinned keys.');
        return;
      }
      console.log(`${'ENV'.padEnd(20)} ${'KEY'.padEnd(30)} PINNED AT`);
      console.log('-'.repeat(70));
      for (const p of pins) {
        console.log(`${p.env.padEnd(20)} ${p.key.padEnd(30)} ${p.pinnedAt}`);
      }
    });
}
