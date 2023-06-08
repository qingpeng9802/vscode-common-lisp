import { ExcludeRanges, SingleQuoteAndBackQuoteHighlight, SingleQuoteAndBackQuoteExcludedRanges } from '../common/enum';

class WorkspaceConfig {
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
}

export { WorkspaceConfig };
