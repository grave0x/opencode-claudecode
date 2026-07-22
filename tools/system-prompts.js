#!/usr/bin/env node

// system-prompts.js — CLI for managing leaked frontier model system prompts
//
// Usage:
//   node tools/system-prompts.js list [--tag <tag>]
//   node tools/system-prompts.js view <id> [--patterns]
//   node tools/system-prompts.js fetch <id>
//   node tools/system-prompts.js fetch --all
//   node tools/system-prompts.js create <id> [--url <url>] [--file <path>]
//   node tools/system-prompts.js search <query>
//   node tools/system-prompts.js compare <id1> <id2>
//   node tools/system-prompts.js export <id> [--format md|json|txt]
//   node tools/system-prompts.js use <id>
//   node tools/system-prompts.js edit <id> [--key <key> --value <val>]
//   node tools/system-prompts.js remove <id>
//   node tools/system-prompts.js validate

import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const REGISTRY_FILE = path.join(ROOT, 'system-prompts', 'registry.json');
const RAW_DIR = path.join(ROOT, 'system-prompts', 'raw');
const PATTERNS_DIR = path.join(ROOT, 'system-prompts');

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function readRegistry() {
  return JSON.parse(readFileSync(REGISTRY_FILE, 'utf8'));
}

function writeRegistry(data) {
  writeFileSync(REGISTRY_FILE, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function getPrompt(id) {
  const reg = readRegistry();
  const p = reg.prompts.find(x => x.id === id);
  if (!p) throw new Error(`Prompt "${id}" not found in registry`);
  return p;
}

function rawPath(id) {
  return path.join(RAW_DIR, `${id}.txt`);
}

function readRaw(id) {
  const f = rawPath(id);
  if (!existsSync(f)) return null;
  return readFileSync(f, 'utf8');
}

// ─── Market (remote index from YeeKal/leaked-system-prompts) ────────────

const MARKET_REPO = 'YeeKal/leaked-system-prompts';
const MARKET_INDEX_FILE = path.join(ROOT, 'system-prompts', 'market-index.json');

function ghCurl(url) {
  const token = process.env.GITHUB_TOKEN;
  const auth = token ? ` -H "Authorization: token ${token}"` : '';
  return execSync(`curl -sL${auth} "${url}"`, { encoding: 'utf8', timeout: 15000 });
}

function companyDisplay(name) {
  const map = {
    'anthropic': 'Anthropic', 'openai': 'OpenAI', 'xai': 'xAI', 'google': 'Google',
    'perplexity': 'Perplexity', 'cursor': 'Cursor', 'github': 'GitHub',
    'microsoft': 'Microsoft', 'deepseek': 'DeepSeek', 'meta': 'Meta',
    'bolt-new': 'Bolt.new', 'brave': 'Brave', 'chatglm': 'ChatGLM',
    'codeium': 'Codeium', 'colab': 'Colab', 'devin': 'Devin', 'devv': 'Devv',
    'discord': 'Discord', 'factory': 'Factory', 'gandalf': 'Gandalf',
    'lovable': 'Lovable', 'manus': 'Manus', 'mistral': 'Mistral',
    'moonshot': 'Moonshot', 'naver': 'Naver', 'notion': 'Notion',
    'opera': 'Opera', 'phind': 'Phind', 'remoteli': 'Remoteli',
    'roblox': 'Roblox', 'snap': 'Snap', 'v0': 'v0', 'wrtn': 'Wrtn',
  };
  return map[name] || name;
}

function modelFamilyFromCompany(company) {
  const map = {
    'anthropic': 'anthropic/claude', 'openai': 'openai/gpt',
    'xai': 'xai/grok', 'google': 'google/gemini',
    'perplexity': 'perplexity/perplexity', 'cursor': 'cursor/cursor',
    'github': 'github/copilot', 'microsoft': 'microsoft/copilot',
    'deepseek': 'deepseek/deepseek', 'meta': 'meta/muse',
    'bolt-new': 'bolt/bolt', 'brave': 'brave/leo',
    'chatglm': 'chatglm/chatglm', 'codeium': 'codeium/windsurf',
    'colab': 'google/colab', 'devin': 'devin/devin', 'devv': 'devv/devv',
    'discord': 'discord/clyde', 'factory': 'factory/droid',
    'gandalf': 'lakera/gandalf', 'lovable': 'lovable/lovable',
    'manus': 'manus/manus', 'mistral': 'mistral/le-chat',
    'moonshot': 'moonshot/kimi', 'naver': 'naver/cue',
    'notion': 'notion/notion', 'opera': 'opera/aria',
    'phind': 'phind/phind', 'remoteli': 'remoteli/remoteli',
    'roblox': 'roblox/studio', 'snap': 'snap/myai', 'v0': 'v0/v0',
    'wrtn': 'wrtn/wrtn',
  };
  return map[company] || company;
}

function inferModelName(name) {
  // Strip company prefix and date suffix for a clean name
  let n = name.replace(/^[a-z]+-/, '').replace(/_\d{8}$/, '').replace(/-/g, ' ').trim();
  return n.charAt(0).toUpperCase() + n.slice(1);
}

function inferTags(company, name) {
  const tags = [company, 'leaked'];
  const lname = name.toLowerCase();
  if (lname.includes('code') || lname.includes('cursor') || lname.includes('devin') || lname.includes('windsurf')) tags.push('coding-agent');
  if (lname.includes('thinking') || lname.includes('reasoning') || lname.includes('deep')) tags.push('reasoning');
  if (lname.includes('opus') || lname.includes('sonnet') || lname.includes('frontier') || lname.includes('grok') || lname.includes('5.5')) tags.push('frontier');
  if (lname.includes('search') || lname.includes('deep')) tags.push('search');
  if (lname.includes('design')) tags.push('design');
  if (lname.includes('dall-e') || lname.includes('diffusion')) tags.push('image');
  if (lname.includes('assistant') || lname.includes('chat')) tags.push('chat');
  if (lname.includes('ios') || lname.includes('android') || lname.includes('mobile')) tags.push('mobile');
  return tags;
}

async function fetchMarketIndex() {
  // Try cached index first
  if (existsSync(MARKET_INDEX_FILE)) {
    const cached = JSON.parse(readFileSync(MARKET_INDEX_FILE, 'utf8'));
    // Use cache if < 1 hour old
    if (cached._fetched && (Date.now() - cached._fetched) < 3600000) {
      return cached;
    }
  }

  // Fetch from GitHub API
  const index = { _fetched: Date.now(), _source: MARKET_REPO, prompts: [] };
  const apiUrl = `https://api.github.com/repos/${MARKET_REPO}/contents/prompts`;
  let companyDirs = [];
  try {
    companyDirs = JSON.parse(ghCurl(apiUrl));
  } catch (e) {
    // Fall back to cache if fetch fails
    if (existsSync(MARKET_INDEX_FILE)) {
      console.log('  ⚠ Could not reach GitHub API, using cached market index');
      return JSON.parse(readFileSync(MARKET_INDEX_FILE, 'utf8'));
    }
    throw new Error(`Failed to fetch market index: ${e.message}`);
  }

  for (const d of companyDirs) {
    if (d.type !== 'dir') continue;
    const company = d.name;
    let files = [];
    try {
      files = JSON.parse(ghCurl(d.url));
    } catch { continue; }

    for (const f of files) {
      if (f.type !== 'file' || !f.name.endsWith('.md') || f.name === 'README.md') continue;
      const nameNoExt = f.name.replace(/\.md$/, '');
      const dateMatch = nameNoExt.match(/_(\d{8})$/);
      const date = dateMatch ? `${dateMatch[1].slice(0,4)}-${dateMatch[1].slice(4,6)}-${dateMatch[1].slice(6,8)}` : null;

      // Build unique ID from name — include date suffix to avoid collisions
      const baseId = nameNoExt.replace(/^[a-z]+-/, '').replace(/_\d{8}$/, '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || nameNoExt.toLowerCase();
      const dateSuffix = date ? `-${date.replace(/-/g, '')}` : '';
      const id = `${company}-${baseId}${dateSuffix}`;

      index.prompts.push({
        id,
        name: inferModelName(nameNoExt),
        company,
        company_display: companyDisplay(company),
        filename: f.name,
        date,
        size: f.size,
        download_url: f.download_url,
        sha: f.sha,
        model_family: modelFamilyFromCompany(company),
        tags: inferTags(company, nameNoExt),
      });
    }
  }

  // Cache index
  ensureDir(path.dirname(MARKET_INDEX_FILE));
  writeFileSync(MARKET_INDEX_FILE, JSON.stringify(index, null, 2), 'utf8');
  return index;
}

function findMarketPrompt(prompts, query) {
  // 1. Exact match
  const exact = prompts.filter(p => p.id === query);
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) throw new Error(`Multiple exact matches for "${query}"`);
  // 2. Strip date suffix (-\d{8}$), then check equal or endsWith
  const stripDate = id => id.replace(/-\d{8}$/, '');
  const name = prompts.filter(p => stripDate(p.id) === query || stripDate(p.id).endsWith(query));
  if (name.length === 1) return name[0];
  if (name.length > 1) throw new Error(`"${query}" matches ${name.length} prompts. Use full ID (e.g., "${name[0].id}").`);
  return null;
}

function cmdMarket(args) {
  const sub = args[0];
  const subArgs = args.slice(1);

  if (!sub || sub === 'help') {
    console.log(`
  Market Commands (YeeKal/leaked-system-prompts — 116 prompts, 33 companies):

    market list [--company <c>] [--tag <t>]   List available prompts
    market search <query>                      Search market prompts
    market info <id>                           Show market prompt details
    market download <id | --all>               Download to local registry
    market cache                               Refresh local market index
    market help                                This help

  Companies: anthropic, openai, xai, google, perplexity, cursor, github,
             microsoft, deepseek, meta, bolt-new, brave, chatglm, codeium,
             colab, devin, devv, discord, factory, gandalf, lovable, manus,
             mistral, moonshot, naver, notion, opera, phind, remoteli,
             roblox, snap, v0, wrtn
`);
    return;
  }

  const index = (async () => {
    try {
      return await fetchMarketIndex();
    } catch (e) {
      console.error(`  ✗ ${e.message}`);
      process.exit(1);
    }
  })();

  if (sub === 'cache') {
    index.then(idx => {
      const age = Math.round((Date.now() - idx._fetched) / 1000);
      console.log(`  ✓ Market index refreshed: ${idx.prompts.length} prompts, ${age}s old`);
    });
    return;
  }

  if (sub === 'list') {
    index.then(idx => {
      let prompts = idx.prompts;
      const companyIdx = subArgs.indexOf('--company');
      if (companyIdx !== -1 && subArgs[companyIdx + 1]) {
        prompts = prompts.filter(p => p.company === subArgs[companyIdx + 1]);
      }
      const tagIdx = subArgs.indexOf('--tag');
      if (tagIdx !== -1 && subArgs[tagIdx + 1]) {
        prompts = prompts.filter(p => p.tags.includes(subArgs[tagIdx + 1]));
      }

      // Group by company
      const groups = {};
      for (const p of prompts) {
        if (!groups[p.company]) groups[p.company] = { display: p.company_display, prompts: [] };
        groups[p.company].prompts.push(p);
      }

      console.log(`\n  Market — ${prompts.length} available prompts:\n`);
      for (const [company, g] of Object.entries(groups).sort()) {
        console.log(`  ${g.display}:`);
        for (const p of g.prompts) {
          const hasReg = readRegistry().prompts.some(r => r.source_url === p.download_url) ? '✓' : ' ';
          const sizeKb = (p.size / 1024).toFixed(1);
          console.log(`    ${hasReg} ${p.id.padEnd(36)} ${sizeKb.padStart(6)}KB  ${p.date || '          '}`);
        }
      }
      console.log();
    });
    return;
  }

  if (sub === 'search') {
    const query = subArgs.join(' ');
    if (!query) { console.error('Usage: market search <query>'); process.exit(1); }
    index.then(idx => {
      const q = query.toLowerCase();
      const results = idx.prompts.filter(p =>
        p.id.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.company.includes(q) ||
        p.tags.some(t => t.includes(q))
      );
      console.log(`\n  Market search "${query}" — ${results.length} matches\n`);
      for (const r of results.slice(0, 50)) {
        console.log(`  ${r.id.padEnd(36)} ${(r.size/1024).toFixed(1).padStart(6)}KB  ${r.date || '          '}  ${r.company_display}`);
      }
      if (results.length > 50) console.log(`  ... and ${results.length - 50} more`);
      console.log();
    });
    return;
  }

  if (sub === 'info') {
    const id = subArgs[0];
    if (!id) { console.error('Usage: market info <id>'); process.exit(1); }
    index.then(idx => {
      let p;
      try { p = findMarketPrompt(idx.prompts, id); } catch (e) { console.error(`  ✗ ${e.message}`); process.exit(1); }
      if (!p) { console.error(`  ✗ Market prompt "${id}" not found. Use "market list" to see IDs.`); process.exit(1); }
      const already = readRegistry().prompts.some(r => r.source_url === p.download_url);
      console.log(`\n  ${p.name} (${p.id})\n`);
      console.log(`  Company:  ${p.company_display} (${p.company})`);
      console.log(`  Date:     ${p.date || 'unknown'}`);
      console.log(`  Size:     ${p.size} bytes (${(p.size/1024).toFixed(1)} KB)`);
      console.log(`  File:     ${p.filename}`);
      console.log(`  Tags:     ${p.tags.join(', ')}`);
      console.log(`  Status:   ${already ? '✓ Already in local registry' : '○ Not downloaded yet'}`);
      console.log();
    });
    return;
  }

  if (sub === 'download') {
    const downloadAll = subArgs.includes('--all');
    const targetId = subArgs[0];

    if (!downloadAll && !targetId) {
      console.error('Usage: market download <id> or market download --all');
      process.exit(1);
    }

    index.then(async idx => {
      let targets = [];
      if (downloadAll) {
        targets = idx.prompts;
      } else {
        let match;
        try { match = findMarketPrompt(idx.prompts, targetId); } catch (e) { console.error(`  ✗ ${e.message}`); process.exit(1); }
        if (!match) {
          console.error(`  ✗ Market prompt "${targetId}" not found. Use "market list" to see IDs.`);
          process.exit(1);
        }
        targets = [match];
      }

      ensureDir(RAW_DIR);
      const reg = readRegistry();
      let fetched = 0, skipped = 0;

      for (const mp of targets) {
        // Skip if already registered
        if (reg.prompts.some(r => r.source_url === mp.download_url)) {
          console.log(`  — ${mp.id}: already in registry, skipping`);
          skipped++;
          continue;
        }

        console.log(`  → Downloading ${mp.id} from market ...`);
        try {
          const content = execSync(`curl -sL "${mp.download_url}"`, { encoding: 'utf8', timeout: 30000 });
          // Some raw files wrap in code fences — strip if present
          const cleaned = content.replace(/^```(?:markdown)?\n?/i, '').replace(/\n```\s*$/, '');
          if (!cleaned || cleaned.length < 50) {
            console.log(`  ✗ ${mp.id}: empty or too short (${cleaned.length} chars)`);
            continue;
          }

          const rawFrag = `raw/${mp.id}.txt`;
          writeFileSync(path.join(ROOT, 'system-prompts', rawFrag), cleaned, 'utf8');

          const newEntry = {
            id: mp.id,
            name: mp.name,
            model_family: mp.model_family,
            version: 'latest',
            date: mp.date || new Date().toISOString().slice(0, 10),
            source_url: mp.download_url,
            backup_url: `https://github.com/${MARKET_REPO}`,
            local_path: rawFrag,
            raw_size_bytes: cleaned.length,
            key_patterns_file: null,
            tags: mp.tags,
            description: `${mp.company_display} ${mp.name} — ${mp.date || ''}`.trim(),
            registered: new Date().toISOString().slice(0, 10)
          };

          reg.prompts.push(newEntry);
          fetched++;
          console.log(`  ✓ ${mp.id}: saved (${cleaned.length} chars)`);
        } catch (e) {
          console.log(`  ✗ ${mp.id}: download failed — ${e.message}`);
        }
      }

      writeRegistry(reg);
      console.log(`\n  Market download complete: ${fetched} fetched, ${skipped} skipped\n`);
    });
    return;
  }

  console.error(`  Unknown market subcommand: ${sub}. Try "market help".`);
  process.exit(1);
}

// ─── Commands ───────────────────────────────────────────────────────────

function cmdList(args) {
  const reg = readRegistry();
  let prompts = reg.prompts;
  const tagIdx = args.indexOf('--tag');
  if (tagIdx !== -1 && args[tagIdx + 1]) {
    const tag = args[tagIdx + 1];
    prompts = prompts.filter(p => p.tags.includes(tag));
  }
  console.log(`\n  System Prompts (${prompts.length}/${reg.prompts.length}):\n`);
  for (const p of prompts) {
    const hasRaw = p.local_path && existsSync(path.join(ROOT, 'system-prompts', p.local_path)) ? '✓' : '✗';
    const hasPatterns = p.key_patterns_file && existsSync(path.join(ROOT, 'system-prompts', p.key_patterns_file)) ? '✓' : '✗';
    console.log(`  ${p.id.padEnd(24)} ${hasRaw} raw  ${hasPatterns} pat  ${p.model_family.padEnd(24)}  ${p.date || ''}`);
  }
  console.log();
}

function cmdView(args) {
  const id = args[0];
  if (!id) { console.error('Usage: view <id> [--patterns]'); process.exit(1); }
  const p = getPrompt(id);
  const showPatterns = args.includes('--patterns');

  console.log(`\n  ${p.name} (${p.id})\n`);
  console.log(`  Model:    ${p.model_family}`);
  console.log(`  Version:  ${p.version}`);
  console.log(`  Date:     ${p.date || 'unknown'}`);
  console.log(`  Source:   ${p.source_url || 'none'}`);
  console.log(`  Backup:   ${p.backup_url || 'none'}`);
  console.log(`  Tags:     ${p.tags.join(', ')}`);
  console.log(`  Patterns: ${p.key_patterns_file || 'none'}`);
  console.log();

  if (showPatterns && p.key_patterns_file) {
    const patFile = path.join(PATTERNS_DIR, p.key_patterns_file);
    if (existsSync(patFile)) {
      console.log(`  ── Key Patterns (${p.key_patterns_file}) ──\n`);
      console.log(readFileSync(patFile, 'utf8'));
    } else {
      console.log('  (key patterns file not found)\n');
    }
  }

  const raw = readRaw(id);
  if (raw) {
    console.log(`  ── Raw Prompt (${raw.length} chars) ──\n`);
    // Show first 50 lines, truncate if longer
    const lines = raw.split('\n');
    const maxLines = 50;
    for (let i = 0; i < Math.min(lines.length, maxLines); i++) {
      console.log(`  ${lines[i]}`);
    }
    if (lines.length > maxLines) {
      console.log(`  ... (${lines.length - maxLines} more lines, ${raw.length} total chars)`);
    }
    console.log();
  } else {
    console.log('  (raw prompt not cached locally — use `fetch` to download)\n');
  }
}

function cmdFetch(args) {
  const reg = readRegistry();
  ensureDir(RAW_DIR);

  const fetchAll = args.includes('--all');
  const force = args.includes('--force');
  const targets = fetchAll
    ? force ? reg.prompts : reg.prompts.filter(p => !p.local_path || !existsSync(path.join(ROOT, 'system-prompts', p.local_path)))
    : [getPrompt(args[0])];

  if (!args[0] && !fetchAll) {
    console.error('Usage: fetch <id> or fetch --all');
    process.exit(1);
  }

  for (const p of targets) {
    if (!p.source_url) {
      console.log(`  ✗ ${p.id}: no source_url configured`);
      continue;
    }
    console.log(`  → Fetching ${p.id} from ${p.source_url} ...`);
    try {
      const content = execSync(`curl -sL "${p.source_url}"`, { encoding: 'utf8', timeout: 30000 });
      if (!content || content.length < 50) {
        console.log(`  ✗ ${p.id}: empty or too short (${content.length} chars)`);
        continue;
      }
      const localFrag = `raw/${p.id}.txt`;
      writeFileSync(path.join(ROOT, 'system-prompts', localFrag), content, 'utf8');
      // Update registry
      p.local_path = localFrag;
      p.raw_size_bytes = content.length;
      writeRegistry(reg);
      console.log(`  ✓ ${p.id}: saved (${content.length} chars)`);
    } catch (e) {
      console.log(`  ✗ ${p.id}: fetch failed — ${e.message}`);
    }
  }
}

function cmdCreate(args) {
  const id = args[0];
  if (!id) { console.error('Usage: create <id> [--url <url>] [--file <path>]'); process.exit(1); }
  const reg = readRegistry();
  if (reg.prompts.find(p => p.id === id)) {
    console.error(`  ✗ Prompt "${id}" already exists`);
    process.exit(1);
  }

  const urlIdx = args.indexOf('--url');
  const fileIdx = args.indexOf('--file');
  let rawContent = '';

  if (urlIdx !== -1 && args[urlIdx + 1]) {
    try {
      rawContent = execSync(`curl -sL "${args[urlIdx + 1]}"`, { encoding: 'utf8', timeout: 30000 });
      console.log(`  → Fetched ${rawContent.length} chars from URL`);
    } catch (e) {
      console.error(`  ✗ Failed to fetch URL: ${e.message}`);
      process.exit(1);
    }
  } else if (fileIdx !== -1 && args[fileIdx + 1]) {
    try {
      rawContent = readFileSync(args[fileIdx + 1], 'utf8');
      console.log(`  → Read ${rawContent.length} chars from file`);
    } catch (e) {
      console.error(`  ✗ Failed to read file: ${e.message}`);
      process.exit(1);
    }
  } else {
    console.error('  Provide either --url or --file with prompt content');
    process.exit(1);
  }

  const newPrompt = {
    id,
    name: id.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    model_family: 'unknown',
    version: 'latest',
    date: new Date().toISOString().slice(0, 10),
    source_url: urlIdx !== -1 ? args[urlIdx + 1] : null,
    backup_url: null,
    local_path: `raw/${id}.txt`,
    raw_size_bytes: rawContent.length,
    key_patterns_file: null,
    tags: ['custom'],
    description: '',
    registered: new Date().toISOString().slice(0, 10)
  };

  ensureDir(RAW_DIR);
  writeFileSync(path.join(ROOT, 'system-prompts', `raw/${id}.txt`), rawContent, 'utf8');
  reg.prompts.push(newPrompt);
  writeRegistry(reg);
  console.log(`  ✓ Created "${id}" (${rawContent.length} chars)`);
}

function cmdSearch(args) {
  const query = args.join(' ');
  if (!query) { console.error('Usage: search <query>'); process.exit(1); }
  const reg = readRegistry();
  const q = query.toLowerCase();

  const results = [];

  // Search metadata
  for (const p of reg.prompts) {
    const metaMatch = p.name.toLowerCase().includes(q) ||
      p.id.toLowerCase().includes(q) ||
      p.model_family.toLowerCase().includes(q) ||
      p.tags.some(t => t.includes(q)) ||
      (p.description && p.description.toLowerCase().includes(q));

    if (metaMatch) {
      results.push({ id: p.id, match: 'metadata', snippet: p.description?.slice(0, 100) || '' });
    }

    // Search raw content
    const raw = readRaw(p.id);
    if (raw) {
      const lines = raw.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().includes(q)) {
          results.push({ id: p.id, match: `raw:${i + 1}`, snippet: lines[i].trim().slice(0, 120) });
          if (results.filter(r => r.id === p.id).length > 10) break; // limit per prompt
        }
      }
    }
  }

  console.log(`\n  Search "${query}" — ${results.length} results\n`);
  for (const r of results.slice(0, 40)) {
    console.log(`  ${r.id.padEnd(24)} ${r.match.padEnd(16)} ${r.snippet}`);
  }
  if (results.length > 40) console.log(`  ... and ${results.length - 40} more`);
  console.log();
}

function cmdCompare(args) {
  const id1 = args[0], id2 = args[1];
  if (!id1 || !id2) { console.error('Usage: compare <id1> <id2>'); process.exit(1); }
  const p1 = getPrompt(id1), p2 = getPrompt(id2);
  const r1 = readRaw(id1), r2 = readRaw(id2);

  console.log(`\n  Comparing: ${p1.name} vs ${p2.name}\n`);
  console.log(`  ${'─'.repeat(60)}`);
  console.log(`  ${'Field'.padEnd(24)} ${p1.name.padEnd(30)} ${p2.name}`);
  console.log(`  ${'─'.repeat(60)}`);
  console.log(`  ${'Family'.padEnd(24)} ${p1.model_family.padEnd(30)} ${p2.model_family}`);
  console.log(`  ${'Date'.padEnd(24)} ${(p1.date||'?').padEnd(30)} ${p2.date||'?'}`);
  console.log(`  ${'Raw chars'.padEnd(24)} ${((r1?.length||'?')+'').padEnd(30)} ${r2?.length||'?'}`);
  console.log(`  ${'Tags'.padEnd(24)} ${p1.tags.join(',').padEnd(30)} ${p2.tags.join(',')}`);
  console.log(`  ${'Key patterns'.padEnd(24)} ${(p1.key_patterns_file||'-').padEnd(30)} ${p2.key_patterns_file||'-'}`);
  console.log();

  if (r1 && r2) {
    const l1 = r1.split('\n');
    const l2 = r2.split('\n');
    const maxLines = Math.min(30, Math.max(l1.length, l2.length));
    console.log(`  First ${maxLines} lines (side-by-side comparison):\n`);
    for (let i = 0; i < maxLines; i++) {
      const a = (l1[i] || '').slice(0, 60).padEnd(60);
      const b = (l2[i] || '').slice(0, 60);
      console.log(`  ${a}  │  ${b}`);
    }
  }
}

function cmdExport(args) {
  const id = args[0];
  const format = args.includes('--format') ? args[args.indexOf('--format') + 1] : 'md';
  if (!id) { console.error('Usage: export <id> [--format md|json|txt]'); process.exit(1); }
  const p = getPrompt(id);
  const raw = readRaw(id);
  const outFile = path.join(ROOT, `${p.id}.${format === 'json' ? 'json' : format === 'txt' ? 'txt' : 'md'}`);

  let output = '';
  if (format === 'json') {
    output = JSON.stringify({ metadata: p, raw: raw || null }, null, 2);
  } else if (format === 'txt') {
    output = raw || '(not cached)';
  } else {
    output = `# ${p.name}\n\n`;
    output += `- **Model:** ${p.model_family} ${p.version}\n`;
    output += `- **Date:** ${p.date || 'unknown'}\n`;
    output += `- **Source:** ${p.source_url || 'none'}\n`;
    output += `- **Tags:** ${p.tags.join(', ')}\n\n`;
    output += raw || '(not cached)';
  }

  writeFileSync(outFile, output, 'utf8');
  console.log(`  ✓ Exported "${id}" → ${outFile} (${output.length} chars)`);
}

function cmdUse(args) {
  const id = args[0];
  if (!id) { console.error('Usage: use <id>'); process.exit(1); }
  const p = getPrompt(id);
  const raw = readRaw(id);

  console.log(`\n  Loaded "${p.name}" for session context.\n`);
  console.log(`  To inject, read from: system-prompts/raw/${p.id}.txt\n`);
  console.log(`  ── ${p.name} (${p.model_family}) ──\n`);
  console.log(`  Source: ${p.source_url || 'local'}`);
  console.log(`  Date:   ${p.date || 'unknown'}`);
  console.log(`  Size:   ${raw ? `${raw.length} chars` : '(not cached)'}\n`);

  if (raw) {
    const lines = raw.split('\n');
    const preview = lines.slice(0, 20);
    preview.forEach(l => console.log(`  ${l}`));
    if (lines.length > 20) console.log(`  ... (${lines.length - 20} more lines)`);
  }
}

function cmdEdit(args) {
  const id = args[0];
  if (!id) { console.error('Usage: edit <id> [--key <key> --value <val>]'); process.exit(1); }
  const reg = readRegistry();
  const idx = reg.prompts.findIndex(p => p.id === id);
  if (idx === -1) { console.error(`  ✗ Prompt "${id}" not found`); process.exit(1); }

  const keyIdx = args.indexOf('--key');
  const valIdx = args.indexOf('--value');

  if (keyIdx !== -1 && args[keyIdx + 1]) {
    const key = args[keyIdx + 1];
    let val = valIdx !== -1 && args[valIdx + 1] ? args[valIdx + 1] : null;

    // Parse JSON values for arrays
    if (val && (val.startsWith('[') || val.startsWith('{'))) {
      try { val = JSON.parse(val); } catch {}
    }

    reg.prompts[idx][key] = val;
    writeRegistry(reg);
    console.log(`  ✓ Updated ${id}.${key} = ${JSON.stringify(val)}`);
  } else {
    console.log(`\n  Current metadata for "${id}":\n`);
    for (const [k, v] of Object.entries(reg.prompts[idx])) {
      console.log(`  ${k}: ${JSON.stringify(v)}`);
    }
    console.log('\n  Edit with: --key <field> --value <newvalue>');
  }
}

function cmdRemove(args) {
  const id = args[0];
  if (!id) { console.error('Usage: remove <id>'); process.exit(1); }
  const reg = readRegistry();
  const idx = reg.prompts.findIndex(p => p.id === id);
  if (idx === -1) { console.error(`  ✗ Prompt "${id}" not found`); process.exit(1); }

  const p = reg.prompts[idx];

  // Delete raw file if exists
  if (p.local_path) {
    const rf = path.join(ROOT, 'system-prompts', p.local_path);
    if (existsSync(rf)) {
      unlinkSync(rf);
      console.log(`  ✗ Deleted raw file: ${p.local_path}`);
    }
  }

  reg.prompts.splice(idx, 1);
  writeRegistry(reg);
  console.log(`  ✗ Removed "${id}" from registry`);
}

function cmdValidate(args) {
  const reg = readRegistry();
  let errors = 0;

  for (const p of reg.prompts) {
    if (!p.id) { console.error('  ✗ Prompt missing id'); errors++; continue; }
    if (!p.name) { console.error(`  ✗ ${p.id}: missing name`); errors++; }
    if (!p.model_family) { console.error(`  ✗ ${p.id}: missing model_family`); errors++; }
    if (!p.tags || !Array.isArray(p.tags)) { console.error(`  ✗ ${p.id}: missing or invalid tags`); errors++; }

    // Check file consistency
    if (p.local_path) {
      if (!existsSync(path.join(ROOT, 'system-prompts', p.local_path))) {
        console.log(`  ⚠ ${p.id}: local_path "${p.local_path}" not found on disk`);
      }
    }
    if (p.key_patterns_file) {
      if (!existsSync(path.join(ROOT, 'system-prompts', p.key_patterns_file))) {
        console.log(`  ⚠ ${p.id}: key_patterns_file "${p.key_patterns_file}" not found`);
      }
    }
  }

  console.log(`  ${errors ? `✗ ${errors} errors` : '✓ All valid'} (${reg.prompts.length} prompts)`);
}

// ─── Main ──────────────────────────────────────────────────────────────

const cmd = process.argv[2];
const args = process.argv.slice(3);

const commands = {
  list: cmdList,
  view: cmdView,
  fetch: cmdFetch,
  create: cmdCreate,
  search: cmdSearch,
  compare: cmdCompare,
  export: cmdExport,
  use: cmdUse,
  edit: cmdEdit,
  remove: cmdRemove,
  validate: cmdValidate,
  market: cmdMarket,
};

if (!cmd || !commands[cmd]) {
  console.log(`
  System Prompt Manager — CLI

  Usage:
    list [--tag <tag>]          List prompts
    view <id> [--patterns]      View prompt details
    fetch <id> | --all          Download raw prompt
    create <id> --url <url>     Create from URL
    create <id> --file <path>   Create from file
    search <query>              Search content
    compare <id1> <id2>         Diff prompts
    export <id> [--format md|json|txt]
    use <id>                    Load into session
    edit <id> [--key <k> --value <v>]
    remove <id>
    validate                    Check registry integrity
    market                      Browse & download from YeeKal/leaked-system-prompts
      market list               List all 116 available prompts
      market search <query>     Search market
      market info <id>          Show prompt details
      market download <id|--all> Import to local registry
      market cache              Refresh market index
`);
  process.exit(cmd ? 1 : 0);
}

try {
  commands[cmd](args);
} catch (e) {
  console.error(`  ✗ Error: ${e.message}`);
  process.exit(1);
}
