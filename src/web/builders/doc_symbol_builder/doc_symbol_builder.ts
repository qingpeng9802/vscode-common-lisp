import * as vscode from 'vscode';

import type { DocSymbolInfo } from '../../collect_user_symbol/DocSymbolInfo';
import type { ScanDocRes } from '../../collect_user_symbol/ScanDocRes';
import type { SymbolInfo } from '../../collect_user_symbol/SymbolInfo';
import { findMatchPairAfterP } from '../../collect_user_symbol/user_symbol_util';
import { bisectRight } from '../../common/algorithm';

function genAnonContainerNameNum(d: Map<string, number>, anonContainerName: string): number {
  // {anonymous container name, count}
  if (d.has(anonContainerName)) {
    d.set(anonContainerName, d.get(anonContainerName)! + 1);
  } else {
    d.set(anonContainerName, 1);
  }
  return d.get(anonContainerName)!;
}

// @sideEffect: SymbolInfo.numberedContainerName
function globalContainerToSymbolInfosDict(defs: Map<string, SymbolInfo[]>, containerName: string):
  Map<string, vscode.DocumentSymbol> {
  const res: Map<string, vscode.DocumentSymbol> = new Map<string, vscode.DocumentSymbol>();

  for (const [defName, info] of defs) {
    for (const item of info) {
      item.numberedContainerName = containerName;
      res.set(defName, new vscode.DocumentSymbol(defName, containerName, item.kind, item.loc.range, item.loc.range));
    }
  }

  return res;
}

// @sideEffect: SymbolInfo.numberedContainerName
function noValidContainerToSymbolInfosDict(defs: Map<string, SymbolInfo[]>, anonContainerNameDict: Map<string, number>): Map<string, vscode.DocumentSymbol> {
  const res: Map<string, vscode.DocumentSymbol> = new Map<string, vscode.DocumentSymbol>();

  for (const [defName, info] of defs) {
    for (const item of info) {
      const containerName = (item.containerName !== undefined) ?
        `${item.containerName}<${genAnonContainerNameNum(anonContainerNameDict, item.containerName)}>` :
        '';
      item.numberedContainerName = containerName;
      res.set(defName, new vscode.DocumentSymbol(defName, containerName, item.kind, item.loc.range, item.loc.range));
    }

  }

  return res;
}

// @sideEffect: SymbolInfo.numberedContainerName
function noValidContainerToSymbolInfos(defs: Map<string, SymbolInfo[]>, anonContainerNameDict: Map<string, number>): vscode.DocumentSymbol[] {
  const res: vscode.DocumentSymbol[] = [];

  for (const [defName, info] of defs) {
    for (const item of info) {
      const containerName = (item.containerName !== undefined) ?
        `${item.containerName}<${genAnonContainerNameNum(anonContainerNameDict, item.containerName)}>` :
        '';
      item.numberedContainerName = containerName;
      res.push(new vscode.DocumentSymbol(defName, containerName, item.kind, item.loc.range, item.loc.range));
    }

  }

  return res;
}

// @sideEffect: SymbolInfo.globalDefRange
function genSortedTopLevelScopes(scanDocRes: ScanDocRes, symbols: SymbolInfo[]): [string, [number, number]][] {
  const res: [string, [number, number]][] = [];
  for (const symbol of symbols) {
    const endInd = findMatchPairAfterP(symbol.numRange[0], scanDocRes.pair);
    symbol.globalDefRange = [symbol.numRange[0], endInd];
    res.push([symbol.name, symbol.globalDefRange]);
    //console.log(symbol.globalDefRange, symbol.scope);
  }

  res.sort((a, b) => a[1][0] - b[1][0]); // sort by range start
  return res;
}

function genDocumentSymbol(currDocSymbolInfo: DocSymbolInfo): vscode.DocumentSymbol[] {
  // for anonymous container name
  const anonContainerNameDict: Map<string, number> = new Map<string, number>();

  // start assgin
  const fileName = currDocSymbolInfo.document.uri.path.split('/').pop();
  const globalContainerName = (fileName !== undefined) ? fileName : 'Untitled';
  const globalDefSIDict = globalContainerToSymbolInfosDict(currDocSymbolInfo.globalDef, globalContainerName);
  for (const sInfos of currDocSymbolInfo.globalNamedLambda.values()) {
    for (const sInfo of sInfos) {
      if (sInfo.containerName === undefined) {
        continue;
      }
      globalDefSIDict.get(sInfo.containerName)!.children.push(
        new vscode.DocumentSymbol(
          sInfo.name, sInfo.containerName, vscode.SymbolKind.Variable, sInfo.loc.range, sInfo.loc.range
        )
      );
    }
  }

  const localDefSIDict = noValidContainerToSymbolInfosDict(currDocSymbolInfo.localDef, anonContainerNameDict);
  for (const sInfos of currDocSymbolInfo.localNamedLambda.values()) {
    for (const sInfo of sInfos) {
      if (sInfo.containerName === undefined) {
        continue;
      }
      localDefSIDict.get(sInfo.containerName)!.children.push(
        new vscode.DocumentSymbol(
          sInfo.name, sInfo.containerName, vscode.SymbolKind.Variable, sInfo.loc.range, sInfo.loc.range
        )
      );
    }
  }

  // wild vars
  const localAnonLambdaSIs = noValidContainerToSymbolInfos(currDocSymbolInfo.localAnonLambda, anonContainerNameDict);
  const localAnonSingleSIs = noValidContainerToSymbolInfos(currDocSymbolInfo.localAnonSingle, anonContainerNameDict);

  // try to append wild vars to parent scope from down to top ----------------------------------------------------------
  let headVars: vscode.DocumentSymbol[] = [...localAnonLambdaSIs, ...localAnonSingleSIs];
  let restVars: vscode.DocumentSymbol[] = [];

  const topLevelLocalDefs = Array.from(currDocSymbolInfo.localDef.values()).flat();
  const topLevelLocalScopes = genSortedTopLevelScopes(currDocSymbolInfo.docRes, topLevelLocalDefs);

  for (const si of headVars) {
    const siStart = currDocSymbolInfo.document.offsetAt(si.range.start);
    const siEnd = currDocSymbolInfo.document.offsetAt(si.range.end);

    let idx = bisectRight(topLevelLocalScopes, siStart, item => item[1][0]);
    while (idx > 0) {
      const topLevelLocalScopesLast = topLevelLocalScopes[idx - 1];
      const [lastScopeDefName, lastScope] = topLevelLocalScopesLast;
      const [lastScopeStart, lastScopeEnd] = lastScope;

      if (lastScopeStart <= siStart && siEnd <= lastScopeEnd) {
        localDefSIDict.get(lastScopeDefName)!.children.push(si);
        break;
      } else {
        idx--;
      }
    }
    if (idx === 0) {
      restVars.push(si);
    }
  }

  headVars = [...localDefSIDict.values(), ...restVars];
  restVars = [];

  const topLevelDefs = Array.from(currDocSymbolInfo.globalDef.values()).flat();
  const topLevelScopes = genSortedTopLevelScopes(currDocSymbolInfo.docRes, topLevelDefs);
  for (const si of headVars) {
    const siStart = currDocSymbolInfo.document.offsetAt(si.range.start);
    const siEnd = currDocSymbolInfo.document.offsetAt(si.range.end);

    let idx = bisectRight(topLevelScopes, currDocSymbolInfo.document.offsetAt(si.range.start), item => item[1][0]);
    while (idx > 0) {
      const topLevelScopesLast = topLevelScopes[idx - 1];
      const [lastScopeDefName, lastScope] = topLevelScopesLast;
      const [lastScopeStart, lastScopeEnd] = lastScope;

      if (lastScopeStart <= siStart && siEnd <= lastScopeEnd) {
        globalDefSIDict.get(lastScopeDefName)!.children.push(si);
        break;
      } else {
        idx--;
      }
    }
    if (idx === 0) {
      restVars.push(si);
    }
  }

  return [
    ...globalDefSIDict.values(),
    ...restVars
  ];
}

export { genDocumentSymbol };
