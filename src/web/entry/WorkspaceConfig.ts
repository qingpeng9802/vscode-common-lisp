import * as vscode from 'vscode';

import { ExcludeRanges, SingleQuoteAndBackQuoteHighlight, SingleQuoteAndBackQuoteExcludedRanges } from '../common/enum';
import type { StructuredInfo } from '../provider_interface/StructuredInfo';

import type { TraceableDisposables } from './TraceableDisposables';

class WorkspaceConfig {
  private static readonly CL_ID = 'commonlisp';

  private readonly config: Record<string, any> = {
    'commonLisp.StaticAnalysis.enabled': true,

    'editor.semanticHighlighting.enabled': undefined,

    'commonLisp.StaticAnalysis.SingleQuoteAndBackQuote.ExcludedRanges': SingleQuoteAndBackQuoteExcludedRanges.BQButComma,
    'commonLisp.DocumentSemanticTokensProvider.ExcludedRanges': ExcludeRanges.CommentString,
    'commonLisp.DocumentSemanticTokensProvider.SingleQuoteAndBackQuote.Highlight': SingleQuoteAndBackQuoteHighlight.SQAndBQC,
    'commonLisp.ReferenceProvider.ExcludedRanges': ExcludeRanges.CommentString,
    'commonLisp.ReferenceProvider.BackQuoteFilter.enabled': true,
    'commonLisp.DefinitionProvider.ExcludedRanges': ExcludeRanges.None,
    'commonLisp.DefinitionProvider.BackQuoteFilter.enabled': true,

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

  public initConfig(contextSubcriptions: vscode.Disposable[], traceableDisposables: TraceableDisposables) {
    const config = vscode.workspace.getConfiguration();
    for (const k of Object.keys(this.config)) {
      const langEntry: any = config.get(`[${WorkspaceConfig.CL_ID}]`);
      let newConfigVal = undefined;

      const newVal = config.get(k);
      newConfigVal = (newVal !== undefined) ? newVal : newConfigVal;
      newConfigVal = langEntry && (langEntry[k] !== undefined) ? langEntry[k] : newConfigVal;

      this.config[k] = newConfigVal;
      traceableDisposables.updateDisposables(contextSubcriptions, k, newConfigVal);
    }
    //console.log(workspaceConfig);
  }

  public updateConfig(contextSubcriptions: vscode.Disposable[], traceableDisposables: TraceableDisposables, e: vscode.ConfigurationChangeEvent) {
    const config = vscode.workspace.getConfiguration();
    for (const k of Object.keys(this.config)) {
      let dirty = false;
      let newConfigVal = undefined;

      if (e.affectsConfiguration(k)) {
        const newVal = config.get(k);
        if (newVal !== undefined) {
          newConfigVal = newVal;
          dirty = true;
        }
      }

      const langEntry: any = config.get(`[${WorkspaceConfig.CL_ID}]`);
      if (e.affectsConfiguration(k, { languageId: WorkspaceConfig.CL_ID }) && langEntry) {
        const newVal = langEntry[k];
        if (newVal !== undefined) {
          newConfigVal = newVal;
          dirty = true;
        }
      }

      if (dirty) {
        //console.log(`update workspace config: ${k} = ${newConfig}`);
        this.config[k] = newConfigVal;
        traceableDisposables.updateDisposables(contextSubcriptions, k, newConfigVal);
      }

    }
  }

  public syncBuildingConfigWithConfig(structuredInfo: StructuredInfo) {
    // copy the configs that are needed for building later
    // so `workspaceConfig` is decoupled from the building process
    // that is, maintaining Unidirectional Data Flow here
    for (const k of Object.keys(structuredInfo.buildingConfig)) {
      structuredInfo.buildingConfig[k] = this.config[k];
    }
  }
}

export { WorkspaceConfig };
