import * as vscode from 'vscode';

import type { SymbolInfo } from '../../collect_info/SymbolInfo';
import { isRangeIntExcludedRanges, bisectRight } from '../../common/algorithm';
import type { DocSymbolInfo } from '../DocSymbolInfo';
import { isShadowed } from '../builders_util';

import { CallHrchyInfo } from './CallHrchyInfo';

// @sideEffect ic: vscode.CallHierarchyIncomingCall
// @sideEffect og: vscode.CallHierarchyOutgoingCall
function buildEdge(
  icD: Map<string, vscode.CallHierarchyIncomingCall>,
  stringifyCallerKey: string | undefined, fromItem: vscode.CallHierarchyItem | undefined,
  ogD: Map<string, vscode.CallHierarchyOutgoingCall>,
  stringifyIsCalledKey: string | undefined, toItem: vscode.CallHierarchyItem | undefined,
  callAppearRange: vscode.Range[]
) {
  if (fromItem !== undefined && stringifyCallerKey !== undefined) {
    icD.set(stringifyCallerKey, new vscode.CallHierarchyIncomingCall(fromItem, callAppearRange));
  }
  if (toItem !== undefined && stringifyIsCalledKey !== undefined) {
    ogD.set(stringifyIsCalledKey, new vscode.CallHierarchyOutgoingCall(toItem, callAppearRange));
  }
  return;
}

function getRealIsCalled(
  globalOrderedRange: [string, [number, number]], currDocSymbolInfo: DocSymbolInfo,
): [string, vscode.Range, SymbolInfo] | undefined {

  const [isCalledName, isCalledRange] = globalOrderedRange;
  const [realIsCalled, shadow] = currDocSymbolInfo.getSymbolWithShadowByRange(isCalledName, isCalledRange, undefined);
  if (realIsCalled === undefined) {
    return undefined;
  }
  if (shadow !== undefined && shadow.length !== 0 && isShadowed(isCalledRange, shadow)) {
    return undefined;
  }
  if (isRangeIntExcludedRanges(isCalledRange, currDocSymbolInfo.docRes.commentAndStringRange)) {
    return undefined;
  }

  const callAppearRange = new vscode.Range(
    currDocSymbolInfo.document.positionAt(isCalledRange[0]),
    currDocSymbolInfo.document.positionAt(isCalledRange[1]),
  );

  return [isCalledName, callAppearRange, realIsCalled];
}

function buildEdgeForIsCalledRange(
  currCallHierarchyInfo: CallHrchyInfo, realIsCalledRes: [string, vscode.Range, SymbolInfo],
  callerName: string, callerSymbolStr: string | undefined, fromItem: vscode.CallHierarchyItem | undefined,
) {
  const [isCalledName, callAppearRange, realIsCalled] = realIsCalledRes;

  fromItem = (fromItem === undefined) ?
    // when the file is the caller, the file has no `range`.
    // Therefore, make the range circle back, that is,
    // let the range points to the isCalled itself
    new vscode.CallHierarchyItem(
      vscode.SymbolKind.Namespace, callerName,
      realIsCalled.uri.path, realIsCalled.uri,
      realIsCalled.range, realIsCalled.range
    ) : fromItem;

  const realIsCalledStr = realIsCalled.stringify;
  const callHrchyItems = currCallHierarchyInfo.callHrchyItems;
  if (callHrchyItems.get(isCalledName) === undefined) {
    callHrchyItems.set(isCalledName, new Map([[realIsCalledStr, realIsCalled.toCallHierarchyItem()]]));
  }
  const toItem = callHrchyItems.get(isCalledName)?.get(realIsCalledStr);

  // we are creating two directional edges
  //
  //           IncomingCall   OutgoingCall
  //
  //            fromItems
  //                |
  //                |
  //               \|/
  // key:     1. isCalled   2.   caller
  //                               |
  //                               |
  //                              \|/
  //                             toItems
  //
  // note that
  // `fromItems` is constructed from caller and
  // `toItems` is constructed from isCalled.
  // that is, our dictionary needs two infos to build an edge
  const iCMap = currCallHierarchyInfo.incomingCall;
  const oGMap = currCallHierarchyInfo.outgoingCall;
  if (!iCMap.has(isCalledName)) {
    iCMap.set(isCalledName, new Map<string, vscode.CallHierarchyIncomingCall>());
  }

  buildEdge(
    iCMap.get(isCalledName)!, realIsCalledStr, fromItem,
    oGMap.get(callerName)!, callerSymbolStr, toItem,
    [callAppearRange]
  );
}

function genAllCallHierarchyItemsNonOrphan(
  callHrchyInfo: CallHrchyInfo,
  currDocSymbolInfo: DocSymbolInfo, globalOrderedRanges: [string, [number, number]][]
): Set<number> {
  // init
  const visited: Set<number> = new Set();

  const callHrchyItems = callHrchyInfo.callHrchyItems;
  const oGMap = callHrchyInfo.outgoingCall;

  const infos = Array.from(currDocSymbolInfo.globalDef.values()).flat().sort((a, b) => {
    return a.numRange[0] - b.numRange[0];
  });

  // iterate all globalDef as caller
  // for example a() {b, c}, `a` as the caller
  for (const info of infos) {
    const callerName = info.name;
    const callerSymbolStr = info.stringify;

    if (callHrchyItems.get(callerName) === undefined) {
      callHrchyItems.set(callerName, new Map([[callerSymbolStr, info.toCallHierarchyItem()]]));
    }
    const fromItem = callHrchyItems.get(callerName)?.get(callerSymbolStr);
    if (fromItem === undefined) {
      continue;
    }

    // isCalled is in this range
    // for example a() {b, c}, `b` and `c` are in the range
    const isCalledRange = info.symbolInPRange;
    if (isCalledRange === undefined) {
      continue;
    }

    if (!oGMap.has(callerName)) {
      oGMap.set(callerName, new Map<string, vscode.CallHierarchyOutgoingCall>());
    }

    const idxStart = bisectRight(globalOrderedRanges, isCalledRange[0], item => item[1][0]);
    const idxEnd = bisectRight(globalOrderedRanges, isCalledRange[1], item => item[1][0]);

    // find possible isCalleds ranges
    for (let i = idxStart; i < idxEnd; ++i) {
      visited.add(i);

      const isCalledRange = globalOrderedRanges[i];
      const realIsCalledRes = getRealIsCalled(isCalledRange, currDocSymbolInfo);
      if (realIsCalledRes === undefined) {
        continue;
      }
      buildEdgeForIsCalledRange(
        callHrchyInfo, realIsCalledRes,
        callerName, callerSymbolStr, fromItem
      );
    }

  }

  return visited;
}

function genAllCallHierarchyItems(
  currDocSymbolInfo: DocSymbolInfo, globalOrderedRanges: [string, [number, number]][]
): CallHrchyInfo {
  const callHrchyInfo: CallHrchyInfo = new CallHrchyInfo();
  const visited = genAllCallHierarchyItemsNonOrphan(
    callHrchyInfo, currDocSymbolInfo, globalOrderedRanges
  );

  // make the file as definition, that is,
  // make the file as caller
  const fileName = currDocSymbolInfo.document.uri.path.split('/').pop();
  const callerName = (fileName !== undefined) ? fileName : 'Untitled';
  const oGMap = callHrchyInfo.outgoingCall;
  if (!oGMap.has(callerName)) {
    oGMap.set(callerName, new Map<string, vscode.CallHierarchyOutgoingCall>());
  }

  // find isCalled ranges who is NOT visited. (orphans)
  for (let i = 0; i < globalOrderedRanges.length; ++i) {
    if (visited.has(i)) {
      continue;
    }

    const isCalledRange = globalOrderedRanges[i];
    const realIsCalledRes = getRealIsCalled(isCalledRange, currDocSymbolInfo);
    if (realIsCalledRes === undefined) {
      continue;
    }
    // only build IncomingCall Edge since the file cannot be called,
    // that is, cannot be `toItems`
    buildEdgeForIsCalledRange(
      callHrchyInfo, realIsCalledRes,
      callerName, undefined, undefined
    );
  }
  return callHrchyInfo;
}

export { genAllCallHierarchyItems };

