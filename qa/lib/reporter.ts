// ApexSports QA — bug reporter (C0 harness)
// Single source of truth for the __qa_ prefix used by every spec when
// creating test data. Specs MUST `import { PREFIX } from './lib/reporter'`
// and NEVER hardcode "__qa_".
//
// appendBug writes structured markdown sections into the QA bug report so
// the C16 wave can roll up all defects into the final deliverable.
import { appendFileSync, existsSync, mkdirSync } from 'fs'
import { dirname, resolve } from 'path'

export const PREFIX = '__qa_'

const REPORT_PATH =
  'E:/2_Project(personal)/1_顶点体育/.omo/evidence/qa-bug-report.md'

export type Severity = 'P0' | 'P1' | 'P2' | 'P3'

export interface BugEntry {
  module: string
  caseKey: string
  step: string
  expected: string
  actual: string
  severity: Severity
  screenshotPath?: string
}

/**
 * Appends a single bug section to the QA bug report markdown. Creates the
 * file (and parent dir) on first call. Idempotent across calls — no
 * deduplication; every invocation produces a new section.
 */
export function appendBug(entry: BugEntry): void {
  const dir = dirname(REPORT_PATH)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19)
  const shot =
    entry.screenshotPath !== undefined
      ? `\n- **Screenshot**: ${entry.screenshotPath}`
      : ''

  const section = `

---

## [${ts}] ${entry.severity} — ${entry.module} / ${entry.caseKey}

- **Step**: ${entry.step}
- **Expected**: ${entry.expected}
- **Actual**: ${entry.actual}${shot}
`
  appendFileSync(REPORT_PATH, section, 'utf8')
}

// Convenience: absolute path so specs / debug scripts can reference the
// report without re-deriving it.
export const BUG_REPORT_PATH = resolve(REPORT_PATH)
