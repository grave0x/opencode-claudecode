// auto-approve — opencode plugin
//
// Permission mode state machine. Controls when tools auto-execute vs require
// approval. Modes: manual, acceptEdits, plan, auto, yolo.
//
// Commands: /yolo (cycle), /permissions <mode> (set specific)

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const MODES = ['manual', 'acceptEdits', 'plan', 'auto', 'yolo'];

function opencodeConfigDir() {
  if (process.env.XDG_CONFIG_HOME) {
    return path.join(process.env.XDG_CONFIG_HOME, 'opencode');
  }
  return path.join(os.homedir(), '.config', 'opencode');
}

const STATE_DIR = path.join(opencodeConfigDir(), '.auto-approve');
const MODE_FILE = path.join(STATE_DIR, 'mode');

function ensureDir() {
  if (!existsSync(STATE_DIR)) mkdirSync(STATE_DIR, { recursive: true });
}

function getMode() {
  try { return readFileSync(MODE_FILE, 'utf8').trim(); }
  catch { return 'manual'; }
}

function setMode(m) {
  ensureDir();
  writeFileSync(MODE_FILE, m, 'utf8');
}

// For auto mode: simple classifier of tool safety
function isAllowedInAutoMode(tool, args) {
  const readTools = ['Read', 'read', 'Glob', 'glob', 'Grep', 'grep', 'ListDir', 'ls', 'List', 'WebSearch', 'webSearch', 'websearch'];
  const safeWriteTools = ['Write', 'write', 'Edit', 'edit'];

  if (readTools.includes(tool)) return true;

  if (tool === 'Bash' || tool === 'bash' || tool === 'shell') {
    const cmd = (args && args.command) || '';
    const safeCommands = ['npm test', 'npm run', 'tsc ', 'eslint ', 'prettier ', 'vitest ', 'jest '];
    if (safeCommands.some(s => cmd.startsWith(s))) return true;
    return false;
  }

  // For acceptEdits mode: allow file writes
  // For plan mode: block everything
  // For yolo: allow everything

  return false;
}

function parsePermissionsCommand(promptRaw) {
  const prompt = (promptRaw || '').trim().toLowerCase();

  // /yolo
  if (prompt === '/yolo') return { action: 'cycle' };

  // /permissions <mode>
  const match = prompt.match(/^\/permissions\s+(\w+)/);
  if (match) {
    const mode = match[1];
    if (MODES.includes(mode)) return { action: 'set', mode };
  }

  // /permissions (show current)
  if (prompt === '/permissions') return { action: 'show' };

  return null;
}

export const AutoApprovePlugin = async (ctx) => {
  ensureDir();
  if (!existsSync(MODE_FILE)) setMode('manual');

  return {
    'tool.execute.before': async ({ tool, args, info } = {}) => {
      const mode = getMode();
      if (mode === 'yolo') return; // Allow everything
      if (mode === 'acceptEdits') {
        if (tool === 'Bash') {
          const cmd = (args && args.command) || '';
          const unsafe = ['sudo', 'rm -rf', 'git push', 'git reset'];
          if (unsafe.some(u => cmd.includes(u))) {
            return { deny: true, reason: `acceptEdits mode blocks: ${cmd}` };
          }
        }
        return; // Allow writes and safe commands
      }
      if (mode === 'plan') {
        // Block all mutating tools — plan mode only
        const mutatingTools = ['Write', 'Edit', 'Bash'];
        if (mutatingTools.includes(tool)) {
          return { deny: true, reason: 'Plan mode active. Use /approve to proceed.' };
        }
        return;
      }
      if (mode === 'auto') {
        if (!isAllowedInAutoMode(tool, args)) {
          return { deny: true, reason: `Auto mode blocks: ${tool}. Use /yolo or /permissions to change mode.` };
        }
        return;
      }
      // manual — do nothing, let default approval flow handle
    },

    'chat.message': async (_input, output) => {
      if (!output || !output.parts) return;
      for (const part of output.parts) {
        if (part && part.type === 'text' && part.text) {
          const cmd = parsePermissionsCommand(part.text);
          if (!cmd) continue;

          switch (cmd.action) {
            case 'cycle': {
              const cur = getMode();
              const idx = (MODES.indexOf(cur) + 1) % MODES.length;
              setMode(MODES[idx]);
              break;
            }
            case 'set':
              setMode(cmd.mode);
              break;
            case 'show':
              // mode displayed via system transform
              break;
          }
        }
      }
    },

    'experimental.chat.system.transform': async (_input, output) => {
      if (!output || !Array.isArray(output.system)) return;
      const mode = getMode();
      output.system.push(`PERMISSION MODE: ${mode}. Use /yolo to cycle, /permissions <mode> to set.`);
    },
  };
};

export default AutoApprovePlugin;
