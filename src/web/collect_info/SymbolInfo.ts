import type * as vscode from 'vscode';

import { bisectRight } from '../common/algorithm';

import type { DocSymbolInfo } from './DocSymbolInfo';

class SymbolInfo {
  public readonly name: string;
  public readonly containerName: string | undefined;
  // if has scope, this symbol is valid only if the symbol is in scope
  public readonly scope: [number, number] | undefined;
  public readonly loc: vscode.Location;
  public readonly kind: vscode.SymbolKind;
  public readonly numRange: [number, number];

  public numberedContainerName: string | undefined;
  public globalDefRange: [number, number] | undefined;

  constructor(
    name: string,
    containerName: string | undefined,
    scope: [number, number] | undefined,
    loc: vscode.Location,
    kind: vscode.SymbolKind,
    numRange: [number, number]
  ) {

    this.name = name;
    this.containerName = containerName;
    this.scope = scope;
    this.loc = loc;
    this.kind = kind;
    this.numRange = numRange;
  }

  public stringify(): string {
    return `${this.name}|${this.loc.uri.path}|${this.loc.range.start.line},${this.loc.range.start.character},${this.loc.range.end.line},${this.loc.range.end.character}`;
  }

  public getScopedSameNameWordsExcludeItself(
    needColorDict: Map<string, [number, number][]>,
    currDocSymbolInfo: DocSymbolInfo,
  ): [number, number][] {
    const sameNameWords = needColorDict.get(this.name);
    if (sameNameWords === undefined || sameNameWords.length === 0) {
      return [];
    }

    if (this.scope !== undefined) {
      // local, use scope to narrow the set of words
      const [scopeStart, scopeEnd] = this.scope;
      const selectFirst = (item: [number, number]) => item[0];

      const idxStart = bisectRight(sameNameWords, scopeStart, selectFirst);
      const idxEnd = bisectRight(sameNameWords, scopeEnd, selectFirst);
      const scopedSameNameWords = sameNameWords.slice(idxStart, idxEnd);

      if (this.containerName === 'do') {
        const stepFormArr = currDocSymbolInfo.stepFormArr;
        // check extended scope [numRange[1], scope[0]]
        const idxStart = bisectRight(sameNameWords, this.numRange[1], selectFirst);
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
      const sameNameDefStartSet = new Set(
        currDocSymbolInfo.globalDef.get(this.name)!
          .map(item => item.numRange[0])
      );
      const filtered = sameNameWords.filter(item=>!sameNameDefStartSet.has(item[0]));
      return filtered;
    }
  }

}

export { SymbolInfo };
