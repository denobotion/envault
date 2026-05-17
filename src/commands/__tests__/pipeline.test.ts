import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  loadPipelines,
  savePipelines,
  addPipeline,
  removePipeline,
  resolvePipelinePath,
  PipelineDefinition,
} from '../pipeline';

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'envault-pipeline-'));
}

describe('pipeline', () => {
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

  it('returns empty array when no pipeline file exists', () => {
    expect(loadPipelines(vaultPath)).toEqual([]);
  });

  it('saves and loads pipelines', () => {
    const pipelines: PipelineDefinition[] = [
      { name: 'deploy', steps: [{ command: 'sync', args: { env: 'production' } }] },
    ];
    savePipelines(vaultPath, pipelines);
    expect(loadPipelines(vaultPath)).toEqual(pipelines);
  });

  it('adds a new pipeline', () => {
    const pipeline: PipelineDefinition = {
      name: 'ci',
      steps: [{ command: 'verify', args: { env: 'staging' } }],
    };
    addPipeline(vaultPath, pipeline);
    const loaded = loadPipelines(vaultPath);
    expect(loaded).toHaveLength(1);
    expect(loaded[0].name).toBe('ci');
  });

  it('overwrites existing pipeline with same name', () => {
    const p1: PipelineDefinition = { name: 'ci', steps: [{ command: 'sync', args: {} }] };
    const p2: PipelineDefinition = { name: 'ci', steps: [{ command: 'verify', args: {} }] };
    addPipeline(vaultPath, p1);
    addPipeline(vaultPath, p2);
    const loaded = loadPipelines(vaultPath);
    expect(loaded).toHaveLength(1);
    expect(loaded[0].steps[0].command).toBe('verify');
  });

  it('removes an existing pipeline', () => {
    addPipeline(vaultPath, { name: 'deploy', steps: [] });
    const removed = removePipeline(vaultPath, 'deploy');
    expect(removed).toBe(true);
    expect(loadPipelines(vaultPath)).toHaveLength(0);
  });

  it('returns false when removing non-existent pipeline', () => {
    const removed = removePipeline(vaultPath, 'ghost');
    expect(removed).toBe(false);
  });

  it('resolves pipeline path relative to vault', () => {
    const pipelinePath = resolvePipelinePath(vaultPath);
    expect(pipelinePath).toBe(path.join(tmpDir, '.envault-pipelines.json'));
  });
});
