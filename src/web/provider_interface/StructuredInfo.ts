import type * as vscode from 'vscode';

import type { CallHrchyInfo } from '../builders/call_hierarchy_builder/CallHrchyInfo';
import { genAllCallHierarchyItems } from '../builders/call_hierarchy_builder/call_hierarchy_builder';
import type { UserSymbols } from '../builders/comp_item_builder/UserSymbols';
import { genUserSymbols } from '../builders/comp_item_builder/comp_item_user_builder';
import { genDocumentSymbol } from '../builders/doc_symbol_builder/doc_symbol_builder';
import { buildSemanticTokens, genAllPossibleWord } from '../builders/semantic_tokens_builder/semantic_tokens_builder';
import type { DocSymbolInfo } from '../collect_user_symbol/DocSymbolInfo';
import { getDocSymbolInfo } from '../collect_user_symbol/collect_user_symbol_info';
import { TriggerProvider, ExcludeRanges, SingleQuoteAndBackQuoteExcludedRanges, SingleQuoteAndBackQuoteHighlight, ProduceOption } from '../common/enum';

import type { TriggerEvent } from './TriggerEvent';

class StructuredInfo {
  public currDocSymbolInfo: DocSymbolInfo | undefined = undefined;
  public currDocumentSymbol: vscode.DocumentSymbol[] | undefined = undefined;
  public currUserSymbols: UserSymbols | undefined = undefined;
  public currSemanticTokens: vscode.SemanticTokens | undefined = undefined;
  public currCallHierarchyInfo: CallHrchyInfo | undefined = undefined;

  // optimization: use [number, number] to avoid `positionAt` overhead
  public needColorDict: Record<string, [number, number][]> | undefined = undefined;
  public globalOrderedRanges: [string, [number, number]][] | undefined = undefined;

  // building process config passed down from workspace config
  public readonly buildingConfig: Record<string, any> = {
    'commonLisp.DocumentSemanticTokensProvider.SingleQuoteAndBackQuote.Highlight': SingleQuoteAndBackQuoteHighlight.SQAndBQC,
    'commonLisp.StaticAnalysis.SingleQuoteAndBackQuote.ExcludedRanges': SingleQuoteAndBackQuoteExcludedRanges.BQButComma,
    'commonLisp.ReferenceProvider.BackQuoteFilter.enabled': true,
    'commonLisp.DefinitionProvider.BackQuoteFilter.enabled': true,

    'commonLisp.DefinitionProvider.ExcludedRanges': ExcludeRanges.None,
    'commonLisp.ReferenceProvider.ExcludedRanges': ExcludeRanges.CommentString,
    'commonLisp.DocumentSemanticTokensProvider.ExcludedRanges': ExcludeRanges.CommentString,
  };

  // dirty flag indicates that the document has been changed,
  // and curr info needs to be updated.
  private readonly dirty: Record<ProduceOption, boolean> = {
    [ProduceOption.getDocSymbolInfo]: true,
    [ProduceOption.genUserSymbols]: true,
    [ProduceOption.genDocumentSymbol]: true,
    [ProduceOption.genAllPossibleWord]: true,
    [ProduceOption.buildSemanticTokens]: true,
    [ProduceOption.genAllCallHierarchyItems]: true,
  };

  private static readonly actionUsedByProviders = {
    [ProduceOption.getDocSymbolInfo]: new Set([
      TriggerProvider.provideCompletionItems, TriggerProvider.prepareCallHierarchy, TriggerProvider.provideDefinition,
      TriggerProvider.provideDocumentSymbols, TriggerProvider.provideReferences, TriggerProvider.provideDocumentSemanticTokens,
    ]),
    [ProduceOption.genUserSymbols]: new Set([TriggerProvider.provideCompletionItems]),
    [ProduceOption.genDocumentSymbol]: new Set([TriggerProvider.provideCompletionItems, TriggerProvider.prepareCallHierarchy, TriggerProvider.provideDocumentSymbols]),
    [ProduceOption.genAllPossibleWord]: new Set([TriggerProvider.provideReferences, TriggerProvider.provideDocumentSemanticTokens, TriggerProvider.prepareCallHierarchy]),
    [ProduceOption.buildSemanticTokens]: new Set([TriggerProvider.provideDocumentSemanticTokens]),
    [ProduceOption.genAllCallHierarchyItems]: new Set([TriggerProvider.prepareCallHierarchy])
  };

  constructor() {

  }

  public setDirtyTrue() {
    Object.keys(this.dirty).forEach((k) => { this.dirty[k as ProduceOption] = true; });
  }

  private getNeedProduceSetByTriggerProvider(triggerProvider: TriggerProvider): Set<ProduceOption> {
    const needProduceSet: Set<ProduceOption> = new Set<ProduceOption>();
    for (const [k, v] of Object.entries(StructuredInfo.actionUsedByProviders)) {
      if (v.has(triggerProvider)) {
        needProduceSet.add(k as ProduceOption);
      }
    }
    return needProduceSet;
  }

  public produceInfoByDoc(doc: vscode.TextDocument, triggerEvent: TriggerEvent) {
    //const t = performance.now();
    const triggerProvider: TriggerProvider = triggerEvent.triggerProvider;
    const needProduceSet = this.getNeedProduceSetByTriggerProvider(triggerProvider);

    const needProduceSetCheckDirty = new Set(
      [...needProduceSet].filter(ele => this.dirty[ele])
    );

    // order matters here!
    if (needProduceSetCheckDirty.has(ProduceOption.getDocSymbolInfo)) {
      this.currDocSymbolInfo = getDocSymbolInfo(doc, this.buildingConfig);
      this.dirty[ProduceOption.getDocSymbolInfo] = false;
    }

    if (this.currDocSymbolInfo !== undefined) {
      if (needProduceSetCheckDirty.has(ProduceOption.genUserSymbols)) {
        this.currUserSymbols = genUserSymbols(this.currDocSymbolInfo);
        this.dirty[ProduceOption.genUserSymbols] = false;
      }

      if (needProduceSetCheckDirty.has(ProduceOption.genDocumentSymbol)) {
        this.currDocumentSymbol = genDocumentSymbol(this.currDocSymbolInfo);
        this.dirty[ProduceOption.genDocumentSymbol] = false;
      }

      if (needProduceSetCheckDirty.has(ProduceOption.genAllPossibleWord)) {
        [this.needColorDict, this.globalOrderedRanges] = genAllPossibleWord(this.currDocSymbolInfo);
        this.dirty[ProduceOption.genAllPossibleWord] = false;
      }

      if (needProduceSetCheckDirty.has(ProduceOption.buildSemanticTokens)) {
        if (this.needColorDict === undefined) {
          console.warn(`[StructuredInfo.produceResultByDoc] this.needColorDict===undefined`);
        } else {
          this.currSemanticTokens = buildSemanticTokens(this.currDocSymbolInfo, this.needColorDict, this.buildingConfig);
          this.dirty[ProduceOption.buildSemanticTokens] = false;
        }
      }

      if (needProduceSetCheckDirty.has(ProduceOption.genAllCallHierarchyItems) && this.globalOrderedRanges) {
        if (this.globalOrderedRanges === undefined) {
          console.warn(`[StructuredInfo.produceResultByDoc] this.globalOrderedRanges===undefined`);
        } else {
          this.currCallHierarchyInfo = genAllCallHierarchyItems(this.currDocSymbolInfo, this.globalOrderedRanges);
          this.dirty[ProduceOption.genAllCallHierarchyItems] = false;
        }
      }

    } else {
      console.warn(`[StructuredInfo.produceResultByDoc] this.currDocSymbolInfo===undefined`);
    }
    //console.log(`finish: ${performance.now() - t}ms`, needProduceSetCheckDirty);

  }
}

export { StructuredInfo };
