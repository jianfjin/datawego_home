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
  // `--skip-deploy` assembles dist/ and stops, so `wrangler pages dev` can serve
  // the page and the Function together without shipping anything to Cloudflare.
  const assembleOnly = process.argv.includes('--skip-deploy');

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
  const docsDistDir = path.join(distDir, 'docs');
  fs.rmSync(docsDistDir, { recursive: true, force: true });
  for (const doc of diagramDocs) {
    const src = path.join(projectRoot, 'docs', doc);
    if (!fs.existsSync(src)) {
      log(`❌ Missing committed diagram doc: docs/${doc} — aborting before deploy`, 'red');
      process.exit(1);
    }
    fs.mkdirSync(docsDistDir, { recursive: true });
    fs.copyFileSync(src, path.join(docsDistDir, doc));
  }
  log('✅ dist/ ready (index.html + resources/ + docs/ diagrams)', 'green');

  // Step 1b: Functions routing, and the guards that keep it honest.
  // functions/ stays tracked at the repo root — wrangler reads it from the
  // directory the command runs in, which is projectRoot below — so the Function is
  // bundled from source and nothing has to be copied into dist/. A dist/functions
  // would instead be uploaded as a static asset (its source readable at a URL), and
  // a dist/_worker.js replaces the routing altogether. Both are fatal here.
  fs.writeFileSync(
    path.join(distDir, '_routes.json'),
    JSON.stringify({ version: 1, include: ['/api/*'], exclude: [] }, null, 2) + '\n'
  );
  for (const hazard of ['_worker.js', 'functions']) {
    if (fs.existsSync(path.join(distDir, hazard))) {
      log(`❌ dist/${hazard} exists — it would ship as an asset beside the Function. Remove dist/ and re-run.`, 'red');
      process.exit(1);
    }
  }
  log('✅ Functions routing ready (_routes.json covers only /api/*; no dist/functions, no _worker.js)', 'green');

  if (assembleOnly) {
    log('⏭  dist/ assembled, nothing deployed. Run `npx wrangler pages dev` for http://localhost:8788', 'green');
    return;
  }

  // Step 2: Deploy to Cloudflare Pages (production branch)
  log('🌐 Deploying to Cloudflare Pages...', 'yellow');
  exec(`npx wrangler pages deploy dist --project-name=datawego --branch=main --commit-dirty`, {
    cwd: projectRoot
  });

  log('✨ Deployment complete! https://datawego.pages.dev/', 'green');
}

main();
