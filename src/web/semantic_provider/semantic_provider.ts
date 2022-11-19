import * as vscode from 'vscode';

import { CL_MODE } from '../cl_util';
import { legend } from './semantic_tokens_builder';

import { updateInfo } from '../entry/common';
import { triggerUpdateSymbol } from '../entry/init';

function getSemanticProvider() {
  const semanticProvider = vscode.languages.registerDocumentSemanticTokensProvider(
    CL_MODE,
    {
      provideDocumentSemanticTokens(document, token) {

        triggerUpdateSymbol(document);

        return updateInfo.currSemanticTokens;
      }
    },
    legend
  );

  return semanticProvider;
}

export { getSemanticProvider };
