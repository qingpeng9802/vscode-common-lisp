import * as vscode from 'vscode';

import { ExcludeRanges, SingleQuoteAndBackQuoteHighlight, SingleQuoteAndBackQuoteExcludedRanges } from '../common/enum';
import type { StructuredInfo } from '../provider_interface/StructuredInfo';

import type { TraceableDisposables } from './TraceableDisposables';

class WorkspaceConfig {
  private static readonly CL_ID = 'commonlisp';

  private readonly config: Map<string, any> = new Map<string, any>([
    ['commonLisp.StaticAnalysis.enabled', true],

    ['editor.semanticHighlighting.enabled', undefined],

    ['commonLisp.StaticAnalysis.SingleQuoteAndBackQuote.ExcludedRanges',
      SingleQuoteAndBackQuoteExcludedRanges.BQButComma],
    ['commonLisp.DocumentSemanticTokensProvider.ExcludedRanges', ExcludeRanges.CommentString],
    ['commonLisp.DocumentSemanticTokensProvider.SingleQuoteAndBackQuote.Highlight',
      SingleQuoteAndBackQuoteHighlight.SQAndBQC],
    ['commonLisp.ReferenceProvider.ExcludedRanges', ExcludeRanges.CommentString],
    ['commonLisp.ReferenceProvider.BackQuoteFilter.enabled', true],
    ['commonLisp.DefinitionProvider.ExcludedRanges', ExcludeRanges.None],
    ['commonLisp.DefinitionProvider.BackQuoteFilter.enabled', true],

    ['commonLisp.providers.CompletionItemProviders.user.enabled', true],
    ['commonLisp.providers.CompletionItemProviders.original.enabled', true],
    ['commonLisp.providers.CompletionItemProviders.loop.enabled', true],

    ['commonLisp.providers.CompletionItemProviders.ampersand.enabled', true],
    ['commonLisp.providers.CompletionItemProviders.asterisk.enabled', true],
    ['commonLisp.providers.CompletionItemProviders.colon.enabled', true],

    ['commonLisp.providers.CompletionItemProviders.tilde.enabled', false],
    ['commonLisp.providers.CompletionItemProviders.sharpsign.enabled', false],

    ['commonLisp.providers.HoverProvider.enabled', true],
    ['commonLisp.providers.DefinitionProvider.enabled', true],
    ['commonLisp.providers.DocumentSymbolProvider.enabled', true],
    ['commonLisp.providers.ReferenceProvider.enabled', true],
    ['commonLisp.providers.DocumentSemanticTokensProvider.enabled', true],
    ['commonLisp.providers.CallHierarchyProvider.enabled', true],
  ]);

  public initConfig(contextSubcriptions: vscode.Disposable[], traceableDisposables: TraceableDisposables) {
    const config = vscode.workspace.getConfiguration();
    const langEntry: any = config.get(`[${WorkspaceConfig.CL_ID}]`);
    for (const k of this.config.keys()) {
      const newVal = config.get(k);
      const newConfigVal = langEntry && (langEntry[k] !== undefined) ? langEntry[k] : newVal;

      this.config.set(k, newConfigVal);
      traceableDisposables.updateDisposables(contextSubcriptions, k, newConfigVal);
    }
    //console.log(workspaceConfig);
  }

  public updateConfig(
    contextSubcriptions: vscode.Disposable[],
    traceableDisposables: TraceableDisposables,
    e: vscode.ConfigurationChangeEvent
  ) {
    const config = vscode.workspace.getConfiguration();
    const langEntry: any = config.get(`[${WorkspaceConfig.CL_ID}]`);
    for (const k of this.config.keys()) {
      const newVal = e.affectsConfiguration(k) ? config.get(k) : undefined;
      const newConfigVal = (
        e.affectsConfiguration(k, { languageId: WorkspaceConfig.CL_ID }) &&
        langEntry && (langEntry[k] !== undefined)
      ) ?
        langEntry[k] : newVal;


      if (newConfigVal !== undefined) {
        //console.log(`update workspace config: ${k} = ${newConfig}`);
        this.config.set(k, newConfigVal);
        traceableDisposables.updateDisposables(contextSubcriptions, k, newConfigVal);
      }
    }

  }

  public syncBuildingConfigWithConfig(structuredInfo: StructuredInfo) {
    // copy the configs that are needed for building later
    // so `workspaceConfig` is decoupled from the building process
    // that is, maintaining Unidirectional Data Flow here
    for (const k of structuredInfo.buildingConfig.keys()) {
      structuredInfo.buildingConfig.set(k, this.config.get(k));
    }
  }
}

export { WorkspaceConfig };
