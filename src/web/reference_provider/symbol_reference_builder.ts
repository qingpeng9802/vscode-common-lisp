import * as vscode from 'vscode';

import { DocSymbolInfo } from '../user_symbol/DocSymbolInfo';
import { isRangeIntExcludedRanges, isQuote, isShadowed, isIntExcludedRanges } from '../user_symbol/collect_symbol_util';
import { SymbolInfo } from '../user_symbol/SymbolInfo';
import { bisectRight } from '../algorithm';

import { updateInfo, workspaceConfig } from '../entry/common';

// Design options: include? definition, include? comment, include? string
// See https://github.com/microsoft/vscode/issues/74237
function getReferenceByWord(currDocSymbolInfo: DocSymbolInfo, range: vscode.Range, position: vscode.Position | undefined, includeDefinition: boolean): vscode.Location[] {
  const [intRes, excludedRanges] = isIntExcludedRanges(
    workspaceConfig, currDocSymbolInfo, range,
    'commonLisp.ReferenceProvider.ExcludedRanges', 'commonLisp.ReferenceProvider.BackQuoteFilter.enabled');
  if (!intRes) {
    return [];
  }

  const document = currDocSymbolInfo.document;
  const word = document.getText(range).toLowerCase();
  if (!word) {
    return [];
  }

  const [symbolSelected, shadow]: [SymbolInfo | undefined, SymbolInfo[]] =
    currDocSymbolInfo.getSymbolWithShadowByRange(range, word, position);
  if (!symbolSelected) {
    return [];
  }

  const res: vscode.Location[] = [];

  const selectedWord = symbolSelected.name;
  let sameNameWords = updateInfo.needColorDict[selectedWord];
  if (sameNameWords === undefined) {
    return [];
  }

  if (symbolSelected.scope) {
    const idxStart = bisectRight(sameNameWords, symbolSelected.scope[0], item => item[0]);
    const idxEnd = bisectRight(sameNameWords, symbolSelected.scope[1], item => item[0]);
    sameNameWords = sameNameWords.slice(idxStart, idxEnd);
  }

  for (const wordRange of sameNameWords) {
    if (isRangeIntExcludedRanges(wordRange, excludedRanges)
    ) {
      continue;
    }

    if (
      !includeDefinition &&
      // intersection
      (wordRange[0] <= symbolSelected.numRange[1] && symbolSelected.numRange[0] <= wordRange[1])) {
      continue;
    }

    if (position) {
      // lexcial scope is enabled, exclude global vars (with quote) from lexical scope
      if (selectedWord.length > 1 && isQuote(document, document.positionAt(wordRange[0]))) {
        continue;
      }
    }

    // shadowing is enabled, exclude local vars from global scope
    if (shadow && shadow.length !== 0 && isShadowed(wordRange, shadow)) {
      continue;
    }

    // console.log(`${document.offsetAt(range.start)} -> ${document.offsetAt(range.end)}`);
    res.push(new vscode.Location(
      document.uri,
      new vscode.Range(
        document.positionAt(wordRange[0]),
        document.positionAt(wordRange[1])
      )
    ));

  }

  if (includeDefinition) {
    res.push(symbolSelected.loc);
  }

  return res;

}


export { getReferenceByWord };

