import * as vscode from 'vscode';

import { legend } from '../../builders/semantic_tokens_builder/token_util';
import { CL_MODE } from '../../common/cl_util';
import { TriggerProvider } from '../../common/enum';
import { TriggerEvent } from '../TriggerEvent';
import { structuredInfo } from '../structured_info';

function registerSemanticProvider() {
  const semanticProvider = vscode.languages.registerDocumentSemanticTokensProvider(
    CL_MODE,
    {
      provideDocumentSemanticTokens(document, token) {
        structuredInfo.produceInfoByDoc(document, new TriggerEvent(TriggerProvider.provideDocumentSemanticTokens));

        return structuredInfo.currSemanticTokens;
      }
    },
    legend
  );

  return semanticProvider;
}

export { registerSemanticProvider };
