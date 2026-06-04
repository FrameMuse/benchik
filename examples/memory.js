import { bench } from "benchik"

// Allocating a large string ensures GC can't easily reclaim
// since resultsOut keeps all return values alive across iterations.
const SIZE = 100_000

await bench.untilCompiled()

{
  using g = bench.group("Memory: String Allocation")
  g.memory = process.memoryUsage

  bench("no allocation", () => Array(20))
  bench("allocate 10kB string", () => "x".repeat(SIZE / 10))
  bench("allocate 100kB string", () => "x".repeat(SIZE))
  bench("allocate 200kB string", () => "x".repeat(SIZE * 2))
}
