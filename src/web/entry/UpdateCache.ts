
class UpdateCache {
  // {offset: [line, char]}
  public readonly cacheDocumentPosition: Record<number, [number, number]> = {};

  constructor() {

  }
}

export { UpdateCache };
