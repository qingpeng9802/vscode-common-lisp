import * as vscode from 'vscode';

import { WorkspaceConfig } from './WorkspaceConfig';
import { UpdateInfo } from '../provider_interface/UpdateInfo';

import { syncUpdateInfoWithConfig } from './sync_with_config';

const CL_ID: string = 'commonlisp';
const workspaceConfig: WorkspaceConfig = new WorkspaceConfig();

function init(contextSubcriptions: vscode.Disposable[], workspaceConfig: WorkspaceConfig, updateInfo: UpdateInfo) {
  const config = vscode.workspace.getConfiguration();
  if (config.get('commonLisp.StaticAnalysis.enabled')) {
    initConfig(contextSubcriptions, workspaceConfig);
    syncUpdateInfoWithConfig(contextSubcriptions, workspaceConfig, updateInfo);
  }

  vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration('commonLisp.StaticAnalysis.enabled')) {
      const config = vscode.workspace.getConfiguration();
      if (!config.get('commonLisp.StaticAnalysis.enabled')) {
        workspaceConfig.disposeAll();
        return;
      }

      initConfig(contextSubcriptions, workspaceConfig);
    }

    updateConfig(contextSubcriptions, workspaceConfig, e);
    syncUpdateInfoWithConfig(contextSubcriptions, workspaceConfig, updateInfo);

  }, contextSubcriptions);
}

function initConfig(contextSubcriptions: vscode.Disposable[], workspaceConfig: WorkspaceConfig) {
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
  //console.log(workspaceConfig);
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
  let disposableName: string = '';
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

export { init, workspaceConfig };

