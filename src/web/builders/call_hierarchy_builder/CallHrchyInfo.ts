import type * as vscode from 'vscode';

class CallHrchyInfo {
  // {name, {stringify, item}}
  public readonly callHrchyItems: Record<string, Record<string, vscode.CallHierarchyItem>>;
  // {name, {stringify, item}}
  public readonly incomingCall: Record<string, Record<string, vscode.CallHierarchyIncomingCall>>;
  // {name, {stringify, item}}
  public readonly outgoingCall: Record<string, Record<string, vscode.CallHierarchyOutgoingCall>>;

  constructor(
    callHrchyItems: Record<string, Record<string, vscode.CallHierarchyItem>>,
    incomingCall: Record<string, Record<string, vscode.CallHierarchyIncomingCall>>,
    outgoingCall: Record<string, Record<string, vscode.CallHierarchyOutgoingCall>>
  ) {
    this.callHrchyItems = callHrchyItems;
    this.incomingCall = incomingCall;
    this.outgoingCall = outgoingCall;
  }
}

export { CallHrchyInfo };
