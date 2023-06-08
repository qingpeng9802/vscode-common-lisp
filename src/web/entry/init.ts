import * as vscode from 'vscode';

import type { StructuredInfo } from '../provider_interface/StructuredInfo';

import { TraceableDisposables } from './TraceableDisposables';
import { WorkspaceConfig } from './WorkspaceConfig';
import { initConfig, syncBuildingConfigWithConfig, updateConfig } from './config_util';

const traceableDisposables: TraceableDisposables = new TraceableDisposables();
const workspaceConfig: WorkspaceConfig = new WorkspaceConfig();

function init(contextSubcriptions: vscode.Disposable[], workspaceConfig: WorkspaceConfig, traceableDisposables: TraceableDisposables, StructuredInfo: StructuredInfo) {
  const config = vscode.workspace.getConfiguration();
  if (config.get('commonLisp.StaticAnalysis.enabled')) {
    initConfig(contextSubcriptions, workspaceConfig, traceableDisposables, StructuredInfo);
    syncBuildingConfigWithConfig(workspaceConfig, StructuredInfo);
  }

  vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration('commonLisp.StaticAnalysis.enabled')) {
      const config = vscode.workspace.getConfiguration();
      if (!config.get('commonLisp.StaticAnalysis.enabled')) {
        traceableDisposables.disposeAll();
        return;
      }

      initConfig(contextSubcriptions, workspaceConfig, traceableDisposables, StructuredInfo);
    }

    updateConfig(contextSubcriptions, workspaceConfig, traceableDisposables, e);
    syncBuildingConfigWithConfig(workspaceConfig, StructuredInfo);
  }, contextSubcriptions);
}


export { init, workspaceConfig, traceableDisposables };

