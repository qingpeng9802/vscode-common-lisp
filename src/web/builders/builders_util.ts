import type { SymbolInfo } from '../collect_info/SymbolInfo';
import { bisectLeft, bisectRight } from '../common/algorithm';

import type { DocSymbolInfo } from './DocSymbolInfo';

function findMatchPairAfterP(
  absIndex: number, pair: [number, number][], validUpper: number | undefined = undefined
): number {
  const idx = bisectLeft(pair, absIndex, item => item[0]);
  if (idx === -1 || idx === 0) {
    return -1;
  }

  const res = pair[idx - 1][1];
  // validUpper is not including
  if (res < absIndex || (validUpper !== undefined && validUpper <= res)) {
    return -1;
  }
  return res + 1;
}

function isShadowed(currRange: [number, number], shadow: SymbolInfo[]): boolean {
  for (const s of shadow) {
    if (
      // s.scope contains currRange
      (s.scope !== undefined && s.scope[0] <= currRange[0] && currRange[1] <= s.scope[1]) ||
      // intersects with definition
      (s.numRange[0] <= currRange[1] && currRange[0] <= s.numRange[1])
    ) {
      return true;
    }

  }
  return false;
}

function getScopedSameNameWordsExcludeItself(
  symbolinfo: SymbolInfo,
  needColorDict: Map<string, [number, number][]>,
  currDocSymbolInfo: DocSymbolInfo,
): [number, number][] {
  const sameNameWords = needColorDict.get(symbolinfo.name);
  if (sameNameWords === undefined || sameNameWords.length === 0) {
    return [];
  }

  if (symbolinfo.scope !== undefined) {
    // local, use scope to narrow the set of words
    const [scopeStart, scopeEnd] = symbolinfo.scope;
    const selectFirst = (item: [number, number]) => item[0];

    const idxStart = bisectRight(sameNameWords, scopeStart, selectFirst);
    const idxEnd = bisectRight(sameNameWords, scopeEnd, selectFirst);
    const scopedSameNameWords = sameNameWords.slice(idxStart, idxEnd);

    if (symbolinfo.containerName === 'do') {
      const stepFormArr = currDocSymbolInfo.stepFormArr;
      // check extended scope [numRange[1], scope[0]]
      const idxStart = bisectRight(sameNameWords, symbolinfo.numRange[1], selectFirst);
      const idxEnd = bisectRight(sameNameWords, scopeStart, selectFirst);
      scopedSameNameWords.push(
        ...sameNameWords.slice(idxStart, idxEnd).filter(wordRange => {
          const idx = bisectRight(stepFormArr, wordRange[0], selectFirst);
          return (idx !== -1 && idx !== 0 && wordRange[1] <= stepFormArr[idx - 1][1]);
        })
      );
    }

    return scopedSameNameWords;
  } else {
    // global, exclude same name def
    const defs = currDocSymbolInfo.globalDef.get(symbolinfo.name);
    if (defs === undefined) {
      return [];
    }
    const sameNameDefStartSet = new Set(
      defs.map(item => item.numRange[0])
    );
    const filtered = sameNameWords.filter(item => !sameNameDefStartSet.has(item[0]));
    return filtered;
  }
}

export {
  findMatchPairAfterP,
  isShadowed,
  getScopedSameNameWordsExcludeItself
};
