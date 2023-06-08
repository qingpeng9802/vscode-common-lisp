import * as vscode from 'vscode';

import type { UserSymbols } from '../builders/comp_item_builder/UserSymbols';
import { genAllOriSymbols } from '../builders/comp_item_builder/comp_item_ori_builder';
import { bisectRight } from '../common/algorithm';
import { clValidWithColonSharp, CL_MODE } from '../common/cl_util';
import { TriggerProvider } from '../common/enum';

import { TriggerEvent } from './TriggerEvent';
import { structuredInfo } from './structured_info';

// only need once
const oriSymbolsCompItem = genAllOriSymbols();

// default completion item's word range does not include the '-' character, so we need to reset it
// @sideEffect: compItems:vscode.CompletionItem[]
function resetCompItemWordRange(range: vscode.Range, compItems: vscode.CompletionItem[]) {
  for (const compItem of compItems) {
    compItem.range = range;
  }
}

function getUserompletionItems(currUserSymbols: UserSymbols, position: number): vscode.CompletionItem[] {
  const res: vscode.CompletionItem[] = currUserSymbols.globalCItems;

  const idx = bisectRight(currUserSymbols.localScopeCItems, position, item => item[1][0]);
  for (let i = idx - 1; i >= 0; i--) {
    if (
      // contains position
      currUserSymbols.localScopeCItems[i][1][0] <= position &&
      position <= currUserSymbols.localScopeCItems[i][1][1]
    ) {
      res.push(currUserSymbols.localScopeCItems[i][0]);
    }
  }

  return res;
}

function registerCompletionItemProviders(providerName: string): vscode.Disposable | undefined {
  switch (providerName) {
    case 'userSymbols':
      return vscode.languages.registerCompletionItemProvider(
        CL_MODE, {
          provideCompletionItems(document, position, token, context) {
            const range = document.getWordRangeAtPosition(position, clValidWithColonSharp);
            if (!range) {
              return undefined;
            }

            structuredInfo.produceInfoByDoc(document, new TriggerEvent(TriggerProvider.provideCompletionItems));
            if (!structuredInfo.currUserSymbols) {
              return undefined;
            }

            const numPosition = document.offsetAt(position);
            const userSymbols = getUserompletionItems(structuredInfo.currUserSymbols, numPosition);

            resetCompItemWordRange(range, userSymbols);

            return userSymbols;
          }
        });
    case 'oriSymbols':
      return vscode.languages.registerCompletionItemProvider(
        CL_MODE, {
          provideCompletionItems(document, position, token, context) {
            const range = document.getWordRangeAtPosition(position, clValidWithColonSharp);
            if (!range) {
              return undefined;
            }
            resetCompItemWordRange(range, oriSymbolsCompItem.oriSymbols);

            return oriSymbolsCompItem.oriSymbols;
          }
        });
    case 'ampersand':
      return vscode.languages.registerCompletionItemProvider(
        CL_MODE, {
          provideCompletionItems(document, position, token, context) {
            const range = document.getWordRangeAtPosition(position, clValidWithColonSharp);
            if (!range) {
              return undefined;
            }
            resetCompItemWordRange(range, oriSymbolsCompItem.afterAmpersand);

            return oriSymbolsCompItem.afterAmpersand;
          }
        }, '&');
    case 'asterisk':
      return vscode.languages.registerCompletionItemProvider(
        CL_MODE, {
          provideCompletionItems(document, position, token, context) {
            const range = document.getWordRangeAtPosition(position, clValidWithColonSharp);
            if (!range) {
              return undefined;
            }
            resetCompItemWordRange(range, oriSymbolsCompItem.afterAsterisk);

            return oriSymbolsCompItem.afterAsterisk;
          }
        }, '*');
    case 'colon':
      return vscode.languages.registerCompletionItemProvider(
        CL_MODE, {
          provideCompletionItems(document, position, token, context) {
            const range = document.getWordRangeAtPosition(position, clValidWithColonSharp);
            if (!range) {
              return undefined;
            }
            resetCompItemWordRange(range, oriSymbolsCompItem.afterColon);

            return oriSymbolsCompItem.afterColon;
          }
        }, ':');
    case 'tilde':
      return vscode.languages.registerCompletionItemProvider(
        CL_MODE, {
          provideCompletionItems(document, position, token, context) {
            const range = document.getWordRangeAtPosition(position, clValidWithColonSharp);
            if (!range) {
              return undefined;
            }
            resetCompItemWordRange(range, oriSymbolsCompItem.afterTilde);

            return oriSymbolsCompItem.afterTilde;
          }
        }, '~');
    case 'sharpsign':
      return vscode.languages.registerCompletionItemProvider(
        CL_MODE, {
          provideCompletionItems(document, position, token, context) {
            const range = document.getWordRangeAtPosition(position, clValidWithColonSharp);
            if (!range) {
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

export {
  registerCompletionItemProviders
};
