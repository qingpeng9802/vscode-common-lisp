import * as vscode from 'vscode';

import { CL_MODE } from '../common/cl_util';
import type { StructuredInfo } from '../provider_interface/StructuredInfo';

import { TraceableDisposables } from './TraceableDisposables';
import { WorkspaceConfig } from './WorkspaceConfig';

const traceableDisposables: TraceableDisposables = new TraceableDisposables();
const workspaceConfig: WorkspaceConfig = new WorkspaceConfig();
let activeEditor = vscode.window.activeTextEditor;

function init(contextSubcriptions: vscode.Disposable[], workspaceConfig: WorkspaceConfig, traceableDisposables: TraceableDisposables, structuredInfo: StructuredInfo) {
  const config = vscode.workspace.getConfiguration();
  if (config.get('commonLisp.StaticAnalysis.enabled')) {
    workspaceConfig.initConfig(contextSubcriptions, traceableDisposables);
    setDirtyHookForStructuredInfo(contextSubcriptions, traceableDisposables, structuredInfo);

    workspaceConfig.syncBuildingConfigWithConfig(structuredInfo);
  }

  vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration('commonLisp.StaticAnalysis.enabled')) {
      const config = vscode.workspace.getConfiguration();
      if (!config.get('commonLisp.StaticAnalysis.enabled')) {
        traceableDisposables.disposeAll();
        return;
      }

      workspaceConfig.initConfig(contextSubcriptions, traceableDisposables);
      setDirtyHookForStructuredInfo(contextSubcriptions, traceableDisposables, structuredInfo);
    } else {
      workspaceConfig.updateConfig(contextSubcriptions, traceableDisposables, e);
    }

    workspaceConfig.syncBuildingConfigWithConfig(structuredInfo);
  }, contextSubcriptions);
}

function setDirtyHookForStructuredInfo(contextSubcriptions: vscode.Disposable[], traceableDisposables: TraceableDisposables, structuredInfo: StructuredInfo) {
  // For text update mechanism
  // See https://github.com/microsoft/vscode-extension-samples/tree/a4f2ebf7ddfd44fb610bcbb080e97c7ce9a0ef44/decorator-sample
  // and https://github.com/microsoft/vscode-extension-samples/blob/62e7e59776c41e4495665d3a084621ea61a026e9/tree-view-sample/src/jsonOutline.ts
  //
  // According to https://github.com/microsoft/vscode/issues/49975#issuecomment-389817172
  // the document change event is emitted before any language actions (IntelliSense, outline, etc.).
  // Therefore, it is safe to use `onDidChangeTextDocument` and `onDidChangeActiveTextEditor` event to mark dirty on the StructuredInfo.
  if (traceableDisposables.disposables['eventOnDidChangeTD'] === undefined) {
    traceableDisposables.disposables['eventOnDidChangeTD'] = vscode.workspace.onDidChangeTextDocument(event => {
      if (event.contentChanges.length !== 0 && activeEditor !== undefined && event.document === activeEditor.document &&
        event.document.languageId === CL_MODE) {
        structuredInfo.setDirtyTrue();
        //console.log('dirty it by TD');
      }
    }, null, contextSubcriptions);
  }

  if (traceableDisposables.disposables['eventOnDidChangeATE'] === undefined) {
    traceableDisposables.disposables['eventOnDidChangeATE'] = vscode.window.onDidChangeActiveTextEditor(editor => {
      if (editor === undefined) {
        return;
      }
      activeEditor = editor;
      if (editor !== undefined && editor.document.languageId === CL_MODE) {
        structuredInfo.setDirtyTrue();
        //console.log('dirty it by ATE');
      }
    }, null, contextSubcriptions);
  }
}


export { init, workspaceConfig, traceableDisposables };

