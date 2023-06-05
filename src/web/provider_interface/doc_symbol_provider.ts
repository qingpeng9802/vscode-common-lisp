import * as vscode from 'vscode';

import { CL_MODE } from '../common/cl_util';

import { structuredInfo } from './structured_info';

function getDocumentSymbolProvider() {
  const documentSymbolProvider = vscode.languages.registerDocumentSymbolProvider(
    CL_MODE,
    {
      provideDocumentSymbols(document, token) {
        structuredInfo.produceInfoByDoc(document);

        return structuredInfo.currDocumentSymbol;
      }
    }
  );

  return documentSymbolProvider;
}

export { getDocumentSymbolProvider };
