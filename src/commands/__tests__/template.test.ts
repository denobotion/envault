import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { renderTemplate, renderTemplateFile } from '../template';
import { writeVaultFile } from '../../vault';
import { encryptToString } from '../../crypto';

const MASTER_KEY = 'test-master-key-for-template-1234';

async function makeTmpVault(): Promise<string> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'envault-template-'));
  const vaultPath = path.join(dir, 'vault.json');

  const encA = await encryptToString('http://localhost:3000', MASTER_KEY);
  const encB = await encryptToString('supersecret', MASTER_KEY);
  const encC = await encryptToString('postgres://localhost/db', MASTER_KEY);

  writeVaultFile(vaultPath, {
    version: 1,
    environments: {
      dev: {
        APP_URL: encA,
        SECRET_KEY: encB,
        DATABASE_URL: encC,
      },
    },
  });

  return vaultPath;
}

describe('renderTemplate', () => {
  it('replaces all known placeholders', async () => {
    const vaultPath = await makeTmpVault();
    const tmpl = 'URL={{ APP_URL }} KEY={{ SECRET_KEY }}';
    const result = await renderTemplate(tmpl, 'dev', MASTER_KEY, vaultPath);
    expect(result.output).toBe('URL=http://localhost:3000 KEY=supersecret');
    expect(result.missing).toHaveLength(0);
  });

  it('tracks missing keys and leaves them unreplaced', async () => {
    const vaultPath = await makeTmpVault();
    const tmpl = 'URL={{ APP_URL }} MISSING={{ UNKNOWN_KEY }}';
    const result = await renderTemplate(tmpl, 'dev', MASTER_KEY, vaultPath);
    expect(result.output).toContain('URL=http://localhost:3000');
    expect(result.output).toContain('{{UNKNOWN_KEY}}');
    expect(result.missing).toContain('UNKNOWN_KEY');
  });

  it('returns empty output for empty template string', async () => {
    const vaultPath = await makeTmpVault();
    const result = await renderTemplate('', 'dev', MASTER_KEY, vaultPath);
    expect(result.output).toBe('');
    expect(result.missing).toHaveLength(0);
  });

  it('throws if environment does not exist', async () => {
    const vaultPath = await makeTmpVault();
    await expect(
      renderTemplate('{{ APP_URL }}', 'production', MASTER_KEY, vaultPath)
    ).rejects.toThrow('Environment "production" not found');
  });
});

describe('renderTemplateFile', () => {
  it('reads template file and writes rendered output', async () => {
    const vaultPath = await makeTmpVault();
    const dir = path.dirname(vaultPath);
    const tmplPath = path.join(dir, 'app.conf.tmpl');
    const outPath = path.join(dir, 'app.conf');

    fs.writeFileSync(tmplPath, 'DATABASE={{ DATABASE_URL }}\nSECRET={{ SECRET_KEY }}');

    const result = await renderTemplateFile(tmplPath, outPath, 'dev', MASTER_KEY, vaultPath);

    expect(result.missing).toHaveLength(0);
    const written = fs.readFileSync(outPath, 'utf-8');
    expect(written).toContain('DATABASE=postgres://localhost/db');
    expect(written).toContain('SECRET=supersecret');
  });

  it('throws if template file does not exist', async () => {
    const vaultPath = await makeTmpVault();
    await expect(
      renderTemplateFile('/nonexistent/file.tmpl', '/tmp/out.txt', 'dev', MASTER_KEY, vaultPath)
    ).rejects.toThrow('Template file not found');
  });
});
