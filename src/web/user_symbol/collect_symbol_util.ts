import * as vscode from 'vscode';

import { bisectRight, excludeRangesFromRanges, mergeSortedIntervals } from '../algorithm';
import { DocSymbolInfo } from './DocSymbolInfo';
import { SymbolInfo } from './SymbolInfo';

import { WorkspaceConfig } from '../entry/WorkspaceConfig';

function isShadowed(currRange: [number, number], shadow: SymbolInfo[]): boolean {
  for (const s of shadow) {
    if (
      // s.scope contains currRange
      (s.scope && s.scope[0] <= currRange[0] && currRange[1] <= s.scope[1]) ||
      // intersects with definition
      (s.numRange[0] <= currRange[1] && currRange[0] <= s.numRange[1])
    ) {
      return true;
    }

  }
  return false;
}

function isIntExcludedRanges(
  workspaceConfig: WorkspaceConfig, currDocSymbolInfo: DocSymbolInfo, range: vscode.Range, eRangCfgName: string, backQuoteCfgName: string):
  [boolean, [number, number][]] {

  const excludedRangesCfg = workspaceConfig.config[eRangCfgName];
  let excludedRanges: [number, number][] = currDocSymbolInfo.getExcludedRanges(excludedRangesCfg);

  if (workspaceConfig.config[backQuoteCfgName]) {

    const backquotePairAndSymbol = mergeSortedIntervals(
      [...currDocSymbolInfo.docRes.backquotePairRange, ...currDocSymbolInfo.docRes.backquoteRange].sort((a, b) => a[0] - b[0]));
    const commaPairAndSymbol = mergeSortedIntervals(
      [...currDocSymbolInfo.docRes.commaPairRange, ...currDocSymbolInfo.docRes.commaRange].sort((a, b) => a[0] - b[0]));
    const excludedComma = excludeRangesFromRanges(backquotePairAndSymbol, commaPairAndSymbol);

    excludedRanges = mergeSortedIntervals(
      [...excludedRanges, ...excludedComma].sort((a, b) => a[0] - b[0]));
  }

  const document = currDocSymbolInfo.document;
  if (isRangeIntExcludedRanges([document.offsetAt(range.start), document.offsetAt(range.end)], excludedRanges)
  ) {
    return [false, excludedRanges];
  } else {
    return [true, excludedRanges];
  }
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

function isRangeIntExcludedRange(r: vscode.Range, ExcludedRange: vscode.Range[]): boolean {
  const rStart: vscode.Position = r.start;
  const idx = bisectRight(ExcludedRange, rStart, item => item.start);
  if (idx > 0 && ExcludedRange[idx - 1].contains(rStart)) {
    return true;
  }
  return false;
}

function findInnermost(symbols: SymbolInfo[], range: [number, number], position: number): SymbolInfo | undefined {
  let farthest: SymbolInfo | undefined = undefined;

  for (const s of symbols) {
    if (!s.scope) {
      continue;
    }

    // if the finding range is the symbol itself, return it
    if (s.numRange[0] === range[0] && s.numRange[1] === range[1]) {
      return s;
    }

    if (s.scope[0] <= position && position <= s.scope[1]) {
      if (!farthest || (farthest.scope && s.scope[0] > farthest.scope[0])) {
        farthest = s;
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
  return parentheseRange || quoteSymbolRange;
}

function getValidGroup(indices: [number, number][], nameGroup: number[]) {
  let groupIndex: [number, number] | undefined = undefined;
  for (const g of nameGroup) {
    if (indices[g]) {
      groupIndex = indices[g];
      return groupIndex;
    }
  }
  return groupIndex;

}

function checkDefName(r: RegExpMatchArray, nameGroup: number[]): string | undefined {
  let defName: string | undefined = undefined;

  for (const g of nameGroup) {
    if (r[g]) {
      defName = r[g];
      break;
    }
  }

  // exclude KEYWORD package symbols
  if (!defName) {
    return undefined;
  }

  /*
  if (!isStringClValidSymbol(defName)) {
    return undefined;
  }
  */
  return defName;
}

function addToDictArr(dict: Record<string, any[]>, k: any, item: any) {
  if (dict.hasOwnProperty(k)) {
    dict[k].push(item);
  } else {
    dict[k] = [item];
  }

}

export {
  isIntExcludedRanges,
  findInnermost,
  isQuote,
  checkDefName, getValidGroup,
  isRangeIntExcludedRanges,
  addToDictArr,
  isShadowed
};
