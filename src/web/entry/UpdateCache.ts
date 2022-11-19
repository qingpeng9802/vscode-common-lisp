
class UpdateCache {
  // {offset: [line, char]}
  public readonly cacheDocumentPosition: Record<number, [number, number]> = {};

  constructor() {

  }

  reset() {
    this.cacheDocumentPosition = {};
  }
}

export { UpdateCache };
