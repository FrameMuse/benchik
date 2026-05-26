# `benchik`

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

Benchik ships as raw TypeScript, import it directly with any ESM-compatible runtime (Bun, tsx, ts-node, or a bundler like Vite/esbuild).

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
// → [40.00ns] [✗] unsorted
// → [50.00µs] [✓] sorted
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
// Declare static variables and compute things.
const d1 = []
const d2 = [2, 3, 4]

// Wait for JIT to make sure the first benchmark doesn't get slowed down.
await bench.untilCompiled()

bench("first test", () => { /* ... */ })
```

### Black hole

The JS engines may optimize pure functions that doesn't really do anything.
To avoid skipping over iterations or function execution, always return the output of iterations.

For example, if you're benchmarking `for` loop iteration speed, you should setup some quick calculations
like summing many numbers or pushing numbers to array.

```js
const MAX = 1_000

using g = bench.group("loops")
g.assert = MAX

let r = 0
bench("for", () => {
  r = 0
  for (let i = 0; i < MAX; i++) r += 1
  return r
})
```

Even though these calculations introduce overhead, it's very often tolerable

### Relativeness & Fairness (advice)

When measuring speed, the actual numbers matter, but usually it's more important how one option/approach/solution is better over another one.

So remember to make sure your benchmarks are fair to each other, e.g. init same amount of variables, do the same setups to measure that something is indeed relatively faster.

### Full Example

```js
import { bench } from "benchik"

class asd { }

const arrD = []
const MAX = 1_000
const finalResult = Array.from({ length: MAX }).map(() => new asd)

await bench.untilCompiled()

{
  using _ = bench.group("Array Populate")

  bench("dynamic (push)", () => {
    const array = []
    for (let i = 0; i < MAX; i++) array.push(new asd)
    return array
  })
  bench("dynamic (no push)", () => {
    const array = []
    for (let i = 0; i < MAX; i++) array[i] = new asd
    return array
  })
  bench("dynamic (no push via length)", () => {
    const array = []
    for (let i = 0; i < MAX; i++) array[array.length] = new asd
    return array
  })
  bench("pre-allocate", () => {
    const array = Array(MAX)
    for (let i = 0; i < MAX; i++) array[i] = new asd
    return array
  })
  bench("reusing", () => {
    const array = arrD.fill(null, 0, MAX)
    for (let i = 0; i < MAX; i++) array[i] = new asd
    return array
  })
}
```

## API

### `bench(label?, callback)`

Runs a 50ms warmup phase, then measures the callback for 50ms and reports the median iteration time.

### `bench.group(label)`

Creates a console group. Returns a `Disposable` object (works with `using` declarations).

| Property | Description |
|----------|-------------|
| `fresh(factory)` | Returns fresh values per iteration |
| `assert` | Expected return value for all iterations |

### `bench.random()`

Returns a deterministic pseudorandom number (mulberry32). Reseeded to `0xDEADBEEF` before both warmup and measurement phases for reproducibility.

### `bench.untilCompiled()`

Returns a promise that resolves after 200ms, giving the runtime time to JIT-compile objects before the first benchmark runs.

## Agent Instruction

You can adopt this instruction to allow your agent to run benchmarks from time to time and have better insights for you.

```md
---
description: Asses code speed, do benchmarks.
---

- Read files in `github.com/FrameMuse/benchik/tree/main/examples`, these are benchmarks of a real project, results of which can be used to make considerations, include in the task or show to a user.
- To run the benchmarks, run `file.js`.
- To create a permanent benchmark, create a file (`.js` format, ESNext style) in a desired path.
- To create a temporary benchmark, create a `.js` file in `/tmp/benchiky` directory, run `/tmp/benchiky/file.js` and use the results.

Use installed JS runtime: `bun` or `node` or `deno`.

(Bun only) Note: make sure to import a benchmark suite, use `bun link benchik` once and then import like usual `import { bench } from "benchik"`.
```

## Browser & terminal

Benchik uses only universally available APIs:

- **`performance.now()`**: the high-resolution monotonic clock available in all browsers and Node.js/Bun/Deno
- **`console.log` / `console.group` / `console.groupEnd`**: native console output everywhere
- **ANSI escape codes** for color

No DOM, no Node-specific APIs, no runtime-specific imports. The same code runs identically in both environments.

## Why it's reliable

- **Warmup phase**: the callback runs for 50ms before measurement begins. This allows JIT compilation to stabilize and CPU caches to warm, so the first measurement isn't artificially slow.
- **Deterministic random**: the mulberry32 randomizer is reset with the same value before both warmup and measurement, ensuring identical random inputs and eliminating a benchmark variance.
- **Fresh data pattern**: `g.fresh()` creates a new data object for each iteration, preventing state mutations from one run affecting the cost of the next (a common pitfall in JS microbenchmarks).
- **Median aggregation**: default aggregation uses the [median](https://en.wikipedia.org/wiki/Median), gives a more representative measurement than the [mean (average)](https://en.wikipedia.org/wiki/Average).
- Runs each benchmark either for 50ms or 50_000 times, which works great both for very slow and very fast programs.
- **No dependencies**: zero third-party code means zero risk of dependency-related performance noise or version conflicts.

## Why you may not need it

- Benchmarks are measured in perfect conditions, which may not be what you need.
- This library doesn't measure time deviations, it only produces final measurement stable across multiple runs.
