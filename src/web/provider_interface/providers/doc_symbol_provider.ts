import * as vscode from 'vscode';

import { CL_MODE } from '../../common/cl_util';
import { TriggerProvider } from '../../common/enum';
import { TriggerEvent } from '../TriggerEvent';
import { structuredInfo } from '../structured_info';

function registerDocumentSymbolProvider() {
  const documentSymbolProvider = vscode.languages.registerDocumentSymbolProvider(
    CL_MODE,
    {
      provideDocumentSymbols(document, token) {
        structuredInfo.produceInfoByDoc(document, new TriggerEvent(TriggerProvider.provideDocumentSymbols));

        return structuredInfo.currDocumentSymbol;
      }
    }
  );

  return documentSymbolProvider;
}

export { registerDocumentSymbolProvider };
