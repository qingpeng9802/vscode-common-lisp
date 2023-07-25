import type * as vscode from 'vscode';

class CallHrchyInfo {
  // {name, {stringify, item}}
  public readonly callHrchyItems: Map<string, Map<string, vscode.CallHierarchyItem>> =
    new Map<string, Map<string, vscode.CallHierarchyItem>>();

  // {name, {stringify, item}}
  public readonly incomingCall: Map<string, Map<string, vscode.CallHierarchyIncomingCall>> =
    new Map<string, Map<string, vscode.CallHierarchyIncomingCall>>();

  // {name, {stringify, item}}
  public readonly outgoingCall: Map<string, Map<string, vscode.CallHierarchyOutgoingCall>> =
    new Map<string, Map<string, vscode.CallHierarchyOutgoingCall>>();

  constructor() {
  }
}

export { CallHrchyInfo };
