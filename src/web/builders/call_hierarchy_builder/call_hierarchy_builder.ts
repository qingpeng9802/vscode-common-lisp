import * as vscode from 'vscode';

import type { DocSymbolInfo } from '../../collect_user_symbol/DocSymbolInfo';
import type { SymbolInfo } from '../../collect_user_symbol/SymbolInfo';
import { isRangeIntExcludedRanges, isShadowed } from '../../collect_user_symbol/user_symbol_util';
import { bisectRight } from '../../common/algorithm';

import { CallHrchyInfo } from './CallHrchyInfo';

function buildCallHierarchyItem(info: SymbolInfo): vscode.CallHierarchyItem {
  const detail =
    (info.numberedContainerName !== undefined) ?
      info.numberedContainerName :
      ((info.containerName !== undefined) ? info.containerName : '');
  const item = new vscode.CallHierarchyItem(
    info.kind,
    info.name,
    detail,
    info.loc.uri,
    info.loc.range,
    info.loc.range
  );
  return item;
}

// @sideEffect ic: vscode.CallHierarchyIncomingCall
// @sideEffect og: vscode.CallHierarchyOutgoingCall
function buildEdge(
  icD: Record<string, vscode.CallHierarchyIncomingCall>, stringifyCallerKey: string | undefined, fromItem: vscode.CallHierarchyItem | undefined,
  ogD: Record<string, vscode.CallHierarchyOutgoingCall>, stringifyIsCalledKey: string | undefined, toItem: vscode.CallHierarchyItem | undefined,
  callAppearRange: vscode.Range[]
) {
  if (fromItem !== undefined && stringifyCallerKey !== undefined) {
    icD[stringifyCallerKey] = new vscode.CallHierarchyIncomingCall(fromItem, callAppearRange);
  }
  if (toItem !== undefined && stringifyIsCalledKey !== undefined) {
    ogD[stringifyIsCalledKey] = new vscode.CallHierarchyOutgoingCall(toItem, callAppearRange);
  }
  return;
}

function getRealCaller(
  globalOrderedRange: [string, [number, number]],
  currDocSymbolInfo: DocSymbolInfo,
): [string, vscode.Range, SymbolInfo] | undefined {

  const [currCallerName, currCallerRange] = globalOrderedRange;
  const [realCaller, shadow] = currDocSymbolInfo.getSymbolWithShadowByRange(currCallerName, currCallerRange, undefined);
  if (realCaller === undefined) {
    return undefined;
  }
  if (shadow !== undefined && shadow.length !== 0 && isShadowed(currCallerRange, shadow)) {
    return undefined;
  }
  if (isRangeIntExcludedRanges(currCallerRange, currDocSymbolInfo.docRes.commentAndStringRange)) {
    return undefined;
  }

  const callAppearRange = new vscode.Range(
    currDocSymbolInfo.document.positionAt(currCallerRange[0]),
    currDocSymbolInfo.document.positionAt(currCallerRange[1]),
  );
  return [currCallerName, callAppearRange, realCaller];
}

function genAllCallHierarchyItems(currDocSymbolInfo: DocSymbolInfo, globalOrderedRanges: [string, [number, number]][]): CallHrchyInfo {
  const [callHrchyInfo, visited] = genAllCallHierarchyItemsNonOrphan(currDocSymbolInfo, globalOrderedRanges);

  const callHrchyItems = callHrchyInfo.callHrchyItems;
  const callHierarchyICs = callHrchyInfo.incomingCall;
  const callHierarchyOGs = callHrchyInfo.outgoingCall;
  for (let i = 0; i < globalOrderedRanges.length; ++i) {
    if (visited.has(i)) {
      continue;
    }

    const realCallerRes = getRealCaller(globalOrderedRanges[i], currDocSymbolInfo);
    if (realCallerRes === undefined) {
      continue;
    }
    const [currCallerName, callAppearRange, realCaller] = realCallerRes;
    const realCallerStr = realCaller.stringify();
    if (callHrchyItems[currCallerName] === undefined) {
      callHrchyItems[currCallerName] = { realCallerStr: buildCallHierarchyItem(realCaller) };
    }
    const toItem = callHrchyItems[currCallerName][realCallerStr];

    // fileItem
    const fileName = currDocSymbolInfo.document.uri.path.split('/').pop();
    const isCalledName = (fileName !== undefined) ? fileName : 'Untitled';
    // make the range circle back
    const fromItem = new vscode.CallHierarchyItem(
      vscode.SymbolKind.Namespace, isCalledName, currDocSymbolInfo.document.uri.path, currDocSymbolInfo.document.uri,
      realCaller.loc.range, realCaller.loc.range
    );

    if (!Object.hasOwn(callHierarchyICs, currCallerName)) {
      callHierarchyICs[currCallerName] = {};
    }
    if (!Object.hasOwn(callHierarchyOGs, isCalledName)) {
      callHierarchyOGs[isCalledName] = {};
    }
    buildEdge(
      callHierarchyICs[currCallerName], realCallerStr, fromItem,
      callHierarchyOGs[isCalledName], undefined, toItem, [callAppearRange]
    );

  }
  return callHrchyInfo;
}


function genAllCallHierarchyItemsNonOrphan(currDocSymbolInfo: DocSymbolInfo, globalOrderedRanges: [string, [number, number]][]): [CallHrchyInfo, Set<number>] {
  const visited: Set<number> = new Set();

  const callHrchyItems: Record<string, Record<string, vscode.CallHierarchyItem>> = {};
  const callHierarchyICs: Record<string, Record<string, vscode.CallHierarchyIncomingCall>> = {};
  const callHierarchyOGs: Record<string, Record<string, vscode.CallHierarchyOutgoingCall>> = {};
  const currCallHierarchyInfo: CallHrchyInfo = new CallHrchyInfo(callHrchyItems, callHierarchyICs, callHierarchyOGs);

  const infos = Object.values(currDocSymbolInfo.globalDef).flat().sort((a, b) => {
    return a.numRange[0] - b.numRange[0];
  });

  for (const info of infos) {
    const isCalledName = info.name;
    const infoStr = info.stringify();
    if (callHrchyItems[isCalledName] === undefined) {
      callHrchyItems[isCalledName] = { infoStr: buildCallHierarchyItem(info) };
    }
    const fromItem = callHrchyItems[isCalledName][infoStr];
    if (fromItem === undefined) {
      continue;
    }

    // caller's range
    const callerRange = info.globalDefRange;
    if (callerRange === undefined) {
      continue;
    }

    const idxStart = bisectRight(globalOrderedRanges, callerRange[0], item => item[1][0]);
    const idxEnd = bisectRight(globalOrderedRanges, callerRange[1], item => item[1][0]);
    for (let i = idxStart; i < idxEnd; ++i) {
      visited.add(i);

      const realCallerRes = getRealCaller(globalOrderedRanges[i], currDocSymbolInfo);
      if (realCallerRes === undefined) {
        continue;
      }
      const [currCallerName, callAppearRange, realCaller] = realCallerRes;
      const realCallerStr = realCaller.stringify();
      if (callHrchyItems[currCallerName] === undefined) {
        callHrchyItems[currCallerName] = { realCallerStr: buildCallHierarchyItem(realCaller) };
      }
      const toItem = callHrchyItems[currCallerName][realCallerStr];

      // this is kind of twisted,
      // from-to relation represents the curr context
      // definition must be the ISCALLED, execution must be the CALLER, curr context is not matter
      // we are creating two directional edges
      //
      //            fromItems                   |
      //            \   |   /                   |
      // key:     1. currCaller  2. isCalled    |
      //                             /  |  \    |
      //                             toItems   \|/
      //
      // that is, our dictionary needs the opposite info to build an edge
      if (!Object.hasOwn(callHierarchyICs, currCallerName)) {
        callHierarchyICs[currCallerName] = {};
      }
      if (!Object.hasOwn(callHierarchyOGs, isCalledName)) {
        callHierarchyOGs[isCalledName] = {};
      }
      buildEdge(
        callHierarchyICs[currCallerName], realCallerStr, fromItem,
        callHierarchyOGs[isCalledName], infoStr, toItem, [callAppearRange]
      );

    }
  }

  return [currCallHierarchyInfo, visited];

}


export { genAllCallHierarchyItems };

