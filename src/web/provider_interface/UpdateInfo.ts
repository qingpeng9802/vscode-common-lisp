import * as vscode from 'vscode';

import { CallHrchyInfo } from '../builders/call_hierarchy_builder/CallHrchyInfo';
import { UserSymbols } from '../builders/comp_item_builder/UserSymbols';
import { DocSymbolInfo } from '../collect_user_symbol/DocSymbolInfo';

import { genDocumentSymbol } from '../builders/doc_symbol_builder/doc_symbol_builder';
import { getDocSymbolInfo } from '../collect_user_symbol/collect_user_symbol_info';
import { genUserSymbols } from '../builders/comp_item_builder/comp_item_user_builder';
import { buildSemanticTokens, genAllPossibleWord } from '../builders/semantic_tokens_builder/semantic_tokens_builder';
import { genAllCallHierarchyItems } from '../builders/call_hierarchy_builder/call_hierarchy_builder';
import { ExcludeRanges, SingleQuoteAndBackQuoteExcludedRanges, SingleQuoteAndBackQuoteHighlight } from '../common/config_enum';

class UpdateInfo {
  public currDocSymbolInfo: DocSymbolInfo | undefined = undefined;
  public currDocumentSymbol: vscode.DocumentSymbol[] = [];
  public currUserSymbols: UserSymbols | undefined = undefined;
  public currSemanticTokens: vscode.SemanticTokens | undefined = undefined;
  public prevSemanticTokens: vscode.SemanticTokens | undefined = undefined;
  public callHierarchyInfo: CallHrchyInfo | undefined = undefined;

  // optimization: use [number, number] to avoid `positionAt` overhead
  public needColorDict: Record<string, [number, number][]> = {};
  public globalOrderedRanges: [string, [number, number]][] = [];

  // dirty flag indicates that the document has been changed,
  // and curr info needs to be updated.
  public dirty: boolean = true;

  public needUpdateSet: Set<string> = new Set();

  public buildingConfig: Record<string, any> = {
    'commonLisp.DocumentSemanticTokensProvider.SingleQuoteAndBackQuote.Highlight': SingleQuoteAndBackQuoteHighlight.SQAndBQC,
    'commonLisp.StaticAnalysis.SingleQuoteAndBackQuote.ExcludedRanges': SingleQuoteAndBackQuoteExcludedRanges.BQButComma,
    'commonLisp.ReferenceProvider.BackQuoteFilter.enabled': true,
    'commonLisp.DefinitionProvider.BackQuoteFilter.enabled': true,

    'commonLisp.DefinitionProvider.ExcludedRanges': ExcludeRanges.None,
    'commonLisp.ReferenceProvider.ExcludedRanges': ExcludeRanges.CommentString,
    'commonLisp.DocumentSemanticTokensProvider.ExcludedRanges': ExcludeRanges.CommentString,
  };

  constructor() {

  }

  public updateSymbol(doc: vscode.TextDocument) {
    if (!this.dirty) {
      //console.log(this.needUpdateSet);
      //console.log('dirty===false, no update');
      return;
    }
    //const t = performance.now();

    this.currDocSymbolInfo = undefined;
    this.currDocumentSymbol = [];
    this.currUserSymbols = undefined;
    this.currSemanticTokens = undefined;
    this.prevSemanticTokens = undefined;
    this.callHierarchyInfo = undefined;
    this.needColorDict = {};
    this.globalOrderedRanges = [];

    // order matters here!
    if (this.needUpdateSet.has('getDocSymbolInfo')) {
      const saSQAndBQExcludedRangesCfg = this.buildingConfig['commonLisp.StaticAnalysis.SingleQuoteAndBackQuote.ExcludedRanges'];
      this.currDocSymbolInfo = getDocSymbolInfo(doc, saSQAndBQExcludedRangesCfg);
    }

    if (this.needUpdateSet.has('genUserSymbols') && this.currDocSymbolInfo) {
      this.currUserSymbols = genUserSymbols(this.currDocSymbolInfo);
    }

    if (this.needUpdateSet.has('genDocumentSymbol') && this.currDocSymbolInfo) {
      this.currDocumentSymbol = genDocumentSymbol(this.currDocSymbolInfo);
    }

    if (this.needUpdateSet.has('genAllPossibleWord') && this.currDocSymbolInfo) {
      const res = genAllPossibleWord(this.currDocSymbolInfo);
      this.needColorDict = res[0];
      this.globalOrderedRanges = res[1];
    }

    if (this.needUpdateSet.has('buildSemanticTokens') && this.currDocSymbolInfo) {
      const excludedRangesCfg = this.buildingConfig['commonLisp.DocumentSemanticTokensProvider.ExcludedRanges'];
      const SQAndBQHighlightCfg = this.buildingConfig['commonLisp.DocumentSemanticTokensProvider.SingleQuoteAndBackQuote.Highlight'];
      this.currSemanticTokens = buildSemanticTokens(this.currDocSymbolInfo, this.needColorDict, excludedRangesCfg, SQAndBQHighlightCfg);
    }

    if (this.needUpdateSet.has('genAllCallHierarchyItems') && this.currDocSymbolInfo) {
      this.callHierarchyInfo = genAllCallHierarchyItems(this.currDocSymbolInfo, this.globalOrderedRanges);
    }

    //console.log(`finish: ${performance.now() - t}ms`);

    this.dirty = false;
    //console.log('make_dirty_false');
  }
}

export { UpdateInfo };
