import { appendFileSync, writeFileSync } from 'node:fs'
import {
  findNew,
  formatReport,
  hasFindings,
  SOURCES,
  type Pages,
  type Supported
} from '../../src/upstream.ts'
import { knownRepoDirs } from '../../src/platform.ts'
import { LEGACY_VERSIONS, MULTIARCH_VERSIONS } from '../../src/versions.ts'

const supported: Supported = {
  multiarch: MULTIARCH_VERSIONS,
  legacy: LEGACY_VERSIONS,
  repoDirs: knownRepoDirs()
}

async function get(url: string): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  return res.text()
}

const entries = await Promise.all(
  Object.entries(SOURCES).map(async ([k, url]) => [k, await get(url)])
)
const findings = findNew(Object.fromEntries(entries) as Pages, supported)
const report = formatReport(findings, supported)

console.log(report)
if (process.argv[2]) writeFileSync(process.argv[2], report + '\n')
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `found=${hasFindings(findings)}\n`)
}
