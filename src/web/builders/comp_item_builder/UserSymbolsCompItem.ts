import type * as vscode from 'vscode';

class UserSymbolsCompItem {
  public readonly globalCItems: vscode.CompletionItem[];
  public readonly localScopeCItems: [vscode.CompletionItem, [number, number]][];

  constructor(
    globalCItems: vscode.CompletionItem[],
    localScopeCItems: [vscode.CompletionItem, [number, number]][],

  ) {
    this.globalCItems = globalCItems;
    this.localScopeCItems = localScopeCItems;
  }

}

export { UserSymbolsCompItem };
