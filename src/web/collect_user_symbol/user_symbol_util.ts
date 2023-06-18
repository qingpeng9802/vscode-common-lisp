import type * as vscode from 'vscode';

import { bisectLeft, bisectRight } from '../common/algorithm';

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

function findMatchPairAfterP(absIndex: number, pair: [number, number][], validUpper: number | undefined = undefined): number {
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

function findMatchPairExactP(absIndex: number, pairMap: Map<number, number>, validUpper: number | undefined = undefined): number {
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

const space = new Set([' ', '\f', '\n', '\r', '\t', '\v']);
const isSpace = (c: string) => space.has(c);

export {
  isQuote,
  checkDefName, getValidGroupInd,
  isRangeIntExcludedRanges,
  addToDictArr,
  isShadowed,
  findMatchPairAfterP, findMatchPairExactP,
  isSpace
};
