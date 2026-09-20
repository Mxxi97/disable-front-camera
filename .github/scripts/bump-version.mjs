#!/usr/bin/env node
/**
 * Bumps mod_version in gradle.properties and prints the new version.
 *
 * gradle.properties is the single source of truth for the released version: the
 * release workflow publishes whatever it says, NOT the tag name. Tag v1.1.2 once
 * shipped as "1.1.0" on Modrinth because the two were edited independently, so
 * this script is the only supported way to move the version -- the caller tags
 * the very commit this produces, keeping tag and gradle.properties in lockstep.
 *
 *   node .github/scripts/bump-version.mjs --bump patch|minor|major   # default: patch
 *   node .github/scripts/bump-version.mjs --set 1.2.0
 *
 * In --bump mode, versions whose v-tag already exists are skipped (patch keeps
 * incrementing until a free tag is found): stale tags from failed pipeline runs
 * (v1.1.1, v1.1.2) would otherwise wedge the daily automation forever. In --set
 * mode a collision is a hard error, because an explicit version was asked for.
 *
 * Requires the full tag list, so CI checkouts need fetch-depth: 0.
 */

import { readFile, writeFile, appendFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const GRADLE_PROPERTIES = fileURLToPath(new URL('../../gradle.properties', import.meta.url))
const VERSION_RE = /^\d+\.\d+\.\d+$/

function fail (message) {
  console.error(`::error title=Version bump failed::${message}`)
  process.exit(1)
}

function tagExists (version) {
  const out = execFileSync('git', ['tag', '-l', `v${version}`], { encoding: 'utf8' })
  return out.trim() !== ''
}

function bump (version, part) {
  const [major, minor, patch] = version.split('.').map(Number)
  if (part === 'major') return `${major + 1}.0.0`
  if (part === 'minor') return `${major}.${minor + 1}.0`
  return `${major}.${minor}.${patch + 1}`
}

const args = process.argv.slice(2)
const setIndex = args.indexOf('--set')
const bumpIndex = args.indexOf('--bump')
const explicit = setIndex !== -1 ? args[setIndex + 1] : null
const part = bumpIndex !== -1 ? args[bumpIndex + 1] : 'patch'
if (!explicit && !['patch', 'minor', 'major'].includes(part)) {
  fail(`Unknown bump type '${part}'. Use patch, minor or major.`)
}

const properties = await readFile(GRADLE_PROPERTIES, 'utf8')
const current = /^mod_version=(.*)$/m.exec(properties)?.[1]?.trim()
if (!current || !VERSION_RE.test(current)) {
  fail(`Could not read a semver mod_version from gradle.properties (got '${current}').`)
}

let next
if (explicit) {
  if (!VERSION_RE.test(explicit)) fail(`'${explicit}' is not a MAJOR.MINOR.PATCH version.`)
  if (explicit === current) fail(`${explicit} is already the current version.`)
  if (tagExists(explicit)) fail(`Tag v${explicit} already exists. Pick another version.`)
  next = explicit
} else {
  next = bump(current, part)
  while (tagExists(next)) {
    console.log(`Skipping ${next}: tag v${next} already exists.`)
    next = bump(next, 'patch')
  }
}

const updated = properties.replace(/^mod_version=.*$/m, `mod_version=${next}`)
if (updated === properties) {
  fail('gradle.properties did not change. The mod_version line was not found.')
}
await writeFile(GRADLE_PROPERTIES, updated)

console.log(`mod_version: ${current} -> ${next}`)
if (process.env.GITHUB_OUTPUT) {
  await appendFile(process.env.GITHUB_OUTPUT, `version=${next}\n`)
}
