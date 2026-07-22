#!/usr/bin/env node
// theme — Theme system for opencode sessions
//
// Manages color schemes, density, and display preferences.
// State stored in ~/.config/opencode/theme.json
//
// Usage:
//   node tools/theme.js                  # show current theme
//   node tools/theme.js --set dark       # set theme
//   node tools/theme.js --list           # list available themes
//   node tools/theme.js --density compact # set density

const fs = require('fs');
const path = require('path');
const os = require('os');

const CONFIG_DIR = process.env.XDG_CONFIG_HOME
  ? path.join(process.env.XDG_CONFIG_HOME, 'opencode')
  : path.join(os.homedir(), '.config', 'opencode');

const THEME_FILE = path.join(CONFIG_DIR, 'theme.json');

const THEMES = {
  dark: {
    name: 'Dark',
    bg: '#1a1a2e',
    fg: '#e0e0e0',
    accent: '#7c3aed',
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    border: '#333',
  },
  light: {
    name: 'Light',
    bg: '#ffffff',
    fg: '#1a1a2e',
    accent: '#7c3aed',
    success: '#059669',
    warning: '#d97706',
    error: '#dc2626',
    border: '#e5e7eb',
  },
  monokai: {
    name: 'Monokai',
    bg: '#272822',
    fg: '#f8f8f2',
    accent: '#a6e22e',
    success: '#a6e22e',
    warning: '#e6db74',
    error: '#f92672',
    border: '#3e3d32',
  },
  nord: {
    name: 'Nord',
    bg: '#2e3440',
    fg: '#d8dee9',
    accent: '#88c0d0',
    success: '#a3be8c',
    warning: '#ebcb8b',
    error: '#bf616a',
    border: '#4c566a',
  },
  solarized: {
    name: 'Solarized',
    bg: '#002b36',
    fg: '#839496',
    accent: '#268bd2',
    success: '#859900',
    warning: '#b58900',
    error: '#dc322f',
    border: '#073642',
  },
};

const DENSITIES = ['compact', 'normal', 'comfortable'];

function getDefaults() {
  return { theme: 'dark', density: 'normal' };
}

function loadConfig() {
  try {
    return { ...getDefaults(), ...JSON.parse(fs.readFileSync(THEME_FILE, 'utf8')) };
  } catch {
    return getDefaults();
  }
}

function saveConfig(config) {
  const dir = path.dirname(THEME_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(THEME_FILE, JSON.stringify(config, null, 2), 'utf8');
}

function listThemes() {
  console.log('Available themes:');
  for (const [key, t] of Object.entries(THEMES)) {
    console.log(`  ${key.padEnd(12)} ${t.name}`);
  }
  console.log('\nDensities:', DENSITIES.join(', '));
}

function showCurrent() {
  const config = loadConfig();
  const theme = THEMES[config.theme] || THEMES.dark;
  console.log(`Theme:   ${config.theme} (${theme.name})`);
  console.log(`Density: ${config.density}`);
  console.log(`\nColors:`);
  for (const [key, val] of Object.entries(theme)) {
    if (key !== 'name') console.log(`  ${key.padEnd(10)} ${val}`);
  }
}

function main() {
  const args = process.argv.slice(2);

  if (args.includes('--list')) {
    listThemes();
    return;
  }

  const setIdx = args.indexOf('--set');
  if (setIdx !== -1 && args[setIdx + 1]) {
    const themeName = args[setIdx + 1];
    if (!THEMES[themeName]) {
      console.error(`Unknown theme: ${themeName}. Use --list to see available themes.`);
      process.exit(1);
    }
    const config = loadConfig();
    config.theme = themeName;
    saveConfig(config);
    console.log(`Theme set to: ${themeName}`);
    return;
  }

  const densityIdx = args.indexOf('--density');
  if (densityIdx !== -1 && args[densityIdx + 1]) {
    const density = args[densityIdx + 1];
    if (!DENSITIES.includes(density)) {
      console.error(`Unknown density: ${density}. Use: ${DENSITIES.join(', ')}`);
      process.exit(1);
    }
    const config = loadConfig();
    config.density = density;
    saveConfig(config);
    console.log(`Density set to: ${density}`);
    return;
  }

  showCurrent();
}

if (require.main === module) main();

module.exports = { THEMES, loadConfig, saveConfig };
