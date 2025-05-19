import { RequestParameters } from '@maptiler/sdk'

export class TileCache {

  constructor(
    private capacity: number
  ) {}

  private cache = new Map<string, [ArrayBuffer, number]>()
  private totalSize: number = 0

  public fetch(params: RequestParameters) {
    return this.cache.get(params.url)?.[0] ?? null
  }

  public store(params: RequestParameters, buffer: ArrayBuffer) {
    if (this.cache.has(params.url)) { return }
    
    this.cache.set(params.url, [buffer, Date.now()])
    this.totalSize += buffer.byteLength
    this.prune()
  }

  public clear() {
    this.cache.clear()
  }

  public prune() {
    if (this.totalSize <= this.capacity) { return }

    const sorted = Array.from(this.cache.entries()).sort((a, b) => a[1][1] - b[1][1])
    while (this.totalSize > this.capacity) {
      const current = sorted.shift()
      if (current == null) { break }

      this.cache.delete(current[0])
      this.totalSize -= current[1][0].byteLength
    }
  }

}