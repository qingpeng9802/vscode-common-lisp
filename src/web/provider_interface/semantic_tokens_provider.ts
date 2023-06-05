import * as vscode from 'vscode';

import { legend } from '../builders/semantic_tokens_builder/semantic_tokens_builder';
import { CL_MODE } from '../common/cl_util';

import { structuredInfo } from './structured_info';

function getSemanticProvider() {
  const semanticProvider = vscode.languages.registerDocumentSemanticTokensProvider(
    CL_MODE,
    {
      provideDocumentSemanticTokens(document, token) {
        structuredInfo.produceInfoByDoc(document);

        return structuredInfo.currSemanticTokens;
      }
    },
    legend
  );

  return semanticProvider;
}

export { getSemanticProvider };
