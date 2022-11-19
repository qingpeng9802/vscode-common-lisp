import * as vscode from 'vscode';

import { CL_ID, CL_MODE } from '../cl_util';
import { decideUpdateProcess, updateSymbol } from './listen_update';
import { getProvider } from './provider_manager';

import { WorkspaceConfig } from './WorkspaceConfig';

import { needUpdateSet, workspaceConfig } from './common';

let activeEditor = vscode.window.activeTextEditor;
let timerId: NodeJS.Timer | undefined = undefined;
let updateTimeStamp: number | undefined = undefined;

// in case both 
// DocumentSemanticTokensProvider and DocumentSymbolProvider are NOT enabled
function backupTriggerUpdateSymbol(workspaceConfig: WorkspaceConfig, contextSubcriptions: vscode.Disposable[]) {
  if (
    workspaceConfig.disposables['documentSemanticTokensProvider'] !== undefined ||
    workspaceConfig.disposables['documentSymbolProvider'] !== undefined
  ) {
    if (workspaceConfig.disposables['backupTriggerUpdateSymbolonDidChangeTD'] !== undefined) {
      workspaceConfig.disposables['backupTriggerUpdateSymbolonDidChangeTD'].dispose();
      workspaceConfig.disposables['backupTriggerUpdateSymbolonDidChangeTD'] = undefined;
    }
    if (workspaceConfig.disposables['backupTriggerUpdateSymbolonDidChangeATE'] !== undefined) {
      workspaceConfig.disposables['backupTriggerUpdateSymbolonDidChangeATE'].dispose();
      workspaceConfig.disposables['backupTriggerUpdateSymbolonDidChangeATE'] = undefined;
    }
    return;
  }

  // For text update mechanism
  // See https://github.com/microsoft/vscode-extension-samples/tree/a4f2ebf7ddfd44fb610bcbb080e97c7ce9a0ef44/decorator-sample
  // and https://github.com/microsoft/vscode-extension-samples/blob/62e7e59776c41e4495665d3a084621ea61a026e9/tree-view-sample/src/jsonOutline.ts
  workspaceConfig.disposables['backupTriggerUpdateSymbolonDidChangeTD'] = vscode.workspace.onDidChangeTextDocument(event => {
    if (event.contentChanges.length !== 0 && activeEditor && event.document === activeEditor.document &&
      event.document.languageId === CL_MODE) {
      //console.log('backupTriggerUpdateSymbol');
      debounceTriggerUpdateSymbol(event.document);
    }
  }, null, contextSubcriptions);

  workspaceConfig.disposables['backupTriggerUpdateSymbolonDidChangeATE'] = vscode.window.onDidChangeActiveTextEditor(editor => {
    if (editor === undefined) {
      return;
    }
    activeEditor = editor;
    if (editor && editor.document.languageId === CL_MODE) {
      //console.log('backupTriggerUpdateSymbol');
      debounceTriggerUpdateSymbol(editor.document);
    }
  }, null, contextSubcriptions);
}

function debounceTriggerUpdateSymbol(doc: vscode.TextDocument) {
  const debounceTimeout = workspaceConfig.config['commonLisp.backupUpdater.debounceTimeout'] || 750;

  if (timerId) {
    clearTimeout(timerId);
    timerId = undefined;
  }

  timerId = setTimeout(() => { updateSymbol(doc); }, debounceTimeout);
  return;
}


function triggerUpdateSymbol(doc: vscode.TextDocument) {
  const throttleTimeout = workspaceConfig.config['commonLisp.Updater.throttleTimeout'] || 200;

  if (updateTimeStamp === undefined) {
    updateTimeStamp = performance.now();
    updateSymbol(doc);
    return;
  }

  if (performance.now() - updateTimeStamp < throttleTimeout) {
    //console.log('throttle@@@@@@@@@@@')
    return;
  } else {
    updateTimeStamp = performance.now();
    updateSymbol(doc);
    return;
  }
}

function disposeAll(disposablesDict: Record<string, vscode.Disposable | undefined>) {
  for (const [k, dis] of Object.entries(disposablesDict)) {
    if (dis !== undefined) {
      dis.dispose();
      disposablesDict[k] = undefined;
    }
  }
}

function initWithConfig(workspaceConfig: WorkspaceConfig, contextSubcriptions: vscode.Disposable[]) {
  const saEnabled = initWorkspaceConfig(workspaceConfig, contextSubcriptions);
  if (saEnabled) {
    backupTriggerUpdateSymbol(workspaceConfig, contextSubcriptions);

    needUpdateSet.clear();
    decideUpdateProcess(workspaceConfig).forEach(needUpdateSet.add, needUpdateSet);

    if (
      workspaceConfig.disposables['documentSemanticTokensProvider'] === undefined &&
      workspaceConfig.disposables['documentSymbolProvider'] === undefined
    ) {
      if (activeEditor) {
        triggerUpdateSymbol(activeEditor.document);
      }
    }
  }

  vscode.workspace.onDidChangeConfiguration((e) => {
    const saEnabled = updateWorkspaceConfig(contextSubcriptions, workspaceConfig, e);
    if (!saEnabled) {
      return;
    }
    backupTriggerUpdateSymbol(workspaceConfig, contextSubcriptions);

    needUpdateSet.clear();
    decideUpdateProcess(workspaceConfig).forEach(needUpdateSet.add, needUpdateSet);
  }, contextSubcriptions);
}

function initWorkspaceConfig(workspaceConfig: WorkspaceConfig, contextSubcriptions: vscode.Disposable[],
): boolean {
  const config = vscode.workspace.getConfiguration();

  if (!config.get('commonLisp.StaticAnalysis.enabled')) {
    disposeAll(workspaceConfig.disposables);
    return false;
  }

  for (const [k, v] of Object.entries(workspaceConfig.config)) {
    const langEntry: any = config.get(`[${CL_ID}]`);
    let newConfig = undefined;

    const newVal = config.get(k);
    newConfig = newVal !== undefined ? newVal : newConfig;
    newConfig = langEntry && langEntry[k] !== undefined ? langEntry[k] : newConfig;

    workspaceConfig.config[k] = newConfig;
    updateContextSubcriptions(contextSubcriptions, workspaceConfig, k, newConfig);
  }
  return true;
}

function updateWorkspaceConfig(
  contextSubcriptions: vscode.Disposable[],
  workspaceConfig: WorkspaceConfig,
  e: vscode.ConfigurationChangeEvent
): boolean {
  const config = vscode.workspace.getConfiguration();


  if (e.affectsConfiguration('commonLisp.StaticAnalysis.enabled')) {
    if (!config.get('commonLisp.StaticAnalysis.enabled')) {
      disposeAll(workspaceConfig.disposables);
      return false;
    } else {
      initWorkspaceConfig(workspaceConfig, contextSubcriptions);
      backupTriggerUpdateSymbol(workspaceConfig, contextSubcriptions);

      needUpdateSet.clear();
      decideUpdateProcess(workspaceConfig).forEach(needUpdateSet.add, needUpdateSet);

      if (
        workspaceConfig.disposables['documentSemanticTokensProvider'] === undefined &&
        workspaceConfig.disposables['documentSymbolProvider'] === undefined
      ) {
        if (activeEditor) {
          triggerUpdateSymbol(activeEditor.document);
        }
      }
      return true;
    }
  }

  for (const [k, v] of Object.entries(workspaceConfig.config)) {
    const langEntry: any = config.get(`[${CL_ID}]`);

    let dirty = false;
    let newConfig = undefined;

    if (e.affectsConfiguration(k)) {
      const newVal = config.get(k);
      if (newVal !== undefined) {
        newConfig = newVal;
        dirty = true;
      }
    }
    if (e.affectsConfiguration(k, { languageId: CL_ID }) && langEntry) {
      const newVal = langEntry[k];
      if (newVal !== undefined) {
        newConfig = newVal;
        dirty = true;
      }
    }

    if (dirty) {
      //console.log(`update workspace config: ${k} = ${newConfig}`);

      workspaceConfig.config[k] = newConfig;
      updateContextSubcriptions(contextSubcriptions, workspaceConfig, k, newConfig);
    }

  }

  return true;
}

function updateDisposables(contextSubcriptions: vscode.Disposable[], workspaceConfig: WorkspaceConfig, disposableName: string, workspaceConfigVal: any) {
  if (workspaceConfigVal === false) {
    if (workspaceConfig.disposables[disposableName] !== undefined) {
      workspaceConfig.disposables[disposableName]?.dispose();
      workspaceConfig.disposables[disposableName] = undefined;
    }
  } else {
    if (workspaceConfig.disposables[disposableName] === undefined) {
      const provider = getProvider(disposableName);
      workspaceConfig.disposables[disposableName] = provider;

      provider ? contextSubcriptions.push(provider) : undefined;
    }

  }
}

function updateContextSubcriptions(
  contextSubcriptions: vscode.Disposable[],
  workspaceConfig: WorkspaceConfig,
  workspaceConfigKey: string,
  workspaceConfigVal: any
) {
  // NOTE: If enableSemanticHighlighting is enabled,
  // we delegate text change listening to semantic token provider since
  // it has better debounce mechanism. Also, we can make sure there is not 
  // mutation causing inconsistent colors.
  // 
  // If `documentSemanticTokensProvider` is disabled, 
  // we delegate text change listening to `DocumentSymbolProvider`.
  // 
  // Otherwise, we use `backupTriggerUpdateSymbolonDidChangeATE` and `backupTriggerUpdateSymbolonDidChangeTD`
  //
  if (workspaceConfigKey === 'editor.semanticHighlighting.enabled') {
    updateDisposables(contextSubcriptions, workspaceConfig, 'documentSemanticTokensProvider', workspaceConfigVal);

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
  ].includes(workspaceConfigKey)
  ) {
    const disposableName = workspaceConfig.cfgMapDisposable[workspaceConfigKey];
    updateDisposables(contextSubcriptions, workspaceConfig, disposableName, workspaceConfigVal);
  }
}

export {
  triggerUpdateSymbol,
  initWithConfig,
};

