/**
 * 삽입 순서를 유지하는 Map을 이용한 최소한의 LRU 캐시.
 *
 * 값으로 undefined를 저장할 수 있어야 하므로(= "타입 없음"도 캐시 대상이다)
 * 적중 여부는 get()의 반환값이 아니라 has()로 판단한다.
 */
export class LruCache<V> {
  private readonly entries = new Map<string, V>();

  constructor(private readonly limit: number) {
    if (limit < 1) {
      throw new Error('LruCache의 limit은 1 이상이어야 한다');
    }
  }

  get size(): number {
    return this.entries.size;
  }

  has(key: string): boolean {
    return this.entries.has(key);
  }

  /** 값을 돌려주면서 해당 항목을 가장 최근 사용으로 올린다. */
  get(key: string): V | undefined {
    if (!this.entries.has(key)) {
      return undefined;
    }
    const value = this.entries.get(key) as V;
    this.entries.delete(key);
    this.entries.set(key, value);
    return value;
  }

  /** 값을 넣고, 한도를 넘으면 가장 오래 쓰이지 않은 항목부터 버린다. */
  set(key: string, value: V): void {
    this.entries.delete(key);
    this.entries.set(key, value);

    while (this.entries.size > this.limit) {
      const oldest = this.entries.keys().next();
      if (oldest.done) {
        break;
      }
      this.entries.delete(oldest.value);
    }
  }

  delete(key: string): void {
    this.entries.delete(key);
  }

  keys(): string[] {
    return [...this.entries.keys()];
  }
}
