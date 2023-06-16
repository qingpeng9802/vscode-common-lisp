import * as vscode from 'vscode';

import type { DocSymbolInfo } from '../collect_user_symbol/DocSymbolInfo';
import { isQuote, isRangeIntExcludedRanges, isShadowed } from '../collect_user_symbol/user_symbol_util';
import { bisectRight } from '../common/algorithm';
import { clValidWithColonSharp, CL_MODE } from '../common/cl_util';
import { TriggerProvider } from '../common/enum';

import { TriggerEvent } from './TriggerEvent';
import { structuredInfo } from './structured_info';

function registerReferenceProvider() {
  const referenceProvider = vscode.languages.registerReferenceProvider(
    CL_MODE,
    {
      provideReferences(document, position, context, token) {
        const range = document.getWordRangeAtPosition(position, clValidWithColonSharp);
        if (range === undefined) {
          return undefined;
        }

        structuredInfo.produceInfoByDoc(document, new TriggerEvent(TriggerProvider.provideReferences));
        if (structuredInfo.currDocSymbolInfo === undefined) {
          return undefined;
        }

        const positionFlag = (isQuote(document, position) !== undefined) ? undefined : position;
        return getReferenceByWord(
          structuredInfo.currDocSymbolInfo,
          range,
          positionFlag,
          structuredInfo.buildingConfig,
          structuredInfo.needColorDict,
          true
        );
      }
    }
  );

  return referenceProvider;
}

// Design options: include? definition, include? comment, include? string
// See https://github.com/microsoft/vscode/issues/74237
function getReferenceByWord(
  currDocSymbolInfo: DocSymbolInfo,
  range: vscode.Range,
  positionFlag: vscode.Position | undefined,
  buildingConfig: Record<string, any>,
  needColorDict: Record<string, [number, number][]> | undefined,
  includeDefinition: boolean):
  vscode.Location[] {

  // config
  const excludedRanges = currDocSymbolInfo.docRes.getExcludedRangesForDefReferenceProvider(buildingConfig, 'ReferenceProvider');
  const doc = currDocSymbolInfo.document;
  const numRange: [number, number] = [doc.offsetAt(range.start), doc.offsetAt(range.end)];
  if (isRangeIntExcludedRanges(numRange, excludedRanges)) {
    return [];
  }
  const word = doc.getText(range).toLowerCase();
  if (!word) {
    return [];
  }
  const [symbolSelected, shadow] = currDocSymbolInfo.getSymbolWithShadowByRange(word, range, positionFlag);
  if (symbolSelected === undefined) {
    return [];
  }


  const selectedWord = symbolSelected.name;
  if (needColorDict === undefined) {
    return [];
  }
  let sameNameWords = needColorDict[selectedWord];
  if (sameNameWords === undefined) {
    return [];
  }
  if (symbolSelected.scope !== undefined) {
    const idxStart = bisectRight(sameNameWords, symbolSelected.scope[0], item => item[0]);
    const idxEnd = bisectRight(sameNameWords, symbolSelected.scope[1], item => item[0]);
    sameNameWords = sameNameWords.slice(idxStart, idxEnd);
  }

  const res: vscode.Location[] = [];
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

    if (positionFlag !== undefined) {
      // lexcial scope is enabled, exclude global vars (with quote) from lexical scope
      if (
        (selectedWord.length > 1) &&
        (isQuote(doc, doc.positionAt(wordRange[0])) !== undefined)) {
        continue;
      }
    }

    // shadowing is enabled, exclude local vars from global scope
    if (shadow !== undefined && shadow.length !== 0 && isShadowed(wordRange, shadow)) {
      continue;
    }

    // console.log(`${document.offsetAt(range.start)} -> ${document.offsetAt(range.end)}`);
    res.push(new vscode.Location(
      doc.uri,
      new vscode.Range(
        doc.positionAt(wordRange[0]),
        doc.positionAt(wordRange[1])
      )
    ));

  }

  if (includeDefinition) {
    res.push(symbolSelected.loc);
  }

  return res;
}

export { registerReferenceProvider };
