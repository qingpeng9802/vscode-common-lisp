import type * as vscode from 'vscode';

import type { SymbolInfo } from '../../collect_info/SymbolInfo';
import { bisectRight } from '../../common/algorithm';
import type { DocSymbolInfo } from '../DocSymbolInfo';
import { findMatchPairAfterP } from '../builders_util';

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
  defs: Map<string, SymbolInfo[]>, numberedContainerName: string
): Map<string, vscode.DocumentSymbol> {
  const res: Map<string, vscode.DocumentSymbol> = new Map<string, vscode.DocumentSymbol>();

  for (const [defName, info] of defs) {
    for (const item of info) {
      res.set(defName, item.toDocumentSymbol(numberedContainerName));
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
      const numberedContainerName = (item.containerName !== undefined) ?
        `${item.containerName}<${genAnonContainerNameNum(anonContainerNameDict, item.containerName)}>` :
        '';
      res.set(defName, item.toDocumentSymbol(numberedContainerName));
    }

  }

  return res;
}

// @sideEffect: SymbolInfo.numberedContainerName
function noValidContainerToDocumentSymbol(
  defs: Map<string, SymbolInfo[]>, anonContainerNameDict: Map<string, number>
): vscode.DocumentSymbol[] {
  const res: vscode.DocumentSymbol[] = [];

  for (const info of defs.values()) {
    for (const item of info) {
      const numberedContainerName = (item.containerName !== undefined) ?
        `${item.containerName}<${genAnonContainerNameNum(anonContainerNameDict, item.containerName)}>` :
        '';
      res.push(item.toDocumentSymbol(numberedContainerName));
    }

  }

  return res;
}

// @sideEffect: SymbolInfo.symbolInPRange
function genSortedTopLevelScopes(pair: [number, number][], symbols: SymbolInfo[]): [string, [number, number]][] {
  const res: [string, [number, number]][] = [];
  for (const symbol of symbols) {
    const endInd = findMatchPairAfterP(symbol.numRange[0], pair);
    symbol.symbolInPRange = [symbol.numRange[0], endInd];
    res.push([symbol.name, symbol.symbolInPRange]);
    //console.log(symbol.symbolInPRange, symbol.scope);
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
      const containerDocumentSymbol = globalDefSIDict.get(sInfo.containerName);
      if (containerDocumentSymbol === undefined) {
        //console.warn(`cannot find containerDocumentSymbol with global name: ${sInfo.containerName}`);
        continue;
      }
      containerDocumentSymbol.children.push(sInfo.toDocumentSymbol());
    }
  }

  // local
  const localDefSIDict = noValidContainerToDocumentSymbolDict(currDocSymbolInfo.localDef, anonContainerNameDict);
  for (const sInfos of currDocSymbolInfo.localNamedLambda.values()) {
    for (const sInfo of sInfos) {
      if (sInfo.containerName === undefined) {
        continue;
      }
      const containerDocumentSymbol = localDefSIDict.get(sInfo.containerName);
      if (containerDocumentSymbol === undefined) {
        //console.warn(`cannot find containerDocumentSymbol with local name: ${sInfo.containerName}`);
        continue;
      }
      containerDocumentSymbol.children.push(sInfo.toDocumentSymbol());
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
  const topLevelScopes = genSortedTopLevelScopes(currDocSymbolInfo.docRes.pair, topLevelDefs);

  for (const si of localAnonVarDSs) {
    const siStart = currDocSymbolInfo.document.offsetAt(si.range.start);
    const siEnd = currDocSymbolInfo.document.offsetAt(si.range.end);

    let idx = bisectRight(topLevelScopes, siStart, item => item[1][0]);
    while (idx > 0) {
      const topLevelScopesLast = topLevelScopes[idx - 1];
      const [lastScopeDefName, lastScope] = topLevelScopesLast;
      const [lastScopeStart, lastScopeEnd] = lastScope;

      if (lastScopeStart <= siStart && siEnd <= lastScopeEnd) {
        const lastScopeDocumentSymbol = localDefSIDict.get(lastScopeDefName);
        if (lastScopeDocumentSymbol === undefined) {
          idx--;
          continue;
        }

        lastScopeDocumentSymbol.children.push(si);
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
