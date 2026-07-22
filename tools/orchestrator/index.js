#!/usr/bin/env node
// orchestrator — subagent task decomposition + parallel execution
//
// Takes a complex task, decomposes into dependency graph, spawns subagents
// in parallel, merges results.
//
// Usage:
//   node tools/orchestrator/index.js "Implement user auth module"
//   node tools/orchestrator/index.js --plan-only "Refactor API routes"

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const crypto = require('crypto');

// Simple LLM-based task decomposition (uses opencode in headless mode)
function decomposeTask(taskDescription) {
  const prompt = `Decompose this task into ordered subtasks with dependencies.
Each subtask should be independently implementable.

Task: ${taskDescription}

Output format (JSON):
{
  "subtasks": [
    {
      "id": 1,
      "name": "short name",
      "description": "detailed description",
      "files": ["file1.ts", "file2.ts"],
      "dependencies": [], // subtask IDs that must complete first
      "estimatedComplexity": "low|medium|high"
    }
  ]
}

Output ONLY valid JSON, no other text.`;

  try {
    const result = execSync(
      `opencode run -p "${prompt.replace(/"/g, '\\"')}" 2>/dev/null`,
      { encoding: 'utf8', timeout: 60000 }
    );
    // Extract JSON from response
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1]);
    }
  } catch (e) {
    console.error('Decomposition failed:', e.message);
  }

  // Fallback: simple linear decomposition
  return {
    subtasks: [
      { id: 1, name: taskDescription, description: taskDescription, files: [], dependencies: [], estimatedComplexity: 'medium' },
    ],
  };
}

// Create git worktree for isolated subagent execution
function createWorktree(subtask) {
  const worktreeDir = path.join(os.tmpdir(), `orchestrator-${subtask.id}-${Date.now()}`);
  try {
    execSync(`git worktree add ${worktreeDir} HEAD 2>/dev/null || mkdir -p ${worktreeDir}`, { encoding: 'utf8' });
  } catch {
    fs.mkdirSync(worktreeDir, { recursive: true });
  }
  return worktreeDir;
}

// Execute a subtask in a subagent
function executeSubtask(subtask, worktreeDir) {
  return new Promise((resolve) => {
    const prompt = `Implement this subtask:
Task: ${subtask.description}
Files to modify: ${(subtask.files || []).join(', ')}

Work in directory: ${worktreeDir}
Follow existing code patterns. Write tests.`;

    const child = spawn('opencode', ['run', '-p', prompt], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, OPENCODE_HEADLESS: '1' },
      cwd: worktreeDir,
      timeout: 5 * 60 * 1000,
    });

    let output = '';
    child.stdout.on('data', (data) => { output += data.toString(); });
    child.stderr.on('data', (data) => { output += data.toString(); });

    child.on('close', (code) => {
      resolve({
        subtaskId: subtask.id,
        name: subtask.name,
        success: code === 0,
        exitCode: code,
        output: output.slice(-5000), // Last 5k chars
        worktree: worktreeDir,
      });
    });

    child.on('error', (err) => {
      resolve({
        subtaskId: subtask.id,
        name: subtask.name,
        success: false,
        error: err.message,
        worktree: worktreeDir,
      });
    });
  });
}

// Merge changes from worktree back to main repo
function mergeResults(results) {
  const merged = { success: true, changes: [] };

  for (const result of results) {
    if (!result.success) {
      merged.success = false;
      merged.errors = merged.errors || [];
      merged.errors.push(`Subtask "${result.name}" failed`);
      continue;
    }

    try {
      // Get diff from worktree
      const diff = execSync(
        `cd "${result.worktree}" && git diff HEAD 2>/dev/null || true`,
        { encoding: 'utf8' }
      );
      if (diff.trim()) {
        const diffFile = `orchestrator-merge-${result.subtaskId}.patch`;
        fs.writeFileSync(diffFile, diff, 'utf8');
        // Apply the diff
        execSync(`git apply "${diffFile}" 2>/dev/null`, { encoding: 'utf8' });
        merged.changes.push({
          subtask: result.name,
          patch: diffFile,
          filesChanged: (diff.match(/^diff --git/g) || []).length,
        });
        // Clean up
        try { fs.unlinkSync(diffFile); } catch {}
      }

      // Clean up worktree
      try {
        execSync(`git worktree remove "${result.worktree}" 2>/dev/null`, { encoding: 'utf8' });
      } catch {
        try { fs.rmSync(result.worktree, { recursive: true, force: true }); } catch {}
      }
    } catch (e) {
      merged.success = false;
      merged.errors = merged.errors || [];
      merged.errors.push(`Merge failed for "${result.name}": ${e.message}`);
    }
  }

  return merged;
}

// Main
async function main() {
  const args = process.argv.slice(2);
  const taskDescription = args.filter(a => !a.startsWith('--')).join(' ');
  const planOnly = args.includes('--plan-only');

  if (!taskDescription) {
    console.error('Usage: orchestrator.js [--plan-only] "task description"');
    process.exit(1);
  }

  console.error(`Decomposing: ${taskDescription}`);
  const plan = decomposeTask(taskDescription);

  if (planOnly) {
    console.log(JSON.stringify(plan, null, 2));
    return;
  }

  const subtasks = plan.subtasks;
  console.error(`Plan: ${subtasks.length} subtasks`);

  // Topological sort: execute by dependency order
  const done = new Set();
  const results = [];

  while (done.size < subtasks.length) {
    const available = subtasks.filter(
      s => !done.has(s.id) && s.dependencies.every(d => done.has(d))
    );

    if (available.length === 0) {
      console.error('Circular dependency detected or all tasks completed');
      break;
    }

    // Execute available subtasks in parallel
    const batchResults = await Promise.all(
      available.map(subtask => {
        const worktree = createWorktree(subtask);
        console.error(`Starting: ${subtask.name} in ${worktree}`);
        return executeSubtask(subtask, worktree);
      })
    );

    for (const r of batchResults) {
      done.add(r.subtaskId);
      results.push(r);
      console.error(`Done: ${r.name} (${r.success ? 'OK' : 'FAIL'})`);
    }
  }

  // Merge all results
  const merged = mergeResults(results);
  console.log(JSON.stringify(merged, null, 2));
}

const os = require('os');
if (require.main === module) main();

module.exports = { decomposeTask, executeSubtask, mergeResults };
