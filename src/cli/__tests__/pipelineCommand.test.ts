import { Command } from 'commander';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { registerPipelineCommands } from '../pipelineCommand';
import { savePipelines } from '../../commands/pipeline';

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'envault-pipelinecmd-'));
}

function makeProgram(vaultPath: string): Command {
  const program = new Command();
  program.exitOverride();
  registerPipelineCommands(program);
  return program;
}

describe('pipelineCommand', () => {
  let tmpDir: string;
  let vaultPath: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    vaultPath = path.join(tmpDir, 'vault.json');
    fs.writeFileSync(vaultPath, JSON.stringify({ entries: {} }), 'utf-8');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('lists pipelines — empty', () => {
    const program = makeProgram(vaultPath);
    const logs: string[] = [];
    jest.spyOn(console, 'log').mockImplementation((m) => logs.push(m));
    program.parse(['node', 'envault', 'pipeline', 'list', '-v', vaultPath]);
    expect(logs.some((l) => l.includes('No pipelines'))).toBe(true);
    jest.restoreAllMocks();
  });

  it('lists pipelines — with entries', () => {
    savePipelines(vaultPath, [
      { name: 'deploy', steps: [{ command: 'sync', args: { env: 'prod' } }] },
    ]);
    const program = makeProgram(vaultPath);
    const logs: string[] = [];
    jest.spyOn(console, 'log').mockImplementation((m) => logs.push(m));
    program.parse(['node', 'envault', 'pipeline', 'list', '-v', vaultPath]);
    expect(logs.some((l) => l.includes('deploy'))).toBe(true);
    jest.restoreAllMocks();
  });

  it('adds a pipeline', () => {
    const program = makeProgram(vaultPath);
    const logs: string[] = [];
    jest.spyOn(console, 'log').mockImplementation((m) => logs.push(m));
    program.parse(['node', 'envault', 'pipeline', 'add', 'ci', 'sync:staging', '-v', vaultPath]);
    expect(logs.some((l) => l.includes('ci'))).toBe(true);
    jest.restoreAllMocks();
  });

  it('removes a pipeline', () => {
    savePipelines(vaultPath, [{ name: 'ci', steps: [] }]);
    const program = makeProgram(vaultPath);
    const logs: string[] = [];
    jest.spyOn(console, 'log').mockImplementation((m) => logs.push(m));
    program.parse(['node', 'envault', 'pipeline', 'remove', 'ci', '-v', vaultPath]);
    expect(logs.some((l) => l.includes('removed'))).toBe(true);
    jest.restoreAllMocks();
  });

  it('errors when removing non-existent pipeline', () => {
    const program = makeProgram(vaultPath);
    const errors: string[] = [];
    jest.spyOn(console, 'error').mockImplementation((m) => errors.push(m));
    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit'); });
    expect(() =>
      program.parse(['node', 'envault', 'pipeline', 'remove', 'ghost', '-v', vaultPath])
    ).toThrow();
    expect(errors.some((e) => e.includes('not found'))).toBe(true);
    jest.restoreAllMocks();
    mockExit.mockRestore();
  });
});
