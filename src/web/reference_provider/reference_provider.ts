import * as vscode from 'vscode';

import { clValidWithColonSharp, CL_MODE } from '../cl_util';
import { isQuote } from '../user_symbol/collect_symbol_util';
import { getReferenceByWord } from './symbol_reference_builder';

import { updateInfo } from '../entry/common';

function getReferenceProvider() {
  const referenceProvider = vscode.languages.registerReferenceProvider(
    CL_MODE,
    {
      provideReferences(document, position, context, token) {
        if (!updateInfo.currDocSymbolInfo) {
          return undefined;
        }

        const range = document.getWordRangeAtPosition(position, clValidWithColonSharp);
        if (!range) {
          return undefined;
        }

        if (isQuote(document, position)) {
          return getReferenceByWord(updateInfo.currDocSymbolInfo, range, undefined, true);
        }

        return getReferenceByWord(updateInfo.currDocSymbolInfo, range, position, true);
      }
    }
  );

  return referenceProvider;
}

export { getReferenceProvider };
