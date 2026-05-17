import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { addPipeline, loadPipelines, removePipeline, savePipelines } from '../pipeline';

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'envault-pipeline-int-'));
}

describe('pipeline integration', () => {
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

  it('full lifecycle: add, list, overwrite, remove', () => {
    addPipeline(vaultPath, {
      name: 'release',
      steps: [
        { command: 'sync', args: { env: 'production' } },
        { command: 'verify', args: { env: 'production' } },
      ],
    });

    let pipelines = loadPipelines(vaultPath);
    expect(pipelines).toHaveLength(1);
    expect(pipelines[0].steps).toHaveLength(2);

    // Overwrite with fewer steps
    addPipeline(vaultPath, {
      name: 'release',
      steps: [{ command: 'sync', args: { env: 'staging' } }],
    });

    pipelines = loadPipelines(vaultPath);
    expect(pipelines).toHaveLength(1);
    expect(pipelines[0].steps).toHaveLength(1);
    expect(pipelines[0].steps[0].args.env).toBe('staging');

    const removed = removePipeline(vaultPath, 'release');
    expect(removed).toBe(true);
    expect(loadPipelines(vaultPath)).toHaveLength(0);
  });

  it('handles multiple pipelines independently', () => {
    addPipeline(vaultPath, { name: 'alpha', steps: [] });
    addPipeline(vaultPath, { name: 'beta', steps: [{ command: 'sync', args: {} }] });
    addPipeline(vaultPath, { name: 'gamma', steps: [] });

    let pipelines = loadPipelines(vaultPath);
    expect(pipelines).toHaveLength(3);

    removePipeline(vaultPath, 'beta');
    pipelines = loadPipelines(vaultPath);
    expect(pipelines).toHaveLength(2);
    expect(pipelines.map((p) => p.name)).toEqual(['alpha', 'gamma']);
  });

  it('pipeline file is valid JSON after multiple writes', () => {
    for (let i = 0; i < 5; i++) {
      addPipeline(vaultPath, { name: `p${i}`, steps: [{ command: 'sync', args: { env: `env${i}` } }] });
    }
    const pipelinePath = path.join(tmpDir, '.envault-pipelines.json');
    expect(() => JSON.parse(fs.readFileSync(pipelinePath, 'utf-8'))).not.toThrow();
    expect(loadPipelines(vaultPath)).toHaveLength(5);
  });
});
