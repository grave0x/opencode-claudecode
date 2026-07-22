// background — opencode plugin
//
// Background agent subprocess manager. Spawns headless opencode processes
// for delegated tasks. Tracks PIDs, status, output.
//
// Commands: /bg "task", /bg list, /bg attach <id>, /bg stop <id>, /bg log <id>

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

const BG_DIR = path.join(os.tmpdir(), 'opencode-bg');
const INDEX_FILE = path.join(BG_DIR, 'agents.json');

function ensureDir() {
  if (!existsSync(BG_DIR)) mkdirSync(BG_DIR, { recursive: true });
}

function getAgents() {
  try { return JSON.parse(readFileSync(INDEX_FILE, 'utf8')); }
  catch { return []; }
}

function saveAgents(agents) {
  ensureDir();
  writeFileSync(INDEX_FILE, JSON.stringify(agents, null, 2), 'utf8');
}

function createAgent(task) {
  const id = crypto.randomUUID().slice(0, 8);
  const agent = {
    id,
    task,
    status: 'running',
    pid: null,
    started: new Date().toISOString(),
    logFile: path.join(BG_DIR, `${id}.log`),
  };
  return agent;
}

// Parse /bg command
function parseBgCommand(promptRaw) {
  const prompt = (promptRaw || '').trim();
  if (!prompt.startsWith('/bg')) return null;

  const rest = prompt.slice(3).trim();

  // /bg list
  if (rest === 'list') return { action: 'list' };
  // /bg stop <id>
  const stopMatch = rest.match(/^stop\s+(\S+)/);
  if (stopMatch) return { action: 'stop', id: stopMatch[1] };
  // /bg log <id> [--tail N]
  const logMatch = rest.match(/^log\s+(\S+)(?:\s+--tail\s+(\d+))?/);
  if (logMatch) return { action: 'log', id: logMatch[1], tail: logMatch[2] ? parseInt(logMatch[2]) : undefined };
  // /bg attach <id>
  const attachMatch = rest.match(/^attach\s+(\S+)/);
  if (attachMatch) return { action: 'attach', id: attachMatch[1] };
  // /bg "task" or /bg task
  if (rest.startsWith('"')) {
    const taskMatch = rest.match(/^"(.+)"$/);
    if (taskMatch) return { action: 'spawn', task: taskMatch[1] };
  }
  if (rest && !['list', 'stop', 'log', 'attach'].includes(rest.split(/\s+/)[0])) {
    // Treat remaining text as task description
    return { action: 'spawn', task: rest };
  }

  return null;
}

export const BackgroundPlugin = async (ctx) => {
  ensureDir();

  return {
    'chat.message': async (_input, output) => {
      if (!output || !output.parts) return;
      for (const part of output.parts) {
        if (part && part.type === 'text' && part.text) {
          const cmd = parseBgCommand(part.text);
          if (!cmd) continue;

          switch (cmd.action) {
            case 'spawn': {
              const agent = createAgent(cmd.task);
              const agents = getAgents();
              agents.push(agent);
              saveAgents(agents);

              // Spawn headless opencode process
              const child = spawn('opencode', ['run', '-p', cmd.task], {
                stdio: ['pipe', 'pipe', 'pipe'],
                detached: true,
                env: { ...process.env, OPENCODE_HEADLESS: '1' },
              });

              agent.pid = child.pid;
              saveAgents(getAgents().map(a => a.id === agent.id ? agent : a));

              // Capture output to log file
              const logStream = require('node:fs').createWriteStream(agent.logFile, { flags: 'a' });
              child.stdout.pipe(logStream);
              child.stderr.pipe(logStream);

              child.on('exit', (code) => {
                const agents2 = getAgents();
                const idx = agents2.findIndex(a => a.id === agent.id);
                if (idx !== -1) {
                  agents2[idx].status = code === 0 ? 'completed' : 'failed';
                  agents2[idx].exitCode = code;
                  agents2[idx].finished = new Date().toISOString();
                  saveAgents(agents2);
                }
              });

              child.unref();
              break;
            }
            case 'list': {
              const agents = getAgents();
              const listPath = path.join(BG_DIR, '.last-results');
              writeFileSync(listPath, JSON.stringify(agents.map(a => ({
                id: a.id,
                task: a.task,
                status: a.status,
                started: a.started,
                finished: a.finished,
              })), null, 2), 'utf8');
              break;
            }
            case 'stop': {
              const agents = getAgents();
              const agent = agents.find(a => a.id === cmd.id);
              if (agent && agent.pid) {
                try {
                  process.kill(agent.pid, 'SIGTERM');
                  agent.status = 'stopped';
                  saveAgents(agents);
                } catch {}
              }
              break;
            }
            case 'log': {
              const agents = getAgents();
              const agent = agents.find(a => a.id === cmd.id);
              if (agent && existsSync(agent.logFile)) {
                let logData = readFileSync(agent.logFile, 'utf8');
                if (cmd.tail) {
                  const lines = logData.split('\n');
                  logData = lines.slice(-cmd.tail).join('\n');
                }
                const logPath = path.join(BG_DIR, '.last-log');
                writeFileSync(logPath, logData, 'utf8');
              }
              break;
            }
            case 'attach': {
              // Attach not fully supported in headless mode — log the limitation
              const attachPath = path.join(BG_DIR, '.last-results');
              writeFileSync(attachPath, JSON.stringify({
                error: 'attach not supported in headless mode',
                note: 'use /bg log <id> to see output',
              }), 'utf8');
              break;
            }
          }
        }
      }
    },

    // Clean up stale agents on session start
    'event': async ({ event } = {}) => {
      if (event && event.type === 'session.created') {
        const agents = getAgents();
        const stale = agents.filter(a => a.status === 'running' && a.pid);
        for (const agent of stale) {
          try {
            process.kill(agent.pid, 0); // check if alive
          } catch {
            // Process dead, mark as orphaned
            agent.status = 'orphaned';
          }
        }
        saveAgents(agents);
      }
    },
  };
};

export default BackgroundPlugin;
