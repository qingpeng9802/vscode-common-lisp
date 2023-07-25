const enum ExcludeRanges {
  CommentString = 'comment and string',
  Comment = 'comment',
  String = 'string',
  None = 'none'
}

const enum SingleQuoteAndBackQuoteHighlight {
  SQ = 'single quote',
  SQAndBQC = "single quote and backquote's comma only",
  SQAndBQAll = "single quote and backquote's all",
  BQC = "backquote's comma only",
  BQAll = "backquote's all",
  None = 'none'
}

const enum SingleQuoteAndBackQuoteExcludedRanges {
  SQ = 'single quote',
  SQBQButComma = 'single quote and backquote, but comma is saved',
  SQAndBQ = "single quote and backquote's all",
  BQButComma = 'backquote, but comma is saved',
  BQ = "backquote's all",
  None = 'none'
}

const enum UpdateOption {
  getDocSymbolInfo = 'getDocSymbolInfo',
  genUserSymbolsCompItem = 'genUserSymbolsCompItem',
  genDocumentSymbol = 'genDocumentSymbol',
  genAllPossibleWord = 'genAllPossibleWord',
  buildSemanticTokens = 'buildSemanticTokens',
  genAllCallHierarchyItems = 'genAllCallHierarchyItems',
}

const enum TriggerProvider {
  provideCompletionItems = 'provideCompletionItems',
  prepareCallHierarchy = 'prepareCallHierarchy',
  provideDefinition = 'provideDefinition',
  provideDocumentSymbols = 'provideDocumentSymbols',
  provideReferences = 'provideReferences',
  provideDocumentSemanticTokens = 'provideDocumentSemanticTokens',
  provideHoverUser = 'provideHoverUser',
}

export {
  ExcludeRanges,
  SingleQuoteAndBackQuoteHighlight,
  SingleQuoteAndBackQuoteExcludedRanges,
  UpdateOption,
  TriggerProvider
};
