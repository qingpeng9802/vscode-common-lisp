import * as vscode from 'vscode';

import { getHoverProvider } from '../hover_provider/hover_provider';
import { getCompletionItemProviders } from '../comp_item_provider/comp_item_provider';
import { getDefinitionProvider } from '../definition_provider/def_provider';
import { getDocumentSymbolProvider } from '../doc_symbol_provider/doc_symbol_provider';
import { getReferenceProvider } from '../reference_provider/reference_provider';
import { getSemanticProvider } from '../semantic_provider/semantic_provider';
import { getCallHierarchyProvider } from '../call_hierarchy_provider/call_hierarchy_provider';

import { WorkspaceConfig } from './WorkspaceConfig';

function initProviders(workspaceConfig: WorkspaceConfig): vscode.Disposable[] {
  const providersPrefix = 'commonLisp.providers';
  const res: vscode.Disposable[] = [];

  if (workspaceConfig.config?.[`${providersPrefix}.HoverProvider.enabled`]) {
    res.push(getHoverProvider());
  }

  const completionItemProviders = getCompletionItemProviders();
  for (const k of ['user', 'original', 'ampersand', 'asterisk', 'colon', 'tilde', 'sharpsign']) {
    const currK = `${providersPrefix}.CompletionItemProviders.${k}.enabled`;
    const currCfg = workspaceConfig.config[currK];
    if (!currCfg) {
      continue;
    }
    switch (k) {
      case 'user':
        res.push(completionItemProviders['userSymbols']);
        break;

      case 'original':
        res.push(completionItemProviders['oriSymbols']);
        break;

      case 'ampersand':
        res.push(completionItemProviders['ampersand']);
        break;

      case 'asterisk':
        res.push(completionItemProviders['asterisk']);
        break;

      case 'colon':
        res.push(completionItemProviders['colon']);
        break;

      case 'tilde':
        res.push(completionItemProviders['tilde']);
        break;

      case 'sharpsign':
        res.push(completionItemProviders['sharpsign']);
        break;

      default:
        break;
    }
  }

  if (workspaceConfig.config?.[`${providersPrefix}.DefinitionProvider.enabled`]) {
    res.push(getDefinitionProvider());
  }
  if (workspaceConfig.config?.[`${providersPrefix}.DocumentSymbolProvider.enabled`]) {
    res.push(getDocumentSymbolProvider());
  }
  if (workspaceConfig.config?.[`${providersPrefix}.ReferenceProvider.enabled`]) {
    res.push(getReferenceProvider());
  }
  if (workspaceConfig.config?.[`${providersPrefix}.DocumentSemanticTokensProvider.enabled`]) {
    res.push(getSemanticProvider());
  }
  if (workspaceConfig.config?.[`${providersPrefix}.CallHierarchyProvider.enabled`]) {
    res.push(getCallHierarchyProvider());
  }

  return res;
}

function getProvider(key: string): vscode.Disposable | undefined {
  switch (key) {
    case 'userCompletionItemProvider':
      return getCompletionItemProviders()['userSymbols'];

    case 'oriCompletionItemProvider':
      return getCompletionItemProviders()['oriSymbols'];

    case 'ampersandCompletionItemProvider':
      return getCompletionItemProviders()['ampersand'];

    case 'asteriskCompletionItemProvider':
      return getCompletionItemProviders()['asterisk'];

    case 'colonCompletionItemProvider':
      return getCompletionItemProviders()['colon'];

    case 'tildeCompletionItemProvider':
      return getCompletionItemProviders()['tilde'];

    case 'sharpsignCompletionItemProvider':
      return getCompletionItemProviders()['sharpsign'];

    case 'hoverProvider':
      return getHoverProvider();

    case 'definitionProvider':
      return getDefinitionProvider();

    case 'documentSymbolProvider':
      return getDocumentSymbolProvider();

    case 'referenceProvider':
      return getReferenceProvider();

    case 'documentSemanticTokensProvider':
      return getSemanticProvider();

    case 'callHierarchyProvider':
      return getCallHierarchyProvider();

    default:
      return undefined;
  }

}


export { initProviders, getProvider };

