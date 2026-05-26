# benchik

A tiny benchmark library using `console.log` and `console.group`.
Works equally well in the browser and terminal - zero dependencies, ~200 lines of code.

Use this library if you need a quick, fast and reliable peek to benchmark results.

```ts
import { bench } from "benchik"

bench("Array.from", () => { Array.from({ length: 1000 }) })
bench("for loop",  () => { const a = []; for (let i = 0; i < 1000; i++) a.push(i) })
```

## Install

```bash
npm i benchik
```

Benchik ships as raw TypeScript — import it directly with any ESM-compatible runtime (Bun, tsx, ts-node, or a bundler like Vite/esbuild).

## Usage

### Basic benchmark

```ts
bench(() => Math.sqrt(Math.random()))
// → [1.40ns] Math.sqrt(Math.random())

bench("sqrt 1000x", () => { for (let i = 0; i < 1000; i++) Math.sqrt(i) })
// → [500.00ns] sqrt 1000x
```

### Grouped benchmarks

Groups show which test was fastest and how much slower the others were:

```ts
using g = bench.group("Array iteration")

bench("for",      () => { for (let i = 0; i < 1e4; i++) })
bench("forEach",  () => { Array(1e4).fill(0).forEach(x => x) })
bench("for..of",  () => { for (const x of Array(1e4).fill(0)) })
```

```
Array iteration
  [5.00ms]  for       [fastest]
  [8.30ms]  forEach   [+1.66x]
  [5.10ms]  for..of   [+1.02x]
```

### Fresh data per iteration

Prevent state cross-contamination between runs with `fresh()`, each iteration gets its own copy:

```ts
using g = bench.group("Array push")
const f = g.fresh(() => ({ array: [1, 2, 3] }))

bench("push",      () => { f.array.push(4) })
bench("spread",    () => { const x = [...f.array, 4] })
```

### Assertions

Verify that every iteration returns the same value:

```ts
using g = bench.group("Sorting")
g.assert = [1, 2, 3, 4, 5]

bench("unsorted", () => [3, 1, 5, 2, 4])
bench("sorted", () => [3, 1, 5, 2, 4].sort())
// → [40.00ns] [✓] sorted
// → [50.00ms] [✗] unsorted
```

### Custom aggregation & formatting

```ts
using g = bench.group("Custom", {
  aggregate: bench.agg.average,  // use average instead of median
  format: v => `${v.toFixed(0)}ms`
})

bench("test", () => { /* ... */ })
```

### Deterministic randomness

Use `bench.random()` to generate the same [pseudorandom](https://en.wikipedia.org/wiki/Pseudorandomness) sequence across warmup and measurement phases:

```ts
bench("rand test", () => {
  const seed = bench.random()
  // `seed` is deterministic, same in warmup and measurement.
})
```

### Wait for JIT compilation

```ts
await bench.untilCompiled()
bench("first test", () => { /* ... */ })
```

## API

### `bench(label?, callback)`

Runs a 50ms warmup phase, then measures the callback for 50ms and reports the median iteration time.

### `bench.group(label, options?)`

Creates a console group. Returns a `Disposable` object (works with `using` declarations).

| Property | Description |
|----------|-------------|
| `fresh(factory)` | Returns fresh values per iteration |
| `assert` | Expected return value for all iterations |

### `bench.Options`

| Option | Default | Description |
|--------|---------|-------------|
| `aggregate` | `median` | Aggregation function (`median` / `average`) |
| `format` | `formatTime` | Custom time formatter |
| `warmup` | `{ ms: 50 }` | Warmup configuration |
| `runFor` | `{ ms: 50 }` | Measurement configuration |

### `bench.agg`

| Function | Description |
|----------|-------------|
| `median` | Sorts all iteration times and returns the median |
| `average` | Arithmetic mean of all iteration times |

### `bench.random()`

Returns a deterministic pseudorandom number (mulberry32 PRNG). Reseeded to `0xDEADBEEF` before both warmup and measurement phases for reproducibility.

### `bench.untilCompiled()`

Returns a promise that resolves after 200ms, giving the runtime time to JIT-compile objects before the first benchmark runs.

## Browser & terminal

Benchik uses only universally available APIs:

- **`performance.now()`** — the high-resolution monotonic clock available in all browsers and Node.js/Bun/Deno
- **`console.log` / `console.group` / `console.groupEnd`** — native console output everywhere
- **ANSI escape codes** for color — rendered natively in terminals, ignored by browsers

No DOM, no Node-specific APIs, no runtime-specific imports. The same code runs identically in both environments.

## Why it's fast

- **Generator-based measurement** — `runFor` is a generator that yields individual timing samples. No intermediate arrays are allocated until the aggregation step, minimizing GC pressure.
- **Median aggregation** — default aggregation uses the median, which is robust to outliers (GC pauses, OS scheduling) and gives a more representative measurement than the mean.
- **Deterministic PRNG** — the mulberry32 PRNG is reseeded with the same value before both warmup and measurement, ensuring identical random inputs and eliminating a common source of benchmark variance.
- **Safety cap** — maximum 50,000 iterations per run prevents infinite loops for extremely fast callbacks.

## Why it's reliable

- **Warmup phase** — the callback runs for 50ms before measurement begins. This allows JIT compilation to stabilize and CPU caches to warm, so the first measurement isn't artificially slow.
- **Fresh data pattern** — `g.fresh()` creates a new data object for each iteration, preventing state mutations from one run affecting the cost of the next (a common pitfall in JS microbenchmarks).
- **No dependencies** — zero third-party code means zero risk of dependency-related performance noise or version conflicts.
- **`using` declarations** — groups implement `Symbol.dispose`, so group boundaries are always correctly closed even if code exits early.
