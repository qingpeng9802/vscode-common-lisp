import * as vscode from 'vscode';

import { CL_MODE, clValidWithColonSharp } from '../common/cl_util';
import _kind from '../cl_data/cl_kind.json';
import { getDocByName, getDocByNameNonAlphabetic } from '../doc/get_doc';

function isOriSymbol(symbolName: string): boolean {
  const kind: Record<string, any> = _kind;
  return Object.keys(kind).includes(symbolName.toLowerCase());
}

function getDoc(word: string) {
  let tooltip = undefined;

  if (isOriSymbol(word)) {
    tooltip = getDocByName(word);
  } else if (word.startsWith(':')) {
    tooltip = getDocByNameNonAlphabetic(word);
  } else { }

  return tooltip;
}

// Example: https://github.com/NativeScript/nativescript-vscode-extension/blob/474c22c3dea9f9a145dc2cccf01b05e38850de90/src/services/language-services/hover/widget-hover.ts
function getHoverProvider() {
  const hoverProviderValidSymbols = vscode.languages.registerHoverProvider(
    CL_MODE,
    {
      provideHover(document, position, token) {
        const range = document.getWordRangeAtPosition(position, clValidWithColonSharp);
        if (!range) {
          return undefined;
        }

        const word = document.getText(range);

        //console.log(word);
        if (!word) {
          return undefined;
        }

        const tooltip = getDoc(word.toLowerCase());
        return tooltip ? new vscode.Hover(tooltip) : undefined;
      },
    }
  );

  return hoverProviderValidSymbols;
}

export { getHoverProvider };
