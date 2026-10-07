#!/usr/bin/env node
/**
 * Writes release notes (markdown) by comparing versions.json at the previous
 * v-tag with the current one, plus any hand-written commit subjects in between.
 *
 *   node .github/scripts/changelog.mjs --out changelog.md [--version 1.2.9]
 *
 * --version defaults to mod_version in gradle.properties. The previous tag is
 * the highest v-tag below that version. Needs the full tag list, so CI
 * checkouts need fetch-depth: 0.
 */

import { readFile, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const arg = (name) => {
  const i = process.argv.indexOf(name)
  return i === -1 ? undefined : process.argv[i + 1]
}
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', cwd: ROOT })

const out = arg('--out')
if (!out) {
  console.error('--out <file> is required')
  process.exit(1)
}

const props = await readFile(`${ROOT}gradle.properties`, 'utf8')
const version = arg('--version') ?? /^mod_version=(.+)$/m.exec(props)?.[1].trim()
const parse = (v) => v.split('.').map(Number)
const cmp = (a, b) => {
  const [x, y] = [parse(a), parse(b)]
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i]
  return 0
}

const previous = git('tag', '-l', 'v*').split('\n')
  .map((t) => t.trim().replace(/^v/, ''))
  .filter((v) => /^\d+\.\d+\.\d+$/.test(v) && cmp(v, version) < 0)
  .sort(cmp)
  .pop()

const lines = []
const current = JSON.parse(await readFile(`${ROOT}versions.json`, 'utf8'))
let before = null
if (previous) {
  try {
    before = JSON.parse(git('show', `v${previous}:versions.json`))
  } catch {
    // Early tags may predate versions.json; fall through to the generic note.
  }
}

if (before) {
  const index = (d) => new Map(d.targets.map((t) => [t.minecraft, t]))
  const [old, now] = [index(before), index(current)]
  const label = (t) => `${t.neoforge}${t.beta ? ' (beta)' : ''}`

  const added = [...now.keys()].filter((m) => !old.has(m))
  const removed = [...old.keys()].filter((m) => !now.has(m))
  const neo = [...now].filter(([m, t]) => old.has(m) && old.get(m).neoforge !== t.neoforge)
    .map(([m, t]) => `- ${m}: NeoForge ${label(old.get(m))} → ${label(t)}`)
  const fabricAdded = [...now].filter(([m, t]) => old.has(m) && t.fabric != null && old.get(m).fabric == null).map(([m]) => m)
  const fabricRemoved = [...now].filter(([m, t]) => old.has(m) && t.fabric == null && old.get(m).fabric != null).map(([m]) => m)

  if (added.length) lines.push('### Added Minecraft versions', ...added.map((m) => `- ${m}${now.get(m).beta ? ' (NeoForge beta)' : ''}`), '')
  if (removed.length) lines.push('### Dropped Minecraft versions', ...removed.map((m) => `- ${m}`), '')
  if (fabricAdded.length) lines.push('### Fabric support added', ...fabricAdded.map((m) => `- ${m}`), '')
  if (fabricRemoved.length) lines.push('### Fabric support dropped', ...fabricRemoved.map((m) => `- ${m}`), '')
  if (neo.length) lines.push('### Rebuilt and verified against newer NeoForge', ...neo, '')
  if (before.fabric_loader !== current.fabric_loader) {
    lines.push(`### Fabric Loader`, `- Built against ${current.fabric_loader} (was ${before.fabric_loader})`, '')
  }
}

// Hand-written changes between the tags. Automated version-sync commits are
// already summarised above, so they are filtered out.
if (previous) {
  const subjects = git('log', '--no-merges', '--format=%s', `v${previous}..HEAD`).split('\n')
    .map((s) => s.trim())
    .filter((s) => s && !/^(Support new Minecraft versions|Support new NeoForge beta metadata|Update version metadata)/.test(s))
  if (subjects.length) lines.push('### Other changes', ...subjects.map((s) => `- ${s}`), '')
}

if (!lines.length) {
  lines.push('Maintenance release: no functional changes to the mod.', '')
}
lines.push('Supported Minecraft versions: ' + current.targets.map((t) => t.minecraft).join(', '))

await writeFile(out, lines.join('\n') + '\n')
console.log(`Wrote ${out} (v${version}, previous ${previous ? 'v' + previous : 'none'}):\n`)
console.log(lines.join('\n'))
