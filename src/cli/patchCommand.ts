import { Command } from 'commander';
import { patchVault, PatchEntry } from '../commands/patch';

export function registerPatchCommands(program: Command): void {
  program
    .command('patch <env>')
    .description('Patch key=value pairs into a vault environment')
    .requiredOption('-k, --key <masterKey>', 'Master key for encryption')
    .option('-f, --file <vaultFile>', 'Path to vault file', '.envault')
    .option('--no-overwrite', 'Skip keys that already exist')
    .option('--dry-run', 'Preview changes without writing to disk')
    .argument('<assignments...>', 'Key=value pairs to patch (e.g. FOO=bar BAZ=qux)')
    .action(async (env: string, assignments: string[], opts) => {
      const patches: PatchEntry[] = [];

      for (const assignment of assignments) {
        const eqIndex = assignment.indexOf('=');
        if (eqIndex === -1) {
          console.error(`Invalid assignment (expected KEY=VALUE): ${assignment}`);
          process.exit(1);
        }
        patches.push({
          key: assignment.slice(0, eqIndex).trim(),
          value: assignment.slice(eqIndex + 1),
        });
      }

      try {
        const result = await patchVault(opts.file, env, patches, opts.key, {
          overwrite: opts.overwrite,
          dryRun: opts.dryRun,
        });

        if (opts.dryRun) {
          console.log('[dry-run] No changes written.');
        }

        if (result.added.length) console.log(`Added:   ${result.added.join(', ')}`);
        if (result.updated.length) console.log(`Updated: ${result.updated.join(', ')}`);
        if (result.skipped.length) console.log(`Skipped: ${result.skipped.join(', ')}`);

        if (!result.added.length && !result.updated.length && !result.skipped.length) {
          console.log('Nothing to patch.');
        }
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });
}
