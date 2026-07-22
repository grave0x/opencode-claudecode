#!/usr/bin/env node
// export-session — Session export utility
//
// Exports session history to Markdown or JSON format.
// Reads from opencode session data directory.
//
// Usage:
//   node tools/export-session.js                          # export as markdown
//   node tools/export-session.js --format json            # export as JSON
//   node tools/export-session.js --since "2h ago"         # time range
//   node tools/export-session.js --output ./session.md    # output path

const fs = require('fs');
const path = require('path');
const os = require('os');

function getSessionDir() {
  const hash = require('crypto').createHash('sha256')
    .update(process.cwd()).digest('hex').slice(0, 12);
  return path.join(os.homedir(), '.opencode-sessions', hash);
}

function getCheckpoints() {
  const cpFile = path.join(getSessionDir(), 'checkpoints.jsonl');
  try {
    const data = fs.readFileSync(cpFile, 'utf8').trim();
    return data.split('\n').filter(Boolean).map(line => JSON.parse(line));
  } catch { return []; }
}

function formatMarkdown(checkpoints) {
  let md = `# Session Export\n\n`;
  md += `**Exported:** ${new Date().toISOString()}\n`;
  md += `**Workspace:** ${process.cwd()}\n`;
  md += `**Checkpoints:** ${checkpoints.length}\n\n`;
  md += `---\n\n`;

  for (const cp of checkpoints) {
    md += `## Checkpoint #${cp.id}: ${cp.label}\n\n`;
    md += `- **Time:** ${cp.timestamp}\n`;
    md += `- **Files:**\n`;

    if (cp.files && cp.files.diff) {
      md += '```diff\n' + cp.files.diff + '\n```\n';
    }

    md += '\n---\n\n';
  }

  return md;
}

function formatJSON(checkpoints) {
  return JSON.stringify({
    exported: new Date().toISOString(),
    workspace: process.cwd(),
    session: path.basename(getSessionDir()),
    checkpointCount: checkpoints.length,
    checkpoints,
  }, null, 2);
}

function main() {
  const args = process.argv.slice(2);
  let format = 'markdown';
  let outputPath = null;
  let sinceTime = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--format' && args[i + 1]) {
      format = args[i + 1];
      if (!['markdown', 'json'].includes(format)) {
        console.error('Format must be "markdown" or "json"');
        process.exit(1);
      }
    }
    if (args[i] === '--output' && args[i + 1]) {
      outputPath = args[i + 1];
    }
    if (args[i] === '--since' && args[i + 1]) {
      sinceTime = args[i + 1];
    }
  }

  let checkpoints = getCheckpoints();

  // Filter by time if --since provided
  if (sinceTime) {
    const match = sinceTime.match(/^(\d+)\s*(h|m|s|d)\s*ago$/);
    if (match) {
      const amount = parseInt(match[1]);
      const unit = match[2];
      const ms = { h: 3600000, m: 60000, s: 1000, d: 86400000 }[unit];
      const cutoff = Date.now() - amount * ms;
      checkpoints = checkpoints.filter(cp =>
        new Date(cp.timestamp).getTime() >= cutoff
      );
    }
  }

  const output = format === 'json' ? formatJSON(checkpoints) : formatMarkdown(checkpoints);

  if (outputPath) {
    fs.writeFileSync(outputPath, output, 'utf8');
    console.log(`Session exported to: ${outputPath}`);
  } else {
    const defaultPath = `opencode-export-${Date.now()}.${format === 'json' ? 'json' : 'md'}`;
    fs.writeFileSync(defaultPath, output, 'utf8');
    console.log(`Session exported to: ${defaultPath}`);
  }
}

if (require.main === module) main();

module.exports = { formatMarkdown, formatJSON, getCheckpoints };
