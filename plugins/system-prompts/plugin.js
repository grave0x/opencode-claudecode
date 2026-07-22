// system-prompts — opencode plugin
//
// Registers system-prompt management tools into the agent's toolchain.
// Handles lifecycle hooks for prompt injection and session context.
//
// Plugin API used:
//   - chat.message: intercept /prompt commands and route to CLI
//   - tool.register: expose system.prompt.* tools
//   - experimental.chat.system.transform: append active prompt to system

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const CLI = path.join(ROOT, 'tools', 'system-prompts.js');
const STATE_DIR = path.join(os.homedir(), '.config', 'opencode', '.system-prompt');
const ACTIVE_FILE = path.join(STATE_DIR, 'active');

function ensureStateDir() {
  if (!existsSync(STATE_DIR)) {
    mkdirSync(STATE_DIR, { recursive: true });
  }
}

function readActivePrompt() {
  try {
    return readFileSync(ACTIVE_FILE, 'utf8').trim() || null;
  } catch {
    return null;
  }
}

function setActivePrompt(id) {
  ensureStateDir();
  writeFileSync(ACTIVE_FILE, id, 'utf8');
}

function clearActivePrompt() {
  try {
    writeFileSync(ACTIVE_FILE, '', 'utf8');
  } catch {}
}

function runCLI(args) {
  return execSync(`node "${CLI}" ${args}`, {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 60000,
    maxBuffer: 1024 * 1024,
  });
}

// ─── Plugin Hooks ───────────────────────────────────────────────────────

export const name = 'system-prompts';
export const version = '1.0.0';

export async function onChatMessage(message, context) {
  if (!message || typeof message !== 'string') return null;
  const trimmed = message.trim();
  const match = trimmed.match(/^\/prompt\s+(.+)/);
  if (!match) return null;

  const args = match[1].trim();

  // Track "use" subcommand
  const useMatch = args.match(/^use\s+(\S+)/);
  if (useMatch) {
    setActivePrompt(useMatch[1]);
  }

  try {
    const result = runCLI(args);
    return {
      type: 'tool-result',
      tool: 'system.prompt',
      result,
    };
  } catch (e) {
    return {
      type: 'tool-result',
      tool: 'system.prompt',
      result: `Error: ${e.message}`,
    };
  }
}

export async function onToolRegister() {
  return [
    {
      name: 'system.prompt.list',
      description: 'List all registered system prompts in the registry, optionally filtered by tag',
      handler: async (args) => runCLI(`list${args.tag ? ` --tag ${args.tag}` : ''}`),
      parameters: {
        type: 'object',
        properties: {
          tag: { type: 'string', description: 'Filter by tag (e.g. anthropic, openai, leaked)' },
        },
      },
    },
    {
      name: 'system.prompt.view',
      description: 'View a system prompt\'s metadata and raw content',
      handler: async (args) => runCLI(`view "${args.id}"${args.patterns ? ' --patterns' : ''}`),
      parameters: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', description: 'Prompt ID from registry' },
          patterns: { type: 'boolean', description: 'Also show key patterns file' },
        },
      },
    },
    {
      name: 'system.prompt.fetch',
      description: 'Download raw prompt from its remote source URL to local cache',
      handler: async (args) => runCLI(`fetch ${args.all ? '--all' : `"${args.id}"`}`),
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Prompt ID to fetch' },
          all: { type: 'boolean', description: 'Fetch all uncached prompts' },
        },
      },
    },
    {
      name: 'system.prompt.search',
      description: 'Search across all prompt metadata and raw content for a query string',
      handler: async (args) => runCLI(`search "${args.query}"`),
      parameters: {
        type: 'object',
        required: ['query'],
        properties: {
          query: { type: 'string', description: 'Search term' },
        },
      },
    },
    {
      name: 'system.prompt.compare',
      description: 'Compare two prompts side by side (metadata and first lines)',
      handler: async (args) => runCLI(`compare "${args.id1}" "${args.id2}"`),
      parameters: {
        type: 'object',
        required: ['id1', 'id2'],
        properties: {
          id1: { type: 'string', description: 'First prompt ID' },
          id2: { type: 'string', description: 'Second prompt ID' },
        },
      },
    },
    {
      name: 'system.prompt.use',
      description: 'Load a prompt as the active reference prompt for this session',
      handler: async (args) => {
        setActivePrompt(args.id);
        return runCLI(`use "${args.id}"`);
      },
      parameters: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', description: 'Prompt ID to activate' },
        },
      },
    },
    {
      name: 'system.prompt.create',
      description: 'Create a new prompt entry from a URL or local file',
      handler: async (args) => {
        let cmd = `create "${args.id}"`;
        if (args.url) cmd += ` --url "${args.url}"`;
        if (args.file) cmd += ` --file "${args.file}"`;
        return runCLI(cmd);
      },
      parameters: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', description: 'New prompt ID' },
          url: { type: 'string', description: 'Source URL to fetch from' },
          file: { type: 'string', description: 'Local file path to read from' },
        },
      },
    },
    {
      name: 'system.prompt.export',
      description: 'Export a prompt to a local file in md, json, or txt format',
      handler: async (args) => runCLI(`export "${args.id}"${args.format ? ` --format ${args.format}` : ''}`),
      parameters: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', description: 'Prompt ID' },
          format: { type: 'string', enum: ['md', 'json', 'txt'], description: 'Export format (default: md)' },
        },
      },
    },
    {
      name: 'system.prompt.remove',
      description: 'Delete a prompt from the registry and remove its cached files',
      handler: async (args) => {
        if (readActivePrompt() === args.id) clearActivePrompt();
        return runCLI(`remove "${args.id}"`);
      },
      parameters: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', description: 'Prompt ID to remove' },
        },
      },
    },
    // ── Market tools ─────────────────────────────────────────────────
    {
      name: 'system.prompt.market.list',
      description: 'List available prompts from the YeeKal/leaked-system-prompts market (116 prompts, 33 companies)',
      handler: async (args) => {
        let cmd = 'market list';
        if (args.company) cmd += ` --company ${args.company}`;
        if (args.tag) cmd += ` --tag ${args.tag}`;
        return runCLI(cmd);
      },
      parameters: {
        type: 'object',
        properties: {
          company: { type: 'string', description: 'Filter by company (e.g. anthropic, openai, xai, google)' },
          tag: { type: 'string', description: 'Filter by tag (e.g. frontier, coding-agent, reasoning)' },
        },
      },
    },
    {
      name: 'system.prompt.market.search',
      description: 'Search the market index for available prompts by name, company, or tags',
      handler: async (args) => runCLI(`market search "${args.query}"`),
      parameters: {
        type: 'object',
        required: ['query'],
        properties: {
          query: { type: 'string', description: 'Search term' },
        },
      },
    },
    {
      name: 'system.prompt.market.info',
      description: 'Show detailed information about a market prompt',
      handler: async (args) => runCLI(`market info "${args.id}"`),
      parameters: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', description: 'Market prompt ID (use market.list to find)' },
        },
      },
    },
    {
      name: 'system.prompt.market.download',
      description: 'Download a prompt from the market and register it locally',
      handler: async (args) => runCLI(`market download ${args.all ? '--all' : `"${args.id}"`}`),
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Market prompt ID to download' },
          all: { type: 'boolean', description: 'Download all market prompts' },
        },
      },
    },
    {
      name: 'system.prompt.market.cache',
      description: 'Force refresh the local market index from GitHub',
      handler: async () => runCLI('market cache'),
      parameters: { type: 'object', properties: {} },
    },
  ];
}

export async function onSystemTransform(systemPrompt) {
  const active = readActivePrompt();
  if (!active) return systemPrompt;

  const regPath = path.join(ROOT, 'system-prompts', 'registry.json');
  if (!existsSync(regPath)) return systemPrompt;

  const reg = JSON.parse(readFileSync(regPath, 'utf8'));
  const p = reg.prompts.find(x => x.id === active);
  if (!p || !p.local_path) return systemPrompt;

  const rawFile = path.join(ROOT, 'system-prompts', p.local_path);
  if (!existsSync(rawFile)) return systemPrompt;

  const raw = readFileSync(rawFile, 'utf8');
  // Skip injection for very large prompts to avoid context bloat
  if (raw.length > 50000) return systemPrompt;

  return `${systemPrompt}\n\n<!-- Active Reference Prompt: ${p.name} -->\n${raw}\n<!-- /Active Reference Prompt -->\n`;
}
