#!/usr/bin/env bash
set -euo pipefail

project_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
dist_root="$project_root/dist"

rm -rf "$dist_root"
mkdir -p "$dist_root/server" "$dist_root/.openai"
node --input-type=module - "$project_root" <<'JS'
import {readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
const root = process.argv[2];
const page = readFileSync(join(root, 'worker/index.html'), 'utf8');
const worker = readFileSync(join(root, 'worker/index.js'), 'utf8');
writeFileSync(join(root, 'dist/server/index.js'),
  worker.replace("import page from './page.js';", () => 'const page = ' + JSON.stringify(page) + ';'));
JS

cp "$project_root/.openai/hosting.json" "$dist_root/.openai/hosting.json"

echo "Built $dist_root"
