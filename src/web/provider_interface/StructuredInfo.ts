import type * as vscode from 'vscode';

import { DocSymbolInfo } from '../builders/DocSymbolInfo';
import type { CallHrchyInfo } from '../builders/call_hierarchy_builder/CallHrchyInfo';
import { genAllCallHierarchyItems } from '../builders/call_hierarchy_builder/call_hierarchy_builder';
import { UserSymbolsCompItem } from '../builders/comp_item_builder/UserSymbolsCompItem';
import { genDocumentSymbol } from '../builders/doc_symbol_builder/doc_symbol_builder';
import { buildSemanticTokens, genAllPossibleWord } from '../builders/semantic_tokens_builder/semantic_tokens_builder';
import {
  TriggerProvider, ExcludeRanges,
  SingleQuoteAndBackQuoteExcludedRanges, SingleQuoteAndBackQuoteHighlight, UpdateOption
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
  private readonly dirty: Map<UpdateOption, boolean> = new Map<UpdateOption, boolean>([
    [UpdateOption.getDocSymbolInfo, true],
    [UpdateOption.genUserSymbolsCompItem, true],
    [UpdateOption.genDocumentSymbol, true],
    [UpdateOption.genAllPossibleWord, true],
    [UpdateOption.buildSemanticTokens, true],
    [UpdateOption.genAllCallHierarchyItems, true],
  ]);

  private static readonly actionUsedByProviders = new Map<UpdateOption, Set<TriggerProvider>>([
    [UpdateOption.getDocSymbolInfo, new Set([
      TriggerProvider.provideCompletionItems, TriggerProvider.prepareCallHierarchy,
      TriggerProvider.provideDefinition, TriggerProvider.provideDocumentSymbols,
      TriggerProvider.provideReferences, TriggerProvider.provideDocumentSemanticTokens,
      TriggerProvider.provideHoverUser
    ])],

    [UpdateOption.genUserSymbolsCompItem, new Set([TriggerProvider.provideCompletionItems])],

    [UpdateOption.genDocumentSymbol, new Set([
      TriggerProvider.provideCompletionItems, TriggerProvider.prepareCallHierarchy,
      TriggerProvider.provideDocumentSymbols
    ])],

    [UpdateOption.genAllPossibleWord, new Set([
      TriggerProvider.provideReferences, TriggerProvider.provideDocumentSemanticTokens,
      TriggerProvider.prepareCallHierarchy
    ])],

    [UpdateOption.buildSemanticTokens, new Set([TriggerProvider.provideDocumentSemanticTokens])],
    [UpdateOption.genAllCallHierarchyItems, new Set([TriggerProvider.prepareCallHierarchy])]
  ]);

  constructor() {

  }

  public setDirty(value: boolean, keySet: Set<UpdateOption> | undefined = undefined) {
    const keys = (keySet === undefined) ? this.dirty.keys() : keySet;
    for (const k of keys) {
      this.dirty.set(k, value);
    }
  }

  private getNeedUpdateByTriggerProvider(triggerProvider: TriggerProvider): UpdateOption[] {
    const needUpdateArr: UpdateOption[] = [];
    for (const [k, v] of StructuredInfo.actionUsedByProviders) {
      if (v.has(triggerProvider)) {
        needUpdateArr.push(k);
      }
    }
    return needUpdateArr;
  }

  public updateInfoByDoc(doc: vscode.TextDocument, triggerEvent: TriggerEvent) {
    //const t = performance.now();
    const triggerProvider: TriggerProvider = triggerEvent.triggerProvider;
    const needUpdateArr = this.getNeedUpdateByTriggerProvider(triggerProvider);

    //const needUpdateSetCheckDirty = new Set(needUpdateArr);
    // comment this part for profile
    const needUpdateSetCheckDirty = new Set(
      needUpdateArr.filter(ele => this.dirty.get(ele))
    );

    // order matters here!
    if (needUpdateSetCheckDirty.has(UpdateOption.getDocSymbolInfo)) {
      this.currDocSymbolInfo = new DocSymbolInfo(doc, this.buildingConfig);
    }

    if (this.currDocSymbolInfo === undefined) {
      console.warn(`[StructuredInfo.updateResultByDoc] this.currDocSymbolInfo===undefined`);
      return;
    }

    if (needUpdateSetCheckDirty.has(UpdateOption.genUserSymbolsCompItem)) {
      this.currUserSymbolsCompItem = new UserSymbolsCompItem(this.currDocSymbolInfo);
    }

    if (needUpdateSetCheckDirty.has(UpdateOption.genDocumentSymbol)) {
      this.currDocumentSymbol = genDocumentSymbol(this.currDocSymbolInfo);
    }

    if (needUpdateSetCheckDirty.has(UpdateOption.genAllPossibleWord)) {
      [this.needColorDict, this.globalOrderedRanges] = genAllPossibleWord(this.currDocSymbolInfo);
    }

    if (needUpdateSetCheckDirty.has(UpdateOption.buildSemanticTokens)) {
      if (this.needColorDict === undefined) {
        console.warn(`[StructuredInfo.updateResultByDoc] this.needColorDict===undefined`);
        return;
      }
      this.currSemanticTokens = buildSemanticTokens(this.currDocSymbolInfo, this.needColorDict, this.buildingConfig);
    }

    if (needUpdateSetCheckDirty.has(UpdateOption.genAllCallHierarchyItems)) {
      if (this.globalOrderedRanges === undefined) {
        console.warn(`[StructuredInfo.updateResultByDoc] this.globalOrderedRanges===undefined`);
        return;
      }
      this.currCallHierarchyInfo = genAllCallHierarchyItems(this.currDocSymbolInfo, this.globalOrderedRanges);
    }

    this.setDirty(false, needUpdateSetCheckDirty);

    //console.log(`finish: ${performance.now() - t}ms`, needUpdateSetCheckDirty);
  }
}

export { StructuredInfo };
