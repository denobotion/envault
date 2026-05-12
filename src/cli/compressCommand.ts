import { Command } from 'commander';
import { compressVault, decompressVault } from '../commands/compress';

export function registerCompressCommands(program: Command): void {
  program
    .command('compress <env>')
    .description('Compress an encrypted vault file using gzip')
    .option('-d, --vault-dir <dir>', 'Path to vault directory')
    .action(async (env: string, options: { vaultDir?: string }) => {
      try {
        const result = await compressVault(env, options.vaultDir);
        console.log(`✔ Compressed vault: ${env}`);
        console.log(`  Original size : ${result.originalSize} bytes`);
        console.log(`  Compressed    : ${result.compressedSize} bytes`);
        console.log(`  Reduction     : ${result.ratio}%`);
        console.log(`  Output        : ${result.vaultPath}.gz`);
      } catch (err: any) {
        console.error(`✖ ${err.message}`);
        process.exit(1);
      }
    });

  program
    .command('decompress <env>')
    .description('Decompress a gzip-compressed vault file')
    .option('-d, --vault-dir <dir>', 'Path to vault directory')
    .action(async (env: string, options: { vaultDir?: string }) => {
      try {
        const result = await decompressVault(env, options.vaultDir);
        console.log(`✔ Decompressed vault: ${env}`);
        console.log(`  Restored size : ${result.size} bytes`);
        console.log(`  Output        : ${result.vaultPath}`);
      } catch (err: any) {
        console.error(`✖ ${err.message}`);
        process.exit(1);
      }
    });
}
