if (typeof HTMLMediaElement !== 'undefined') {
  HTMLMediaElement.prototype.play = function play() {
    return Promise.resolve()
  }
  HTMLMediaElement.prototype.pause = function pause() {}
  HTMLMediaElement.prototype.load = function load() {}
}

const localStorageStub = new Map<string, string>()

Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  get() {
    return {
      get length() {
        return localStorageStub.size
      },
      key: (index: number) => [...localStorageStub.keys()][index] ?? null,
      getItem: (key: string) => localStorageStub.get(key) ?? null,
      setItem: (key: string, value: string) => {
        localStorageStub.set(key, String(value))
      },
      removeItem: (key: string) => {
        localStorageStub.delete(key)
      },
      clear: () => localStorageStub.clear()
    }
  }
})
