// Currently, VS Code does not support sort of autocompletion items.
// (https://github.com/microsoft/vscode/issues/80444)
// Thus, the order of symbol is not matter here.

import type { ClSymbolKind } from '../../common/cl_kind';
import { clOriSymbolsByKind } from '../../common/cl_kind';


function getOriSymbolsLength(oriSymbols: Map<ClSymbolKind, string[]>): number {
  const s: Set<string> = new Set();
  let length = 0;
  for (const symbols of oriSymbols.values()) {
    symbols.forEach(item => {
      if (s.has(item)) {
        throw new Error('There should not be any duplicated commonlisp symbol.');
      }
      s.add(item);
    });
    length += symbols.length;
  }
  return length;
}

function getCLOriSymbols(): Map<ClSymbolKind, string[]> {
  const LEN_CL_ALL_SYMBOLS = 978;
  if (getOriSymbolsLength(clOriSymbolsByKind) !== LEN_CL_ALL_SYMBOLS) {
    throw new Error(`Please make sure all ${LEN_CL_ALL_SYMBOLS} commonlisp symbols have been included.`);
  }
  return clOriSymbolsByKind;
}

function _printSymbolKind() {
  const d: Map<string, string> = new Map<string, string>();
  for (const [k, partSymbols] of clOriSymbolsByKind) {
    for (const s of partSymbols) {
      d.set(s, k);
    }
  }
  //console.log(JSON.stringify(d));
}

// printSymbolKind();

export { getCLOriSymbols };
