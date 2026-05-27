const hasProcess = typeof (globalThis as any).process !== 'undefined'

const useAnsi = hasProcess && (() => {
  const p = (globalThis as any).process
  const { env = {}, argv = [], platform = '' } = p

  if ('NO_COLOR' in env || argv.includes('--no-color')) return false
  if ('FORCE_COLOR' in env || argv.includes('--color')) return true
  if (env.TERM === 'dumb') return false
  if (platform === 'win32') return true
  if ('CI' in env && ('GITHUB_ACTIONS' in env || 'GITLAB_CI' in env || 'CIRCLECI' in env)) return true
  if (p.stdout && p.stdout.isTTY) return true

  return false
})()

const ansi: Record<string, string> = { gray: '90', blue: '94', red: '91', green: '92', lightGreen: '38;5;114' }
const css: Record<string, string> = { gray: 'color: gray', blue: 'color: #5599ff', red: 'color: #ff5555', green: 'color: #55cc55', lightGreen: 'color: #87d787' }

function clr(color: string, text: string): string[] {
  if (!hasProcess) return [`%c${text}`, css[color]]
  if (useAnsi) return [`\x1b[${ansi[color]}m%s\x1b[0m`, text]
  return [text]
}

const units = ["ps", "ns", "µs", "ms", "s"]
const UNSET = Symbol('unset')

function mulberry32(seed = 0x12345678) {
  let t = seed >>> 0
  return function () {
    t += 0x6D2B79F5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
} //     mulberry32(0xDEADBEEF)


let randomFactory = mulberry32(0xDEADBEEF)

export function bench(callback: () => void): void
export function bench(label: string, callback: () => void): void
export function bench(label: string | (() => void), callback: () => void = () => { }): void {
  if (typeof label === "function") {
    callback = label
    label = callback.toString().replace(/^\(\)\s*=>\s*/m, "").replace(/\n+/g, " ").replace(/\s+/g, " ")
  }


  function onBefore() {
    if (groupTTT.fresh != null) {
      Object.assign(groupTTT.fresh.values, groupTTT.fresh.factory())
    }
  }

  randomFactory = mulberry32(0xDEADBEEF)
  // Warmup.
  runFor({ callback, ms: 50, onBefore })

  const aggregate = groupTTT.options?.aggregate ?? median
  const format = groupTTT.options?.format ?? formatTime

  randomFactory = mulberry32(0xDEADBEEF)

  const resultsOut: unknown[] = []
  // Measure.
  const time = aggregate(runFor({ callback, ms: 50, onBefore, resultsOut }))
  const defaultMessages = clr('gray', `[${format(time)}]`)

  if (groupTTT.label) {
    groupTTT.attempts!.push(time)
    // groupTTT.results!.push(result)
    groupTTT.callbacks!.push(minmax => {
      const getAssertMark = () => {
        if (groupTTT.assert === UNSET) return []
        if (resultsOut.every(x => jsonStringify(x) === groupTTT.assertJson)) return clr('green', '[✓]')

        return clr('red', '[✗]')
      }

      const asdMessages = getasd(minmax, time)
      const assertMessages = getAssertMark()
      if (!hasProcess) {
        const flat = [...defaultMessages, ...asdMessages, ...assertMessages]
        const fmt = flat.filter((_, i) => i % 2 === 0)
        const styles = flat.filter((_, i) => i % 2 === 1)
        console.log(fmt.join(' '), ...styles, label)
      } else {
        console.log(...defaultMessages, ...asdMessages, ...assertMessages, label)
      }
    })
  } else {
    console.log(...defaultMessages, label)
  }
}

export namespace bench {
  export interface Options {
    aggregate?(items: ArrayIterator<number>): number
    format?(value: number): string

    warmup?: { ms?: number, times?: number }
    runFor?: { ms?: number, times?: number }
  }

  export interface Group {
    fresh<T extends FreshRecord>(factory: () => T): T
    assert?: unknown
  }

  export interface FreshRecord extends Record<keyof never, unknown> { }

  export function group(label: string, options?: Options): Group & Disposable {
    groupTTT.options = options
    groupTTT(label)
    return {
      [Symbol.dispose]: groupTTT.end,

      get assert() { return groupTTT.assert === UNSET ? undefined : groupTTT.assert },
      set assert(v: unknown) { groupTTT.assert = v; groupTTT.assertJson = jsonStringify(v) },

      fresh(factory) {
        const values = factory()
        groupTTT.fresh = { factory, values }
        return values
      },
    }
  }

  export function snapshot(ops: { write(destination: string, content: string): void }): Disposable {
    groupTTT.snapshot = {}

    return {
      [Symbol.dispose]() {

      },
    }
  }

  /** 
   * Wait a bit, so objects are likely to be compiled by the first benchmark.
   */
  export function untilCompiled(): Promise<void> {
    // Wait a bit, so objects are likely to be compiled by the first benchmark.
    return new Promise(r => setTimeout(r, 200))
  }
  export function reset(): void { }

  export function random(): number { return randomFactory() }

  export const agg = {
    median: median as typeof median,
    average: average as typeof average
  }
}

function groupTTT(label: string): void {
  if (groupTTT.label != null) groupTTT.end()

  groupTTT.label = label
  groupTTT.attempts = []
  groupTTT.callbacks = []
  groupTTT.results = []
  groupTTT.assert = UNSET
}
namespace groupTTT {
  export declare let attempts: number[] | null
  export declare let callbacks: ((minmax: readonly [number, number]) => void)[] | null
  export declare let label: string | null
  export declare let options: bench.Options | null | undefined
  export declare let fresh: { factory: () => bench.FreshRecord, values: bench.FreshRecord } | null | undefined
  export declare let snapshot: {} | null
  export declare let assert: unknown
  export declare let assertJson: string | null
  export declare let results: unknown[] | null

  export function end(): void {
    if (groupTTT.label == null) return

    console.group(groupTTT.label)
    const minmax = [Math.min(...groupTTT.attempts ?? []), Math.max(...groupTTT.attempts ?? [])] as const
    groupTTT.callbacks?.forEach(callback => callback(minmax))
    console.groupEnd()

    groupTTT.label = null
    groupTTT.attempts = null
    groupTTT.callbacks = null
    groupTTT.options = null
    groupTTT.assert = UNSET
    groupTTT.assertJson = null
    groupTTT.results = null
  }
}

function getasd([min, max]: readonly [number, number], time: number): string[] {
  if (time === min) {
    return clr('blue', '[fastest]')
  }
  if (time > min) {
    return clr('red', `[+${((time / min)).toFixed(2)}x]`)
  }
  if (time < min) {
    return clr('lightGreen', `[-<${formatTime(min + time)}]`)
  }

  return []
}

function formatTime(ms: number) {
  if (ms === 0) return "0ms"

  const unitIndex = Math.floor(Math.log10(ms) / 3) + 3
  const value = ms / 1000 ** (unitIndex - 3)
  return value.toLocaleString("en", { minimumIntegerDigits: 3, minimumFractionDigits: 2 }) + units[unitIndex]
}

function jsonStringify(value: unknown): string {
  const seen = new WeakMap<object, number>()
  let id = 0

  return JSON.stringify(value, function (key, val) {
    if (typeof val === 'object' && val !== null) {
      if (seen.has(val)) {
        return `[Circular->${seen.get(val)}]`
      }
      seen.set(val, ++id)
    }
    return val
  })
}

function average(items: ArrayIterator<number>): number {
  let l = 0
  return items.reduce((a, b, i) => (l = i, a + b)) / (l + 1)
}


function* runFor(options: { callback: () => void, ms?: number, onBefore?: () => void, resultsOut?: unknown[] }): Generator<number> {
  const { callback, ms, onBefore, resultsOut } = options

  const gt = performance.now()

  let result
  let batchStart = gt
  let batchCalls = 0

  for (let i = 0; i < 50_000; i++) {
    onBefore?.()
    result = callback()
    batchCalls++
    resultsOut?.push(result)
  
    const now = performance.now()
    if (now > batchStart) {
      yield (now - batchStart) / batchCalls
      batchStart = now
      batchCalls = 0
    }

    if (ms != null) {
      if ((performance.now() - gt) >= ms) break
    }
  }
}


function median(items: ArrayIterator<number>): number {
  const sorted = items.toArray().sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)

  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2
}
