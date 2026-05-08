import { Command } from 'commander';
import { restoreSnapshot } from '../commands/restore';
import { loadSnapshots, resolveSnapshotPath } from '../commands/snapshot';
import * as fs from 'fs';

export function registerRestoreCommands(program: Command): void {
  program
    .command('restore <environment> [snapshotId]')
    .description('Restore a snapshot for the given environment')
    .option('--vault <path>', 'Path to the vault file')
    .option('--snapshots <path>', 'Path to the snapshots directory')
    .option('--keystore <path>', 'Path to the keystore file')
    .option('--list', 'List available snapshots for the environment')
    .action(async (environment: string, snapshotId: string | undefined, opts) => {
      try {
        const snapshotFile = resolveSnapshotPath(opts.snapshots);

        if (opts.list) {
          if (!fs.existsSync(snapshotFile)) {
            console.log('No snapshots file found.');
            return;
          }
          const snapshots = loadSnapshots(snapshotFile);
          const envSnaps = snapshots[environment] || [];
          if (envSnaps.length === 0) {
            console.log(`No snapshots found for environment "${environment}".`);
            return;
          }
          console.log(`Snapshots for "${environment}":`);
          for (const snap of envSnaps) {
            console.log(`  [${snap.id}] ${snap.timestamp} — ${Object.keys(snap.data).length} keys`);
          }
          return;
        }

        if (!snapshotId) {
          console.error('Error: snapshotId is required unless --list is used.');
          process.exit(1);
        }

        const result = await restoreSnapshot(environment, snapshotId, {
          vaultPath: opts.vault,
          snapshotDir: opts.snapshots,
          keystorePath: opts.keystore,
        });

        console.log(
          `Restored ${result.restoredKeys} key(s) for "${environment}" from snapshot taken at ${result.snapshotTimestamp}.`
        );
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });
}
