import * as vscode from 'vscode';

class OriSymbolsCompItem {
  public readonly oriSymbols: vscode.CompletionItem[];

  public readonly afterAmpersand: vscode.CompletionItem[];
  public readonly afterAsterisk: vscode.CompletionItem[];

  public readonly afterColon: vscode.CompletionItem[];
  public readonly afterTilde: vscode.CompletionItem[];
  public readonly afterSharpsign: vscode.CompletionItem[];

  constructor(
    oriSymbols: vscode.CompletionItem[],
    afterAmpersand: vscode.CompletionItem[],
    afterAsterisk: vscode.CompletionItem[],
    afterColon: vscode.CompletionItem[],
    afterTilde: vscode.CompletionItem[],
    afterSharpsign: vscode.CompletionItem[]
  ) {

    this.oriSymbols = oriSymbols;
    this.afterAmpersand = afterAmpersand;
    this.afterAsterisk = afterAsterisk;
    this.afterColon = afterColon;
    this.afterTilde = afterTilde;
    this.afterSharpsign = afterSharpsign;
  }
}

export { OriSymbolsCompItem };
