import * as vscode from 'vscode';

import type { DocSymbolInfo } from '../../collect_user_symbol/DocSymbolInfo';
import type { SymbolInfo } from '../../collect_user_symbol/SymbolInfo';
import { isRangeIntExcludedRanges, isShadowed } from '../../collect_user_symbol/user_symbol_util';
import { bisectRight } from '../../common/algorithm';

import { CallHrchyInfo } from './CallHrchyInfo';

function buildCallHierarchyItem(info: SymbolInfo): vscode.CallHierarchyItem {
  const detail =
    info.numberedContainerName ?
      info.numberedContainerName :
      (info.containerName ? info.containerName : '');
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
  if (fromItem && stringifyCallerKey) {
    icD[stringifyCallerKey] = new vscode.CallHierarchyIncomingCall(fromItem, callAppearRange);
  }
  if (toItem && stringifyIsCalledKey) {
    ogD[stringifyIsCalledKey] = new vscode.CallHierarchyOutgoingCall(toItem, callAppearRange);
  }
  return;
}

function getCallAppearRange(currDocSymbolInfo: DocSymbolInfo, range: [number, number]): vscode.Range {
  const callAppearRange = new vscode.Range(
    currDocSymbolInfo.document.positionAt(range[0]),
    currDocSymbolInfo.document.positionAt(range[1]),
  );
  return callAppearRange;
}

function processglobalOrderedRange(
  globalOrderedRange: [string, [number, number]],
  callHrchyItems: Record<string, Record<string, vscode.CallHierarchyItem>>,
  currDocSymbolInfo: DocSymbolInfo,
): [string, SymbolInfo, string, vscode.CallHierarchyItem, vscode.Range] | undefined {

  const currCallerName = globalOrderedRange[0];
  const [realCaller, shadow] = currDocSymbolInfo.getSymbolWithShadowByRange(globalOrderedRange[1], currCallerName, undefined);
  if (!realCaller) {
    return undefined;
  }
  if (shadow && shadow.length !== 0 && isShadowed(globalOrderedRange[1], shadow)) {
    return undefined;
  }
  if (isRangeIntExcludedRanges(globalOrderedRange[1], currDocSymbolInfo.commentAndStringRange)) {
    return undefined;
  }

  const callAppearRange = getCallAppearRange(currDocSymbolInfo, globalOrderedRange[1]);

  const realCallerStr = realCaller.stringify();
  if (!callHrchyItems[currCallerName]) {
    callHrchyItems[currCallerName] = {};
    callHrchyItems[currCallerName][realCallerStr] = buildCallHierarchyItem(realCaller);
  }
  const toItem = callHrchyItems[currCallerName][realCallerStr];
  if (!toItem) {
    return undefined;
  }
  return [currCallerName, realCaller, realCallerStr, toItem, callAppearRange];
}

function genAllCallHierarchyItems(currDocSymbolInfo: DocSymbolInfo, globalOrderedRanges: [string, [number, number]][]): CallHrchyInfo {
  const [callHrchyInfo, visited] = genAllCallHierarchyItemsNonOrphan(currDocSymbolInfo, globalOrderedRanges);

  const callHrchyItems = callHrchyInfo.callHrchyItems;
  const callHierarchyICs = callHrchyInfo.incomingCall;
  const callHierarchyOGs = callHrchyInfo.outgoingCall;
  for (let i = 0; i < globalOrderedRanges.length; i++) {
    if (visited.has(i)) {
      continue;
    }

    const rangeProcessedRes = processglobalOrderedRange(globalOrderedRanges[i], callHrchyItems, currDocSymbolInfo);
    if (!rangeProcessedRes) {
      continue;
    }
    const [currCallerName, realCaller, realCallerStr, toItem, callAppearRange] = rangeProcessedRes;

    // fileItem
    const isCalledName = (currDocSymbolInfo.document.uri.path.split('/').pop() || 'Untitled');
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
    buildEdge(callHierarchyICs[currCallerName], realCallerStr, fromItem, callHierarchyOGs[isCalledName], undefined, toItem, [callAppearRange]);

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
    if (!callHrchyItems[isCalledName]) {
      callHrchyItems[isCalledName] = {};
      callHrchyItems[isCalledName][infoStr] = buildCallHierarchyItem(info);
    }
    const fromItem = callHrchyItems[isCalledName][infoStr];
    if (!fromItem) {
      continue;
    }

    // caller's range
    const callerRange = info.globalDefRange;
    if (!callerRange) {
      continue;
    }

    if (callerRange[0]) {

      const idxStart = bisectRight(globalOrderedRanges, callerRange[0], item => item[1][0]);
      const idxEnd = bisectRight(globalOrderedRanges, callerRange[1], item => item[1][0]);
      for (let i = idxStart; i < idxEnd; i++) {
        visited.add(i);

        const rangeProcessedRes = processglobalOrderedRange(globalOrderedRanges[i], callHrchyItems, currDocSymbolInfo);
        if (!rangeProcessedRes) {
          continue;
        }
        const [currCallerName, realCaller, realCallerStr, toItem, callAppearRange] = rangeProcessedRes;

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
        buildEdge(callHierarchyICs[currCallerName], realCallerStr, fromItem, callHierarchyOGs[isCalledName], infoStr, toItem, [callAppearRange]);

      }

    }
  }

  return [currCallHierarchyInfo, visited];

}


export { genAllCallHierarchyItems };

