import * as vscode from 'vscode';

const vscodeCIKindToVscodeCIKind: Map<vscode.SymbolKind, vscode.CompletionItemKind> =
  new Map<vscode.SymbolKind, vscode.CompletionItemKind>([
    [vscode.SymbolKind.File, vscode.CompletionItemKind.File],
    [vscode.SymbolKind.Module, vscode.CompletionItemKind.Module],
    // no direct mapping
    [vscode.SymbolKind.Namespace, vscode.CompletionItemKind.Module],
    // no direct mapping
    [vscode.SymbolKind.Package, vscode.CompletionItemKind.Module],
    [vscode.SymbolKind.Class, vscode.CompletionItemKind.Class],
    [vscode.SymbolKind.Method, vscode.CompletionItemKind.Method],
    [vscode.SymbolKind.Property, vscode.CompletionItemKind.Property],
    [vscode.SymbolKind.Field, vscode.CompletionItemKind.Field],
    [vscode.SymbolKind.Constructor, vscode.CompletionItemKind.Constructor],
    [vscode.SymbolKind.Enum, vscode.CompletionItemKind.Enum],
    [vscode.SymbolKind.Interface, vscode.CompletionItemKind.Interface],
    [vscode.SymbolKind.Function, vscode.CompletionItemKind.Function],
    [vscode.SymbolKind.Variable, vscode.CompletionItemKind.Variable],
    [vscode.SymbolKind.Constant, vscode.CompletionItemKind.Constant],
    // no direct mapping
    [vscode.SymbolKind.String, vscode.CompletionItemKind.Variable],
    // no direct mapping
    [vscode.SymbolKind.Number, vscode.CompletionItemKind.Variable],
    // no direct mapping
    [vscode.SymbolKind.Boolean, vscode.CompletionItemKind.Variable],
    // no direct mapping
    [vscode.SymbolKind.Array, vscode.CompletionItemKind.Variable],
    // no direct mapping
    [vscode.SymbolKind.Object, vscode.CompletionItemKind.Variable],
    // no direct mapping
    [vscode.SymbolKind.Key, vscode.CompletionItemKind.Variable],
    // no direct mapping
    [vscode.SymbolKind.Null, vscode.CompletionItemKind.Keyword],
    [vscode.SymbolKind.EnumMember, vscode.CompletionItemKind.EnumMember],
    [vscode.SymbolKind.Struct, vscode.CompletionItemKind.Struct],
    [vscode.SymbolKind.Event, vscode.CompletionItemKind.Event],
    [vscode.SymbolKind.Operator, vscode.CompletionItemKind.Operator],
    [vscode.SymbolKind.TypeParameter, vscode.CompletionItemKind.TypeParameter],

  ]);

class SymbolInfo {
  private readonly document: vscode.TextDocument;
  public readonly uri: vscode.Uri;

  public readonly name: string;
  public readonly containerName: string | undefined;
  // if has scope, this symbol is valid only if the symbol is in scope
  public readonly scope: [number, number] | undefined;
  public readonly kind: vscode.SymbolKind;
  public readonly numRange: [number, number];
  public readonly docStr: string | undefined;

  private _startPos: vscode.Position | undefined = undefined;
  private _range: vscode.Range | undefined = undefined;
  private _loc: vscode.Location | undefined = undefined;
  private _stringify: string | undefined = undefined;

  private numberedContainerName: string | undefined = undefined;
  public symbolInPRange: [number, number] | undefined = undefined;

  constructor(
    document: vscode.TextDocument,
    name: string,
    containerName: string | undefined,
    scope: [number, number] | undefined,
    kind: vscode.SymbolKind,
    numRange: [number, number],
    docStr: string | undefined = undefined
  ) {

    this.document = document;
    this.uri = document.uri;

    this.name = name;
    this.containerName = containerName;
    this.scope = scope;
    this.kind = kind;
    this.numRange = numRange;
    this.docStr = docStr;
  }

  get startPos() {
    if (this._startPos === undefined) {
      this._startPos = this.document.positionAt(this.numRange[0]);
    }
    return this._startPos;
  }

  get range() {
    if (this._range === undefined) {
      this._range = new vscode.Range(
        this.startPos,
        this.document.positionAt(this.numRange[1]),
      );
    }
    return this._range;
  }

  get loc() {
    if (this._loc === undefined) {
      this._loc = new vscode.Location(this.uri, this.range);
    }
    return this._loc;
  }

  get stringify() {
    if (this._stringify === undefined) {
      this._stringify = `${this.name}|${this.uri.path}|${this.range.start.line},${this.range.start.character},${this.range.end.line},${this.range.end.character}`;
    }
    return this._stringify;
  }

  public toCompletionItem(): vscode.CompletionItem {
    const citemLabel: vscode.CompletionItemLabel = {
      label: this.name,
      // in doc_symbol_builder.ts, numberedContainerName will not be assigned if no need
      description: (this.numberedContainerName !== undefined) ?
        this.numberedContainerName : this.containerName,
    };

    return new vscode.CompletionItem(citemLabel, vscodeCIKindToVscodeCIKind.get(this.kind));
  }

  public toCallHierarchyItem(): vscode.CallHierarchyItem {
    const detail =
      (this.numberedContainerName !== undefined) ?
        this.numberedContainerName :
        ((this.containerName !== undefined) ? this.containerName : '');

    return new vscode.CallHierarchyItem(
      this.kind,
      this.name,
      detail,
      this.uri,
      this.range,
      this.range
    );
  }

  public toDocumentSymbol(
    numberedContainerName: string | undefined = undefined
  ): vscode.DocumentSymbol {
    if (numberedContainerName !== undefined) {
      this.numberedContainerName = numberedContainerName;
      return new vscode.DocumentSymbol(
        this.name,
        numberedContainerName,
        this.kind, this.range, this.range
      );
    }

    if (this.containerName === undefined) {
      // console.warn('`this.containerName` cannot be undefined');
    }
    return new vscode.DocumentSymbol(
      this.name,
      this.containerName!,
      this.kind, this.range, this.range
    );
  }

}

export { SymbolInfo };
