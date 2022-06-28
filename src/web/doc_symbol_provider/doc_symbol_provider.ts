import * as vscode from 'vscode';

import { CL_MODE } from '../cl_util';

import { updateInfo } from '../entry/listen_update';
import { triggerUpdateSymbol } from '../entry/init';

function getDocumentSymbolProvider() {
  const documentSymbolProvider = vscode.languages.registerDocumentSymbolProvider(
    CL_MODE,
    {
      provideDocumentSymbols(document, token) {

        triggerUpdateSymbol(document);

        return updateInfo.currDocumentSymbol;
      }
    }
  );
  return documentSymbolProvider;
}

export { getDocumentSymbolProvider };
