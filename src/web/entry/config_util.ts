import * as vscode from 'vscode';

import { CL_MODE } from '../common/cl_util';
import type { StructuredInfo } from '../provider_interface/StructuredInfo';

import type { WorkspaceConfig } from './WorkspaceConfig';

let activeEditor = vscode.window.activeTextEditor;
const CL_ID = 'commonlisp';

function syncStructuredInfoWithConfig(workspaceConfig: WorkspaceConfig, StructuredInfo: StructuredInfo) {
  // copy the configs that are needed for building later
  // so `workspaceConfig` is decoupled from the building process
  for (const k of Object.keys(StructuredInfo.buildingConfig)) {
    StructuredInfo.buildingConfig = workspaceConfig.config[k];
  }
  StructuredInfo.needProduceSet = workspaceConfig.getNeedProduceSetByConfig();

  if (activeEditor) {
    StructuredInfo.produceInfoByDoc(activeEditor.document);
  }
}

function initConfig(contextSubcriptions: vscode.Disposable[], workspaceConfig: WorkspaceConfig, StructuredInfo: StructuredInfo) {
  const config = vscode.workspace.getConfiguration();
  for (const k of Object.keys(workspaceConfig.config)) {
    const langEntry: any = config.get(`[${CL_ID}]`);
    let newConfigVal = undefined;

    const newVal = config.get(k);
    newConfigVal = newVal !== undefined ? newVal : newConfigVal;
    newConfigVal = langEntry && (langEntry[k] !== undefined) ? langEntry[k] : newConfigVal;

    workspaceConfig.config[k] = newConfigVal;
    updateDisposables(contextSubcriptions, workspaceConfig, k, newConfigVal);
  }

  setDirtyHookForStructuredInfo(contextSubcriptions, workspaceConfig, StructuredInfo);
  //console.log(workspaceConfig);
}

function setDirtyHookForStructuredInfo(contextSubcriptions: vscode.Disposable[], workspaceConfig: WorkspaceConfig, StructuredInfo: StructuredInfo) {
  // For text update mechanism
  // See https://github.com/microsoft/vscode-extension-samples/tree/a4f2ebf7ddfd44fb610bcbb080e97c7ce9a0ef44/decorator-sample
  // and https://github.com/microsoft/vscode-extension-samples/blob/62e7e59776c41e4495665d3a084621ea61a026e9/tree-view-sample/src/jsonOutline.ts
  //
  // According to https://github.com/microsoft/vscode/issues/49975#issuecomment-389817172
  // the document change event is emitted before any language actions (IntelliSense, outline, etc.).
  // Therefore, it is safe to use StructuredInfo event to mark dirty on the StructuredInfo.
  if (workspaceConfig.disposables['eventOnDidChangeTD'] === undefined) {
    workspaceConfig.disposables['eventOnDidChangeTD'] = vscode.workspace.onDidChangeTextDocument(event => {
      if (event.contentChanges.length !== 0 && activeEditor && event.document === activeEditor.document &&
        event.document.languageId === CL_MODE) {
        StructuredInfo.dirty = true;
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
        StructuredInfo.dirty = true;
        //console.log('dirty it by ATE');
      }
    }, null, contextSubcriptions);
  }
}

function updateConfig(contextSubcriptions: vscode.Disposable[], workspaceConfig: WorkspaceConfig, e: vscode.ConfigurationChangeEvent) {
  const config = vscode.workspace.getConfiguration();
  for (const k of Object.keys(workspaceConfig.config)) {
    let dirty = false;
    let newConfigVal = undefined;

    if (e.affectsConfiguration(k)) {
      const newVal = config.get(k);
      if (newVal !== undefined) {
        newConfigVal = newVal;
        dirty = true;
      }
    }

    const langEntry: any = config.get(`[${CL_ID}]`);
    if (e.affectsConfiguration(k, { languageId: CL_ID }) && langEntry) {
      const newVal = langEntry[k];
      if (newVal !== undefined) {
        newConfigVal = newVal;
        dirty = true;
      }
    }

    if (dirty) {
      //console.log(`update workspace config: ${k} = ${newConfig}`);
      workspaceConfig.config[k] = newConfigVal;
      updateDisposables(contextSubcriptions, workspaceConfig, k, newConfigVal);
    }

  }
}

function updateDisposables(contextSubcriptions: vscode.Disposable[], workspaceConfig: WorkspaceConfig, workspaceConfigKey: string, newWorkspaceConfigVal: any) {
  let disposableName = '';
  if (workspaceConfigKey === 'editor.semanticHighlighting.enabled') {
    disposableName = 'documentSemanticTokensProvider';
  } else if ([
    'commonLisp.providers.CompletionItemProviders.user.enabled',
    'commonLisp.providers.CompletionItemProviders.original.enabled',

    'commonLisp.providers.CompletionItemProviders.ampersand.enabled',
    'commonLisp.providers.CompletionItemProviders.asterisk.enabled',
    'commonLisp.providers.CompletionItemProviders.colon.enabled',

    'commonLisp.providers.CompletionItemProviders.tilde.enabled',
    'commonLisp.providers.CompletionItemProviders.sharpsign.enabled',

    'commonLisp.providers.HoverProvider.enabled',
    'commonLisp.providers.DefinitionProvider.enabled',
    'commonLisp.providers.DocumentSymbolProvider.enabled',
    'commonLisp.providers.ReferenceProvider.enabled',
    'commonLisp.providers.DocumentSemanticTokensProvider.enabled',
    'commonLisp.providers.CallHierarchyProvider.enabled',
  ].includes(workspaceConfigKey)) {
    disposableName = workspaceConfig.cfgMapDisposable[workspaceConfigKey];
  }

  if (newWorkspaceConfigVal === false) {
    workspaceConfig.disposeProviderByName(disposableName);
  } else {
    workspaceConfig.setProviderByName(disposableName, contextSubcriptions);
  }
}

export { initConfig, updateConfig, syncStructuredInfoWithConfig };
