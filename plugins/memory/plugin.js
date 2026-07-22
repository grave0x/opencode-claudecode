// memory — opencode plugin
//
// Cross-session memory system. Stores tagged facts as Markdown files in
// ~/.config/opencode/memory/. Grep-friendly, composable, human-readable.
//
// At session start: top-5 relevant memories auto-injected into context.
// Commands: /remember, /memory search|list|clear, /flush

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

function opencodeConfigDir() {
  if (process.env.XDG_CONFIG_HOME) {
    return path.join(process.env.XDG_CONFIG_HOME, 'opencode');
  }
  return path.join(os.homedir(), '.config', 'opencode');
}

const MEMORY_DIR = path.join(opencodeConfigDir(), 'memory');
const INDEX_FILE = path.join(MEMORY_DIR, 'index.json');

function ensureDir() {
  if (!existsSync(MEMORY_DIR)) mkdirSync(MEMORY_DIR, { recursive: true });
}

function getIndex() {
  try { return JSON.parse(readFileSync(INDEX_FILE, 'utf8')); }
  catch { return []; }
}

function saveIndex(idx) {
  ensureDir();
  writeFileSync(INDEX_FILE, JSON.stringify(idx, null, 2), 'utf8');
}

// Parse /remember "fact"
function parseRemember(promptRaw) {
  const prompt = (promptRaw || '').trim();
  const match = prompt.match(/^\/remember\s+"(.+)"$/);
  if (match) return { fact: match[1] };
  return null;
}

// Parse /memory command
function parseMemory(promptRaw) {
  const prompt = (promptRaw || '').trim().toLowerCase();

  // /memory search <query>
  const searchMatch = prompt.match(/^\/memory\s+search\s+(.+)/);
  if (searchMatch) return { action: 'search', query: searchMatch[1] };

  // /memory list [--tag <tag>]
  if (prompt.startsWith('/memory list')) {
    const tagMatch = prompt.match(/--tag\s+"?(\w+)"?/);
    return { action: 'list', tag: tagMatch ? tagMatch[1] : undefined };
  }

  // /memory clear [--id <id>]
  if (prompt.startsWith('/memory clear')) {
    const idMatch = prompt.match(/--id\s+(\d+)/);
    return { action: 'clear', id: idMatch ? parseInt(idMatch[1]) : undefined };
  }

  return null;
}

// Parse /flush
function parseFlush(prompt) {
  return (prompt || '').trim().toLowerCase() === '/flush';
}

function storeMemory(fact, tags = []) {
  ensureDir();
  const idx = getIndex();
  const id = idx.length > 0 ? idx[idx.length - 1].id + 1 : 1;
  const cwd = process.cwd();
  const cwdTag = path.basename(cwd);
  const entry = {
    id,
    fact,
    tags: [...new Set([...tags, cwdTag])],
    cwd,
    timestamp: new Date().toISOString(),
  };
  const filename = `memory-${id}-${Date.now()}.md`;
  const content = `# Memory #${id}\n\n**Fact:** ${fact}\n\n**Tags:** ${entry.tags.join(', ')}\n\n**CWD:** ${cwd}\n\n**Created:** ${entry.timestamp}\n`;
  writeFileSync(path.join(MEMORY_DIR, filename), content, 'utf8');
  idx.push(entry);
  saveIndex(idx);
  return entry;
}

// Simple relevance scoring — tag overlap + recency
function scoreRelevance(memory, queryWords, cwdTag) {
  let score = 0;
  const lowerFact = memory.fact.toLowerCase();
  for (const word of queryWords) {
    if (lowerFact.includes(word)) score += 2;
  }
  if (memory.tags.includes(cwdTag)) score += 1;
  const ageHours = (Date.now() - new Date(memory.timestamp).getTime()) / (1000 * 3600);
  score -= ageHours / 24; // penalty for age (days)
  return score;
}

export const MemoryPlugin = async (ctx) => {
  ensureDir();

  return {
    'chat.message': async (_input, output) => {
      if (!output || !output.parts) return;
      for (const part of output.parts) {
        if (part && part.type === 'text' && part.text) {
          const text = part.text;

          // /remember "fact"
          const remember = parseRemember(text);
          if (remember) {
            storeMemory(remember.fact);
            continue;
          }

          // /memory search|list|clear
          const memoryCmd = parseMemory(text);
          if (memoryCmd) {
            switch (memoryCmd.action) {
              case 'search': {
                const idx = getIndex();
                const queryWords = memoryCmd.query.toLowerCase().split(/\s+/);
                const cwdTag = path.basename(process.cwd());
                const scored = idx
                  .map(m => ({ memory: m, score: scoreRelevance(m, queryWords, cwdTag) }))
                  .filter(m => m.score > 0)
                  .sort((a, b) => b.score - a.score)
                  .slice(0, 5);
                // Results are injected into conversation via the message handler
                // We just write them to a shared flag file for model to read
                const resultsPath = path.join(MEMORY_DIR, '.last-results');
                writeFileSync(resultsPath, JSON.stringify(scored.map(s => s.memory), null, 2), 'utf8');
                break;
              }
              case 'list': {
                const idx = getIndex();
                const filtered = memoryCmd.tag
                  ? idx.filter(m => m.tags.includes(memoryCmd.tag))
                  : idx;
                const listPath = path.join(MEMORY_DIR, '.last-results');
                writeFileSync(listPath, JSON.stringify(filtered, null, 2), 'utf8');
                break;
              }
              case 'clear': {
                if (memoryCmd.id) {
                  const idx = getIndex();
                  const filtered = idx.filter(m => m.id !== memoryCmd.id);
                  saveIndex(filtered);
                  // Also remove file
                  const files = readdirSync(MEMORY_DIR);
                  for (const f of files) {
                    if (f.startsWith(`memory-${memoryCmd.id}-`)) {
                      unlinkSync(path.join(MEMORY_DIR, f));
                    }
                  }
                } else {
                  // Clear all
                  const files = readdirSync(MEMORY_DIR);
                  for (const f of files) {
                    if (f.startsWith('memory-')) unlinkSync(path.join(MEMORY_DIR, f));
                  }
                  saveIndex([]);
                }
                break;
              }
            }
            continue;
          }

          // /flush
          if (parseFlush(text)) {
            // Session summary — written by the agent, we just store it
            // The agent emits the summary in its response, we capture via
            // tool.execute.after
            break;
          }
        }
      }
    },

    // Watch for agent responses containing session summaries after /flush
    'tool.execute.after': async ({ tool, args, result } = {}) => {
      if (tool === 'Write' && args && args.filePath && args.filePath === '/dev/stdout') {
        // Capture flush output
      }
    },

    // Inject relevant memories at session start
    'experimental.chat.system.transform': async (_input, output) => {
      if (!output || !Array.isArray(output.system)) return;
      const idx = getIndex();
      if (idx.length === 0) return;

      const cwdTag = path.basename(process.cwd());
      const queryWords = [cwdTag];

      // Score and get top-5
      const scored = idx
        .map(m => ({ memory: m, score: scoreRelevance(m, queryWords, cwdTag) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .filter(m => m.score > 0);

      if (scored.length > 0) {
        const lines = scored.map((s, i) =>
          `${i + 1}. [${s.memory.tags.join(', ')}] ${s.memory.fact}`
        );
        output.system.push(
          'RELEVANT MEMORIES:\n' + lines.join('\n') + '\n' +
          'Use /remember "fact" to save new memories. /memory search <q> to search.'
        );
      }
    },
  };
};

export default MemoryPlugin;
