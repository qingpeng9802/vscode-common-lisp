import type * as vscode from 'vscode';

class CallHrchyInfo {
  // {name, {stringify, item}}
  public readonly callHrchyItems: Map<string, Map<string, vscode.CallHierarchyItem>>;
  // {name, {stringify, item}}
  public readonly incomingCall: Map<string, Map<string, vscode.CallHierarchyIncomingCall>>;
  // {name, {stringify, item}}
  public readonly outgoingCall: Map<string, Map<string, vscode.CallHierarchyOutgoingCall>>;

  constructor(
    callHrchyItems: Map<string, Map<string, vscode.CallHierarchyItem>>,
    incomingCall: Map<string, Map<string, vscode.CallHierarchyIncomingCall>>,
    outgoingCall: Map<string, Map<string, vscode.CallHierarchyOutgoingCall>>
  ) {
    this.callHrchyItems = callHrchyItems;
    this.incomingCall = incomingCall;
    this.outgoingCall = outgoingCall;
  }
}

export { CallHrchyInfo };
