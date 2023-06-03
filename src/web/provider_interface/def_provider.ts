import * as vscode from 'vscode';

import { CL_MODE, clValidWithColonSharp } from '../common/cl_util';
import { isQuote, isRangeIntExcludedRanges } from '../collect_user_symbol/user_symbol_util';

import { updateInfo } from './update_info';

function getDefinitionProvider() {
  const definitionProvider = vscode.languages.registerDefinitionProvider(
    CL_MODE,
    {
      provideDefinition(document, position, token) {
        updateInfo.updateSymbol(document);
        if (!updateInfo.currDocSymbolInfo) {
          return undefined;
        }

        const range = document.getWordRangeAtPosition(position, clValidWithColonSharp);
        if (!range) {
          return undefined;
        }


        // config
        const doc = updateInfo.currDocSymbolInfo.document;
        const excludedRangesCfg = updateInfo.buildingConfig['commonLisp.DefinitionProvider.ExcludedRanges'];
        const backQuoteCfg = updateInfo.buildingConfig['commonLisp.DefinitionProvider.BackQuoteFilter.enabled'];
        const [intRes, excludedRanges] = updateInfo.currDocSymbolInfo.isIntExcludedRanges(range, excludedRangesCfg, backQuoteCfg);
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
