import * as vscode from 'vscode';

import type { DocSymbolInfo } from '../../builders/DocSymbolInfo';
import type { CallHrchyInfo } from '../../builders/call_hierarchy_builder/CallHrchyInfo';
import { CL_MODE } from '../../common/cl_util';
import { TriggerProvider } from '../../common/enum';
import { TriggerEvent } from '../TriggerEvent';
import { getCLWordRangeAtPosition } from '../provider_util';
import { structuredInfo } from '../structured_info';

function getCallHierarchyCallsByCallHierarchyItem(
  item: vscode.CallHierarchyItem, callHierarchyCallsDict: Map<string, Map<string, vscode.CallHierarchyOutgoingCall>>
): vscode.CallHierarchyOutgoingCall[];
function getCallHierarchyCallsByCallHierarchyItem(
  item: vscode.CallHierarchyItem, callHierarchyCallsDict: Map<string, Map<string, vscode.CallHierarchyIncomingCall>>
): vscode.CallHierarchyIncomingCall[];
function getCallHierarchyCallsByCallHierarchyItem(
  item: vscode.CallHierarchyItem,
  callHierarchyCallsDict: Map<string, Map<string, vscode.CallHierarchyIncomingCall | vscode.CallHierarchyOutgoingCall>>
): (vscode.CallHierarchyIncomingCall | vscode.CallHierarchyOutgoingCall)[] {

  const callHierarchyItemStr = `${item.name}|${item.uri.path}|${item.range.start.line},${item.range.start.character},${item.range.end.line},${item.range.end.character}`;
  const callHierarchyCallDict = callHierarchyCallsDict.get(item.name);
  if (callHierarchyCallDict === undefined) {
    return [];
  }
  const res = callHierarchyCallDict.get(callHierarchyItemStr);
  return (res !== undefined) ? [res] : [];
}

function getCallHrchyItems(
  currDocSymbolInfo: DocSymbolInfo, range: vscode.Range, currCallHierarchyInfo: CallHrchyInfo
): vscode.CallHierarchyItem | vscode.CallHierarchyItem[] {

  const word = currDocSymbolInfo.document.getText(range);
  const queryStr = `${word}|${currDocSymbolInfo.document.uri.path}|${range.start.line},${range.start.character},${range.end.line},${range.end.character}`;

  const itemD = currCallHierarchyInfo.callHrchyItems.get(word);
  if (itemD === undefined) {
    return [];
  }
  const res = itemD.get(queryStr);
  return (res !== undefined) ? res : [];
}

function registerCallHierarchyProvider() {

  const callHierarchyProvider = vscode.languages.registerCallHierarchyProvider(
    CL_MODE,
    {
      prepareCallHierarchy(document, position, token) {
        const range = getCLWordRangeAtPosition(document, position);
        if (range === undefined) {
          return undefined;
        }

        structuredInfo.updateInfoByDoc(document, new TriggerEvent(TriggerProvider.prepareCallHierarchy));
        if (structuredInfo.currDocSymbolInfo === undefined || structuredInfo.currCallHierarchyInfo === undefined) {
          return undefined;
        }

        const res = getCallHrchyItems(structuredInfo.currDocSymbolInfo, range, structuredInfo.currCallHierarchyInfo);
        return res;
      },

      provideCallHierarchyIncomingCalls(item, token) {
        if (structuredInfo.currCallHierarchyInfo === undefined) {
          return undefined;
        }

        const res = getCallHierarchyCallsByCallHierarchyItem(item, structuredInfo.currCallHierarchyInfo.incomingCall);
        return res;
      },
      provideCallHierarchyOutgoingCalls(item, token) {
        if (structuredInfo.currCallHierarchyInfo === undefined) {
          return undefined;
        }

        const res = getCallHierarchyCallsByCallHierarchyItem(item, structuredInfo.currCallHierarchyInfo.outgoingCall);
        return res;
      }
    }
  );

  return callHierarchyProvider;
}

export { registerCallHierarchyProvider };
