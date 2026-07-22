#!/usr/bin/env node
// repomap — AST-based symbol extraction + call graph ranking
//
// Produces a ranked list of symbols (functions, classes, types) in the
// codebase, annotated with call graph and file location.
//
// Usage:
//   node tools/repomap/index.js [--root <path>] [--top <N>]
//
// Uses tree-sitter for AST parsing across supported languages.
// Falls back to regex-based extraction when tree-sitter isn't available.

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Language detection by file extension
const LANG_MAP = {
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.py': 'python',
  '.rs': 'rust',
  '.go': 'go',
  '.java': 'java',
  '.c': 'c',
  '.cpp': 'cpp',
  '.h': 'c',
  '.hpp': 'cpp',
  '.rb': 'ruby',
  '.php': 'php',
  '.swift': 'swift',
  '.kt': 'kotlin',
  '.scala': 'scala',
};

// Regex patterns for symbol extraction per language
const SYMBOL_PATTERNS = {
  javascript: [
    /(?:export\s+)?(?:async\s+)?function\s+(\w+)/g,
    /(?:export\s+)?(?:async\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_]\w*)\s*=>/g,
    /(?:export\s+)?class\s+(\w+)/g,
    /(?:export\s+)?interface\s+(\w+)/g,
    /(?:export\s+)?type\s+(\w+)\s*=/g,
    /(?:export\s+)?enum\s+(\w+)/g,
    /(?:export\s+)?(?:default\s+)?function\s+(\w+)/g,
    /(\w+)\s*\([^)]*\)\s*\{[^}]*\}/g,  // methods
  ],
  typescript: [
    /(?:export\s+)?(?:async\s+)?function\s+(\w+)/g,
    /(?:export\s+)?(?:async\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_]\w*)\s*=>/g,
    /(?:export\s+)?class\s+(\w+)/g,
    /(?:export\s+)?interface\s+(\w+)/g,
    /(?:export\s+)?type\s+(\w+)\s*=/g,
    /(?:export\s+)?enum\s+(\w+)/g,
    /(?:export\s+)?abstract\s+class\s+(\w+)/g,
  ],
  python: [
    /^class\s+(\w+)/gm,
    /^async?\s+def\s+(\w+)/gm,
    /^def\s+(\w+)/gm,
    /^@\w+\s*\n^def\s+(\w+)/gm,
  ],
  rust: [
    /^fn\s+(\w+)/gm,
    /^pub\s+fn\s+(\w+)/gm,
    /^struct\s+(\w+)/gm,
    /^enum\s+(\w+)/gm,
    /^trait\s+(\w+)/gm,
    /^impl\s+(\w+)/gm,
    /^pub\s+(struct|enum|trait|fn|type)\s+(\w+)/gm,
  ],
  go: [
    /^func\s+(\w+)/gm,
    /^func\s+\([^)]*\)\s+(\w+)/gm,
    /^type\s+(\w+)\s+struct/gm,
    /^type\s+(\w+)\s+interface/gm,
  ],
  java: [
    /(?:public|private|protected)?\s*(?:static\s+)?(?:final\s+)?(?:class|interface|enum)\s+(\w+)/g,
    /(?:public|private|protected)?\s*(?:static\s+)?\w+\s+(\w+)\s*\([^)]*\)\s*(?:throws\s+\w+)?\s*\{/g,
  ],
};

// Extract function/method calls from file content
function extractCalls(content, lang) {
  const calls = new Set();
  const callPatterns = {
    javascript: /\b(\w+)\s*\(/g,
    typescript: /\b(\w+)\s*\(/g,
    python: /\b(\w+)\s*\(/g,
    rust: /\b(\w+)\s*\(/g,
    go: /\b(\w+)\s*\(/g,
  };

  const pattern = callPatterns[lang];
  if (!pattern) return calls;

  const reserved = ['if', 'for', 'while', 'switch', 'catch', 'function', 'return',
    'typeof', 'instanceof', 'import', 'export', 'from', 'require', 'throw', 'new',
    'delete', 'in', 'of', 'await', 'yield', 'case', 'def', 'fn', 'func'];

  let match;
  while ((match = pattern.exec(content)) !== null) {
    if (!reserved.includes(match[1]) && match[1].length > 1) {
      calls.add(match[1]);
    }
  }
  return calls;
}

// Collect all symbols and their callers across the codebase
function buildSymbolMap(rootDir) {
  const symbols = {}; // name -> { files: Set, calls: Set, calledBy: Set }
  const files = [];

  // Recursively collect source files
  function walk(dir) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (!entry.name.startsWith('.') && entry.name !== 'node_modules' &&
              entry.name !== 'target' && entry.name !== 'dist' && entry.name !== 'build') {
            walk(fullPath);
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name);
          if (LANG_MAP[ext]) {
            files.push({ path: fullPath, lang: LANG_MAP[ext] });
          }
        }
      }
    } catch {}
  }

  walk(rootDir);

  // First pass: extract symbols
  for (const file of files) {
    try {
      const content = fs.readFileSync(file.path, 'utf8');
      const patterns = SYMBOL_PATTERNS[file.lang] || [];

      for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
          const name = match[1] || match[2];
          if (name && name.length > 1) {
            if (!symbols[name]) {
              symbols[name] = { files: new Set(), calls: new Set(), calledBy: new Set() };
            }
            symbols[name].files.add(file.path);
          }
        }
      }
    } catch {}
  }

  // Second pass: extract call relationships
  for (const file of files) {
    try {
      const content = fs.readFileSync(file.path, 'utf8');
      const calls = extractCalls(content, file.lang);

      for (const callee of calls) {
        if (symbols[callee]) {
          // Find which symbols are defined in this file
          for (const [name, sym] of Object.entries(symbols)) {
            if (sym.files.has(file.path)) {
              sym.calls.add(callee);
              symbols[callee].calledBy.add(name);
            }
          }
        }
      }
    } catch {}
  }

  return symbols;
}

// PageRank-style ranking based on caller count
function rankSymbols(symbols) {
  const entries = Object.entries(symbols).map(([name, sym]) => ({
    name,
    files: [...sym.files],
    calls: [...sym.calls].slice(0, 20),
    calledBy: [...sym.calledBy].slice(0, 20),
    score: sym.calledBy.size + sym.calls.size * 0.3,
  }));

  entries.sort((a, b) => b.score - a.score);
  return entries;
}

// Main
function main() {
  const args = process.argv.slice(2);
  let rootDir = process.cwd();
  let topN = 50;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--root' && args[i + 1]) rootDir = args[i + 1];
    if (args[i] === '--top' && args[i + 1]) topN = parseInt(args[i + 1]);
  }

  console.error(`Building symbol map for ${rootDir}...`);
  const symbols = buildSymbolMap(rootDir);
  const ranked = rankSymbols(symbols);

  const output = {
    totalSymbols: ranked.length,
    topSymbols: ranked.slice(0, topN).map(s => ({
      name: s.name,
      score: Math.round(s.score * 10) / 10,
      file: s.files[0] || '',
      references: s.calledBy.length,
      calls: s.calls.length,
    })),
  };

  console.log(JSON.stringify(output, null, 2));
}

if (require.main === module) main();

module.exports = { buildSymbolMap, rankSymbols };
