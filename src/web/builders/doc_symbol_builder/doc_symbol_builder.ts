import * as vscode from 'vscode';

import type { DocSymbolInfo } from '../../collect_user_symbol/DocSymbolInfo';
import type { SymbolInfo } from '../../collect_user_symbol/SymbolInfo';
import { findMatchPairParenthese } from '../../collect_user_symbol/pair_parser';
import { bisectRight } from '../../common/algorithm';

function genAnonContainerNameNum(d: Record<string, number>, anonContainerName: string): number {
  // {anonymous container name, count}
  if (Object.hasOwn(d, anonContainerName)) {
    d[anonContainerName] += 1;
  } else {
    d[anonContainerName] = 1;
  }
  return d[anonContainerName];
}

// @sideEffect: SymbolInfo.numberedContainerName
function globalContainerToSymbolInfosDict(defs: Record<string, SymbolInfo[]>, containerName: string):
  Record<string, vscode.DocumentSymbol> {
  const res: Record<string, vscode.DocumentSymbol> = {};

  for (const [defName, info] of Object.entries(defs)) {
    for (const item of info) {
      item.numberedContainerName = containerName;
      res[defName] = new vscode.DocumentSymbol(defName, containerName, item.kind, item.loc.range, item.loc.range);
    }
  }

  return res;
}

// @sideEffect: SymbolInfo.numberedContainerName
function noValidContainerToSymbolInfosDict(defs: Record<string, SymbolInfo[]>, anonContainerNameDict: Record<string, number>): Record<string, vscode.DocumentSymbol> {
  const res: Record<string, vscode.DocumentSymbol> = {};

  for (const [defName, info] of Object.entries(defs)) {
    for (const item of info) {
      const containerName = (item.containerName !== undefined) ?
        `${item.containerName}<${genAnonContainerNameNum(anonContainerNameDict, item.containerName)}>` :
        '';
      item.numberedContainerName = containerName;
      res[defName] = new vscode.DocumentSymbol(defName, containerName, item.kind, item.loc.range, item.loc.range);
    }

  }

  return res;
}

// @sideEffect: SymbolInfo.numberedContainerName
function noValidContainerToSymbolInfos(defs: Record<string, SymbolInfo[]>, anonContainerNameDict: Record<string, number>): vscode.DocumentSymbol[] {
  const res: vscode.DocumentSymbol[] = [];

  for (const [defName, info] of Object.entries(defs)) {
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
function genSortedTopLevelScopes(text: string, symbols: SymbolInfo[]): [string, [number, number]][] {
  const res: [string, [number, number]][] = [];
  for (const symbol of symbols) {
    const endInd = findMatchPairParenthese(symbol.numRange[0], text);
    symbol.globalDefRange = [symbol.numRange[0], endInd];
    res.push([symbol.name, symbol.globalDefRange]);
  }

  res.sort((a, b) => a[1][0] - b[1][0]);
  return res;
}

function genDocumentSymbol(currDocSymbolInfo: DocSymbolInfo): vscode.DocumentSymbol[] {
  // for anonymous container name
  const anonContainerNameDict: Record<string, number> = {};

  // start assgin
  const fileName = currDocSymbolInfo.document.uri.path.split('/').pop();
  const globalContainerName = (fileName !== undefined) ? fileName : 'Untitled';
  const globalDefSIDict = globalContainerToSymbolInfosDict(currDocSymbolInfo.globalDef, globalContainerName);
  for (const sInfos of Object.values(currDocSymbolInfo.globalNamedLambda)) {
    for (const sInfo of sInfos) {
      if (sInfo.containerName === undefined) {
        continue;
      }
      globalDefSIDict[sInfo.containerName].children.push(
        new vscode.DocumentSymbol(
          sInfo.name, sInfo.containerName, vscode.SymbolKind.Variable, sInfo.loc.range, sInfo.loc.range
        )
      );
    }
  }

  const localDefSIDict = noValidContainerToSymbolInfosDict(currDocSymbolInfo.localDef, anonContainerNameDict);
  for (const sInfos of Object.values(currDocSymbolInfo.localNamedLambda)) {
    for (const sInfo of sInfos) {
      if (sInfo.containerName === undefined) {
        continue;
      }
      localDefSIDict[sInfo.containerName].children.push(
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

  const topLevelLocalDefs = Object.values(currDocSymbolInfo.localDef).flat();
  const topLevelLocalScopes = genSortedTopLevelScopes(currDocSymbolInfo.docRes.text, topLevelLocalDefs);

  for (const si of headVars) {
    const siStart = currDocSymbolInfo.document.offsetAt(si.range.start);
    const siEnd = currDocSymbolInfo.document.offsetAt(si.range.end);

    let idx = bisectRight(topLevelLocalScopes, siStart, item => item[1][0]);

    while (idx > 0) {
      if (
        topLevelLocalScopes[idx - 1][1][0] <= siStart &&
        siEnd <= topLevelLocalScopes[idx - 1][1][1]

      ) {
        const defName = topLevelLocalScopes[idx - 1][0];
        localDefSIDict[defName].children.push(si);
        break;
      } else { idx--; }
    }
    if (idx === 0) {
      restVars.push(si);
    }
  }

  headVars = [...Object.values(localDefSIDict), ...restVars];
  restVars = [];

  const topLevelDefs = Object.values(currDocSymbolInfo.globalDef).flat();
  const topLevelScopes = genSortedTopLevelScopes(currDocSymbolInfo.docRes.text, topLevelDefs);
  for (const si of headVars) {
    const siStart = currDocSymbolInfo.document.offsetAt(si.range.start);
    const siEnd = currDocSymbolInfo.document.offsetAt(si.range.end);

    let idx = bisectRight(topLevelScopes, currDocSymbolInfo.document.offsetAt(si.range.start), item => item[1][0]);

    while (idx > 0) {
      if (
        topLevelScopes[idx - 1][1][0] <= siStart &&
        siEnd <= topLevelScopes[idx - 1][1][1]

      ) {
        const defName = topLevelScopes[idx - 1][0];
        globalDefSIDict[defName].children.push(si);
        break;
      } else { idx--; }
    }
    if (idx === 0) {
      restVars.push(si);
    }
  }

  return [
    ...Object.values(globalDefSIDict),
    ...restVars
  ];
}

export { genDocumentSymbol };
