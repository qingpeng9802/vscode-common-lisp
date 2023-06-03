import * as vscode from 'vscode';

import { DocSymbolInfo } from '../../collect_user_symbol/DocSymbolInfo';
import { SymbolInfo } from '../../collect_user_symbol/SymbolInfo';
import { UserSymbols } from './UserSymbols';

const vscodeCIKindToVscodeCIKind: Record<vscode.SymbolKind, vscode.CompletionItemKind> = {
  [vscode.SymbolKind.File]: vscode.CompletionItemKind.File,
  [vscode.SymbolKind.Module]: vscode.CompletionItemKind.Module,
  // no direct mapping
  [vscode.SymbolKind.Namespace]: vscode.CompletionItemKind.Module,
  // no direct mapping
  [vscode.SymbolKind.Package]: vscode.CompletionItemKind.Module,
  [vscode.SymbolKind.Class]: vscode.CompletionItemKind.Class,
  [vscode.SymbolKind.Method]: vscode.CompletionItemKind.Method,
  [vscode.SymbolKind.Property]: vscode.CompletionItemKind.Property,
  [vscode.SymbolKind.Field]: vscode.CompletionItemKind.Field,
  [vscode.SymbolKind.Constructor]: vscode.CompletionItemKind.Constructor,
  [vscode.SymbolKind.Enum]: vscode.CompletionItemKind.Enum,
  [vscode.SymbolKind.Interface]: vscode.CompletionItemKind.Interface,
  [vscode.SymbolKind.Function]: vscode.CompletionItemKind.Function,
  [vscode.SymbolKind.Variable]: vscode.CompletionItemKind.Variable,
  [vscode.SymbolKind.Constant]: vscode.CompletionItemKind.Constant,
  // no direct mapping
  [vscode.SymbolKind.String]: vscode.CompletionItemKind.Variable,
  // no direct mapping
  [vscode.SymbolKind.Number]: vscode.CompletionItemKind.Variable,
  // no direct mapping
  [vscode.SymbolKind.Boolean]: vscode.CompletionItemKind.Variable,
  // no direct mapping
  [vscode.SymbolKind.Array]: vscode.CompletionItemKind.Variable,
  // no direct mapping
  [vscode.SymbolKind.Object]: vscode.CompletionItemKind.Variable,
  // no direct mapping
  [vscode.SymbolKind.Key]: vscode.CompletionItemKind.Variable,
  // no direct mapping
  [vscode.SymbolKind.Null]: vscode.CompletionItemKind.Keyword,
  [vscode.SymbolKind.EnumMember]: vscode.CompletionItemKind.EnumMember,
  [vscode.SymbolKind.Struct]: vscode.CompletionItemKind.Struct,
  [vscode.SymbolKind.Event]: vscode.CompletionItemKind.Event,
  [vscode.SymbolKind.Operator]: vscode.CompletionItemKind.Operator,
  [vscode.SymbolKind.TypeParameter]: vscode.CompletionItemKind.TypeParameter,

};

function symbolInfoToCompletionItem(symbolInfo: SymbolInfo): vscode.CompletionItem {
  const citemLabel: vscode.CompletionItemLabel = {
    label: symbolInfo.name,
    // in doc_symbol_builder.ts, numberedContainerName will not be assigned if no need
    description: symbolInfo.numberedContainerName || symbolInfo.containerName,
  };

  const item = new vscode.CompletionItem(citemLabel);

  item.kind = vscodeCIKindToVscodeCIKind[symbolInfo.kind];

  return item;
}

function genUserSymbols(currDocSymbolInfo: DocSymbolInfo): UserSymbols {
  const globalCItems: vscode.CompletionItem[] = [];
  for (const SIs of Object.values(currDocSymbolInfo.globalDef)) {
    if (SIs && SIs.length !== 0) {
      globalCItems.push(symbolInfoToCompletionItem(SIs[0]));
    }
  }

  const localScopeCItems: [vscode.CompletionItem, [number, number]][] = [];
  for (const SIs of Object.values(currDocSymbolInfo.allLocal)) {
    for (const SI of SIs) {
      if (!SI.scope) {
        continue;
      }
      localScopeCItems.push([symbolInfoToCompletionItem(SI), SI.scope]);
    }
  }

  localScopeCItems.sort((a, b) => a[1][0] - b[1][0]);
  return new UserSymbols(globalCItems, localScopeCItems);
}

export { genUserSymbols };
