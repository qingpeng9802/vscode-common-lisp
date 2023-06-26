import * as vscode from 'vscode';

import type { UserSymbolsCompItem } from '../../builders/comp_item_builder/UserSymbolsCompItem';
import { genAllOriSymbols } from '../../builders/comp_item_builder/comp_item_ori_builder';
import { bisectRight } from '../../common/algorithm';
import { clValidWithColonSharp, CL_MODE } from '../../common/cl_util';
import { TriggerProvider } from '../../common/enum';
import { TriggerEvent } from '../TriggerEvent';
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

function getUserompletionItems(
  currUserSymbolsCompItem: UserSymbolsCompItem, position: number
): vscode.CompletionItem[] {
  const res: vscode.CompletionItem[] = currUserSymbolsCompItem.globalCItems;

  const idx = bisectRight(currUserSymbolsCompItem.localScopeCItems, position, item => item[1][0]);
  for (let i = idx - 1; i >= 0; --i) {
    const [compItem, numRange] = currUserSymbolsCompItem.localScopeCItems[i];
    const [start, end] = numRange;
    // contains position
    if (start <= position && position <= end) {
      res.push(compItem);
    }
  }

  return res;
}

function registerCompletionItemProviders(providerName: string): vscode.Disposable | undefined {
  switch (providerName) {
    case 'userSymbols':
      return vscode.languages.registerCompletionItemProvider(
        CL_MODE,
        {
          provideCompletionItems(document, position, token, context) {
            const range = document.getWordRangeAtPosition(position, clValidWithColonSharp);
            if (range === undefined) {
              return undefined;
            }

            structuredInfo.produceInfoByDoc(document, new TriggerEvent(TriggerProvider.provideCompletionItems));
            if (structuredInfo.currUserSymbolsCompItem === undefined) {
              return undefined;
            }

            const numPosition = document.offsetAt(position);
            const userSymbols = getUserompletionItems(structuredInfo.currUserSymbolsCompItem, numPosition);

            resetCompItemWordRange(range, userSymbols);

            return userSymbols;
          }
        });
    case 'loop':
      return vscode.languages.registerCompletionItemProvider(
        CL_MODE,
        {
          provideCompletionItems(document, position, token, context) {
            const range = document.getWordRangeAtPosition(position, clValidWithColonSharp);
            if (range === undefined) {
              return undefined;
            }
            structuredInfo.produceInfoByDoc(document, new TriggerEvent(TriggerProvider.provideCompletionItems));
            if (structuredInfo.currUserSymbolsCompItem === undefined) {
              return undefined;
            }

            const numPosition = document.offsetAt(position);
            const loopBlocks = structuredInfo.currDocSymbolInfo!.loopBlocks;
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
    case 'oriSymbols':
      return vscode.languages.registerCompletionItemProvider(
        CL_MODE,
        {
          provideCompletionItems(document, position, token, context) {
            const range = document.getWordRangeAtPosition(position, clValidWithColonSharp);
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
            const range = document.getWordRangeAtPosition(position, clValidWithColonSharp);
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
            const range = document.getWordRangeAtPosition(position, clValidWithColonSharp);
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
            const range = document.getWordRangeAtPosition(position, clValidWithColonSharp);
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
            const range = document.getWordRangeAtPosition(position, clValidWithColonSharp);
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
            const range = document.getWordRangeAtPosition(position, clValidWithColonSharp);
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
