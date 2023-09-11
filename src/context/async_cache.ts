type CacheSlot<V> =
  | {
      type: "promise";
      promise: Promise<V>;
    }
  | {
      type: "value";
      value: V;
    };

export class AsyncCache<K, V> {
  cache = new Map<K, CacheSlot<V>>();
  fetchFunction: (key: K) => Promise<V>;

  constructor(
    fetchFunction: (key: K) => Promise<V>,
    json: any = undefined,
    jsonCallback: (key: any, value: any) => [K, V] | undefined = (
      key,
      value
    ) => [key as K, value as V]
  ) {
    this.fetchFunction = fetchFunction;
    json = json ?? [];
    for (const entry of json) {
      const pair = jsonCallback(entry?.key, entry?.value);
      if (pair === undefined) {
        continue;
      }

      const [key, value] = pair;
      this.cache.set(key, {
        type: "value",
        value,
      });
    }
  }

  toJSON() {
    const cache = [];
    for (const [key, value] of this.cache) {
      if (value.type === "value") {
        cache.push({
          key,
          value: value.value,
        });
      }
    }

    return cache;
  }

  fetch(key: K): Promise<V> {
    const cached = this.cache.get(key);
    if (cached !== undefined) {
      return cached.type === "promise"
        ? cached.promise
        : Promise.resolve(cached.value);
    }

    const slot: CacheSlot<V> = {
      type: "promise",
      promise: undefined as unknown as Promise<V>,
    };
    const promise = this.#fetchToSlot(key, slot);
    slot.promise = promise;
    this.cache.set(key, slot);
    return promise;
  }

  async #fetchToSlot(key: K, slot: CacheSlot<V>): Promise<V> {
    try {
      const value = await this.fetchFunction(key);
      Object.assign(slot, {
        type: "value",
        value,
      });
      return value;
    } catch(e) {
      this.cache.delete(key);
      throw e;
    }
  }
}
