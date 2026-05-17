import * as fs from 'fs';
import * as path from 'path';
import { parseVaultFile, writeVaultFile, resolveVaultPath } from '../vault';
import { decryptFromString } from '../crypto';
import { getKey } from '../keys';

export interface PipelineStep {
  command: string;
  args: Record<string, string>;
}

export interface PipelineDefinition {
  name: string;
  steps: PipelineStep[];
}

export function resolvePipelinePath(vaultPath: string): string {
  return path.join(path.dirname(vaultPath), '.envault-pipelines.json');
}

export function loadPipelines(vaultPath: string): PipelineDefinition[] {
  const pipelinePath = resolvePipelinePath(vaultPath);
  if (!fs.existsSync(pipelinePath)) return [];
  try {
    return JSON.parse(fs.readFileSync(pipelinePath, 'utf-8'));
  } catch {
    return [];
  }
}

export function savePipelines(vaultPath: string, pipelines: PipelineDefinition[]): void {
  const pipelinePath = resolvePipelinePath(vaultPath);
  fs.writeFileSync(pipelinePath, JSON.stringify(pipelines, null, 2), 'utf-8');
}

export async function runPipeline(
  pipelineName: string,
  vaultPath: string,
  masterKey: string
): Promise<{ ran: string[]; errors: string[] }> {
  const pipelines = loadPipelines(vaultPath);
  const pipeline = pipelines.find((p) => p.name === pipelineName);
  if (!pipeline) throw new Error(`Pipeline "${pipelineName}" not found.`);

  const ran: string[] = [];
  const errors: string[] = [];

  for (const step of pipeline.steps) {
    try {
      await executeStep(step, vaultPath, masterKey);
      ran.push(step.command);
    } catch (err: any) {
      errors.push(`${step.command}: ${err.message}`);
      break;
    }
  }

  return { ran, errors };
}

async function executeStep(
  step: PipelineStep,
  vaultPath: string,
  masterKey: string
): Promise<void> {
  const vault = parseVaultFile(vaultPath);
  const env = step.args['env'] || 'default';
  const entry = vault.entries[env];
  if (!entry) throw new Error(`Env "${env}" not found in vault.`);

  const keyId = entry.keyId;
  const rawKey = getKey(keyId);
  if (!rawKey) throw new Error(`Key "${keyId}" not found in keystore.`);

  const decrypted = await decryptFromString(entry.ciphertext, rawKey);
  if (!decrypted) throw new Error(`Failed to decrypt env "${env}".`);
  // Step execution is a no-op placeholder for extensibility
}

export function addPipeline(vaultPath: string, pipeline: PipelineDefinition): void {
  const pipelines = loadPipelines(vaultPath);
  const existing = pipelines.findIndex((p) => p.name === pipeline.name);
  if (existing >= 0) {
    pipelines[existing] = pipeline;
  } else {
    pipelines.push(pipeline);
  }
  savePipelines(vaultPath, pipelines);
}

export function removePipeline(vaultPath: string, name: string): boolean {
  const pipelines = loadPipelines(vaultPath);
  const filtered = pipelines.filter((p) => p.name !== name);
  if (filtered.length === pipelines.length) return false;
  savePipelines(vaultPath, filtered);
  return true;
}
