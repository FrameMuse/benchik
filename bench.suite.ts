const units = ["ps", "ns", "µs", "ms", "s"]


export function bench(callback: () => void): void
export function bench(label: string, callback: () => void): void
export function bench(label: string | (() => void), callback: () => void = () => { }): void {
  if (typeof label === "function") {
    callback = label
    label = callback.toString().replace(/^\(\)\s*=>\s*/m, "").replace(/\n+/g, " ").replace(/\s+/g, " ")
  }

  const prevCallback = callback
  callback = () => {
    if (groupTTT.fresh != null) {
      Object.assign(groupTTT.fresh.values, groupTTT.fresh.factory())
    }

    prevCallback()
  }

  // Warmup.
  runFor(callback, 50)

  const aggregate = groupTTT.options?.aggregate ?? median
  const format = groupTTT.options?.format ?? formatTime

  // Measure.
  const time = aggregate(runFor(callback, 50))
  const defaultMessages = ["\x1b[90m%s\x1b[0m", `[${format(time)}]`]

  if (groupTTT.label) {
    groupTTT.attempts!.push(time)
    groupTTT.callbacks!.push(minmax => console.log(...defaultMessages, ...getasd(minmax, time), label))
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
  }

  export interface FreshRecord extends Record<keyof never, unknown> { }

  export function group(label: string, options?: Options): Group & Disposable {
    groupTTT.options = options
    groupTTT(label)
    return {
      [Symbol.dispose]: groupTTT.end,

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
}
namespace groupTTT {
  export declare let attempts: number[] | null
  export declare let callbacks: ((minmax: readonly [number, number]) => void)[] | null
  export declare let label: string | null
  export declare let options: bench.Options | null | undefined
  export declare let fresh: { factory: () => bench.FreshRecord, values: bench.FreshRecord } | null | undefined
  export declare let snapshot: {} | null

  export function end(): void {
    if (label == null) return

    console.group(groupTTT.label)
    const minmax = [Math.min(...groupTTT.attempts ?? []), Math.max(...groupTTT.attempts ?? [])] as const
    groupTTT.callbacks?.forEach(callback => callback(minmax))
    console.groupEnd()

    groupTTT.label = null
    groupTTT.attempts = null
    groupTTT.callbacks = null
    groupTTT.options = null
  }
}

function getasd([min, max]: readonly [number, number], time: number): string[] {
  if (time === min) {
    // Blue.
    return ["\x1b[94m%s\x1b[0m", "[fastest]"]
  }
  if (time > min) {
    // Red.
    return ["\x1b[91m%s\x1b[0m", `[+${((time / min)).toFixed(2)}x]`]
  }
  if (time < min) {
    // Green.
    return ["\x1b[38;5;114m%s\x1b[0m", `[-<${formatTime(min + time)}]`]
  }

  return []
}

function formatTime(ms: number) {
  if (ms === 0) return "0ms"

  const unitIndex = Math.floor(Math.log10(ms) / 3) + 3
  const value = ms / 1000 ** (unitIndex - 3)
  return value.toLocaleString("en", { minimumIntegerDigits: 3, minimumFractionDigits: 2 }) + units[unitIndex]
}

function average(items: ArrayIterator<number>): number {
  let l = 0
  return items.reduce((a, b, i) => (l = i, a + b)) / (l + 1)
}


function* runFor(callback: () => void, ms?: number): Generator<number> {
  let gt = performance.now()
  let i = 0
  while (true) {
    i++
    if (i > 50_000) break
    if (ms != null) {
      if ((performance.now() - gt) >= ms) break
    }

    const t = performance.now()
    blackhole(callback())
    yield performance.now() - t
  }
}

let sink: any
const blackhole = (x: any) => { sink = x }

function median(items: ArrayIterator<number>): number {
  const sorted = items.toArray().sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)

  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2
}