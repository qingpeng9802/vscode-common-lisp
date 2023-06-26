import * as vscode from 'vscode';

import type { DocSymbolInfo } from '../../collect_info/DocSymbolInfo';
import type { SymbolInfo } from '../../collect_info/SymbolInfo';

import { UserSymbolsCompItem } from './UserSymbolsCompItem';

const vscodeCIKindToVscodeCIKind: Map<vscode.SymbolKind, vscode.CompletionItemKind> =
  new Map<vscode.SymbolKind, vscode.CompletionItemKind>([
    [vscode.SymbolKind.File, vscode.CompletionItemKind.File],
    [vscode.SymbolKind.Module, vscode.CompletionItemKind.Module],
    // no direct mapping
    [vscode.SymbolKind.Namespace, vscode.CompletionItemKind.Module],
    // no direct mapping
    [vscode.SymbolKind.Package, vscode.CompletionItemKind.Module],
    [vscode.SymbolKind.Class, vscode.CompletionItemKind.Class],
    [vscode.SymbolKind.Method, vscode.CompletionItemKind.Method],
    [vscode.SymbolKind.Property, vscode.CompletionItemKind.Property],
    [vscode.SymbolKind.Field, vscode.CompletionItemKind.Field],
    [vscode.SymbolKind.Constructor, vscode.CompletionItemKind.Constructor],
    [vscode.SymbolKind.Enum, vscode.CompletionItemKind.Enum],
    [vscode.SymbolKind.Interface, vscode.CompletionItemKind.Interface],
    [vscode.SymbolKind.Function, vscode.CompletionItemKind.Function],
    [vscode.SymbolKind.Variable, vscode.CompletionItemKind.Variable],
    [vscode.SymbolKind.Constant, vscode.CompletionItemKind.Constant],
    // no direct mapping
    [vscode.SymbolKind.String, vscode.CompletionItemKind.Variable],
    // no direct mapping
    [vscode.SymbolKind.Number, vscode.CompletionItemKind.Variable],
    // no direct mapping
    [vscode.SymbolKind.Boolean, vscode.CompletionItemKind.Variable],
    // no direct mapping
    [vscode.SymbolKind.Array, vscode.CompletionItemKind.Variable],
    // no direct mapping
    [vscode.SymbolKind.Object, vscode.CompletionItemKind.Variable],
    // no direct mapping
    [vscode.SymbolKind.Key, vscode.CompletionItemKind.Variable],
    // no direct mapping
    [vscode.SymbolKind.Null, vscode.CompletionItemKind.Keyword],
    [vscode.SymbolKind.EnumMember, vscode.CompletionItemKind.EnumMember],
    [vscode.SymbolKind.Struct, vscode.CompletionItemKind.Struct],
    [vscode.SymbolKind.Event, vscode.CompletionItemKind.Event],
    [vscode.SymbolKind.Operator, vscode.CompletionItemKind.Operator],
    [vscode.SymbolKind.TypeParameter, vscode.CompletionItemKind.TypeParameter],

  ]);

function symbolInfoToCompletionItem(symbolInfo: SymbolInfo): vscode.CompletionItem {
  const citemLabel: vscode.CompletionItemLabel = {
    label: symbolInfo.name,
    // in doc_symbol_builder.ts, numberedContainerName will not be assigned if no need
    description: (symbolInfo.numberedContainerName !== undefined) ?
      symbolInfo.numberedContainerName : symbolInfo.containerName,
  };

  const item = new vscode.CompletionItem(citemLabel, vscodeCIKindToVscodeCIKind.get(symbolInfo.kind));
  return item;
}

function genUserSymbolsCompItem(currDocSymbolInfo: DocSymbolInfo): UserSymbolsCompItem {
  const globalCItems: vscode.CompletionItem[] = [];
  for (const SIs of currDocSymbolInfo.globalDef.values()) {
    if (SIs !== undefined && SIs.length !== 0) {
      globalCItems.push(symbolInfoToCompletionItem(SIs[0]));
    }
  }

  const localScopeCItems: [vscode.CompletionItem, [number, number]][] = [];
  for (const SIs of currDocSymbolInfo.allLocal.values()) {
    for (const SI of SIs) {
      if (SI.scope === undefined) {
        continue;
      }
      localScopeCItems.push([symbolInfoToCompletionItem(SI), SI.scope]);
    }
  }

  localScopeCItems.sort((a, b) => a[1][0] - b[1][0]); // sort by scope start
  return new UserSymbolsCompItem(globalCItems, localScopeCItems);
}

export { genUserSymbolsCompItem };