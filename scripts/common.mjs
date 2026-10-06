import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
export const root = path.resolve(import.meta.dirname, '..');
export const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
export const hashFile = async file => hash(await fs.readFile(file));
export const readJson = async file => JSON.parse(await fs.readFile(file, 'utf8'));
export const writeJson = async (file, value) => { await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, JSON.stringify(value, null, 2) + '\n'); };
export const git = (cwd, ...args) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }).trim();
export function argsOf() {
  const args = Object.create(null);
  for (let i = 2; i < process.argv.length; i += 2) {
    if (!process.argv[i]?.startsWith('--') || !process.argv[i + 1]) throw new Error('Expected --name value pairs');
    args[process.argv[i].slice(2)] = process.argv[i + 1];
  }
  return args;
}

// esbuild creates this exact virtual module for the trusted object-valued define.
// All other inputs, including unknown pseudo-inputs, must resolve to real files.
export async function resolveMetafileInputs(metafile, directory) {
  const files = Object.keys(metafile.inputs).filter(file => file !== '<define:__VALIDATION_PROVENANCE__>');
  return Promise.all(files.map(file => fs.realpath(path.resolve(directory, file))));
}
