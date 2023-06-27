import type * as vscode from 'vscode';

import { registerCallHierarchyProvider } from '../provider_interface/providers/call_hierarchy_provider';
import { registerCompletionItemProviders } from '../provider_interface/providers/comp_item_provider';
import { registerDefinitionProvider } from '../provider_interface/providers/def_provider';
import { registerDocumentSymbolProvider } from '../provider_interface/providers/doc_symbol_provider';
import { registerHoverProvider } from '../provider_interface/providers/hover_provider';
import { registerReferenceProvider } from '../provider_interface/providers/reference_provider';
import { registerSemanticProvider } from '../provider_interface/providers/semantic_tokens_provider';

class TraceableDisposables {
  public readonly disposables: Map<string, vscode.Disposable | undefined> =
    new Map<string, vscode.Disposable | undefined>([
      ['eventOnDidChangeTD', undefined],
      ['eventOnDidChangeATE', undefined],

      ['userCompletionItemProvider', undefined],
      ['oriCompletionItemProvider', undefined],
      ['loopCompletionItemProvider', undefined],

      ['ampersandCompletionItemProvider', undefined],
      ['asteriskCompletionItemProvider', undefined],
      ['colonCompletionItemProvider', undefined],

      ['tildeCompletionItemProvider', undefined],
      ['sharpsignCompletionItemProvider', undefined],

      ['hoverProvider', undefined],
      ['definitionProvider', undefined],
      ['documentSymbolProvider', undefined],
      ['referenceProvider', undefined],
      ['documentSemanticTokensProvider', undefined],
      ['callHierarchyProvider', undefined],
    ]);

  private static readonly cfgMapDisposable: Map<string, string> = new Map<string, string>([
    ['commonLisp.providers.CompletionItemProviders.user.enabled', 'userCompletionItemProvider'],
    ['commonLisp.providers.CompletionItemProviders.original.enabled', 'oriCompletionItemProvider'],
    ['commonLisp.providers.CompletionItemProviders.loop.enabled', 'loopCompletionItemProvider'],

    ['commonLisp.providers.CompletionItemProviders.ampersand.enabled', 'ampersandCompletionItemProvider'],
    ['commonLisp.providers.CompletionItemProviders.asterisk.enabled', 'asteriskCompletionItemProvider'],
    ['commonLisp.providers.CompletionItemProviders.colon.enabled', 'colonCompletionItemProvider'],

    ['commonLisp.providers.CompletionItemProviders.tilde.enabled', 'tildeCompletionItemProvider'],
    ['commonLisp.providers.CompletionItemProviders.sharpsign.enabled', 'sharpsignCompletionItemProvider'],

    ['commonLisp.providers.HoverProvider.enabled', 'hoverProvider'],
    ['commonLisp.providers.DefinitionProvider.enabled', 'definitionProvider'],
    ['commonLisp.providers.DocumentSymbolProvider.enabled', 'documentSymbolProvider'],
    ['commonLisp.providers.ReferenceProvider.enabled', 'referenceProvider'],
    ['commonLisp.providers.DocumentSemanticTokensProvider.enabled', 'documentSemanticTokensProvider'],
    ['commonLisp.providers.CallHierarchyProvider.enabled', 'callHierarchyProvider'],
  ]);

  constructor() {

  }

  public disposeAll() {
    for (const [k, dis] of this.disposables) {
      if (dis !== undefined) {
        dis.dispose();
        this.disposables.set(k, undefined);
      }
    }
  }

  private disposeProviderByName(disposableName: string) {
    if (!this.disposables.has(disposableName)) {
      return;
    }

    if (this.disposables.get(disposableName) !== undefined) {
      //console.log('disp', disposableName);
      this.disposables.get(disposableName)?.dispose();
      this.disposables.set(disposableName, undefined);
    } else {
      return;
    }
  }


  private setProviderByName(disposableName: string, contextSubcriptions: vscode.Disposable[]) {
    if (!this.disposables.has(disposableName)) {
      return;
    }

    if (this.disposables.get(disposableName) !== undefined) {
      return;
    }
    //console.log('setting ' + disposableName);
    const provider = this.registerProviderByName(disposableName);

    if (provider === undefined) {
      return;
    }
    this.disposables.set(disposableName, provider);
    contextSubcriptions.push(provider);
  }

  private registerProviderByName(disposableName: string) {
    switch (disposableName) {
      case 'userCompletionItemProvider':
        return registerCompletionItemProviders('userSymbols');

      case 'oriCompletionItemProvider':
        return registerCompletionItemProviders('oriSymbols');

      case 'loopCompletionItemProvider':
        return registerCompletionItemProviders('loop');

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

  public updateDisposables(
    contextSubcriptions: vscode.Disposable[],
    workspaceConfigKey: string,
    newTraceableDisposablesVal: any
  ) {
    const providerKeys = new Set(TraceableDisposables.cfgMapDisposable.keys());

    let disposableName = '';
    if (workspaceConfigKey === 'editor.semanticHighlighting.enabled') {
      disposableName = 'documentSemanticTokensProvider';
    } else if (providerKeys.has(workspaceConfigKey)) {
      disposableName = TraceableDisposables.cfgMapDisposable.get(workspaceConfigKey)!;
    }

    if (newTraceableDisposablesVal === false) {
      this.disposeProviderByName(disposableName);
    } else {
      this.setProviderByName(disposableName, contextSubcriptions);
    }
  }
}

export { TraceableDisposables };
