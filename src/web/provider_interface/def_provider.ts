import * as vscode from 'vscode';

import { isQuote, isRangeIntExcludedRanges } from '../collect_user_symbol/user_symbol_util';
import { CL_MODE, clValidWithColonSharp } from '../common/cl_util';

import { structuredInfo } from './structured_info';

function getDefinitionProvider() {
  const definitionProvider = vscode.languages.registerDefinitionProvider(
    CL_MODE,
    {
      provideDefinition(document, position, token) {
        structuredInfo.produceInfoByDoc(document);
        if (!structuredInfo.currDocSymbolInfo) {
          return undefined;
        }

        const range = document.getWordRangeAtPosition(position, clValidWithColonSharp);
        if (!range) {
          return undefined;
        }


        // config
        const doc = structuredInfo.currDocSymbolInfo.document;
        const excludedRangesCfg = structuredInfo.buildingConfig['commonLisp.DefinitionProvider.ExcludedRanges'];
        const backQuoteCfg = structuredInfo.buildingConfig['commonLisp.DefinitionProvider.BackQuoteFilter.enabled'];
        const [intRes, excludedRanges] = structuredInfo.currDocSymbolInfo.isIntExcludedRanges(range, excludedRangesCfg, backQuoteCfg);
        if (!intRes) {
          return [];
        }

        if (isRangeIntExcludedRanges([doc.offsetAt(range.start), doc.offsetAt(range.end)], excludedRanges)
        ) {
          return undefined;
        }

        if (isRangeIntExcludedRanges(
          [
            structuredInfo.currDocSymbolInfo.document.offsetAt(range.start),
            structuredInfo.currDocSymbolInfo.document.offsetAt(range.end)
          ], excludedRanges)
        ) {
          return undefined;
        }

        const word = document.getText(range);
        if (!word) {
          return undefined;
        }

        if (isQuote(document, position)) {
          return structuredInfo.currDocSymbolInfo.getSymbolLocByRange(range, word.toLowerCase(), undefined);
        }

        return structuredInfo.currDocSymbolInfo.getSymbolLocByRange(range, word.toLowerCase(), position);

      }
    }
  );

  return definitionProvider;

}

export { getDefinitionProvider };
