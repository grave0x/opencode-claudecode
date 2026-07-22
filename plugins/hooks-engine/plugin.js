// hooks-engine — opencode plugin
//
// Lifecycle hooks system. Reads .opencode/hooks.yaml from the project root
// and executes configured hooks before/after file operations, shell commands,
// and git operations.
//
// Hook format:
//   before:file_write:
//     - command: "npx eslint --fix __FILE__"
//       pattern: "*.ts"
//       timeout: 30000
//   after:file_write:
//     - command: "npm run typecheck"
//   on:error:
//     - command: "notify-send 'Build failed'"

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';

// Simple YAML parser (no deps)
function parseYaml(text) {
  const result = {};
  let currentSection = null;
  let currentList = null;

  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Section header (e.g. "before:file_write:")
    const sectionMatch = trimmed.match(/^(\w[\w:-]+):\s*$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1];
      result[currentSection] = [];
      currentList = result[currentSection];
      continue;
    }

    // Top-level key
    const kvMatch = trimmed.match(/^(\w[\w:-]+):\s*(.*)$/);
    if (kvMatch) {
      if (currentList) {
        // Inside a list — this is a property
        const lastItem = currentList[currentList.length - 1];
        if (lastItem && !lastItem.__done) {
          lastItem[kvMatch[1]] = kvMatch[2].replace(/^["']|["']$/g, '');
        }
      } else {
        result[kvMatch[1]] = kvMatch[2].replace(/^["']|["']$/g, '');
      }
      continue;
    }

    // List item
    const listMatch = trimmed.match(/^-\s+(.*)$/);
    if (listMatch && currentSection) {
      // Could be a simple string or start of an object
      const val = listMatch[1];
      if (val.includes(': ')) {
        // Object start
        const obj = { __done: false };
        const [k, v] = val.split(/:\s+(.*)/);
        obj[k] = (v || '').replace(/^["']|["']$/g, '');
        currentList.push(obj);
      } else {
        currentList.push(val.replace(/^["']|["']$/g, ''));
      }
    }
  }

  return result;
}

function loadHooksConfig() {
  const configPath = path.join(process.cwd(), '.opencode', 'hooks.yaml');
  const configPathAlt = path.join(process.cwd(), '.opencode', 'hooks.yml');
  let content = null;

  if (existsSync(configPath)) content = readFileSync(configPath, 'utf8');
  else if (existsSync(configPathAlt)) content = readFileSync(configPathAlt, 'utf8');

  if (!content) return {};

  return parseYaml(content);
}

function shouldRun(hookDef, toolName, filePath) {
  if (!hookDef.pattern) return true;
  // Simple glob match
  const pattern = hookDef.pattern;
  if (pattern.startsWith('*.')) {
    const ext = pattern.slice(1); // e.g. ".ts"
    return filePath && filePath.endsWith(ext);
  }
  if (pattern.includes('*')) {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return filePath && regex.test(filePath);
  }
  return true;
}

function executeHook(hookDef, extraVars = {}) {
  if (typeof hookDef === 'string') {
    // Simple string command
    try {
      execSync(hookDef, { timeout: 30000, encoding: 'utf8' });
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  if (hookDef.command) {
    let cmd = hookDef.command;
    // Replace variables
    for (const [k, v] of Object.entries(extraVars)) {
      cmd = cmd.replace(new RegExp(`__${k}__`, 'g'), v || '');
    }
    try {
      const timeout = hookDef.timeout || 30000;
      execSync(cmd, { timeout, encoding: 'utf8' });
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message, denyExitCode: hookDef.deny_exit_code };
    }
  }

  return { success: true };
}

export const HooksEnginePlugin = async (ctx) => {
  const config = loadHooksConfig();

  return {
    'tool.execute.before': async ({ tool, args, info } = {}) => {
      const eventName = `before:${tool === 'Write' ? 'file_write' :
        tool === 'Edit' ? 'file_write' :
        tool === 'Bash' ? 'shell_command' :
        tool === 'delete' ? 'file_delete' : ''}`;

      const hooks = config[eventName] || [];
      for (const hookDef of hooks) {
        const filePath = (args && (args.filePath || args.path)) || '';
        if (!shouldRun(hookDef, tool, filePath)) continue;

        const result = executeHook(hookDef, {
          FILE: filePath,
          TOOL: tool,
          CWD: process.cwd(),
        });

        if (!result.success && result.denyExitCode) {
          return { deny: true, reason: `Hook "${eventName}" failed: ${result.error}` };
        }
      }
    },

    'tool.execute.after': async ({ tool, args, result } = {}) => {
      const eventName = `after:${tool === 'Write' ? 'file_write' :
        tool === 'Edit' ? 'file_write' :
        tool === 'Bash' ? 'shell_command' :
        tool === 'delete' ? 'file_delete' : ''}`;

      const hooks = config[eventName] || [];
      for (const hookDef of hooks) {
        const filePath = (args && (args.filePath || args.path)) || '';
        if (!shouldRun(hookDef, tool, filePath)) continue;

        executeHook(hookDef, {
          FILE: filePath,
          TOOL: tool,
          CWD: process.cwd(),
          EXIT_CODE: String(result && result.exitCode !== undefined ? result.exitCode : 0),
        });
      }
    },

    // Auto-create .opencode/hooks.yaml on first run if it doesn't exist
    'event': async ({ event } = {}) => {
      if (event && event.type === 'session.created') {
        const hooksDir = path.join(process.cwd(), '.opencode');
        const hooksFile = path.join(hooksDir, 'hooks.yaml');
        if (!existsSync(hooksFile)) {
          // Don't auto-create — too invasive. Silently skip.
        }
      }
    },
  };
};

export default HooksEnginePlugin;
