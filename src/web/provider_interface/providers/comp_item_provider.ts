import * as vscode from 'vscode';

import { genAllOriSymbols } from '../../builders/comp_item_builder/comp_item_ori_builder';
import { bisectRight } from '../../common/algorithm';
import { CL_MODE } from '../../common/cl_util';
import { TriggerProvider } from '../../common/enum';
import { TriggerEvent } from '../TriggerEvent';
import { getCLWordRangeAtPosition } from '../provider_util';
import { structuredInfo } from '../structured_info';

// only need once
const oriSymbolsCompItem = genAllOriSymbols();

// default completion item's word range does not include the '-' character, so we need to reset it
// @sideEffect: compItems:vscode.CompletionItem[]
function resetCompItemWordRange(range: vscode.Range, compItems: vscode.CompletionItem[]) {
  compItems.forEach(item => {
    item.range = range;
  });
}

function registerCompletionItemProviders(providerName: string): vscode.Disposable | undefined {
  switch (providerName) {
    case 'user':
      return vscode.languages.registerCompletionItemProvider(
        CL_MODE,
        {
          provideCompletionItems(document, position, token, context) {
            const range = getCLWordRangeAtPosition(document, position);
            if (range === undefined) {
              return undefined;
            }

            structuredInfo.updateInfoByDoc(document, new TriggerEvent(TriggerProvider.provideCompletionItems));
            if (structuredInfo.currUserSymbolsCompItem === undefined) {
              return undefined;
            }

            const numPosition = document.offsetAt(position);
            const userSymbols = structuredInfo.currUserSymbolsCompItem.getUserompletionItems(numPosition);

            resetCompItemWordRange(range, userSymbols);

            return userSymbols;
          }
        });
    case 'loop':
      return vscode.languages.registerCompletionItemProvider(
        CL_MODE,
        {
          provideCompletionItems(document, position, token, context) {
            const range = getCLWordRangeAtPosition(document, position);
            if (range === undefined) {
              return undefined;
            }
            structuredInfo.updateInfoByDoc(document, new TriggerEvent(TriggerProvider.provideCompletionItems));
            if (
              structuredInfo.currUserSymbolsCompItem === undefined ||
              structuredInfo.currDocSymbolInfo === undefined
            ) {
              return undefined;
            }

            const numPosition = document.offsetAt(position);
            const loopBlocks = structuredInfo.currDocSymbolInfo.loopBlocks;
            const idx = bisectRight(loopBlocks, numPosition, item => item[0]);
            if (idx === -1 || idx === 0) {
              return undefined;
            }
            if (loopBlocks[idx - 1][1] < numPosition) {
              return undefined;
            }

            const loopSymbols = oriSymbolsCompItem.loopSymbols;
            resetCompItemWordRange(range, loopSymbols);

            return loopSymbols;
          }
        });
    case 'ori':
      return vscode.languages.registerCompletionItemProvider(
        CL_MODE,
        {
          provideCompletionItems(document, position, token, context) {
            const range = getCLWordRangeAtPosition(document, position);
            if (range === undefined) {
              return undefined;
            }
            resetCompItemWordRange(range, oriSymbolsCompItem.oriSymbols);

            return oriSymbolsCompItem.oriSymbols;
          }
        });
    case 'ampersand':
      return vscode.languages.registerCompletionItemProvider(
        CL_MODE,
        {
          provideCompletionItems(document, position, token, context) {
            const range = getCLWordRangeAtPosition(document, position);
            if (range === undefined) {
              return undefined;
            }
            resetCompItemWordRange(range, oriSymbolsCompItem.afterAmpersand);

            return oriSymbolsCompItem.afterAmpersand;
          }
        }, '&');
    case 'asterisk':
      return vscode.languages.registerCompletionItemProvider(
        CL_MODE,
        {
          provideCompletionItems(document, position, token, context) {
            const range = getCLWordRangeAtPosition(document, position);
            if (range === undefined) {
              return undefined;
            }
            resetCompItemWordRange(range, oriSymbolsCompItem.afterAsterisk);

            return oriSymbolsCompItem.afterAsterisk;
          }
        }, '*');
    case 'colon':
      return vscode.languages.registerCompletionItemProvider(
        CL_MODE,
        {
          provideCompletionItems(document, position, token, context) {
            const range = getCLWordRangeAtPosition(document, position);
            if (range === undefined) {
              return undefined;
            }
            resetCompItemWordRange(range, oriSymbolsCompItem.afterColon);

            return oriSymbolsCompItem.afterColon;
          }
        }, ':');
    case 'tilde':
      return vscode.languages.registerCompletionItemProvider(
        CL_MODE,
        {
          provideCompletionItems(document, position, token, context) {
            const range = getCLWordRangeAtPosition(document, position);
            if (range === undefined) {
              return undefined;
            }
            resetCompItemWordRange(range, oriSymbolsCompItem.afterTilde);

            return oriSymbolsCompItem.afterTilde;
          }
        }, '~');
    case 'sharpsign':
      return vscode.languages.registerCompletionItemProvider(
        CL_MODE,
        {
          provideCompletionItems(document, position, token, context) {
            const range = getCLWordRangeAtPosition(document, position);
            if (range === undefined) {
              return undefined;
            }
            resetCompItemWordRange(range, oriSymbolsCompItem.afterSharpsign);

            return oriSymbolsCompItem.afterSharpsign;
          }
        }, '#');
    default:
      return undefined;
  }
}

export { registerCompletionItemProviders };
