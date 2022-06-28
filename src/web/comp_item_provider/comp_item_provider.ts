import * as vscode from 'vscode';

import { clValidWithColonSharp, CL_MODE } from '../cl_util';
import { bisectRight } from '../algorithm';
import { UserSymbols } from './UserSymbols';
import { genAllOriSymbols } from './comp_item_ori_builder';

import { updateInfo } from '../entry/listen_update';

// default completion item's word range does not include the '-' character, so we need to reset it
// @sideEffect: compItems:vscode.CompletionItem[]
function resetCompItemWordRange(document: vscode.TextDocument, position: vscode.Position, compItems: vscode.CompletionItem[]) {
  const range = document.getWordRangeAtPosition(position, clValidWithColonSharp);
  if (!range) {
    return;
  }
  for (const compItem of compItems) {
    compItem.range = range;
  }
}

function getUserompletionItems(currUserSymbols: UserSymbols, position: number): vscode.CompletionItem[] {
  const res: vscode.CompletionItem[] = [];
  res.push(...currUserSymbols.globalCItems);

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

function getCompletionItemProviders() {

  const completionItemProviderUserSymbols = vscode.languages.registerCompletionItemProvider(
    CL_MODE, {
    provideCompletionItems(document, position, token, context) {
      if (!updateInfo.currUserSymbols) {
        return [];
      }

      const numPosition = document.offsetAt(position);
      const userSymbols = getUserompletionItems(updateInfo.currUserSymbols, numPosition);

      resetCompItemWordRange(document, position, userSymbols);

      return userSymbols;
    }
  });

  // only need once
  const oriSymbolsCompItem = genAllOriSymbols();

  const completionItemProviderOriSymbols = vscode.languages.registerCompletionItemProvider(
    CL_MODE, {
    provideCompletionItems(document, position, token, context) {

      resetCompItemWordRange(document, position, oriSymbolsCompItem.oriSymbols);

      return oriSymbolsCompItem.oriSymbols;
    }
  });

  const completionItemProviderAmpersand = vscode.languages.registerCompletionItemProvider(
    CL_MODE, {
    provideCompletionItems(document, position, token, context) {

      resetCompItemWordRange(document, position, oriSymbolsCompItem.afterAmpersand);

      return oriSymbolsCompItem.afterAmpersand;
    }
  }, '&');

  const completionItemProviderAsterisk = vscode.languages.registerCompletionItemProvider(
    CL_MODE, {
    provideCompletionItems(document, position, token, context) {

      resetCompItemWordRange(document, position, oriSymbolsCompItem.afterAsterisk);

      return oriSymbolsCompItem.afterAsterisk;
    }
  }, '*');

  const completionItemProviderColon = vscode.languages.registerCompletionItemProvider(
    CL_MODE, {
    provideCompletionItems(document, position, token, context) {

      resetCompItemWordRange(document, position, oriSymbolsCompItem.afterColon);

      return oriSymbolsCompItem.afterColon;
    }
  }, ':');


  const completionItemProviderTilde = vscode.languages.registerCompletionItemProvider(
    CL_MODE, {
    provideCompletionItems(document, position, token, context) {

      resetCompItemWordRange(document, position, oriSymbolsCompItem.afterTilde);

      return oriSymbolsCompItem.afterTilde;
    }
  }, '~');

  const completionItemProviderSharpsign = vscode.languages.registerCompletionItemProvider(
    CL_MODE, {
    provideCompletionItems(document, position, token, context) {

      resetCompItemWordRange(document, position, oriSymbolsCompItem.afterSharpsign);

      return oriSymbolsCompItem.afterSharpsign;
    }
  }, '#');

  const res = {
    'userSymbols': completionItemProviderUserSymbols,
    'oriSymbols': completionItemProviderOriSymbols,
    'ampersand': completionItemProviderAmpersand,
    'asterisk': completionItemProviderAsterisk,
    'colon': completionItemProviderColon,
    'tilde': completionItemProviderTilde,
    'sharpsign': completionItemProviderSharpsign,
  };

  return res;

}

export {
  getCompletionItemProviders
};
