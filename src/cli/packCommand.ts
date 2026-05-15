import { Command } from 'commander';
import * as path from 'path';
import { packVault, unpackVault } from '../commands/pack';

export function registerPackCommands(program: Command): void {
  const pack = program
    .command('pack')
    .description('Pack and unpack vault environments into portable archive files');

  pack
    .command('create')
    .description('Pack vault environments into a compressed archive')
    .option('-d, --dir <path>', 'vault directory', process.cwd())
    .option('-o, --output <file>', 'output pack file path')
    .option('-e, --env <envs...>', 'environments to include (default: all)')
    .action(async (opts) => {
      try {
        const result = await packVault('', {
          vaultDir: opts.dir,
          output: opts.output,
          environments: opts.env,
        });
        console.log(`✔ Packed ${result.environments.length} environment(s), ${result.entryCount} entries`);
        console.log(`  → ${path.relative(process.cwd(), result.outputPath)} (${result.sizeBytes} bytes)`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`✖ Pack failed: ${msg}`);
        process.exitCode = 1;
      }
    });

  pack
    .command('extract <file>')
    .description('Extract a pack file into a vault directory')
    .option('-d, --dir <path>', 'target vault directory', process.cwd())
    .action(async (file: string, opts) => {
      try {
        const packFile = path.resolve(opts.dir, file);
        const result = await unpackVault(packFile, opts.dir);
        console.log(`✔ Extracted ${result.environments.length} environment(s), ${result.entryCount} entries`);
        result.environments.forEach((e) => console.log(`  • ${e}`));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`✖ Extract failed: ${msg}`);
        process.exitCode = 1;
      }
    });
}
