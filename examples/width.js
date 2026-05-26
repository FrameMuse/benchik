import { bench } from "benchik"



await bench.untilCompiled()

{
  using group = bench.group("abs vs <")

  const f = group.fresh(() => ({ minX: bench.random(), maxX: bench.random() }))

  bench(() => { for (let i = 0; i < 10000; i++) Math.abs(f.minX - f.maxX) })
  bench(() => { for (let i = 0; i < 10000; i++) f.minX < f.maxX ? f.minX - f.maxX : f.maxX - f.minX })
  bench(() => { for (let i = 0; i < 10000; i++) f.minX === f.maxX ? 0 : f.minX < f.maxX ? f.minX - f.maxX : f.maxX - f.minX })
}
