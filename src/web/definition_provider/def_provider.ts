import * as vscode from 'vscode';

import { CL_MODE, clValidWithColonSharp } from '../cl_util';
import { isIntExcludedRanges, isQuote, isRangeIntExcludedRanges } from '../user_symbol/collect_symbol_util';

import { updateInfo, workspaceConfig } from '../entry/common';

function getDefinitionProvider() {
  const definitionProvider = vscode.languages.registerDefinitionProvider(
    CL_MODE,
    {
      provideDefinition(document, position, token) {
        if (!updateInfo.currDocSymbolInfo) {
          return undefined;
        }

        const range = document.getWordRangeAtPosition(position, clValidWithColonSharp);
        if (!range) {
          return undefined;
        }


        // config
        const doc = updateInfo.currDocSymbolInfo.document;
        const [intRes, excludedRanges] = isIntExcludedRanges(
          workspaceConfig, updateInfo.currDocSymbolInfo, range,
          'commonLisp.DefinitionProvider.ExcludedRanges', 'commonLisp.DefinitionProvider.BackQuoteFilter.enabled');
        if (!intRes) {
          return [];
        }

        if (isRangeIntExcludedRanges([doc.offsetAt(range.start), doc.offsetAt(range.end)], excludedRanges)
        ) {
          return undefined;
        }

        if (isRangeIntExcludedRanges(
          [
            updateInfo.currDocSymbolInfo.document.offsetAt(range.start),
            updateInfo.currDocSymbolInfo.document.offsetAt(range.end)
          ], excludedRanges)
        ) {
          return undefined;
        }

        const word = document.getText(range);
        if (!word) {
          return undefined;
        }

        if (isQuote(document, position)) {
          return updateInfo.currDocSymbolInfo.getSymbolLocByRange(range, word.toLowerCase(), undefined);
        }

        return updateInfo.currDocSymbolInfo.getSymbolLocByRange(range, word.toLowerCase(), position);

      }
    }
  );

  return definitionProvider;

}

export { getDefinitionProvider };
