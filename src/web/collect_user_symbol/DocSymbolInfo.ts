import type * as vscode from 'vscode';

import type { ScanDocRes } from './ScanDocRes';
import type { SymbolInfo } from './SymbolInfo';

class DocSymbolInfo {
  public readonly document: vscode.TextDocument;
  public readonly docRes: ScanDocRes;

  public readonly globalDef: Map<string, SymbolInfo[]>;
  public readonly globalNamedLambda: Map<string, SymbolInfo[]>;

  public readonly localDef: Map<string, SymbolInfo[]>;
  public readonly localNamedLambda: Map<string, SymbolInfo[]>;

  public readonly localAnonLambda: Map<string, SymbolInfo[]>;
  public readonly localAnonSingle: Map<string, SymbolInfo[]>;

  //public readonly globalNames: Set<string>;
  //public readonly allLocalNames: Set<string>;
  private _allNames: Set<string> | undefined = undefined;
  private _allLocal: Map<string, SymbolInfo[]> | undefined = undefined;

  constructor(
    document: vscode.TextDocument,
    docRes: ScanDocRes,

    globalDef: Map<string, SymbolInfo[]>,
    globalNamedLambda: Map<string, SymbolInfo[]>,

    localDef: Map<string, SymbolInfo[]>,
    localNamedLambda: Map<string, SymbolInfo[]>,

    localAnonLambda: Map<string, SymbolInfo[]>,
    localAnonSingle: Map<string, SymbolInfo[]>,
  ) {
    this.document = document;
    this.docRes = docRes;

    this.globalDef = globalDef;
    this.globalNamedLambda = globalNamedLambda;

    this.localDef = localDef;
    this.localNamedLambda = localNamedLambda;

    this.localAnonLambda = localAnonLambda;
    this.localAnonSingle = localAnonSingle;

    // sort to tolerance for multiple definition
    for (const info of this.globalDef.values()) {
      info.sort((a, b) => {
        return a.loc.range.start.isBeforeOrEqual(b.loc.range.start) ? -1 : 1;
      });
    }
  }

  get allNames() {
    if (this._allNames === undefined) {
      // this.globalNames, this.allLocalNames, this.allNames
      this._allNames = this.getAllNames();
    }
    return this._allNames;
  }

  get allLocal() {
    if (this._allLocal === undefined) {
      this._allLocal = this.getAllLocal();
    }
    return this._allLocal;
  }

  // for semantic color
  private getAllNames(): Set<string> {
    const allNames: Set<string> = new Set();
    for (const ks of [this.globalDef.keys(), this.allLocal.keys()]) {
      for (const k of ks) {
        allNames.add(k);
      }
    }

    return allNames;
  }

  private getAllLocal(): Map<string, SymbolInfo[]> {
    const allLocal: Map<string, SymbolInfo[]> = new Map<string, SymbolInfo[]>();
    const dicts = [this.globalNamedLambda, this.localDef, this.localNamedLambda, this.localAnonLambda, this.localAnonSingle];
    for (const d of dicts) {
      for (const [k, info] of d) {
        if (!allLocal.has(k)) {
          allLocal.set(k, []);
        }
        allLocal.get(k)!.push(...info);
      }
    }

    // make sure the semantic color in order (innermost last)
    for (const info of allLocal.values()) {
      info.sort((a, b) => {
        return a.loc.range.start.isBeforeOrEqual(b.loc.range.start) ? -1 : 1;
      });
    }

    return allLocal;
  }

  private findInnermost(symbols: SymbolInfo[], range: [number, number], position: number): SymbolInfo | undefined {
    let farthest: SymbolInfo | undefined = undefined;

    for (const symbol of symbols) {
      if (symbol.scope === undefined) {
        continue;
      }

      // if the finding range is the symbol itself, return it
      const [symbolStart, symbolEnd] = symbol.numRange;
      if (symbolStart === range[0] && symbolEnd === range[1]) {
        return symbol;
      }

      if (symbol.scope[0] <= position && position <= symbol.scope[1]) {
        if (farthest === undefined || (farthest.scope !== undefined && symbol.scope[0] > farthest.scope[0])) {
          farthest = symbol;
        }
      }

    }
    return farthest;
  }

  // return [selected symbol, shadowed symbols]
  // if global is selected, return shadowed symbols (position===undefined)
  // if local is selected, return empty shadowed symbols (position!==undefined)
  public getSymbolWithShadowByRange(word: string, range: [number, number] | vscode.Range, positionFlag: vscode.Position | undefined): [SymbolInfo | undefined, SymbolInfo[]] {
    const localShadow = this.allLocal.get(word);
    const shadow = (localShadow !== undefined) ? localShadow : [];

    if (positionFlag === undefined) {
      // only global definition
      const res = this.globalDef.get(word);
      return (res !== undefined && res.length !== 0) ?
        [res.at(-1), shadow] : [undefined, shadow];

    } else if (shadow === undefined || shadow.length === 0) {
      // no shadow means that we cannot find word in local definition, then
      // just find word in the upstream which is global definition
      const res = this.globalDef.get(word);
      return (res !== undefined && res.length !== 0) ?
        [res.at(-1), []] : [undefined, []];

    } else {
      // we got some shadow
      // we try to find the inner most scope from the position by shrinking the scope, then
      // return the definition of that inner most scope
      const numPosition = this.document.offsetAt(positionFlag);
      if (!Array.isArray(range)) {
        range = [this.document.offsetAt(range.start), this.document.offsetAt(range.end)];
      }
      const innermost = this.findInnermost(shadow, range, numPosition);
      if (innermost !== undefined) {
        return [innermost, []];
      }

      // we cannot find valid scope by the position,
      // which means that the word is actually in global.
      // Therefore, we back global definition.
      const res = this.globalDef.get(word);
      return (res !== undefined && res.length !== 0) ?
        [res.at(-1), shadow] : [undefined, shadow];
    }
  }


}

export { DocSymbolInfo };
