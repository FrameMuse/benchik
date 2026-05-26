import { bench } from "benchik"

class asd { }
const f = new asd
const arrD = []

await bench.untilCompiled()

{
  using _ = bench.group("Array Populate")

  bench("dynamic (push)", () => {
    const array = []
    for (let i = 0; i < 1_000; i++) array.push(new asd)
    return array
  })
  bench("dynamic (no push)", () => {
    const array = []
    for (let i = 0; i < 1_000; i++) array[i] = new asd
    return array
  })
  bench("dynamic (no push via length)", () => {
    const array = []
    for (let i = 0; i < 1_000; i++) array[array.length] = new asd
    return array
  })
  bench("pre-allocate", () => {
    const array = Array(1_000)
    for (let i = 0; i < 1_000; i++) array[i] = new asd
    return array
  })
  bench("reusing", () => {
    const array = arrD.fill(null, 0, 1000)
    for (let i = 0; i < 1_000; i++) array[i] = new asd
    return array
  })
}

/**
 * Outcome:
 * - Pre-allocating an array of desired size gives free speed.
 * - Reusing an array works only when array shouldn't be returned, used only as an intermediate.
 */
