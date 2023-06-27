import type * as vscode from 'vscode';

class ParsedToken {
  public readonly startPos: vscode.Position;
  public readonly len: number;
  public readonly tokenType: string;
  public readonly tokenModifiers: string[];

  constructor(
    startPos: vscode.Position,
    len: number,
    tokenType: string,
    tokenModifiers: string[]
  ) {
    this.startPos = startPos;
    this.len = len;
    this.tokenType = tokenType;
    this.tokenModifiers = tokenModifiers;
  }

}

