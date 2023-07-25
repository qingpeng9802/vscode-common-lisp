import type * as vscode from 'vscode';

import type { SymbolInfo } from '../collect_info/SymbolInfo';
import type { ScanDocRes } from '../collect_info/collect_from_text/ScanDocRes';
import { collectLoopVar } from '../collect_info/collect_from_text/loop';
import { scanDoc } from '../collect_info/collect_from_text/no_code';
import { collectGlobalDef, collectLocalDef } from '../collect_info/collect_from_text/non_var';
import { collectKeywordSingleVar, collectKeywordVars } from '../collect_info/collect_from_text/var';
import { bisectRight } from '../common/algorithm';

class DocSymbolInfo {
  public readonly document: vscode.TextDocument;
  public readonly docRes: ScanDocRes;

  public readonly globalDef: Map<string, SymbolInfo[]>;
  public readonly globalNamedLambda: Map<string, SymbolInfo[]>;

  public readonly localDef: Map<string, SymbolInfo[]>;
  public readonly localNamedLambda: Map<string, SymbolInfo[]>;

  public readonly localAnonLambda: Map<string, SymbolInfo[]>;
  public readonly localAnonSingle: Map<string, SymbolInfo[]>;
  public readonly localAnonLoop: Map<string, SymbolInfo[]>;

  public readonly loopBlocks: [number, number][];
  public readonly stepFormArr: [number, number][];

  //public readonly globalNames: Set<string>;
  //public readonly allLocalNames: Set<string>;
  private _allNames: Set<string> | undefined = undefined;
  private _allLocal: Map<string, SymbolInfo[]> | undefined = undefined;

  constructor(
    document: vscode.TextDocument, buildingConfig: Map<string, any>
  ) {
    this.document = document;
    const text = document.getText();

    this.docRes = scanDoc(text);
    const excludedRanges = this.docRes.getExcludedRangesForStaticAnalysis(buildingConfig);

    [this.globalDef, this.globalNamedLambda] = collectGlobalDef(document, this.docRes, excludedRanges);
    [this.localDef, this.localNamedLambda] = collectLocalDef(document, this.docRes, excludedRanges);

    [this.localAnonLambda, this.stepFormArr] = collectKeywordVars(document, this.docRes, excludedRanges);
    this.localAnonSingle = collectKeywordSingleVar(document, this.docRes, excludedRanges);
    [this.localAnonLoop, this.loopBlocks] = collectLoopVar(document, this.docRes, excludedRanges);

    // sort to tolerance for multiple definition
    for (const info of this.globalDef.values()) {
      info.sort((a, b) => {
        return a.startPos.isBeforeOrEqual(b.startPos) ? -1 : 1;
      });
    }
  }

  get allNames() {
    if (this._allNames === undefined) {
      // for semantic color
      this._allNames = new Set<string>();
      for (const ks of [this.globalDef.keys(), this.allLocal.keys()]) {
        for (const k of ks) {
          this._allNames.add(k);
        }
      }
    }
    return this._allNames;
  }

  get allLocal() {
    if (this._allLocal === undefined) {
      this._allLocal = new Map<string, SymbolInfo[]>();
      const dicts = [
        this.globalNamedLambda, this.localDef, this.localNamedLambda,
        this.localAnonLambda, this.localAnonSingle, this.localAnonLoop
      ];
      for (const d of dicts) {
        for (const [k, info] of d) {
          if (!this._allLocal.has(k)) {
            this._allLocal.set(k, []);
          }
          this._allLocal.get(k)!.push(...info);
        }
      }

      // make sure the semantic color in order (innermost last)
      for (const info of this._allLocal.values()) {
        info.sort((a, b) => {
          return a.startPos.isBeforeOrEqual(b.startPos) ? -1 : 1;
        });
      }
    }
    return this._allLocal;
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

  private isInStepForm(numPosition: number, shadow: SymbolInfo[]) {
    // select candidate shadow
    shadow = shadow.filter(item => item.containerName === 'do');
    if (shadow.length === 0) {
      return undefined;
    }

    // filter by the smallest range for quick elimination
    const idx = bisectRight(this.stepFormArr, numPosition, item => item[0]);
    if (idx === -1 || idx === 0 || numPosition >= this.stepFormArr[idx - 1][1]) {
      return undefined;
    }

    // now, can confirm position is in step form, waive scope
    // check extended scope [numRange[1], scope[0]]
    shadow = shadow.filter(item => item.scope !== undefined);
    const idxDo = bisectRight(shadow, numPosition, item => item.numRange[1]);
    if (idxDo === -1 || idxDo === 0 || numPosition >= shadow[idxDo - 1].scope![0]) {
      return undefined;
    }
    return shadow[idxDo - 1];
  }

  // return [selected symbol, shadowed symbols]
  // if global is selected, return shadowed symbols (position===undefined)
  // if local is selected, return empty shadowed symbols (position!==undefined)
  public getSymbolWithShadowByRange(
    word: string,
    range: [number, number] | vscode.Range,
    positionFlag: vscode.Position | undefined
  ): [SymbolInfo | undefined, SymbolInfo[]] {
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

      // check if it is `do`'s step form
      const stepForm = this.isInStepForm(numPosition, shadow);
      if (stepForm !== undefined) {
        return [stepForm, []];
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
