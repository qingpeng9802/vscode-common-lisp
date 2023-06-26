import type * as vscode from 'vscode';

import type { CallHrchyInfo } from '../builders/call_hierarchy_builder/CallHrchyInfo';
import { genAllCallHierarchyItems } from '../builders/call_hierarchy_builder/call_hierarchy_builder';
import type { UserSymbolsCompItem } from '../builders/comp_item_builder/UserSymbolsCompItem';
import { genUserSymbolsCompItem } from '../builders/comp_item_builder/comp_item_user_builder';
import { genDocumentSymbol } from '../builders/doc_symbol_builder/doc_symbol_builder';
import { buildSemanticTokens, genAllPossibleWord } from '../builders/semantic_tokens_builder/semantic_tokens_builder';
import type { DocSymbolInfo } from '../collect_info/DocSymbolInfo';
import { getDocSymbolInfo } from '../collect_info/collect_all_info';
import {
  TriggerProvider, ExcludeRanges,
  SingleQuoteAndBackQuoteExcludedRanges, SingleQuoteAndBackQuoteHighlight, ProduceOption
} from '../common/enum';

import type { TriggerEvent } from './TriggerEvent';

class StructuredInfo {
  public currDocSymbolInfo: DocSymbolInfo | undefined = undefined;
  public currDocumentSymbol: vscode.DocumentSymbol[] | undefined = undefined;
  public currUserSymbolsCompItem: UserSymbolsCompItem | undefined = undefined;
  public currSemanticTokens: vscode.SemanticTokens | undefined = undefined;
  public currCallHierarchyInfo: CallHrchyInfo | undefined = undefined;

  // optimization: use [number, number] to avoid `positionAt` overhead
  public needColorDict: Map<string, [number, number][]> | undefined = undefined;
  public globalOrderedRanges: [string, [number, number]][] | undefined = undefined;

  // building process config passed down from workspace config
  public readonly buildingConfig: Map<string, any> = new Map<string, any>([
    ['commonLisp.DocumentSemanticTokensProvider.SingleQuoteAndBackQuote.Highlight',
      SingleQuoteAndBackQuoteHighlight.SQAndBQC],
    ['commonLisp.StaticAnalysis.SingleQuoteAndBackQuote.ExcludedRanges',
      SingleQuoteAndBackQuoteExcludedRanges.BQButComma],
    ['commonLisp.ReferenceProvider.BackQuoteFilter.enabled', true],
    ['commonLisp.DefinitionProvider.BackQuoteFilter.enabled', true],

    ['commonLisp.DefinitionProvider.ExcludedRanges', ExcludeRanges.None],
    ['commonLisp.ReferenceProvider.ExcludedRanges', ExcludeRanges.CommentString],
    ['commonLisp.DocumentSemanticTokensProvider.ExcludedRanges', ExcludeRanges.CommentString],
  ]);

  // dirty flag indicates that the document has been changed,
  // and curr info needs to be updated.
  private readonly dirty: Map<ProduceOption, boolean> = new Map<ProduceOption, boolean>([
    [ProduceOption.getDocSymbolInfo, true],
    [ProduceOption.genUserSymbolsCompItem, true],
    [ProduceOption.genDocumentSymbol, true],
    [ProduceOption.genAllPossibleWord, true],
    [ProduceOption.buildSemanticTokens, true],
    [ProduceOption.genAllCallHierarchyItems, true],
  ]);

  private static readonly actionUsedByProviders = new Map<ProduceOption, Set<TriggerProvider>>([
    [ProduceOption.getDocSymbolInfo, new Set([
      TriggerProvider.provideCompletionItems, TriggerProvider.prepareCallHierarchy,
      TriggerProvider.provideDefinition, TriggerProvider.provideDocumentSymbols,
      TriggerProvider.provideReferences, TriggerProvider.provideDocumentSemanticTokens,
    ])],

    [ProduceOption.genUserSymbolsCompItem, new Set([TriggerProvider.provideCompletionItems])],

    [ProduceOption.genDocumentSymbol, new Set([
      TriggerProvider.provideCompletionItems, TriggerProvider.prepareCallHierarchy,
      TriggerProvider.provideDocumentSymbols])],

    [ProduceOption.genAllPossibleWord, new Set([
      TriggerProvider.provideReferences, TriggerProvider.provideDocumentSemanticTokens,
      TriggerProvider.prepareCallHierarchy])],

    [ProduceOption.buildSemanticTokens, new Set([TriggerProvider.provideDocumentSemanticTokens])],
    [ProduceOption.genAllCallHierarchyItems, new Set([TriggerProvider.prepareCallHierarchy])]
  ]);

  constructor() {

  }

  public setDirty(value: boolean, keySet: Set<ProduceOption> | undefined = undefined) {
    const keys = (keySet === undefined) ? this.dirty.keys() : keySet;
    for (const k of keys) {
      this.dirty.set(k, value);
    }
  }

  private getNeedProduceByTriggerProvider(triggerProvider: TriggerProvider): ProduceOption[] {
    const needProduceArr: ProduceOption[] = [];
    for (const [k, v] of StructuredInfo.actionUsedByProviders) {
      if (v.has(triggerProvider)) {
        needProduceArr.push(k);
      }
    }
    return needProduceArr;
  }

  public produceInfoByDoc(doc: vscode.TextDocument, triggerEvent: TriggerEvent) {
    //const t = performance.now();
    const triggerProvider: TriggerProvider = triggerEvent.triggerProvider;
    const needProduceArr = this.getNeedProduceByTriggerProvider(triggerProvider);

    //const needProduceSetCheckDirty = new Set(needProduceArr);
    // comment this part for profile
    const needProduceSetCheckDirty = new Set(
      needProduceArr.filter(ele => this.dirty.get(ele))
    );

    // order matters here!
    if (needProduceSetCheckDirty.has(ProduceOption.getDocSymbolInfo)) {
      this.currDocSymbolInfo = getDocSymbolInfo(doc, this.buildingConfig);
    }

    if (this.currDocSymbolInfo === undefined) {
      console.warn(`[StructuredInfo.produceResultByDoc] this.currDocSymbolInfo===undefined`);
      return;
    }

    if (needProduceSetCheckDirty.has(ProduceOption.genUserSymbolsCompItem)) {
      this.currUserSymbolsCompItem = genUserSymbolsCompItem(this.currDocSymbolInfo);
    }

    if (needProduceSetCheckDirty.has(ProduceOption.genDocumentSymbol)) {
      this.currDocumentSymbol = genDocumentSymbol(this.currDocSymbolInfo);
    }

    if (needProduceSetCheckDirty.has(ProduceOption.genAllPossibleWord)) {
      [this.needColorDict, this.globalOrderedRanges] = genAllPossibleWord(this.currDocSymbolInfo);
    }

    if (needProduceSetCheckDirty.has(ProduceOption.buildSemanticTokens)) {
      if (this.needColorDict === undefined) {
        console.warn(`[StructuredInfo.produceResultByDoc] this.needColorDict===undefined`);
        return;
      }
      this.currSemanticTokens = buildSemanticTokens(this.currDocSymbolInfo, this.needColorDict, this.buildingConfig);
    }

    if (needProduceSetCheckDirty.has(ProduceOption.genAllCallHierarchyItems)) {
      if (this.globalOrderedRanges === undefined) {
        console.warn(`[StructuredInfo.produceResultByDoc] this.globalOrderedRanges===undefined`);
        return;
      }
      this.currCallHierarchyInfo = genAllCallHierarchyItems(this.currDocSymbolInfo, this.globalOrderedRanges);
    }

    this.setDirty(false, needProduceSetCheckDirty);

    //console.log(`finish: ${performance.now() - t}ms`, needProduceSetCheckDirty);
  }
}

export { StructuredInfo };
