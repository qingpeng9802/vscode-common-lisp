import * as vscode from 'vscode';

import { genDocumentSymbol } from '../doc_symbol_provider/symbol_info_builder';
import { getDocSymbolInfo } from '../user_symbol/user_symbol_interface';
import { genUserSymbols } from '../comp_item_provider/comp_item_user_builder';
import { buildSemanticTokens, genAllPossibleWord } from '../semantic_provider/semantic_tokens_builder';
import { genAllCallHierarchyItems } from '../call_hierarchy_provider/call_hierarchy_builder';
import { UpdateInfo } from './UpdateInfo';
import { UpdateCache } from './UpdateCache';

import { WorkspaceConfig } from './WorkspaceConfig';
import { needUpdateSet } from './init';

function decideUpdateProcess(workspaceConfig: WorkspaceConfig): Set<string> {
  const need: Set<string> = new Set();
  if (
    workspaceConfig.disposables['userCompletionItemProvider'] !== undefined ||
    workspaceConfig.disposables['definitionProvider'] !== undefined ||
    workspaceConfig.disposables['documentSymbolProvider'] !== undefined ||
    workspaceConfig.disposables['referenceProvider'] !== undefined ||
    workspaceConfig.disposables['documentSemanticTokensProvider'] !== undefined ||
    workspaceConfig.disposables['callHierarchyProvider'] !== undefined
  ) {
    need.add('getDocSymbolInfo');
  }


  if (
    workspaceConfig.disposables['userCompletionItemProvider'] !== undefined
  ) {
    need.add('genUserSymbols');
  };

  if (
    workspaceConfig.disposables['userCompletionItemProvider'] !== undefined ||
    workspaceConfig.disposables['callHierarchyProvider'] !== undefined ||
    workspaceConfig.disposables['documentSymbolProvider'] !== undefined
  ) {
    need.add('genDocumentSymbol');
  };

  if (
    workspaceConfig.disposables['referenceProvider'] !== undefined ||
    workspaceConfig.disposables['documentSemanticTokensProvider'] !== undefined ||
    workspaceConfig.disposables['callHierarchyProvider'] !== undefined
  ) {
    need.add('genAllPossibleWord');
  };

  if (
    workspaceConfig.disposables['documentSemanticTokensProvider'] !== undefined
  ) {
    need.add('buildSemanticTokens');
  };

  if (
    workspaceConfig.disposables['callHierarchyProvider'] !== undefined
  ) {
    need.add('genAllCallHierarchyItems');
  };

  return need;
}

let updateInfo = new UpdateInfo();
let updateCache = new UpdateCache();

// @sideEffect: UpdateInfo.currDocSymbolInfo: DocSymbolInfo | undefined
// @sideEffect: UpdateInfo.currDocumentSymbol: vscode.DocumentSymbol[]
// @sideEffect: UpdateInfo.currUserSymbols: vscode.CompletionItem[]
// @sideEffect: UpdateInfo.currSemanticTokens: vscode.SemanticTokens
// @sideEffect: UpdateInfo.callHierarchyInfo: CallHrchyInfo | undefined
function updateSymbol(doc: vscode.TextDocument) {
  //const t = performance.now();

  updateCache = new UpdateCache();
  updateInfo = new UpdateInfo();
  // order matters here!

  if (needUpdateSet.has('getDocSymbolInfo')) {
    updateInfo.currDocSymbolInfo = getDocSymbolInfo(doc);
  }

  if (needUpdateSet.has('genUserSymbols') && updateInfo.currDocSymbolInfo) {
    updateInfo.currUserSymbols = genUserSymbols(updateInfo.currDocSymbolInfo);
  }

  if (needUpdateSet.has('genDocumentSymbol') && updateInfo.currDocSymbolInfo) {
    updateInfo.currDocumentSymbol = genDocumentSymbol(updateInfo.currDocSymbolInfo);
  }

  if (needUpdateSet.has('genAllPossibleWord') && updateInfo.currDocSymbolInfo) {
    const res = genAllPossibleWord(updateInfo.currDocSymbolInfo);
    updateInfo.needColorDict = res[0];
    updateInfo.globalOrderedRanges = res[1];
  }

  if (needUpdateSet.has('buildSemanticTokens') && updateInfo.currDocSymbolInfo) {
    updateInfo.currSemanticTokens = buildSemanticTokens(updateInfo.currDocSymbolInfo);
  }

  if (needUpdateSet.has('genAllCallHierarchyItems') && updateInfo.currDocSymbolInfo) {
    updateInfo.callHierarchyInfo = genAllCallHierarchyItems(updateInfo.currDocSymbolInfo);
  }


  //console.log(`finish: ${performance.now() - t}ms`);
}

function _sleep(timer: number) {
  return new Promise<void>(resolve => {
    setTimeout(function () { resolve(); }, timer);
  });
};

export {
  decideUpdateProcess,
  updateSymbol,
  updateInfo,
};

