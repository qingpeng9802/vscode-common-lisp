import type * as vscode from 'vscode';

import { ExcludeRanges, SingleQuoteAndBackQuoteHighlight, SingleQuoteAndBackQuoteExcludedRanges, ProduceOption } from '../common/config_enum';
import { getCallHierarchyProvider } from '../provider_interface/call_hierarchy_provider';
import { getCompletionItemProviders } from '../provider_interface/comp_item_provider';
import { getDefinitionProvider } from '../provider_interface/def_provider';
import { getDocumentSymbolProvider } from '../provider_interface/doc_symbol_provider';
import { getHoverProvider } from '../provider_interface/hover_provider';
import { getReferenceProvider } from '../provider_interface/reference_provider';
import { getSemanticProvider } from '../provider_interface/semantic_tokens_provider';

class WorkspaceConfig {
  public readonly cfgMapDisposable: Record<string, string> = {
    'commonLisp.providers.CompletionItemProviders.user.enabled': 'userCompletionItemProvider',
    'commonLisp.providers.CompletionItemProviders.original.enabled': 'oriCompletionItemProvider',

    'commonLisp.providers.CompletionItemProviders.ampersand.enabled': 'ampersandCompletionItemProvider',
    'commonLisp.providers.CompletionItemProviders.asterisk.enabled': 'asteriskCompletionItemProvider',
    'commonLisp.providers.CompletionItemProviders.colon.enabled': 'colonCompletionItemProvider',

    'commonLisp.providers.CompletionItemProviders.tilde.enabled': 'tildeCompletionItemProvider',
    'commonLisp.providers.CompletionItemProviders.sharpsign.enabled': 'sharpsignCompletionItemProvider',

    'commonLisp.providers.HoverProvider.enabled': 'hoverProvider',
    'commonLisp.providers.DefinitionProvider.enabled': 'definitionProvider',
    'commonLisp.providers.DocumentSymbolProvider.enabled': 'documentSymbolProvider',
    'commonLisp.providers.ReferenceProvider.enabled': 'referenceProvider',
    'commonLisp.providers.DocumentSemanticTokensProvider.enabled': 'documentSemanticTokensProvider',
    'commonLisp.providers.CallHierarchyProvider.enabled': 'callHierarchyProvider',
  };

  public readonly config: Record<string, any> = {
    'commonLisp.StaticAnalysis.enabled': true,

    'editor.semanticHighlighting.enabled': undefined,

    'commonLisp.DocumentSemanticTokensProvider.SingleQuoteAndBackQuote.Highlight': SingleQuoteAndBackQuoteHighlight.SQAndBQC,
    'commonLisp.StaticAnalysis.SingleQuoteAndBackQuote.ExcludedRanges': SingleQuoteAndBackQuoteExcludedRanges.BQButComma,
    'commonLisp.ReferenceProvider.BackQuoteFilter.enabled': true,
    'commonLisp.DefinitionProvider.BackQuoteFilter.enabled': true,

    'commonLisp.DefinitionProvider.ExcludedRanges': ExcludeRanges.None,
    'commonLisp.ReferenceProvider.ExcludedRanges': ExcludeRanges.CommentString,
    'commonLisp.DocumentSemanticTokensProvider.ExcludedRanges': ExcludeRanges.CommentString,

    'commonLisp.providers.CompletionItemProviders.user.enabled': true,
    'commonLisp.providers.CompletionItemProviders.original.enabled': true,

    'commonLisp.providers.CompletionItemProviders.ampersand.enabled': true,
    'commonLisp.providers.CompletionItemProviders.asterisk.enabled': true,
    'commonLisp.providers.CompletionItemProviders.colon.enabled': true,

    'commonLisp.providers.CompletionItemProviders.tilde.enabled': false,
    'commonLisp.providers.CompletionItemProviders.sharpsign.enabled': false,

    'commonLisp.providers.HoverProvider.enabled': true,
    'commonLisp.providers.DefinitionProvider.enabled': true,
    'commonLisp.providers.DocumentSymbolProvider.enabled': true,
    'commonLisp.providers.ReferenceProvider.enabled': true,
    'commonLisp.providers.DocumentSemanticTokensProvider.enabled': true,
    'commonLisp.providers.CallHierarchyProvider.enabled': true,
  };

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
    const provider = this.getProviderByName(disposableName);

    if (provider === undefined) {
      return;
    }
    this.disposables[disposableName] = provider;
    contextSubcriptions.push(provider);
  }

  private getProviderByName(disposableName: string) {
    switch (disposableName) {
      case 'userCompletionItemProvider':
        return getCompletionItemProviders('userSymbols');

      case 'oriCompletionItemProvider':
        return getCompletionItemProviders('oriSymbols');

      case 'ampersandCompletionItemProvider':
        return getCompletionItemProviders('ampersand');

      case 'asteriskCompletionItemProvider':
        return getCompletionItemProviders('asterisk');

      case 'colonCompletionItemProvider':
        return getCompletionItemProviders('colon');

      case 'tildeCompletionItemProvider':
        return getCompletionItemProviders('tilde');

      case 'sharpsignCompletionItemProvider':
        return getCompletionItemProviders('sharpsign');

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

  public getNeedProduceSetByConfig(): Set<string> {
    const needProduceSet: Set<string> = new Set();
    const actionUsedByProviders = {
      [ProduceOption.getDocSymbolInfo]: [
        'userCompletionItemProvider', 'definitionProvider', 'documentSymbolProvider',
        'referenceProvider', 'documentSemanticTokensProvider', 'callHierarchyProvider'
      ],
      [ProduceOption.genUserSymbols]: ['userCompletionItemProvider'],
      [ProduceOption.genDocumentSymbol]: ['userCompletionItemProvider', 'callHierarchyProvider', 'documentSymbolProvider'],
      [ProduceOption.genAllPossibleWord]: ['referenceProvider', 'documentSemanticTokensProvider', 'callHierarchyProvider'],
      [ProduceOption.buildSemanticTokens]: ['documentSemanticTokensProvider'],
      [ProduceOption.genAllCallHierarchyItems]: ['callHierarchyProvider']
    };
    for (const [k, v] of Object.entries(actionUsedByProviders)) {
      const notDefined = (ele: string) => this.disposables[ele] !== undefined;

      if (v.some(notDefined)) {
        needProduceSet.add(k);
      }
    }

    return needProduceSet;
  }
}

export { WorkspaceConfig };
