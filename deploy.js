#!/usr/bin/env node

/**
 * DataWeGo Deployment Script
 * Runs the generator, then ships dist/ to Cloudflare Pages.
 *
 * It no longer assembles anything. ADR 0003 makes build.mjs the sole writer of
 * dist/, and a second writer that copies `datawego-company-site.html` over
 * `dist/index.html` would undo the one thing the plan is built on — it would
 * publish the English-authored source as the Dutch address. So this file's whole
 * job is: build, then deploy, and stop if the build says no.
 */

const { execSync } = require('child_process');
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
    process.exit(error.status ?? 1);
  }
}

function main() {
  const projectRoot = __dirname;
  // `--skip-deploy` builds and stops, so `wrangler pages dev` can serve the page
  // and the Function together without shipping anything to Cloudflare.
  const assembleOnly = process.argv.includes('--skip-deploy');

  log('🚀 Starting DataWeGo deployment...', 'yellow');

  // Step 1: generate dist/ (pages in both variants, resources, diagrams,
  // Functions routing). A refusal here — an address that appears twice, a
  // visible string with no Dutch, a stale copy of a Diagram page — exits with
  // the build's own message and nothing is deployed.
  log('📦 Generating dist/...', 'yellow');
  exec(`"${process.execPath}" build.mjs`, { cwd: projectRoot });

  if (assembleOnly) {
    log('⏭  dist/ assembled, nothing deployed. Run `npx wrangler pages dev` for http://localhost:8788', 'green');
    return;
  }

  // Step 2: Deploy to Cloudflare Pages (production branch)
  log('🌐 Deploying to Cloudflare Pages...', 'yellow');
  exec(`npx wrangler pages deploy dist --project-name=datawego --branch=main --commit-dirty`, {
    cwd: projectRoot
  });

  log('✨ Deployment complete! https://www.datawego.nl/', 'green');
}

main();
