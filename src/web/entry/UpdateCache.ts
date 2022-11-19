
class UpdateCache {
  // {offset: [line, char]}
  public cacheDocumentPosition: Record<number, [number, number]> = {};

  constructor() {

  }

  reset() {
    this.cacheDocumentPosition = {};
  }
}

export { UpdateCache };
