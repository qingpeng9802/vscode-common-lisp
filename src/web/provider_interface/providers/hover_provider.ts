import * as vscode from 'vscode';

import type { DocSymbolInfo } from '../../builders/DocSymbolInfo';
import { isRangeIntExcludedRanges } from '../../common/algorithm';
import { CL_MODE } from '../../common/cl_util';
import { TriggerProvider } from '../../common/enum';
import { getDoc } from '../../doc/get_doc';
import { TriggerEvent } from '../TriggerEvent';
import { isQuote, getCLWordRangeAtPosition } from '../provider_util';
import { structuredInfo } from '../structured_info';

// Example: https://github.com/NativeScript/nativescript-vscode-extension/blob/474c22c3dea9f9a145dc2cccf01b05e38850de90/src/services/language-services/hover/widget-hover.ts
function registerHoverProviders(providerName: string) {
  switch (providerName) {
    case 'ori':
      return vscode.languages.registerHoverProvider(
        CL_MODE,
        {
          provideHover(document, position, token) {
            const range = getCLWordRangeAtPosition(document, position);
            if (range === undefined) {
              return undefined;
            }

            const word = document.getText(range);
            //console.log(word);
            if (!word) {
              return undefined;
            }

            const tooltip = getDoc(word.toLowerCase());
            return (tooltip !== undefined) ? new vscode.Hover(tooltip) : undefined;
          },
        }
      );
    case 'user':
      return vscode.languages.registerHoverProvider(
        CL_MODE,
        {
          provideHover(document, position, token) {
            const range = getCLWordRangeAtPosition(document, position);
            if (range === undefined) {
              return undefined;
            }

            structuredInfo.updateInfoByDoc(document, new TriggerEvent(TriggerProvider.provideHoverUser));
            if (structuredInfo.currDocSymbolInfo === undefined) {
              return undefined;
            }

            const positionFlag = (isQuote(document, position) !== undefined) ? undefined : position;
            const docStr = getSymbolDocStrByRange(
              structuredInfo.currDocSymbolInfo,
              range,
              positionFlag,
              structuredInfo.buildingConfig
            );

            if (docStr === undefined) {
              return undefined;
            }

            const tooltip = new vscode.MarkdownString(docStr);
            tooltip.isTrusted = true;
            tooltip.supportHtml = true;
            return new vscode.Hover(tooltip);
          },
        }
      );
    default:
      return undefined;
  }
}

function getSymbolDocStrByRange(
  currDocSymbolInfo: DocSymbolInfo, range: vscode.Range, positionFlag: vscode.Position | undefined,
  buildingConfig: Map<string, any>
): string | undefined {

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
  return symbolSelected?.docStr;
}

export { registerHoverProviders };
