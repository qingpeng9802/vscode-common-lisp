import * as vscode from 'vscode';

import { isRangeIntExcludedRanges, isShadowed } from '../user_symbol/collect_symbol_util';
import { DocSymbolInfo } from '../user_symbol/DocSymbolInfo';
import { SymbolInfo } from '../user_symbol/SymbolInfo';
import { bisectRight } from '../algorithm';
import { CallHrchyInfo } from './CallHrchyInfo';

import { updateInfo } from '../entry/listen_update';

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
  callAppear: vscode.Range[]
) {
  if (fromItem && stringifyCallerKey) {
    icD[stringifyCallerKey] = new vscode.CallHierarchyIncomingCall(fromItem, callAppear);
  }
  if (toItem && stringifyIsCalledKey) {
    ogD[stringifyIsCalledKey] = new vscode.CallHierarchyOutgoingCall(toItem, callAppear);
  }
  return;
}

function getCallAppear(currDocSymbolInfo: DocSymbolInfo, range: [number, number]): vscode.Range {
  const callAppear = new vscode.Range(
    currDocSymbolInfo.document.positionAt(range[0]),
    currDocSymbolInfo.document.positionAt(range[1]),
  );
  return callAppear;
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

  const callAppear = getCallAppear(currDocSymbolInfo, globalOrderedRange[1]);

  const realCallerStr = realCaller.stringify();
  if (!callHrchyItems[currCallerName]) {
    callHrchyItems[currCallerName] = {};
    callHrchyItems[currCallerName][realCallerStr] = buildCallHierarchyItem(realCaller);
  }
  const toItem = callHrchyItems[currCallerName][realCallerStr];
  if (!toItem) {
    return undefined;
  }
  return [currCallerName, realCaller, realCallerStr, toItem, callAppear];
}

function genAllCallHierarchyItems(currDocSymbolInfo: DocSymbolInfo): CallHrchyInfo {
  const [callHrchyInfo, visited] = genAllCallHierarchyItemsNonOrphan(currDocSymbolInfo);

  const callHrchyItems = callHrchyInfo.callHrchyItems;
  const callHierarchyICs = callHrchyInfo.incomingCall;
  const callHierarchyOGs = callHrchyInfo.outgoingCall;
  for (let i = 0; i < updateInfo.globalOrderedRanges.length; i++) {
    if (visited.has(i)) {
      continue;
    }

    const rangeProcessedRes = processglobalOrderedRange(updateInfo.globalOrderedRanges[i], callHrchyItems, currDocSymbolInfo);
    if (!rangeProcessedRes) {
      continue;
    }
    const [currCallerName, realCaller, realCallerStr, toItem, callAppear] = rangeProcessedRes;

    // fileItem
    const isCalledName = (currDocSymbolInfo.document.uri.path.split('/').pop() || 'Untitled');
    // make the range circle back
    const fromItem = new vscode.CallHierarchyItem(
      vscode.SymbolKind.Namespace, isCalledName, currDocSymbolInfo.document.uri.path, currDocSymbolInfo.document.uri,
      realCaller.loc.range, realCaller.loc.range
    );

    if (!callHierarchyICs.hasOwnProperty(currCallerName)) {
      callHierarchyICs[currCallerName] = {};
    }
    if (!callHierarchyOGs.hasOwnProperty(isCalledName)) {
      callHierarchyOGs[isCalledName] = {};
    }
    buildEdge(callHierarchyICs[currCallerName], realCallerStr, fromItem, callHierarchyOGs[isCalledName], undefined, toItem, [callAppear]);

  }
  return callHrchyInfo;
}


function genAllCallHierarchyItemsNonOrphan(currDocSymbolInfo: DocSymbolInfo): [CallHrchyInfo, Set<number>] {
  const visited: Set<number> = new Set();

  const callHrchyItems: Record<string, Record<string, vscode.CallHierarchyItem>> = {};
  const callHierarchyICs: Record<string, Record<string, vscode.CallHierarchyIncomingCall>> = {};
  const callHierarchyOGs: Record<string, Record<string, vscode.CallHierarchyOutgoingCall>> = {};
  const callHierarchyInfo: CallHrchyInfo = new CallHrchyInfo(callHrchyItems, callHierarchyICs, callHierarchyOGs);

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

      const idxStart = bisectRight(updateInfo.globalOrderedRanges, callerRange[0], item => item[1][0]);
      const idxEnd = bisectRight(updateInfo.globalOrderedRanges, callerRange[1], item => item[1][0]);
      for (let i = idxStart; i < idxEnd; i++) {
        visited.add(i);

        const rangeProcessedRes = processglobalOrderedRange(updateInfo.globalOrderedRanges[i], callHrchyItems, currDocSymbolInfo);
        if (!rangeProcessedRes) {
          continue;
        }
        const [currCallerName, realCaller, realCallerStr, toItem, callAppear] = rangeProcessedRes;

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
        if (!callHierarchyICs.hasOwnProperty(currCallerName)) {
          callHierarchyICs[currCallerName] = {};
        }
        if (!callHierarchyOGs.hasOwnProperty(isCalledName)) {
          callHierarchyOGs[isCalledName] = {};
        }
        buildEdge(callHierarchyICs[currCallerName], realCallerStr, fromItem, callHierarchyOGs[isCalledName], infoStr, toItem, [callAppear]);

      }

    }
  }

  return [callHierarchyInfo, visited];

}


export { genAllCallHierarchyItems };

