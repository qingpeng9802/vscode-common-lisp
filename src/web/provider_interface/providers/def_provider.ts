import * as vscode from 'vscode';

import type { DocSymbolInfo } from '../../builders/DocSymbolInfo';
import { isRangeIntExcludedRanges } from '../../common/algorithm';
import { CL_MODE } from '../../common/cl_util';
import { TriggerProvider } from '../../common/enum';
import { TriggerEvent } from '../TriggerEvent';
import { isQuote, getCLWordRangeAtPosition } from '../provider_util';
import { structuredInfo } from '../structured_info';

function registerDefinitionProvider() {
  const definitionProvider = vscode.languages.registerDefinitionProvider(
    CL_MODE,
    {
      provideDefinition(document, position, token) {
        const range = getCLWordRangeAtPosition(document, position);
        if (range === undefined) {
          return undefined;
        }

        structuredInfo.updateInfoByDoc(document, new TriggerEvent(TriggerProvider.provideDefinition));
        if (structuredInfo.currDocSymbolInfo === undefined) {
          return undefined;
        }

        const positionFlag = (isQuote(document, position) !== undefined) ? undefined : position;
        return getSymbolLocByRange(
          structuredInfo.currDocSymbolInfo,
          range,
          positionFlag,
          structuredInfo.buildingConfig
        );
      }
    }
  );

  return definitionProvider;

}

// Common Lisp the Language, 2nd Edition
// 5.2.1. Named Functions https://www.cs.cmu.edu/Groups/AI/html/cltl/clm/node63.html#SECTION00921000000000000000
// set `position` to `undefined`, will only process global definition
function getSymbolLocByRange(
  currDocSymbolInfo: DocSymbolInfo, range: vscode.Range, positionFlag: vscode.Position | undefined,
  buildingConfig: Map<string, any>
): vscode.Location | undefined {

  // config
  const excludedRanges =
    currDocSymbolInfo.docRes.getExcludedRangesForDefReferenceProvider(buildingConfig, 'DefinitionProvider');
  const doc = currDocSymbolInfo.document;
  const numRange: [number, number] = [doc.offsetAt(range.start), doc.offsetAt(range.end)];
  if (isRangeIntExcludedRanges(numRange, excludedRanges)) {
    return undefined;
  }
  const word = doc.getText(range);
  if (!word) {
    return undefined;
  }
  const [symbolSelected, shadow] = currDocSymbolInfo.getSymbolWithShadowByRange(
    word.toLowerCase(), range, positionFlag
  );
  return symbolSelected?.loc;
}

export { registerDefinitionProvider };
