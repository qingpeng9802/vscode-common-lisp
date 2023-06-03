import * as vscode from 'vscode';

import { CL_MODE } from '../common/cl_util';

import { WorkspaceConfig } from './WorkspaceConfig';
import { UpdateInfo } from '../provider_interface/UpdateInfo';

let activeEditor = vscode.window.activeTextEditor;

function setDirtyHookForUpdateInfo(contextSubcriptions: vscode.Disposable[], workspaceConfig: WorkspaceConfig, updateInfo: UpdateInfo) {
  // For text update mechanism
  // See https://github.com/microsoft/vscode-extension-samples/tree/a4f2ebf7ddfd44fb610bcbb080e97c7ce9a0ef44/decorator-sample
  // and https://github.com/microsoft/vscode-extension-samples/blob/62e7e59776c41e4495665d3a084621ea61a026e9/tree-view-sample/src/jsonOutline.ts
  //
  // According to https://github.com/microsoft/vscode/issues/49975#issuecomment-389817172
  // the document change event is emitted before any language actions (IntelliSense, outline, etc.).
  // Therefore, it is safe to use updateInfo event to mark dirty on the UpdateInfo.
  if (workspaceConfig.disposables['eventOnDidChangeTD'] === undefined) {
    workspaceConfig.disposables['eventOnDidChangeTD'] = vscode.workspace.onDidChangeTextDocument(event => {
      if (event.contentChanges.length !== 0 && activeEditor && event.document === activeEditor.document &&
        event.document.languageId === CL_MODE) {
        updateInfo.dirty = true;
        //console.log('dirty it by TD');
      }
    }, null, contextSubcriptions);
  }

  if (workspaceConfig.disposables['eventOnDidChangeATE'] === undefined) {
    workspaceConfig.disposables['eventOnDidChangeATE'] = vscode.window.onDidChangeActiveTextEditor(editor => {
      if (editor === undefined) {
        return;
      }
      activeEditor = editor;
      if (editor && editor.document.languageId === CL_MODE) {
        updateInfo.dirty = true;
        //console.log('dirty it by ATE');
      }
    }, null, contextSubcriptions);
  }
}

function decideUpdateProcessByConfig(workspaceConfig: WorkspaceConfig, updateInfo: UpdateInfo) {
  // copy the configs that are needed for building later 
  // so `workspaceConfig` is decoupled from the building process
  for (const k of Object.keys(updateInfo.buildingConfig)) {
    updateInfo.buildingConfig = workspaceConfig.config[k];
  }

  updateInfo.needUpdateSet = new Set();
  if (
    workspaceConfig.disposables['userCompletionItemProvider'] !== undefined ||
    workspaceConfig.disposables['definitionProvider'] !== undefined ||
    workspaceConfig.disposables['documentSymbolProvider'] !== undefined ||
    workspaceConfig.disposables['referenceProvider'] !== undefined ||
    workspaceConfig.disposables['documentSemanticTokensProvider'] !== undefined ||
    workspaceConfig.disposables['callHierarchyProvider'] !== undefined
  ) {
    updateInfo.needUpdateSet.add('getDocSymbolInfo');
  }

  if (
    workspaceConfig.disposables['userCompletionItemProvider'] !== undefined
  ) {
    updateInfo.needUpdateSet.add('genUserSymbols');
  };

  if (
    workspaceConfig.disposables['userCompletionItemProvider'] !== undefined ||
    workspaceConfig.disposables['callHierarchyProvider'] !== undefined ||
    workspaceConfig.disposables['documentSymbolProvider'] !== undefined
  ) {
    updateInfo.needUpdateSet.add('genDocumentSymbol');
  };

  if (
    workspaceConfig.disposables['referenceProvider'] !== undefined ||
    workspaceConfig.disposables['documentSemanticTokensProvider'] !== undefined ||
    workspaceConfig.disposables['callHierarchyProvider'] !== undefined
  ) {
    updateInfo.needUpdateSet.add('genAllPossibleWord');
  };

  if (
    workspaceConfig.disposables['documentSemanticTokensProvider'] !== undefined
  ) {
    updateInfo.needUpdateSet.add('buildSemanticTokens');
  };

  if (
    workspaceConfig.disposables['callHierarchyProvider'] !== undefined
  ) {
    updateInfo.needUpdateSet.add('genAllCallHierarchyItems');
  };

}

function syncUpdateInfoWithConfig(contextSubcriptions: vscode.Disposable[], workspaceConfig: WorkspaceConfig, updateInfo: UpdateInfo) {
  setDirtyHookForUpdateInfo(contextSubcriptions, workspaceConfig, updateInfo);
  decideUpdateProcessByConfig(workspaceConfig, updateInfo);
  if (activeEditor) {
    updateInfo.updateSymbol(activeEditor.document);
  }
}

export { syncUpdateInfoWithConfig };
