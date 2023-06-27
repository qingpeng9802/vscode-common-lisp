import * as vscode from 'vscode';

import type { DocSymbolInfo } from '../../collect_info/DocSymbolInfo';
import type { ScanDocRes } from '../../collect_info/ScanDocRes';
import type { SymbolInfo } from '../../collect_info/SymbolInfo';
import { findMatchPairAfterP } from '../../collect_info/collect_util';
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
function globalContainerToDocumentSymbolDict(
  defs: Map<string, SymbolInfo[]>, containerName: string
): Map<string, vscode.DocumentSymbol> {
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
function noValidContainerToDocumentSymbolDict(
  defs: Map<string, SymbolInfo[]>, anonContainerNameDict: Map<string, number>
): Map<string, vscode.DocumentSymbol> {
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
function noValidContainerToDocumentSymbol(
  defs: Map<string, SymbolInfo[]>, anonContainerNameDict: Map<string, number>
): vscode.DocumentSymbol[] {
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

  const [globalDefSIDict, localDefSIDict] =
    withNamedContainerToDocumentSymbolDict(currDocSymbolInfo, anonContainerNameDict);

  // collect wild vars (vars without valid container)
  const localAnonLambdaVarDSs =
    noValidContainerToDocumentSymbol(currDocSymbolInfo.localAnonLambda, anonContainerNameDict);
  const localAnonSingleVarDSs =
    noValidContainerToDocumentSymbol(currDocSymbolInfo.localAnonSingle, anonContainerNameDict);
  const localAnonVarDSs = [...localAnonLambdaVarDSs, ...localAnonSingleVarDSs];

  // try local as parent
  const restlocalAnonVarDSs1 =
    tryAppendVarsToParentScope(
      currDocSymbolInfo, localAnonVarDSs, localDefSIDict, currDocSymbolInfo.localDef
    );
  const restlocalAnonVarDSs2 = [...localDefSIDict.values(), ...restlocalAnonVarDSs1];

  // try global as parent
  const restlocalAnonVarDSs3 =
    tryAppendVarsToParentScope(
      currDocSymbolInfo, restlocalAnonVarDSs2, globalDefSIDict, currDocSymbolInfo.globalDef
    );

  return [...globalDefSIDict.values(), ...restlocalAnonVarDSs3];
}

function withNamedContainerToDocumentSymbolDict(
  currDocSymbolInfo: DocSymbolInfo, anonContainerNameDict: Map<string, number>
) {
  // start assgin
  // global
  const fileName = currDocSymbolInfo.document.uri.path.split('/').pop();
  const globalContainerName = (fileName !== undefined) ? fileName : 'Untitled';
  const globalDefSIDict = globalContainerToDocumentSymbolDict(currDocSymbolInfo.globalDef, globalContainerName);
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

  // local
  const localDefSIDict = noValidContainerToDocumentSymbolDict(currDocSymbolInfo.localDef, anonContainerNameDict);
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

  return [globalDefSIDict, localDefSIDict];
}

function tryAppendVarsToParentScope(
  currDocSymbolInfo: DocSymbolInfo, localAnonVarDSs: vscode.DocumentSymbol[],
  localDefSIDict: Map<string, vscode.DocumentSymbol>, def: Map<string, SymbolInfo[]>
) {
  // try to append wild vars to parent scope from down to top
  const restlocalAnonVarDSs: vscode.DocumentSymbol[] = [];

  const topLevelDefs = Array.from(def.values()).flat();
  const topLevelScopes = genSortedTopLevelScopes(currDocSymbolInfo.docRes, topLevelDefs);

  for (const si of localAnonVarDSs) {
    const siStart = currDocSymbolInfo.document.offsetAt(si.range.start);
    const siEnd = currDocSymbolInfo.document.offsetAt(si.range.end);

    let idx = bisectRight(topLevelScopes, siStart, item => item[1][0]);
    while (idx > 0) {
      const topLevelScopesLast = topLevelScopes[idx - 1];
      const [lastScopeDefName, lastScope] = topLevelScopesLast;
      const [lastScopeStart, lastScopeEnd] = lastScope;

      if (lastScopeStart <= siStart && siEnd <= lastScopeEnd) {
        localDefSIDict.get(lastScopeDefName)!.children.push(si);
        break;
      } else {
        idx--;
      }
    }
    if (idx === 0) {
      restlocalAnonVarDSs.push(si);
    }
  }
  return restlocalAnonVarDSs;
}

export { genDocumentSymbol };
