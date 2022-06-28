import * as vscode from 'vscode';

enum ExcludeRanges {
  CommentString = "comment and string",
  Comment = "comment",
  String = "string",
  None = "none"
}

enum SingleQuoteAndBackQuoteHighlight {
  SQ = "single quote",
  SQAndBQC = "single quote and backquote's comma only",
  SQAndBQAll = "single quote and backquote's all",
  BQC = "backquote's comma only",
  BQAll = "backquote's all",
  None = "none"
}

enum SingleQuoteAndBackQuoteExcludedRanges {
  SQ = "single quote",
  SQBQButComma = "single quote and backquote, but comma is saved",
  SQAndBQ = "single quote and backquote's all",
  BQButComma = "backquote, but comma is saved",
  BQ = "backquote's all",
  None = "none"
}

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

    'commonLisp.backupUpdater.debounceTimeout': 750,

    // should be ~<= 200ms (keyboard repeat-delay)
    'commonLisp.Updater.throttleTimeout': 200,

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
    'backupTriggerUpdateSymbolonDidChangeTD': undefined,
    'backupTriggerUpdateSymbolonDidChangeATE': undefined,

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
}

export { WorkspaceConfig, ExcludeRanges, SingleQuoteAndBackQuoteHighlight, SingleQuoteAndBackQuoteExcludedRanges };
