#!/usr/bin/env node

/**
 * DataWeGo Deployment Script
 * Syncs the static site into dist/ and deploys to Cloudflare Pages
 * (same pattern as ~/projects/edm_home/deploy.js, minus the build step —
 * this site is a single self-contained HTML file with no bundler).
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const colors = {
  red: '\x1b[0;31m',
  green: '\x1b[0;32m',
  yellow: '\x1b[1;33m',
  nc: '\x1b[0m'
};

function log(message, color = 'nc') {
  console.log(`${colors[color]}${message}${colors.nc}`);
}

function exec(command, options = {}) {
  try {
    return execSync(command, { stdio: 'inherit', ...options });
  } catch (error) {
    log(`❌ Command failed: ${command}`, 'red');
    process.exit(1);
  }
}

function main() {
  const projectRoot = __dirname;
  const distDir = path.join(projectRoot, 'dist');

  log('🚀 Starting DataWeGo deployment...', 'yellow');

  // Step 1: Sync static site into dist/
  log('📦 Assembling dist/...', 'yellow');
  fs.mkdirSync(distDir, { recursive: true });
  fs.copyFileSync(
    path.join(projectRoot, 'datawego-company-site.html'),
    path.join(distDir, 'index.html')
  );
  const resourcesDir = path.join(projectRoot, 'resources');
  if (fs.existsSync(resourcesDir)) {
    fs.cpSync(resourcesDir, path.join(distDir, 'resources'), { recursive: true });
  }
  // Architecture diagram pages linked from the case studies (explicit list —
  // docs/ also holds plans/ and design notes that must not ship publicly).
  const diagramDocs = [
    'pharm-platform.html',
    'etl-dataflow-with-prepass.html',
    'marketing-research-swarm.html',
    'ehr-platform-architecture-with-prepass.html'
  ];
  for (const doc of diagramDocs) {
    const src = path.join(projectRoot, 'docs', doc);
    if (fs.existsSync(src)) {
      fs.mkdirSync(path.join(distDir, 'docs'), { recursive: true });
      fs.copyFileSync(src, path.join(distDir, 'docs', doc));
    } else {
      log(`⚠️  Missing diagram doc: docs/${doc}`, 'yellow');
    }
  }
  log('✅ dist/ ready (index.html + resources/ + docs/ diagrams)', 'green');

  // Step 2: Deploy to Cloudflare Pages (production branch)
  log('🌐 Deploying to Cloudflare Pages...', 'yellow');
  exec(`npx wrangler pages deploy dist --project-name=datawego --branch=main --commit-dirty`, {
    cwd: projectRoot
  });

  log('✨ Deployment complete! https://datawego.pages.dev/', 'green');
}

main();
