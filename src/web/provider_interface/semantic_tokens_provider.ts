import * as vscode from 'vscode';

import { CL_MODE } from '../common/cl_util';
import { legend } from '../builders/semantic_tokens_builder/semantic_tokens_builder';

import { updateInfo } from './update_info';

function getSemanticProvider() {
  const semanticProvider = vscode.languages.registerDocumentSemanticTokensProvider(
    CL_MODE,
    {
      provideDocumentSemanticTokens(document, token) {
        updateInfo.updateSymbol(document);

        return updateInfo.currSemanticTokens;
      }
    },
    legend
  );

  return semanticProvider;
}

export { getSemanticProvider };
