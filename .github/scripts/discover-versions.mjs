#!/usr/bin/env node
/**
 * Discovers every NeoForge target this mod should be built against and writes
 * versions.json (plus the supported-versions table in README.md).
 *
 * The awkward part this handles: Minecraft changed its version scheme partway
 * through the range we support. The 1.21.x line ran to 1.21.11, then Mojang
 * switched to calendar versions (26.1, 26.2, 26.3), and NeoForge followed by
 * going from three-component versions (21.8.54) to four (26.2.0.88). So there is
 * no arithmetic rule mapping a NeoForge version to its Minecraft version. Instead
 * we read it out of the NeoForge POM, which declares a dependency on
 * net.neoforged:neoform:<minecraftVersion>-<suffix>.
 *
 *   node .github/scripts/discover-versions.mjs           # rewrite versions.json + README
 *   node .github/scripts/discover-versions.mjs --check   # exit 1 if they are stale
 */

import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const NEOFORGE_VERSIONS =
  'https://maven.neoforged.net/api/maven/versions/releases/net%2Fneoforged%2Fneoforge'
const NEOFORGE_POM = (v) =>
  `https://maven.neoforged.net/releases/net/neoforged/neoforge/${v}/neoforge-${v}.pom`
const PARCHMENT_METADATA = (mc) =>
  `https://maven.parchmentmc.org/org/parchmentmc/data/parchment-${mc}/maven-metadata.xml`
const MODDEV_METADATA =
  'https://plugins.gradle.org/m2/net/neoforged/moddev/net.neoforged.moddev.gradle.plugin/maven-metadata.xml'

// Minecraft 1.21.1 was the mod's original target; never regress below it.
// (There is deliberately no 21.2 series -- NeoForge skipped Minecraft 1.21.2.)
const FLOOR_SERIES = [21, 1]

const VERSIONS_JSON = fileURLToPath(new URL('../../versions.json', import.meta.url))
const README = fileURLToPath(new URL('../../README.md', import.meta.url))
const README_START = '<!-- versions:start -->'
const README_END = '<!-- versions:end -->'

async function get (url, { optional = false } = {}) {
  let lastError
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { headers: { 'user-agent': 'disable-front-camera-ci' } })
      if (response.status === 404 && optional) return null
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
      return await response.text()
    } catch (error) {
      lastError = error
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)))
    }
  }
  if (optional) return null
  throw lastError
}

/**
 * Splits a NeoForge version into its series and build number. The series is
 * everything except the final component, which makes this work unchanged across
 * both version schemes: 21.1.250 -> series 21.1, 26.2.0.88 -> series 26.2.0.
 */
function parseNeoVersion (version) {
  const match = /^(\d+(?:\.\d+)*)\.(\d+)(-beta)?$/.exec(version)
  if (!match) return null
  return {
    version,
    series: match[1],
    build: Number(match[2]),
    beta: Boolean(match[3])
  }
}

function compareSeries (a, b) {
  const left = a.split('.').map(Number)
  const right = b.split('.').map(Number)
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

function atOrAboveFloor (series) {
  const parts = series.split('.').map(Number)
  for (let i = 0; i < FLOOR_SERIES.length; i++) {
    const diff = (parts[i] ?? 0) - FLOOR_SERIES[i]
    if (diff !== 0) return diff > 0
  }
  return true
}

/** Latest build in a series, preferring a stable release over a beta. */
function pickBest (candidates) {
  const stable = candidates.filter((c) => !c.beta)
  const pool = stable.length > 0 ? stable : candidates
  return pool.reduce((best, c) => (c.build > best.build ? c : best))
}

/**
 * Reads the Minecraft version out of a NeoForge POM via its neoform dependency,
 * e.g. neoform 1.21.8-20250717.133445 -> 1.21.8, neoform 26.2-2 -> 26.2.
 */
async function minecraftVersionFor (neoVersion) {
  const pom = await get(NEOFORGE_POM(neoVersion))
  for (const [, body] of pom.matchAll(/<dependency>([\s\S]*?)<\/dependency>/g)) {
    if (!/<artifactId>\s*neoform\s*<\/artifactId>/.test(body)) continue
    const version = /<version>\s*([^<\s]+)\s*<\/version>/.exec(body)?.[1]
    if (!version) break
    const stripped = /^(.*)-(?:\+|\d{8}\.\d{6}|\d+)$/.exec(version)
    return stripped ? stripped[1] : version
  }
  throw new Error(`Could not find a neoform dependency in the POM for NeoForge ${neoVersion}`)
}

function latestFromMavenMetadata (xml) {
  if (!xml) return null
  const release = /<release>\s*([^<\s]+)\s*<\/release>/.exec(xml)?.[1]
  if (release) return release
  const all = [...xml.matchAll(/<version>\s*([^<\s]+)\s*<\/version>/g)].map((m) => m[1])
  return all.length > 0 ? all[all.length - 1] : null
}

/** Parchment is dev-time only, and is not published for the 26.x versions at all. */
async function parchmentFor (minecraftVersion) {
  return latestFromMavenMetadata(await get(PARCHMENT_METADATA(minecraftVersion), { optional: true }))
}

async function discover () {
  const listing = JSON.parse(await get(NEOFORGE_VERSIONS))
  const versions = (listing.versions ?? [])
    .map(parseNeoVersion)
    .filter((v) => v && atOrAboveFloor(v.series))

  const bySeries = new Map()
  for (const version of versions) {
    if (!bySeries.has(version.series)) bySeries.set(version.series, [])
    bySeries.get(version.series).push(version)
  }

  const chosen = [...bySeries.entries()]
    .sort(([a], [b]) => compareSeries(a, b))
    .map(([, candidates]) => pickBest(candidates))

  const targets = []
  for (const candidate of chosen) {
    const minecraft = await minecraftVersionFor(candidate.version)
    targets.push({
      minecraft,
      neoforge: candidate.version,
      beta: candidate.beta,
      parchment: await parchmentFor(minecraft)
    })
  }

  return {
    moddev_version: latestFromMavenMetadata(await get(MODDEV_METADATA)) ?? '2.0.147',
    targets
  }
}

function renderReadmeTable (data) {
  const rows = data.targets
    .slice()
    .reverse()
    .map((t) => `| ${t.minecraft} | ${t.neoforge}${t.beta ? ' (beta)' : ''} |`)
  return [
    README_START,
    '',
    '| Minecraft | NeoForge |',
    '| --- | --- |',
    ...rows,
    '',
    README_END
  ].join('\n')
}

async function updateReadme (data) {
  const readme = await readFile(README, 'utf8')
  const table = renderReadmeTable(data)
  const start = readme.indexOf(README_START)
  const end = readme.indexOf(README_END)
  if (start === -1 || end === -1) {
    return readme.trimEnd() + '\n\n## Supported versions\n\n' + table + '\n'
  }
  return readme.slice(0, start) + table + readme.slice(end + README_END.length)
}

/** Lets the scheduled workflow branch on the result without re-parsing stdout. */
async function emitGithubOutput (values) {
  if (!process.env.GITHUB_OUTPUT) return
  const lines = Object.entries(values).map(([k, v]) => `${k}=${v}`).join('\n')
  await writeFile(process.env.GITHUB_OUTPUT, lines + '\n', { flag: 'a' })
}

const check = process.argv.includes('--check')
const data = await discover()
const serialised = JSON.stringify(data, null, 2) + '\n'
const readme = await updateReadme(data)

if (check) {
  const currentJson = await readFile(VERSIONS_JSON, 'utf8').catch(() => '')
  const currentReadme = await readFile(README, 'utf8').catch(() => '')
  if (currentJson === serialised && currentReadme === readme) {
    console.log(`versions.json is up to date (${data.targets.length} targets).`)
    await emitGithubOutput({ stale: false, added: '[]' })
    process.exit(0)
  }
  const known = new Set(JSON.parse(currentJson || '{"targets":[]}').targets.map((t) => t.neoforge))
  const added = data.targets.filter((t) => !known.has(t.neoforge))
  console.log('versions.json is out of date.')
  for (const target of added) {
    console.log(`  new target: Minecraft ${target.minecraft} / NeoForge ${target.neoforge}`)
  }
  console.log(JSON.stringify({ added }, null, 2))
  await emitGithubOutput({ stale: true, added: JSON.stringify(added) })
  // The scheduled workflow treats a non-zero exit as "there is work to do", so it
  // only signals staleness when asked to fail.
  process.exit(process.argv.includes('--soft') ? 0 : 1)
}

await writeFile(VERSIONS_JSON, serialised)
await writeFile(README, readme)
console.log(`Wrote versions.json with ${data.targets.length} targets.`)
for (const target of data.targets) {
  console.log(`  ${target.minecraft.padEnd(9)} <- NeoForge ${target.neoforge}`)
}
