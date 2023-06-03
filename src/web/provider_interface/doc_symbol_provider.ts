import * as vscode from 'vscode';

import { CL_MODE } from '../common/cl_util';

import { updateInfo } from './update_info';

function getDocumentSymbolProvider() {
  const documentSymbolProvider = vscode.languages.registerDocumentSymbolProvider(
    CL_MODE,
    {
      provideDocumentSymbols(document, token) {
        updateInfo.updateSymbol(document);

        return updateInfo.currDocumentSymbol;
      }
    }
  );

  return documentSymbolProvider;
}

export { getDocumentSymbolProvider };
