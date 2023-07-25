const space = new Set([' ', '\f', '\n', '\r', '\t', '\v']);
const isSpace = (c: string) => space.has(c);

function getValidGroupInd(indices: [number, number][], nameGroup: number[]): [number, number] | undefined {
  for (const g of nameGroup) {
    if (indices[g] !== undefined) {
      return indices[g];
    }
  }
  return undefined;
}

function getValidGroupRes(r: RegExpMatchArray, nameGroup: number[]): string | undefined {
  for (const g of nameGroup) {
    if (r[g] !== undefined) {
      return r[g];
    }
  }
  return undefined;
  /*
  let defName: string | undefined = undefined;

  for (const g of nameGroup) {
    if (r[g] !== undefined) {
      defName = r[g];
      break;
    }
  }

  // exclude KEYWORD package symbols
  if (defName === undefined) {
    return undefined;
  }


  //if (isStringClValidSymbol(defName) === undefined) {
  //  return undefined;
  //}

  return defName;
  */
}

function addToDictArr(dict: Map<string, any[]>, k: string, item: any) {
  dict.get(k);
  if (!dict.has(k)) {
    dict.set(k, []);
  }
  dict.get(k)!.push(item);
}

function findMatchPairExactP(
  absIndex: number, pairMap: Map<number, number>, validUpper: number | undefined = undefined
): number {
  const idx = pairMap.get(absIndex);
  if (idx === undefined) {
    return -1;
  }
  // validUpper is not including
  if (idx < absIndex || (validUpper !== undefined && validUpper <= idx)) {
    return -1;
  }
  return idx + 1;
}

export {
  getValidGroupRes, getValidGroupInd,
  addToDictArr,
  findMatchPairExactP,
  isSpace,
};
