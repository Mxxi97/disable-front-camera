#!/usr/bin/env node
/**
 * Builds the mod against every target in versions.json, one Gradle invocation per
 * target, and prints a pass/fail table. This is the same coverage CI gives you,
 * without having to push.
 *
 *   node .github/scripts/build-all.mjs                 # every target
 *   node .github/scripts/build-all.mjs --only 21.8.54  # one target (repeatable)
 *   node .github/scripts/build-all.mjs --no-parchment  # skip dev-time mappings (faster)
 *
 * Exits non-zero if any target failed.
 */

import { readFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { platform } from 'node:process'

const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const WINDOWS = platform === 'win32'
// cmd.exe does not resolve a bare gradlew.bat from the working directory, and Node
// will not spawn a .bat at all without a shell, so pass a quoted absolute path.
const GRADLEW = WINDOWS ? `"${join(ROOT, 'gradlew.bat')}"` : './gradlew'

const only = process.argv.reduce((acc, arg, i, all) => {
  if (arg === '--only' && all[i + 1]) acc.push(all[i + 1])
  return acc
}, [])
const useParchment = !process.argv.includes('--no-parchment')

function run (target) {
  const args = ['build', `-Pneo_version=${target.neoforge}`]
  // Parchment only decorates the decompiled Minecraft sources, so it never affects
  // the jar -- but it makes local debugging far more readable. Both properties must
  // be set together or ModDevGradle throws.
  if (useParchment && target.parchment) {
    args.push(`-PneoForge.parchment.minecraftVersion=${target.minecraft}`)
    args.push(`-PneoForge.parchment.mappingsVersion=${target.parchment}`)
  }

  return new Promise((resolve) => {
    const started = Date.now()
    const child = spawn(GRADLEW, args, { cwd: ROOT, stdio: 'inherit', shell: WINDOWS })
    let spawnError = null
    child.on('error', (error) => { spawnError = error })
    child.on('close', (code) => {
      if (spawnError) console.error(`Could not run Gradle: ${spawnError.message}`)
      resolve({
        target,
        ok: code === 0 && !spawnError,
        seconds: Math.round((Date.now() - started) / 1000)
      })
    })
  })
}

const { targets } = JSON.parse(await readFile(new URL('../../versions.json', import.meta.url), 'utf8'))
const selected = only.length > 0 ? targets.filter((t) => only.includes(t.neoforge)) : targets

if (selected.length === 0) {
  console.error(`No targets matched ${only.join(', ')}.`)
  process.exit(1)
}

const results = []
for (const [index, target] of selected.entries()) {
  console.log(`\n=== [${index + 1}/${selected.length}] Minecraft ${target.minecraft} / NeoForge ${target.neoforge} ===\n`)
  results.push(await run(target))
}

console.log('\n================ summary ================')
for (const { target, ok, seconds } of results) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${target.minecraft.padEnd(9)} NeoForge ${target.neoforge.padEnd(16)} ${seconds}s`)
}

const failed = results.filter((r) => !r.ok)
if (failed.length > 0) {
  console.log(`\n${failed.length} of ${results.length} targets failed.`)
  console.log('To patch a single version, drop a replacement file in src/versions/<minecraftVersion>/java/')
  process.exit(1)
}
console.log(`\nAll ${results.length} targets built.`)
