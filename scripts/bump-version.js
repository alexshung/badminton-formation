#!/usr/bin/env node
// Rewrites the `?v=<n>` cache-busting query on every local asset in index.html
// to a single fresh value. The version was previously hand-copied across six
// <script>/<link> tags, which is easy to desync — leaving users on a mix of
// cached and fresh files after a deploy. Run `npm run bump` before shipping.
//
// Usage: node scripts/bump-version.js [version]   (defaults to current epoch ms)
const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '..', 'index.html');
const version = process.argv[2] || String(Date.now());

const before = fs.readFileSync(indexPath, 'utf8');
const matches = before.match(/\?v=\d+/g) || [];

if (matches.length === 0) {
  console.log('No ?v= cache-busting tags found in index.html — nothing to bump.');
  process.exit(0);
}

const after = before.replace(/(\?v=)\d+/g, `$1${version}`);
fs.writeFileSync(indexPath, after);
console.log(`Bumped ${matches.length} asset reference(s) to ?v=${version}`);
