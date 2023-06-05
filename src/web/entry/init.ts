import * as vscode from 'vscode';

import type { StructuredInfo } from '../provider_interface/StructuredInfo';

import { WorkspaceConfig } from './WorkspaceConfig';
import { initConfig, syncStructuredInfoWithConfig, updateConfig } from './config_util';

const workspaceConfig: WorkspaceConfig = new WorkspaceConfig();

function init(contextSubcriptions: vscode.Disposable[], workspaceConfig: WorkspaceConfig, StructuredInfo: StructuredInfo) {
  const config = vscode.workspace.getConfiguration();
  if (config.get('commonLisp.StaticAnalysis.enabled')) {
    initConfig(contextSubcriptions, workspaceConfig, StructuredInfo);
    syncStructuredInfoWithConfig(workspaceConfig, StructuredInfo);
  }

  vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration('commonLisp.StaticAnalysis.enabled')) {
      const config = vscode.workspace.getConfiguration();
      if (!config.get('commonLisp.StaticAnalysis.enabled')) {
        workspaceConfig.disposeAll();
        return;
      }

      initConfig(contextSubcriptions, workspaceConfig, StructuredInfo);
    }

    updateConfig(contextSubcriptions, workspaceConfig, e);
    syncStructuredInfoWithConfig(workspaceConfig, StructuredInfo);
  }, contextSubcriptions);
}


export { init, workspaceConfig };

