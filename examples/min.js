import { bench } from "benchik"

await bench.untilCompiled()

{
  using _ = bench.group()

  bench(() => Math.min(1, 2))
  bench(() => 1 < 2 ? 1 : 2)
}
