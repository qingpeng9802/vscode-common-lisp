import type * as vscode from 'vscode';

import { bisectRight } from '../common/algorithm';

import type { SymbolInfo } from './SymbolInfo';

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

// we do not need to sort excludedRanges before search since we add those ranges in order
function isRangeIntExcludedRanges(r: [number, number], excludedRange: [number, number][]): boolean {
  if (excludedRange.length === 0) {
    return false;
  }

  const rStart: number = r[0];
  const idx = bisectRight(excludedRange, rStart, item => item[0]);

  if (idx > 0 && excludedRange[idx - 1][0] <= rStart && rStart < excludedRange[idx - 1][1]) {
    return true;
  }
  return false;
}

function isRangeIntExcludedRange(r: vscode.Range, excludedRange: vscode.Range[]): boolean {
  if (excludedRange.length === 0) {
    return false;
  }

  const rStart: vscode.Position = r.start;
  const idx = bisectRight(excludedRange, rStart, item => item.start);
  if (idx > 0 && excludedRange[idx - 1].contains(rStart)) {
    return true;
  }
  return false;
}

function findInnermost(symbols: SymbolInfo[], range: [number, number], position: number): SymbolInfo | undefined {
  let farthest: SymbolInfo | undefined = undefined;

  for (const symbol of symbols) {
    if (symbol.scope === undefined) {
      continue;
    }

    // if the finding range is the symbol itself, return it
    if (symbol.numRange[0] === range[0] && symbol.numRange[1] === range[1]) {
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

// no using lexical scope
// Common Lisp the Language, 2nd Edition
// 7.1. Reference https://www.cs.cmu.edu/Groups/AI/html/cltl/clm/node78.html#SECTION001111000000000000000
function isQuote(document: vscode.TextDocument, position: vscode.Position): vscode.Range | undefined {
  const parentheseRange = document.getWordRangeAtPosition(position, /(?<=^|\s|\(|,@|,\.|,)\s*?quote\s*?[A-Za-z0-9\+\-\*\/\@\$\%\^\&\_\=\<\>\~\!\?\[\]\{\}\.]+?\s*?(?=(\s|\(|\)))/igm);
  const quoteSymbolRange = document.getWordRangeAtPosition(position, /(?<=^|\s|\(|,@|,\.|,)'[A-Za-z0-9\+\-\*\/\@\$\%\^\&\_\=\<\>\~\!\?\[\]\{\}\.]+?(?=(\s|\(|\)))/igm);
  return (parentheseRange !== undefined) ? parentheseRange : quoteSymbolRange;
}

function getValidGroupInd(indices: [number, number][], nameGroup: number[]): [number, number] | undefined {
  for (const g of nameGroup) {
    if (indices[g] !== undefined) {
      return indices[g];
    }
  }
  return undefined;
}

function checkDefName(r: RegExpMatchArray, nameGroup: number[]): string | undefined {
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

  /*
  if (isStringClValidSymbol(defName) === undefined) {
    return undefined;
  }
  */
  return defName;
}

function addToDictArr(dict: Record<string, any[]>, k: string, item: any) {
  if (Object.hasOwn(dict, k)) {
    dict[k].push(item);
  } else {
    dict[k] = [item];
  }
}

export {
  findInnermost,
  isQuote,
  checkDefName, getValidGroupInd,
  isRangeIntExcludedRanges,
  addToDictArr,
  isShadowed
};
