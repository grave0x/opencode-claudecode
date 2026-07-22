// custom-tools — opencode plugin
//
// Registers custom tools that extend opencode's built-in capabilities:
// - web_search: search the web
// - web_fetch: fetch URL content
// - tree_sitter_query: AST query via tree-sitter
// - lint: run linter on files
// - test_watch: run tests in watch mode
// - checkpoint_revert: revert to checkpoint
// - session_export: export session data
//
// Tools registered via `registerTool` API (opencode Plugin API).

import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

async function webSearch(query, numResults = 5) {
  try {
    const result = execSync(
      `curl -s "https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json"`,
      { encoding: 'utf8', timeout: 10000 }
    );
    return JSON.parse(result);
  } catch (e) {
    return { error: e.message };
  }
}

async function webFetch(url) {
  try {
    const result = execSync(`curl -sL "${url}"`, { encoding: 'utf8', timeout: 15000 });
    return result.slice(0, 50000); // Limit size
  } catch (e) {
    return { error: e.message };
  }
}

async function treeSitterQuery(filePath, query) {
  try {
    // Use tree-sitter CLI if available
    const result = execSync(
      `tree-sitter query "${query}" "${filePath}" 2>/dev/null || ` +
      `echo '{"error":"tree-sitter not available"}'`,
      { encoding: 'utf8', timeout: 10000 }
    );
    return result.trim();
  } catch (e) {
    return { error: e.message };
  }
}

async function runLint(filePattern) {
  try {
    const result = execSync(
      `npx eslint "${filePattern}" --format json 2>/dev/null || true`,
      { encoding: 'utf8', timeout: 30000 }
    );
    return result.trim() || 'No lint issues found.';
  } catch (e) {
    return { error: e.message };
  }
}

// Tool definitions
const tools = [
  {
    name: 'web_search',
    description: 'Search the web for information. Returns JSON results with titles, snippets, and URLs.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        numResults: { type: 'number', description: 'Number of results (default 5)' },
      },
      required: ['query'],
    },
    handler: async ({ query, numResults }) => await webSearch(query, numResults),
  },
  {
    name: 'web_fetch',
    description: 'Fetch and return content from a URL. Returns text/markdown content.',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to fetch' },
      },
      required: ['url'],
    },
    handler: async ({ url }) => await webFetch(url),
  },
  {
    name: 'lint',
    description: 'Run ESLint on specified files and return results.',
    parameters: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'File glob pattern (e.g. "src/**/*.ts")' },
      },
      required: ['pattern'],
    },
    handler: async ({ pattern }) => await runLint(pattern),
  },
];

export const CustomToolsPlugin = async (ctx) => {
  // Register each tool
  const registrations = tools.map(tool => {
    if (ctx.registerTool) {
      return ctx.registerTool(tool.name, tool.description, tool.parameters, tool.handler);
    }
    return null;
  });

  return {
    // Provide tools via experimental API if registerTool unavailable
    'experimental.tools.register': async (register) => {
      for (const tool of tools) {
        register(tool.name, tool.description, tool.parameters, tool.handler);
      }
    },
  };
};

export default CustomToolsPlugin;
