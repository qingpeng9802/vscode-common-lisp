import type * as vscode from 'vscode';

import { excludeRangesFromRanges, mergeSortedIntervals } from '../common/algorithm';
import { ExcludeRanges, SingleQuoteAndBackQuoteHighlight } from '../common/config_enum';

import type { SymbolInfo } from './SymbolInfo';
import { addToDictArr, findInnermost, isRangeIntExcludedRanges } from './user_symbol_util';

interface docObj {
  readonly doc: string;
  readonly docLength: number;
  readonly commentRange: [number, number][];
  readonly stringRange: [number, number][];
  readonly quotedRange: [number, number][];
  readonly quotedPairRange: [number, number][];
  readonly backquoteRange: [number, number][];
  readonly backquotePairRange: [number, number][];
  readonly commaRange: [number, number][];
  readonly commaPairRange: [number, number][];
}

class DocSymbolInfo {
  public readonly document: vscode.TextDocument;

  public readonly docRes: docObj;

  public readonly allLocal: Record<string, SymbolInfo[]>;

  public readonly globalNames: Set<string>;
  public readonly allLocalNames: Set<string>;
  public readonly allNames: Set<string>;

  public readonly commentRange: [number, number][] = [];
  public readonly stringRange: [number, number][] = [];
  public readonly commentAndStringRange: [number, number][];

  public readonly globalDef: Record<string, SymbolInfo[]>;
  public readonly globalNamedLambda: Record<string, SymbolInfo[]>;

  public readonly localDef: Record<string, SymbolInfo[]>;
  public readonly localNamedLambda: Record<string, SymbolInfo[]>;

  public readonly localAnonLambda: Record<string, SymbolInfo[]>;
  public readonly localAnonSingle: Record<string, SymbolInfo[]>;

  constructor(
    document: vscode.TextDocument,

    docRes: docObj,

    commentRange: [number, number][],
    stringRange: [number, number][],
    commentAndStringRange: [number, number][],

    globalDef: Record<string, SymbolInfo[]>,
    globalNamedLambda: Record<string, SymbolInfo[]>,

    localDef: Record<string, SymbolInfo[]>,
    localNamedLambda: Record<string, SymbolInfo[]>,
    localAnonLambda: Record<string, SymbolInfo[]>,
    localAnonSingle: Record<string, SymbolInfo[]>,
  ) {
    this.document = document;

    this.docRes = docRes;

    this.commentRange = commentRange;
    this.stringRange = stringRange;
    this.commentAndStringRange = commentAndStringRange;

    this.globalDef = globalDef;
    this.globalNamedLambda = globalNamedLambda;
    this.localDef = localDef;
    this.localNamedLambda = localNamedLambda;
    this.localAnonLambda = localAnonLambda;
    this.localAnonSingle = localAnonSingle;

    this.allLocal = this.getAllLocal();

    [this.globalNames, this.allLocalNames, this.allNames] = this.getAllNames();

    // tolerance for multiple definition
    for (const [k, info] of Object.entries(this.globalDef)) {
      info.sort((a, b) => {
        return a.loc.range.start.isBeforeOrEqual(b.loc.range.start) ? -1 : 1;
      });
    }
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
    for (const [k, info] of Object.entries(allLocal)) {
      info.sort((a, b) => {
        return a.loc.range.start.isBeforeOrEqual(b.loc.range.start) ? -1 : 1;
      });
    }

    return allLocal;
  }

  // Common Lisp the Language, 2nd Edition
  // 5.2.1. Named Functions https://www.cs.cmu.edu/Groups/AI/html/cltl/clm/node63.html#SECTION00921000000000000000
  // set `position` to `undefined`, will only process global definition
  public getSymbolLocByRange(range: vscode.Range, word: string, position: vscode.Position | undefined): vscode.Location | undefined {
    const [symbolSelected, shadow] = this.getSymbolWithShadowByRange(range, word, position);
    return symbolSelected?.loc;
  }

  // return [selected symbol, shadowed symbols]
  // if global is selected, return shadowed symbols
  // if local is selected, return empty shadowed symbols
  public getSymbolWithShadowByRange(range: [number, number] | vscode.Range, word: string, position: vscode.Position | undefined): [SymbolInfo | undefined, SymbolInfo[]] {
    if (!Array.isArray(range)) {
      range = [this.document.offsetAt(range.start), this.document.offsetAt(range.end)];
    }

    const shadow = this.allLocal[word] ? this.allLocal[word] : [];

    if (!position) {
      // only global definition
      const res = this.globalDef[word];
      return (res && res.length !== 0) ? [res.at(-1), shadow] : [undefined, shadow];

    } else {
      // local definition first, then global definition
      if (!shadow || shadow.length === 0) {
        const res = this.globalDef[word];
        return (res && res.length !== 0) ? [res.at(-1), []] : [undefined, []];
      } else {
        const numPosition = this.document.offsetAt(position);
        const innermost = findInnermost(shadow, range, numPosition);

        if (innermost === undefined) {
          const res = this.globalDef[word];
          return (res && res.length !== 0) ? [res.at(-1), shadow] : [undefined, shadow];
        } else {
          return [innermost, []];
        }
      }

    }
  }

  private getExcludedRanges(excludedRangesCfg: ExcludeRanges): [number, number][] {
    switch (excludedRangesCfg) {
      case ExcludeRanges.CommentString:
        return this.commentAndStringRange;
      case ExcludeRanges.Comment:
        return this.commentRange;
      case ExcludeRanges.String:
        return this.stringRange;
      case ExcludeRanges.None:
        return [];
      default:
        return [];
    }
  }

  public getExcludedRangesWithSQAndBQ(buildingConfig: Record<string, any>): [number, number][] {
    const excludedRangesCfg = buildingConfig['commonLisp.DocumentSemanticTokensProvider.ExcludedRanges'];
    const SQAndBQHighlightCfg = buildingConfig['commonLisp.DocumentSemanticTokensProvider.SingleQuoteAndBackQuote.Highlight'];
    let excludedRanges: [number, number][] = this.getExcludedRanges(excludedRangesCfg);

    switch (SQAndBQHighlightCfg) {
      case SingleQuoteAndBackQuoteHighlight.SQ:
        excludedRanges = mergeSortedIntervals([
          ...excludedRanges,
          ...this.docRes.backquotePairRange,
          ...this.docRes.backquoteRange,
        ].sort((a, b) => a[0] - b[0])
        );
        break;

      case SingleQuoteAndBackQuoteHighlight.SQAndBQC: {
        const backquotePairAndSymbol = mergeSortedIntervals(
          [...this.docRes.backquotePairRange, ...this.docRes.backquoteRange].sort((a, b) => a[0] - b[0]));
        const commaPairAndSymbol = mergeSortedIntervals(
          [...this.docRes.commaPairRange, ...this.docRes.commaRange].sort((a, b) => a[0] - b[0]));
        const excludedComma = excludeRangesFromRanges(backquotePairAndSymbol, commaPairAndSymbol);

        excludedRanges = mergeSortedIntervals(
          [...excludedRanges, ...excludedComma].sort((a, b) => a[0] - b[0]));
        break;
      }
      case SingleQuoteAndBackQuoteHighlight.SQAndBQAll:
        // nothing
        break;

      case SingleQuoteAndBackQuoteHighlight.BQC: {
        const backquotePairAndSymbol2 = mergeSortedIntervals(
          [...this.docRes.backquotePairRange, ...this.docRes.backquoteRange].sort((a, b) => a[0] - b[0]));
        const commaPairAndSymbol2 = mergeSortedIntervals(
          [...this.docRes.commaPairRange, ...this.docRes.commaRange].sort((a, b) => a[0] - b[0]));
        const excludedComma2 = excludeRangesFromRanges(backquotePairAndSymbol2, commaPairAndSymbol2);

        excludedRanges = mergeSortedIntervals([
          ...excludedRanges,
          ...this.docRes.quotedPairRange,
          ...this.docRes.quotedRange,
          ...excludedComma2
        ].sort((a, b) => a[0] - b[0]));
        break;
      }
      case SingleQuoteAndBackQuoteHighlight.BQAll:
        excludedRanges = mergeSortedIntervals([
          ...excludedRanges,
          ...this.docRes.quotedPairRange,
          ...this.docRes.quotedRange,
        ].sort((a, b) => a[0] - b[0])
        );
        break;

      case SingleQuoteAndBackQuoteHighlight.None:
        excludedRanges = mergeSortedIntervals([
          ...excludedRanges,
          ...this.docRes.backquotePairRange,
          ...this.docRes.backquoteRange,
          ...this.docRes.quotedPairRange,
          ...this.docRes.quotedRange,
        ].sort((a, b) => a[0] - b[0])
        );
        break;

      default:
        break;
    }

    return excludedRanges;
  }

  public isIntExcludedRanges(range: vscode.Range, excludedRangesCfg: any, backQuoteCfg: any): [boolean, [number, number][]] {
    let excludedRanges: [number, number][] = this.getExcludedRanges(excludedRangesCfg);

    if (backQuoteCfg) {
      const backquotePairAndSymbol = mergeSortedIntervals(
        [...this.docRes.backquotePairRange, ...this.docRes.backquoteRange].sort((a, b) => a[0] - b[0]));
      const commaPairAndSymbol = mergeSortedIntervals(
        [...this.docRes.commaPairRange, ...this.docRes.commaRange].sort((a, b) => a[0] - b[0]));
      const excludedComma = excludeRangesFromRanges(backquotePairAndSymbol, commaPairAndSymbol);

      excludedRanges = mergeSortedIntervals(
        [...excludedRanges, ...excludedComma].sort((a, b) => a[0] - b[0]));
    }

    const document = this.document;
    if (isRangeIntExcludedRanges([document.offsetAt(range.start), document.offsetAt(range.end)], excludedRanges)
    ) {
      return [false, excludedRanges];
    } else {
      return [true, excludedRanges];
    }
  }

}

export { DocSymbolInfo };
