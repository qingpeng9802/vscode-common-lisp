import type * as vscode from 'vscode';

class SymbolInfo {
  public readonly name: string;
  public readonly containerName: string | undefined;
  // if has scope, this symbol is valid only if the symbol is in scope
  public readonly scope: [number, number] | undefined;
  public readonly loc: vscode.Location;
  public readonly kind: vscode.SymbolKind;
  public readonly numRange: [number, number];

  public numberedContainerName: string | undefined;
  public globalDefRange: [number, number] | undefined;

  constructor(
    name: string,
    containerName: string | undefined,
    scope: [number, number] | undefined,
    loc: vscode.Location,
    kind: vscode.SymbolKind,
    numRange: [number, number]
  ) {

    this.name = name;
    this.containerName = containerName;
    this.scope = scope;
    this.loc = loc;
    this.kind = kind;
    this.numRange = numRange;
  }

  public stringify(): string {
    return `${this.name}|${this.loc.uri.path}|${this.loc.range.start.line},${this.loc.range.start.character},${this.loc.range.end.line},${this.loc.range.end.character}`;
  }

}

export { SymbolInfo };
