export type SeededRandom = {
  next: () => number
  between: (min: number, max: number) => number
  int: (min: number, max: number) => number
  bool: (probability: number) => boolean
  pick: <T>(items: readonly T[]) => T
  fork: (salt: string | number) => SeededRandom
}

function hashSeed(seed: string | number) {
  const input = String(seed)
  let hash = 1779033703 ^ input.length

  for (let index = 0; index < input.length; index += 1) {
    hash = Math.imul(hash ^ input.charCodeAt(index), 3432918353)
    hash = (hash << 13) | (hash >>> 19)
  }

  return () => {
    hash = Math.imul(hash ^ (hash >>> 16), 2246822507)
    hash = Math.imul(hash ^ (hash >>> 13), 3266489909)
    return (hash ^= hash >>> 16) >>> 0
  }
}

export function createSeededRandom(seed: string | number): SeededRandom {
  const seedGenerator = hashSeed(seed)
  let state = seedGenerator()

  function next() {
    state += 0x6d2b79f5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }

  return {
    next,
    between: (min, max) => min + (max - min) * next(),
    int: (min, max) => Math.floor(min + (max - min + 1) * next()),
    bool: (probability) => next() < probability,
    pick: (items) => items[Math.min(items.length - 1, Math.floor(next() * items.length))],
    fork: (salt) => createSeededRandom(`${seed}:${salt}:${seedGenerator()}`),
  }
}
