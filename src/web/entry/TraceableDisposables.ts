import type * as vscode from 'vscode';

import { registerCallHierarchyProvider } from '../provider_interface/call_hierarchy_provider';
import { registerCompletionItemProviders } from '../provider_interface/comp_item_provider';
import { registerDefinitionProvider } from '../provider_interface/def_provider';
import { registerDocumentSymbolProvider } from '../provider_interface/doc_symbol_provider';
import { registerHoverProvider } from '../provider_interface/hover_provider';
import { registerReferenceProvider } from '../provider_interface/reference_provider';
import { registerSemanticProvider } from '../provider_interface/semantic_tokens_provider';

class TraceableDisposables {
  public readonly disposables: Record<string, vscode.Disposable | undefined> = {
    'eventOnDidChangeTD': undefined,
    'eventOnDidChangeATE': undefined,

    'userCompletionItemProvider': undefined,
    'oriCompletionItemProvider': undefined,

    'ampersandCompletionItemProvider': undefined,
    'asteriskCompletionItemProvider': undefined,
    'colonCompletionItemProvider': undefined,

    'tildeCompletionItemProvider': undefined,
    'sharpsignCompletionItemProvider': undefined,

    'hoverProvider': undefined,
    'definitionProvider': undefined,
    'documentSymbolProvider': undefined,
    'referenceProvider': undefined,
    'documentSemanticTokensProvider': undefined,
    'callHierarchyProvider': undefined,
  };

  constructor() {

  }

  public disposeAll() {
    for (const [k, dis] of Object.entries(this.disposables)) {
      if (dis !== undefined) {
        dis.dispose();
        this.disposables[k] = undefined;
      }
    }
  }

  public disposeProviderByName(disposableName: string) {
    if (!Object.hasOwn(this.disposables, disposableName)) {
      return;
    }

    if (this.disposables[disposableName] !== undefined) {
      this.disposables[disposableName]?.dispose();
      this.disposables[disposableName] = undefined;
    } else {
      return;
    }
  }


  public setProviderByName(disposableName: string, contextSubcriptions: vscode.Disposable[]) {
    if (!Object.hasOwn(this.disposables, disposableName)) {
      return;
    }

    if (this.disposables[disposableName] !== undefined) {
      return;
    }
    //console.log('setting ' + disposableName);
    const provider = this.registerProviderByName(disposableName);

    if (provider === undefined) {
      return;
    }
    this.disposables[disposableName] = provider;
    contextSubcriptions.push(provider);
  }

  private registerProviderByName(disposableName: string) {
    switch (disposableName) {
      case 'userCompletionItemProvider':
        return registerCompletionItemProviders('userSymbols');

      case 'oriCompletionItemProvider':
        return registerCompletionItemProviders('oriSymbols');

      case 'ampersandCompletionItemProvider':
        return registerCompletionItemProviders('ampersand');

      case 'asteriskCompletionItemProvider':
        return registerCompletionItemProviders('asterisk');

      case 'colonCompletionItemProvider':
        return registerCompletionItemProviders('colon');

      case 'tildeCompletionItemProvider':
        return registerCompletionItemProviders('tilde');

      case 'sharpsignCompletionItemProvider':
        return registerCompletionItemProviders('sharpsign');

      case 'hoverProvider':
        return registerHoverProvider();

      case 'definitionProvider':
        return registerDefinitionProvider();

      case 'documentSymbolProvider':
        return registerDocumentSymbolProvider();

      case 'referenceProvider':
        return registerReferenceProvider();

      case 'documentSemanticTokensProvider':
        return registerSemanticProvider();

      case 'callHierarchyProvider':
        return registerCallHierarchyProvider();

      default:
        return undefined;
    }
  }
}

export { TraceableDisposables };
