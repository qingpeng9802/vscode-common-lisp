import * as vscode from 'vscode';

import _kind from '../cl_data/cl_kind.json';
import { CL_MODE, clValidWithColonSharp } from '../common/cl_util';
import { getDocByName, getDocByNameNonAlphabetic } from '../doc/get_doc';

// Example: https://github.com/NativeScript/nativescript-vscode-extension/blob/474c22c3dea9f9a145dc2cccf01b05e38850de90/src/services/language-services/hover/widget-hover.ts
function registerHoverProvider() {
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

function getDoc(word: string) {
  let tooltip = undefined;
  const isOriSymbol = Object.keys(_kind).includes(word.toLowerCase());

  if (isOriSymbol) {
    tooltip = getDocByName(word);
  } else if (word.startsWith(':')) {
    tooltip = getDocByNameNonAlphabetic(word);
  } else { }

  return tooltip;
}

export { registerHoverProvider };
