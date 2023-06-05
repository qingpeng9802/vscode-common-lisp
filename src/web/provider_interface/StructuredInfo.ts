import type * as vscode from 'vscode';

import type { CallHrchyInfo } from '../builders/call_hierarchy_builder/CallHrchyInfo';
import { genAllCallHierarchyItems } from '../builders/call_hierarchy_builder/call_hierarchy_builder';
import type { UserSymbols } from '../builders/comp_item_builder/UserSymbols';
import { genUserSymbols } from '../builders/comp_item_builder/comp_item_user_builder';
import { genDocumentSymbol } from '../builders/doc_symbol_builder/doc_symbol_builder';
import { buildSemanticTokens, genAllPossibleWord } from '../builders/semantic_tokens_builder/semantic_tokens_builder';
import type { DocSymbolInfo } from '../collect_user_symbol/DocSymbolInfo';
import { getDocSymbolInfo } from '../collect_user_symbol/collect_user_symbol_info';
import { ExcludeRanges, SingleQuoteAndBackQuoteExcludedRanges, SingleQuoteAndBackQuoteHighlight, ProduceOption } from '../common/config_enum';

class StructuredInfo {
  public currDocSymbolInfo: DocSymbolInfo | undefined = undefined;
  public currDocumentSymbol: vscode.DocumentSymbol[] = [];
  public currUserSymbols: UserSymbols | undefined = undefined;
  public currSemanticTokens: vscode.SemanticTokens | undefined = undefined;
  public currCallHierarchyInfo: CallHrchyInfo | undefined = undefined;

  // optimization: use [number, number] to avoid `positionAt` overhead
  public needColorDict: Record<string, [number, number][]> = {};
  public globalOrderedRanges: [string, [number, number]][] = [];

  // dirty flag indicates that the document has been changed,
  // and curr info needs to be updated.
  public dirty = true;

  // building process config
  public needProduceSet: Set<string> = new Set();
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

  private resetResult() {
    this.currDocSymbolInfo = undefined;
    this.currDocumentSymbol = [];
    this.currUserSymbols = undefined;
    this.currSemanticTokens = undefined;
    this.currCallHierarchyInfo = undefined;
    this.needColorDict = {};
    this.globalOrderedRanges = [];
  }

  public produceInfoByDoc(doc: vscode.TextDocument) {
    if (!this.dirty) {
      //console.log(this.needUpdateSet);
      //console.log('dirty===false, no update');
      return;
    }
    //const t = performance.now();

    this.resetResult();

    // order matters here!
    if (this.needProduceSet.has(ProduceOption.getDocSymbolInfo)) {
      this.currDocSymbolInfo = getDocSymbolInfo(doc, this.buildingConfig);
    }

    if (this.currDocSymbolInfo !== undefined) {
      if (this.needProduceSet.has(ProduceOption.genUserSymbols)) {
        this.currUserSymbols = genUserSymbols(this.currDocSymbolInfo);
      }

      if (this.needProduceSet.has(ProduceOption.genDocumentSymbol)) {
        this.currDocumentSymbol = genDocumentSymbol(this.currDocSymbolInfo);
      }

      if (this.needProduceSet.has(ProduceOption.genAllPossibleWord)) {
        const res = genAllPossibleWord(this.currDocSymbolInfo);
        this.needColorDict = res[0];
        this.globalOrderedRanges = res[1];
      }

      if (this.needProduceSet.has(ProduceOption.buildSemanticTokens) && this.needColorDict) {
        this.currSemanticTokens = buildSemanticTokens(this.currDocSymbolInfo, this.needColorDict, this.buildingConfig);
      } else {
        console.warn(`[StructuredInfo.produceResultByDoc] this.needColorDict===undefined`);
      }

      if (this.needProduceSet.has(ProduceOption.genAllCallHierarchyItems) && this.globalOrderedRanges) {
        this.currCallHierarchyInfo = genAllCallHierarchyItems(this.currDocSymbolInfo, this.globalOrderedRanges);
      } else {
        console.warn(`[StructuredInfo.produceResultByDoc] this.globalOrderedRanges===undefined`);
      }

    } else {
      console.warn(`[StructuredInfo.produceResultByDoc] this.currDocSymbolInfo===undefined`);
    }
    //console.log(`finish: ${performance.now() - t}ms`);

    this.dirty = false;
    //console.log('make_dirty_false');
  }
}

export { StructuredInfo };
