import { Command } from 'commander';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { registerTemplateCommands } from '../templateCommand';
import { writeVaultFile } from '../../vault';
import { encryptToString } from '../../crypto';

const MASTER_KEY = 'template-cmd-test-key-567890abcd';

function makeProgram() {
  const program = new Command();
  program.exitOverride();
  registerTemplateCommands(program);
  return program;
}

async function makeTmpDir(): Promise<{ dir: string; vaultPath: string }> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'envault-tmplcmd-'));
  const vaultPath = path.join(dir, 'vault.json');

  const encVal = await encryptToString('hello-world', MASTER_KEY);
  writeVaultFile(vaultPath, {
    version: 1,
    environments: {
      staging: { GREETING: encVal },
    },
  });

  return { dir, vaultPath };
}

describe('registerTemplateCommands - render', () => {
  it('renders template file to output path', async () => {
    const { dir, vaultPath } = await makeTmpDir();
    const tmplPath = path.join(dir, 'hello.tmpl');
    const outPath = path.join(dir, 'hello.txt');
    fs.writeFileSync(tmplPath, 'Value is: {{ GREETING }}');

    const program = makeProgram();
    await program.parseAsync([
      'template', 'render', tmplPath,
      '-e', 'staging',
      '-o', outPath,
      '--master-key', MASTER_KEY,
      '--vault', vaultPath,
    ], { from: 'user' });

    const written = fs.readFileSync(outPath, 'utf-8');
    expect(written).toBe('Value is: hello-world');
  });

  it('exits with error for missing environment', async () => {
    const { dir, vaultPath } = await makeTmpDir();
    const tmplPath = path.join(dir, 'hello.tmpl');
    const outPath = path.join(dir, 'out.txt');
    fs.writeFileSync(tmplPath, '{{ GREETING }}');

    const program = makeProgram();
    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit'); });

    await expect(
      program.parseAsync([
        'template', 'render', tmplPath,
        '-e', 'nonexistent',
        '-o', outPath,
        '--master-key', MASTER_KEY,
        '--vault', vaultPath,
      ], { from: 'user' })
    ).rejects.toThrow('exit');

    mockExit.mockRestore();
  });
});

describe('registerTemplateCommands - preview', () => {
  it('prints rendered content to stdout', async () => {
    const { dir, vaultPath } = await makeTmpDir();
    const tmplPath = path.join(dir, 'preview.tmpl');
    fs.writeFileSync(tmplPath, 'GREETING={{ GREETING }}');

    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const program = makeProgram();

    await program.parseAsync([
      'template', 'preview', tmplPath,
      '-e', 'staging',
      '--master-key', MASTER_KEY,
      '--vault', vaultPath,
    ], { from: 'user' });

    expect(logSpy).toHaveBeenCalledWith('GREETING=hello-world');
    logSpy.mockRestore();
  });
});
