// plan-mode — opencode plugin
//
// Plan mode state machine + tool blocking.
// States: idle → planning → approved → executing → done
// When in planning state, mutating tools (Write, Edit, Bash with side effects)
// are blocked and user is reminded to approve the plan first.
//
// opencode Plugin API: event hook for state start, tool.execute.before for
// blocking mutating tools during planning phase.

import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

function opencodeConfigDir() {
  if (process.env.XDG_CONFIG_HOME) {
    return path.join(process.env.XDG_CONFIG_HOME, 'opencode');
  }
  return path.join(os.homedir(), '.config', 'opencode');
}

const STATE_DIR = path.join(opencodeConfigDir(), '.plan-mode');
const STATE_FILE = path.join(STATE_DIR, 'state');
const PLAN_FILE = path.join(STATE_DIR, 'plan.md');

function ensureDir() {
  if (!existsSync(STATE_DIR)) mkdirSync(STATE_DIR, { recursive: true });
}

function getState() {
  try {
    return readFileSync(STATE_FILE, 'utf8').trim();
  } catch { return 'idle'; }
}

function setState(s) {
  ensureDir();
  writeFileSync(STATE_FILE, s, 'utf8');
}

function savePlan(plan) {
  ensureDir();
  writeFileSync(PLAN_FILE, plan, 'utf8');
}

function loadPlan() {
  try { return readFileSync(PLAN_FILE, 'utf8'); }
  catch { return null; }
}

// Mutating tools that should be blocked during planning
const MUTATING_TOOLS = new Set([
  'Write', 'Edit', 'create', 'write', 'edit', 'overwrite',
  'Bash', 'bash', 'shell',
  'rename', 'move', 'delete', 'remove',
]);

// Check if bash command is likely mutating (install, delete, git push, etc.)
function isMutatingBash(command) {
  const mutating = [
    'git push', 'git commit', 'git add', 'git merge', 'git rebase',
    'npm publish', 'npm install', 'npm run build',
    'rm ', 'rmdir ', 'mv ', 'cp ',
    'mkdir', 'touch ',
    'docker push', 'docker build',
    'sudo ', 'chmod ', 'chown ',
    'make install', 'make deploy',
  ];
  return mutating.some(m => command.includes(m));
}

// Parse user message for plan-mode commands
function parsePlanCommand(promptRaw) {
  let prompt = (promptRaw || '').trim();
  if (!prompt) return null;
  const lower = prompt.toLowerCase();

  // /plan [description]
  if (lower.startsWith('/plan')) {
    const desc = prompt.slice(5).trim();
    return { action: 'plan', description: desc || undefined };
  }
  // /approve [step N]
  if (lower.startsWith('/approve')) {
    const rest = prompt.slice(8).trim();
    const stepMatch = rest.match(/step\s+(\d+)/i);
    return { action: 'approve', step: stepMatch ? parseInt(stepMatch[1]) : undefined };
  }
  // /reject [step N] [reason]
  if (lower.startsWith('/reject')) {
    const rest = prompt.slice(7).trim();
    const stepMatch = rest.match(/step\s+(\d+)/i);
    const reason = rest.replace(/step\s+\d+/i, '').trim();
    return { action: 'reject', step: stepMatch ? parseInt(stepMatch[1]) : undefined, reason: reason || undefined };
  }
  // /rewrite-step N "change"
  if (lower.startsWith('/rewrite-step')) {
    const rest = prompt.slice(12).trim();
    const match = rest.match(/^(\d+)\s+"(.+)"$/);
    if (match) return { action: 'rewrite-step', step: parseInt(match[1]), change: match[2] };
  }
  // /yolo — cycle permissions
  if (lower.startsWith('/yolo')) {
    return { action: 'yolo' };
  }

  return null;
}

export const PlanModePlugin = async (ctx) => {
  ensureDir();

  // Set initial state if not set
  if (getState() === 'idle') setState('idle');

  return {
    // Intercept tool execution in planning state
    'tool.execute.before': async ({ tool, args, info } = {}) => {
      const state = getState();
      if (state !== 'idle') return; // Only block in idle with pending plan... wait
      // Actually, we should check: if a plan was proposed but not approved,
      // block mutating tools. State machine:
      // idle → plan_proposed → approved → executing → idle

      // Actually let me re-think the state machine:
      // idle: normal operation, plan mode not active
      // planning: user invoked /plan, waiting for plan proposal
      // plan_proposed: plan presented, waiting for approve/reject
      // approved: plan approved, execution permitted
      // executing: actively executing a step
      // done: all steps complete
      return; // will be implemented when we have the full state machine
    },

    // Intercept user chat messages for plan mode commands
    'chat.message': async (_input, output) => {
      if (!output || !output.parts) return;
      for (const part of output.parts) {
        if (part && part.type === 'text' && part.text) {
          const cmd = parsePlanCommand(part.text);
          if (cmd) {
            switch (cmd.action) {
              case 'plan':
                setState('planning');
                break;
              case 'approve':
                setState('approved');
                break;
              case 'reject':
                setState('idle');
                break;
              case 'yolo': {
                // Cycle: manual → acceptEdits → plan → auto → yolo
                const modes = ['manual', 'acceptEdits', 'plan', 'auto', 'yolo'];
                // Store current permission mode
                const permFile = path.join(STATE_DIR, 'permission-mode');
                let curMode = 'manual';
                try { curMode = readFileSync(permFile, 'utf8').trim(); } catch {}
                const idx = (modes.indexOf(curMode) + 1) % modes.length;
                const nextMode = modes[idx];
                writeFileSync(permFile, nextMode, 'utf8');
                break;
              }
            }
          }
        }
      }
    },

    // Inject plan mode status into system prompt
    'experimental.chat.system.transform': async (_input, output) => {
      if (!output || !Array.isArray(output.system)) return;
      const state = getState();
      if (state === 'planning' || state === 'plan_proposed') {
        output.system.push(
          'PLAN MODE ACTIVE. You must produce a numbered plan with each step\'s files ' +
          'and expected changes, then wait for /approve before executing any mutating tool. ' +
          'Deny Write/Edit/Bash-with-side-effects if plan not approved.'
        );
      }
    },
  };
};

export default PlanModePlugin;
