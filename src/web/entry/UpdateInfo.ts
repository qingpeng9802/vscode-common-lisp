import * as vscode from 'vscode';

import { CallHrchyInfo } from '../call_hierarchy_provider/CallHrchyInfo';
import { UserSymbols } from '../comp_item_provider/UserSymbols';
import { DocSymbolInfo } from '../user_symbol/DocSymbolInfo';

class UpdateInfo {
  public currDocSymbolInfo: DocSymbolInfo | undefined = undefined;
  public currDocumentSymbol: vscode.DocumentSymbol[] = [];
  public currUserSymbols: UserSymbols | undefined = undefined;
  public currSemanticTokens: vscode.SemanticTokens | undefined = undefined;
  public prevSemanticTokens: vscode.SemanticTokens | undefined = undefined;
  public callHierarchyInfo: CallHrchyInfo | undefined = undefined;

  // optimization: use [number, number] to avoid `positionAt` overhead
  public needColorDict: Record<string, [number, number][]> = {};
  public globalOrderedRanges: [string, [number, number]][] = [];

  constructor() {

  }
}

export { UpdateInfo };
