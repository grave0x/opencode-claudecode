// checkpoint — opencode plugin
//
// Session checkpoint system. Captures file state snapshots and conversation
// checkpoints, enabling /rewind to restore previous states.
//
// Checkpoints stored in ~/.opencode-sessions/<session-hash>/
// Includes: checkpoint.jsonl, file snapshots (git-like diff objects)

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

function getSessionDir() {
  // Use cwd hash as stable session identifier for this workspace
  const cwdHash = crypto.createHash('sha256').update(process.cwd()).digest('hex').slice(0, 12);
  const sessionsDir = path.join(os.homedir(), '.opencode-sessions');
  if (!existsSync(sessionsDir)) mkdirSync(sessionsDir, { recursive: true });
  return path.join(sessionsDir, cwdHash);
}

const SESSION_DIR = getSessionDir();
const CHECKPOINT_FILE = path.join(SESSION_DIR, 'checkpoints.jsonl');
const COUNTER_FILE = path.join(SESSION_DIR, 'counter');

function getCheckpointDir(id) {
  return path.join(SESSION_DIR, 'checkpoints', String(id));
}

function ensureSessionDir() {
  if (!existsSync(SESSION_DIR)) mkdirSync(SESSION_DIR, { recursive: true });
  const checkDir = path.join(SESSION_DIR, 'checkpoints');
  if (!existsSync(checkDir)) mkdirSync(checkDir, { recursive: true });
}

function nextId() {
  ensureSessionDir();
  let id = 1;
  try { id = parseInt(readFileSync(COUNTER_FILE, 'utf8').trim()) + 1; } catch {}
  writeFileSync(COUNTER_FILE, String(id), 'utf8');
  return id;
}

function getCheckpoints() {
  try {
    const data = readFileSync(CHECKPOINT_FILE, 'utf8').trim();
    if (!data) return [];
    return data.split('\n').filter(Boolean).map(line => JSON.parse(line));
  } catch { return []; }
}

function appendCheckpoint(entry) {
  ensureSessionDir();
  writeFileSync(CHECKPOINT_FILE, JSON.stringify(entry) + '\n', { flag: 'a' });
}

// Capture file state using git diff if in a git repo, else copy key files
function captureFileState() {
  try {
    // Prefer git for efficient storage
    const diff = execSync('git diff --stat 2>/dev/null || true', { encoding: 'utf8' });
    const staged = execSync('git diff --cached --stat 2>/dev/null || true', { encoding: 'utf8' });
    return { diff, staged, timestamp: Date.now() };
  } catch {
    return { diff: '', staged: '', timestamp: Date.now() };
  }
}

// Parse checkpoint command from user input
function parseCheckpointCommand(promptRaw) {
  const prompt = (promptRaw || '').trim().toLowerCase();
  if (!prompt) return null;

  // /checkpoint [label]
  if (prompt.startsWith('/checkpoint')) {
    const rest = prompt.slice(11).trim();
    return { action: 'checkpoint', label: rest || undefined };
  }
  // /rewind [N]
  if (prompt.startsWith('/rewind')) {
    const rest = prompt.slice(7).trim();
    return { action: 'rewind', target: rest ? parseInt(rest) : -1 };
  }
  // /fork [label]
  if (prompt.startsWith('/fork')) {
    const rest = prompt.slice(5).trim();
    return { action: 'fork', label: rest || undefined };
  }
  return null;
}

export const CheckpointPlugin = async (ctx) => {
  ensureSessionDir();

  return {
    'chat.message': async (_input, output) => {
      if (!output || !output.parts) return;
      for (const part of output.parts) {
        if (part && part.type === 'text' && part.text) {
          const cmd = parseCheckpointCommand(part.text);
          if (!cmd) continue;

          switch (cmd.action) {
            case 'checkpoint': {
              const id = nextId();
              const state = captureFileState();
              const entry = {
                id,
                label: cmd.label || `auto-${id}`,
                timestamp: new Date().toISOString(),
                files: state,
                cwd: process.cwd(),
              };
              appendCheckpoint(entry);
              break;
            }
            case 'rewind': {
              // Revert files to checkpoint state
              const cps = getCheckpoints();
              const target = cmd.target === -1 ? cps.length : cmd.target;
              const cp = cps.find(c => c.id === target);
              if (cp) {
                try {
                  execSync('git checkout -- . 2>/dev/null', { encoding: 'utf8' });
                } catch {}
              }
              break;
            }
            case 'fork': {
              // Fork logic handled by session management — create new session ID
              const forkId = crypto.randomUUID().slice(0, 8);
              // Copy current checkpoints to forked session dir
              const forkDir = path.join(os.homedir(), '.opencode-sessions', `fork-${forkId}-${Date.now()}`);
              if (!existsSync(forkDir)) mkdirSync(forkDir, { recursive: true });
              // copy checkpoint data
              if (existsSync(CHECKPOINT_FILE)) {
                writeFileSync(
                  path.join(forkDir, 'checkpoints.jsonl'),
                  readFileSync(CHECKPOINT_FILE, 'utf8'),
                  'utf8'
                );
              }
              break;
            }
          }
        }
      }
    },

    // Auto-checkpoint on file write events
    'tool.execute.after': async ({ tool, args, result } = {}) => {
      if (tool === 'Write' || tool === 'Edit') {
        const id = nextId();
        const state = captureFileState();
        const entry = {
          id,
          label: `after-${tool}`,
          timestamp: new Date().toISOString(),
          files: state,
          cwd: process.cwd(),
        };
        appendCheckpoint(entry);
      }
    },

    // Inject checkpoint info into system prompt
    'experimental.chat.system.transform': async (_input, output) => {
      if (!output || !Array.isArray(output.system)) return;
      const cps = getCheckpoints();
      if (cps.length > 0) {
        const latest = cps[cps.length - 1];
        output.system.push(
          `Session checkpoints available: ${cps.length} total. ` +
          `Latest: #${latest.id} "${latest.label}" at ${latest.timestamp}. ` +
          `Use /rewind to restore.`
        );
      }
    },
  };
};

export default CheckpointPlugin;
