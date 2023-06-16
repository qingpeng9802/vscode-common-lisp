import type * as vscode from 'vscode';

import type { ScanDocRes } from './ScanDocRes';
import type { SymbolInfo } from './SymbolInfo';
import { addToDictArr, findInnermost } from './user_symbol_util';

class DocSymbolInfo {
  public readonly document: vscode.TextDocument;
  public readonly docRes: ScanDocRes;

  public readonly globalDef: Record<string, SymbolInfo[]>;
  public readonly globalNamedLambda: Record<string, SymbolInfo[]>;

  public readonly localDef: Record<string, SymbolInfo[]>;
  public readonly localNamedLambda: Record<string, SymbolInfo[]>;

  public readonly localAnonLambda: Record<string, SymbolInfo[]>;
  public readonly localAnonSingle: Record<string, SymbolInfo[]>;

  //public readonly globalNames: Set<string>;
  //public readonly allLocalNames: Set<string>;
  private _allNames: Set<string> | undefined = undefined;
  private _allLocal: Record<string, SymbolInfo[]> | undefined = undefined;

  constructor(
    document: vscode.TextDocument,
    docRes: ScanDocRes,

    globalDef: Record<string, SymbolInfo[]>,
    globalNamedLambda: Record<string, SymbolInfo[]>,

    localDef: Record<string, SymbolInfo[]>,
    localNamedLambda: Record<string, SymbolInfo[]>,

    localAnonLambda: Record<string, SymbolInfo[]>,
    localAnonSingle: Record<string, SymbolInfo[]>,
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
    for (const [k, info] of Object.entries(this.globalDef)) {
      info.sort((a, b) => {
        return a.loc.range.start.isBeforeOrEqual(b.loc.range.start) ? -1 : 1;
      });
    }
  }

  get allNames() {
    if (this._allNames === undefined) {
      // this.globalNames, this.allLocalNames, this.allNames
      [, , this._allNames] = this.getAllNames();
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
  private getAllNames(): Set<string>[] {
    const globalNames = new Set(Object.keys(this.globalDef));
    const allLocalNames = new Set(Object.keys(this.allLocal));

    const allNames = new Set([...globalNames, ...allLocalNames]);
    return [globalNames, allLocalNames, allNames];
  }

  private getAllLocal(): Record<string, SymbolInfo[]> {
    const allLocal: Record<string, SymbolInfo[]> = {};
    const dicts = [this.globalNamedLambda, this.localDef, this.localNamedLambda, this.localAnonLambda, this.localAnonSingle];
    for (const d of dicts) {
      for (const [k, info] of Object.entries(d)) {
        for (const item of info) {
          addToDictArr(allLocal, k, item);
        }
      }
    }

    // make sure the semantic color in order (innermost last)
    for (const info of Object.values(allLocal)) {
      info.sort((a, b) => {
        return a.loc.range.start.isBeforeOrEqual(b.loc.range.start) ? -1 : 1;
      });
    }

    return allLocal;
  }

  // return [selected symbol, shadowed symbols]
  // if global is selected, return shadowed symbols (position===undefined)
  // if local is selected, return empty shadowed symbols (position!==undefined)
  public getSymbolWithShadowByRange(word: string, range: [number, number] | vscode.Range, positionFlag: vscode.Position | undefined): [SymbolInfo | undefined, SymbolInfo[]] {
    if (!Array.isArray(range)) {
      range = [this.document.offsetAt(range.start), this.document.offsetAt(range.end)];
    }

    const shadow = (this.allLocal[word] !== undefined) ? this.allLocal[word] : [];

    if (positionFlag === undefined) {
      // only global definition
      const res = this.globalDef[word];
      return (res !== undefined && res.length !== 0) ? [res.at(-1), shadow] : [undefined, shadow];

    } else {
      // local definition first, then global definition
      if (shadow === undefined || shadow.length === 0) {
        const res = this.globalDef[word];
        return (res !== undefined && res.length !== 0) ? [res.at(-1), []] : [undefined, []];

      } else {
        const numPosition = this.document.offsetAt(positionFlag);
        const innermost = findInnermost(shadow, range, numPosition);

        if (innermost === undefined) {
          const res = this.globalDef[word];
          return (res !== undefined && res.length !== 0) ? [res.at(-1), shadow] : [undefined, shadow];
        } else {
          return [innermost, []];
        }

      }

    }
  }

}

export { DocSymbolInfo };
