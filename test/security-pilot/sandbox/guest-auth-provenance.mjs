#!/usr/bin/env node
// R2-D: records only the guest process environment's auth classification; never credential values.
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, parse, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const SENTINEL = 'mock-fixture-sentinel-not-a-real-key-0000';
const LOOPBACK = 'http://127.0.0.1:8765';
const CREDENTIAL_KEYS = [
  'ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', ['CLAUDE_CODE', 'OAUTH', 'TOKEN'].join('_'),
  'ANTHROPIC_AWS_API_KEY', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY',
  'AWS_SESSION_TOKEN', 'AWS_BEARER_TOKEN_BEDROCK', 'GOOGLE_APPLICATION_CREDENTIALS',
];
const PROVIDER_KEYS = [
  'CLAUDE_CODE_USE_BEDROCK', 'CLAUDE_CODE_USE_VERTEX', 'CLAUDE_CODE_USE_FOUNDRY',
  'CLAUDE_CODE_SKIP_BEDROCK_AUTH', 'CLAUDE_CODE_SKIP_VERTEX_AUTH',
];
const fail = (code) => { throw new Error(code); };
const present = (env, key) => typeof env[key] === 'string' && env[key].length > 0;
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex').toUpperCase();

function outputPath(path) {
  if (typeof path !== 'string' || !isAbsolute(path)) fail('ABSOLUTE_OUTPUT_REQUIRED');
  const full = resolve(path), root = parse(full).root;
  let cursor = root;
  for (const part of dirname(full).slice(root.length).split(sep).filter(Boolean)) {
    cursor = resolve(cursor, part);
    if (!existsSync(cursor)) fail('OUTPUT_PARENT_NOT_FOUND');
    if (lstatSync(cursor).isSymbolicLink()) fail('SYMLINK_PATH_REFUSED');
  }
  if (existsSync(full)) fail('OUTPUT_ALREADY_EXISTS');
  return full;
}

function observedAt(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(value) ||
      !Number.isFinite(Date.parse(value))) fail('OBSERVED_AT_INVALID');
  return value;
}

export function classifyGuestAuth(mode, env = process.env) {
  if (!['NONE', 'MOCK_ENDPOINT'].includes(mode)) fail('AUTH_MODE_REFUSED');
  const credentials = CREDENTIAL_KEYS.filter((key) => present(env, key));
  const providers = PROVIDER_KEYS.filter((key) => present(env, key));
  const baseUrl = present(env, 'ANTHROPIC_BASE_URL') ? env.ANTHROPIC_BASE_URL : null;
  if (mode === 'MOCK_ENDPOINT') {
    const mockCredentials = ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN'].filter((key) => present(env, key));
    if (baseUrl !== LOOPBACK) fail('MOCK_ENDPOINT_INVALID');
    if (mockCredentials.length !== 1 || env[mockCredentials[0]] !== SENTINEL) fail('SYNTHETIC_SENTINEL_INVALID');
    if (credentials.some((key) => !mockCredentials.includes(key)) || providers.length) fail('OTHER_AUTH_SOURCE_PRESENT');
    return { auth_mode: 'MOCK_ENDPOINT', credential_kind: 'SYNTHETIC_SENTINEL',
      endpoint_kind: 'LOOPBACK_MOCK', source: 'RUNNER_ENVIRONMENT' };
  }
  if (credentials.length || providers.length || baseUrl !== null || present(env, 'CLAUDE_CODE_API_KEY_HELPER_TTL_MS'))
    fail('AUTH_SOURCE_PRESENT_FOR_NONE');
  return { auth_mode: 'NONE', credential_kind: 'NONE', endpoint_kind: 'NONE', source: 'RUNNER_ENVIRONMENT' };
}

export function recordGuestAuthProvenance({ mode, output, env = process.env,
  now = () => new Date().toISOString() }) {
  const path = outputPath(output);
  const record = { ...classifyGuestAuth(mode, env), observed_at: observedAt(now()) };
  const bytes = Buffer.from(JSON.stringify(record, null, 2) + '\n');
  writeFileSync(path, bytes, { flag: 'wx', mode: 0o600 });
  return { record, evidence_sha256: hash(bytes) };
}

export function runCli(args = process.argv.slice(2)) {
  if (args.length !== 4 || args[0] !== '--mode' || args[2] !== '--output' || !args[1] || !args[3])
    fail('USAGE_MODE_OUTPUT_ONLY');
  const result = recordGuestAuthProvenance({ mode: args[1], output: args[3] });
  process.stdout.write(`AUTH_PROVENANCE=${result.record.auth_mode} SHA256=${result.evidence_sha256}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { runCli(); }
  catch (error) { process.stderr.write(`FAIL_CLOSED=${error.message}\n`); process.exitCode = 1; }
}
