import * as vscode from 'vscode';

import { clValidWithColonSharp, CL_MODE } from '../common/cl_util';
import { isQuote, isRangeIntExcludedRanges, isShadowed } from '../collect_user_symbol/user_symbol_util';

import { updateInfo } from './update_info';
import { DocSymbolInfo } from '../collect_user_symbol/DocSymbolInfo';
import { SymbolInfo } from '../collect_user_symbol/SymbolInfo';
import { bisectRight } from '../common/algorithm';

function getReferenceProvider() {
  const referenceProvider = vscode.languages.registerReferenceProvider(
    CL_MODE,
    {
      provideReferences(document, position, context, token) {
        updateInfo.updateSymbol(document);
        if (!updateInfo.currDocSymbolInfo) {
          return undefined;
        }

        const range = document.getWordRangeAtPosition(position, clValidWithColonSharp);
        if (!range) {
          return undefined;
        }

        const excludedRangesCfg = updateInfo.buildingConfig['commonLisp.ReferenceProvider.ExcludedRanges'];
        const backQuoteCfg = updateInfo.buildingConfig['commonLisp.ReferenceProvider.BackQuoteFilter.enabled'];
        if (isQuote(document, position)) {
          return getReferenceByWord(updateInfo.currDocSymbolInfo, updateInfo.needColorDict, excludedRangesCfg, backQuoteCfg, range, undefined, true);
        }

        return getReferenceByWord(updateInfo.currDocSymbolInfo, updateInfo.needColorDict, excludedRangesCfg, backQuoteCfg, range, position, true);
      }
    }
  );

  return referenceProvider;
}

// Design options: include? definition, include? comment, include? string
// See https://github.com/microsoft/vscode/issues/74237
function getReferenceByWord(
  currDocSymbolInfo: DocSymbolInfo,
  needColorDict: Record<string, [number, number][]>,
  excludedRangesCfg: any,
  backQuoteCfg: any,
  range: vscode.Range,
  position: vscode.Position | undefined,
  includeDefinition: boolean):
  vscode.Location[] {
  if (currDocSymbolInfo === undefined) {
    return [];
  }
  const [intRes, excludedRanges] = currDocSymbolInfo.isIntExcludedRanges(range, excludedRangesCfg, backQuoteCfg);

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
  let sameNameWords = needColorDict[selectedWord];
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

export { getReferenceProvider };
