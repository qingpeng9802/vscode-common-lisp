import * as vscode from 'vscode';

import type { DocSymbolInfo } from '../../collect_info/DocSymbolInfo';
import { isQuote, isRangeIntExcludedRanges, isShadowed } from '../../collect_info/collect_util';
import { CL_MODE } from '../../common/cl_util';
import { TriggerProvider } from '../../common/enum';
import { TriggerEvent } from '../TriggerEvent';
import { getCLWordRangeAtPosition } from '../provider_util';
import { structuredInfo } from '../structured_info';

function registerReferenceProvider() {
  const referenceProvider = vscode.languages.registerReferenceProvider(
    CL_MODE,
    {
      provideReferences(document, position, context, token) {
        const range = getCLWordRangeAtPosition(document, position);
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
  currDocSymbolInfo: DocSymbolInfo, range: vscode.Range, positionFlag: vscode.Position | undefined,
  buildingConfig: Map<string, any>, needColorDict: Map<string, [number, number][]> | undefined,
  includeDefinition: boolean
): vscode.Location[] {

  // config
  const excludedRanges =
    currDocSymbolInfo.docRes.getExcludedRangesForDefReferenceProvider(buildingConfig, 'ReferenceProvider');
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

  if (needColorDict === undefined) {
    return [];
  }

  const scopedSameNameWords = symbolSelected.getScopedSameNameWordsExcludeItself(needColorDict, currDocSymbolInfo);
  const res: vscode.Location[] = [];
  // loop cache
  const isSymbolSelectedLengthLargerThanOne = (symbolSelected.name.length > 1);
  const isShaowValid = shadow !== undefined && shadow.length !== 0;
  const uri = doc.uri;
  for (const wordRange of scopedSameNameWords) {
    if (isRangeIntExcludedRanges(wordRange, excludedRanges)
    ) {
      continue;
    }

    const [wordStart, wordEnd] = wordRange;

    if (positionFlag !== undefined) {
      // lexcial scope is enabled, exclude global vars (with quote) from lexical scope
      if (
        isSymbolSelectedLengthLargerThanOne &&
        (isQuote(doc, doc.positionAt(wordStart)) !== undefined)) {
        continue;
      }
    }

    // shadowing is enabled, exclude local vars from global scope
    if (isShaowValid && isShadowed(wordRange, shadow)) {
      continue;
    }

    // console.log(`${document.offsetAt(range.start)} -> ${document.offsetAt(range.end)}`);
    res.push(new vscode.Location(
      uri,
      new vscode.Range(doc.positionAt(wordStart), doc.positionAt(wordEnd))
    ));

  }

  if (includeDefinition) {
    res.push(symbolSelected.loc);
  }

  return res;
}

export { registerReferenceProvider };
