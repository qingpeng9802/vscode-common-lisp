import * as vscode from 'vscode';

import type { DocSymbolInfo } from '../../collect_user_symbol/DocSymbolInfo';
import type { SymbolInfo } from '../../collect_user_symbol/SymbolInfo';
import { isRangeIntExcludedRanges } from '../../collect_user_symbol/user_symbol_util';
import { bisectRight } from '../../common/algorithm';

import type { ParsedToken } from './ParsedToken';

const tokenTypes = new Map<string, number>();
const tokenModifiers = new Map<string, number>();

const legend = getLegend();

function getLegend() {
  const tokenTypesLegend: string[] = [
    'namespace',
    'class',
    'enum',
    'interface',
    'struct',
    'typeParameter',
    'type',
    'parameter',
    'variable',
    'property',
    'enumMember',
    'decorator',
    'event',
    'function',
    'method',
    'macro',
    'label',
    'comment',
    'string',
    'keyword',
    'number',
    'regexp',
    'operator',
    '' // placeholder for unknown
  ];

  const tokenModifiersLegend: string[] = [
    'declaration',
    'definition',
    'readonly',
    'static',
    'deprecated',
    'abstract',
    'async',
    'modification',
    'documentation',
    'defaultLibrary',
  ];

  tokenTypesLegend.forEach((tokenType, index) => tokenTypes.set(tokenType, index));
  tokenModifiersLegend.forEach((tokenModifier, index) => tokenModifiers.set(tokenModifier, index));

  return new vscode.SemanticTokensLegend(tokenTypesLegend, tokenModifiersLegend);
}

// https://github.com/microsoft/vscode-extension-samples/blob/main/semantic-tokens-sample/src/extension.ts#L45-L65
function _encodeTokenType(tokenType: string): number {
  if (tokenTypes.has(tokenType)) {
    return tokenTypes.get(tokenType)!;
  } else if (tokenType === 'notInLegend') {
    return tokenTypes.size + 2;
  }
  return 0;
}

function _encodeTokenModifiers(strTokenModifiers: string[]): number {
  let result = 0;
  for (const tokenModifier of strTokenModifiers) {
    if (tokenModifiers.has(tokenModifier)) {
      result = result | (1 << tokenModifiers.get(tokenModifier)!);
    } else if (tokenModifier === 'notInLegend') {
      result = result | (1 << tokenModifiers.size + 2);
    }
  }
  return result;
}

const vscodeKindToTokenType: Map<vscode.SymbolKind, string | [string, string[]]> = new Map<vscode.SymbolKind, string | [string, string[]]>([
  // no direct mapping
  [vscode.SymbolKind.File, 'variable'],
  // no direct mapping
  [vscode.SymbolKind.Module, 'namespace'],
  [vscode.SymbolKind.Namespace, 'namespace'],
  // no direct mapping
  [vscode.SymbolKind.Package, 'type'],
  [vscode.SymbolKind.Class, 'class'],
  [vscode.SymbolKind.Method, 'method'],
  [vscode.SymbolKind.Property, 'property'],
  [vscode.SymbolKind.Field, ''],
  [vscode.SymbolKind.Constructor, ''],
  [vscode.SymbolKind.Enum, 'enum'],
  [vscode.SymbolKind.Interface, 'interface'],
  [vscode.SymbolKind.Function, 'function'],
  [vscode.SymbolKind.Variable, 'variable'],
  [vscode.SymbolKind.Constant, ['variable', ['readonly']]],

  [vscode.SymbolKind.String, 'string'],
  [vscode.SymbolKind.Number, 'number'],
  // no direct mapping
  [vscode.SymbolKind.Boolean, ''],
  // no direct mapping
  [vscode.SymbolKind.Array, ''],
  // no direct mapping
  [vscode.SymbolKind.Object, ''],
  // no direct mapping
  [vscode.SymbolKind.Key, ''],
  // no direct mapping
  [vscode.SymbolKind.Null, ''],
  [vscode.SymbolKind.EnumMember, 'enumMember'],
  [vscode.SymbolKind.Struct, 'struct'],
  [vscode.SymbolKind.Event, 'event'],
  [vscode.SymbolKind.Operator, 'operator'],
  [vscode.SymbolKind.TypeParameter, 'typeParameter']
]);

function genAllPossibleWord(currDocSymbolInfo: DocSymbolInfo):
  [Map<string, [number, number][]>, [string, [number, number]][]] {
  const text = currDocSymbolInfo.docRes.text;

  // not start with colon
  const reg = /(?<=[^A-Za-z0-9\+\-\*\/\@\$\%\^\&\_\=\<\>\~\!\?\[\]\{\}\.])([#:A-Za-z0-9\+\-\*\/\@\$\%\^\&\_\=\<\>\~\!\?\[\]\{\}\.]+)(?=[^A-Za-z0-9\+\-\*\/\@\$\%\^\&\_\=\<\>\~\!\?\[\]\{\}\.])/igm;
  const matchRes = text.matchAll(reg);

  const needColorDict: Map<string, [number, number][]> = new Map<string, [number, number][]>();
  const globalOrderedRanges: [string, [number, number]][] = [];

  const allNames = currDocSymbolInfo.allNames;
  allNames.forEach(v=>{
    needColorDict.set(v, []);
  });
  const globalDef = new Set(currDocSymbolInfo.globalDef.keys());

  for (const r of matchRes) {
    const word = r[1].toLowerCase();
    const hasName = needColorDict.get(word);

    if (hasName !== undefined) {
      const rindex = r.index!;
      const numRange: [number, number] = [rindex, rindex + word.length];
      hasName.push(numRange);

      if (globalDef.has(word)) {
        globalOrderedRanges.push([word, numRange]);
      }
    }
  }

  return [needColorDict, globalOrderedRanges];
}

function getTokenDict(
  currDocSymbolInfo: DocSymbolInfo,
  needColorDict: Map<string, [number, number][]>,
  buildingConfig: Map<string, any>,
  tokensBuilder: vscode.SemanticTokensBuilder
) {
  // config
  const excludedRanges: [number, number][] = currDocSymbolInfo.docRes.getExcludedRangesForDocumentSemanticTokensProvider(buildingConfig);

  const tokenDictGlobal = updateTokenDict(currDocSymbolInfo, excludedRanges, needColorDict, 'global', tokensBuilder);
  const tokenDictLocal = updateTokenDict(currDocSymbolInfo, excludedRanges, needColorDict, 'local', tokensBuilder);
}

function updateTokenDict(
  currDocSymbolInfo: DocSymbolInfo,
  excludedRanges: [number, number][],
  needColorDict: Map<string, [number, number][]>,
  updateScope: 'global' | 'local',
  tokensBuilder: vscode.SemanticTokensBuilder
) {
  const tokenDict: Map<string, ParsedToken> = new Map<string, ParsedToken>();
  const isGlobal = updateScope === 'global';
  const d = isGlobal ? currDocSymbolInfo.globalDef : currDocSymbolInfo.allLocal;

  for (const [name, info] of d) {
    // this is left to `yaml grammar` style guide
    if (name.startsWith(':')) {
      continue;
    }
    // do not override global variables color, this is left to `yaml grammar` file
    if (
      isGlobal && (
        (name.startsWith('+') && name.endsWith('+')) ||
        (name.startsWith('*') && name.endsWith('*')))
    ) {
      continue;
    }

    for (const item of info) {
      if (isGlobal && item.kind === vscode.SymbolKind.Variable) {
        continue;
      }
      // color def itself
      const startPos = item.loc.range.start;
      setParsedToken(tokensBuilder, item, startPos, isGlobal);

      // color its scope
      const currNeedColor = needColorDict.get(item.name);
      if (currNeedColor === undefined || currNeedColor.length === 0) {
        continue;
      }

      const idxStart = (item.scope !== undefined) ? bisectRight(currNeedColor, item.scope[0], item => item[0]) : 0;
      const idxEnd = (item.scope !== undefined) ? bisectRight(currNeedColor, item.scope[1], item => item[0]) : currNeedColor.length;

      for (let i = idxStart; i < idxEnd; ++i) {
        if (isRangeIntExcludedRanges(currNeedColor[i], excludedRanges)) {
          continue;
        }

        const startPos = currDocSymbolInfo.document.positionAt(currNeedColor[i][0]);
        setParsedToken(tokensBuilder, item, startPos);
      }

    }
  }

  return tokenDict;
}

// dependency injection tokensBuilder
function setParsedToken(tokensBuilder: vscode.SemanticTokensBuilder, item: SymbolInfo, startPos: vscode.Position, isGlobal = true) {
  const tokenMapRes = vscodeKindToTokenType.get(item.kind)!;
  let tokenType = '';
  let tokenModifiers: string[] = [];
  if (Array.isArray(tokenMapRes)) {
    tokenType = tokenMapRes[0];
    tokenModifiers = tokenMapRes[1];
  } else {
    tokenType = tokenMapRes;
    tokenModifiers = [];
  }

  const packagePrefixIndScope = item.name.indexOf(':');
  let len = item.name.length;
  if (packagePrefixIndScope !== -1) {
    // `::`
    const lastPackagePrefixIndScope = item.name.lastIndexOf(':');
    if (lastPackagePrefixIndScope + 1 < item.name.length) {
      const subItemName = item.name.substring(lastPackagePrefixIndScope + 1);
      if (
        isGlobal &&
        (subItemName.startsWith('+') && subItemName.endsWith('+')) ||
        (subItemName.startsWith('*') && subItemName.endsWith('*'))) {
        return;
      }
    }
    startPos = startPos.translate(0, packagePrefixIndScope);
    len = len - packagePrefixIndScope;
  }

  tokensBuilder.push(startPos.line, startPos.character, len, _encodeTokenType(tokenType), _encodeTokenModifiers(tokenModifiers));
  //const key = `${item.name}|${startPos.line},${startPos.character},${item.name.length}`;
}

function buildSemanticTokens(currDocSymbolInfo: DocSymbolInfo, needColorDict: Map<string, [number, number][]>, buildingConfig: Map<string, any>): vscode.SemanticTokens {
  const tokensBuilder = new vscode.SemanticTokensBuilder();

  const tokenDict = getTokenDict(currDocSymbolInfo, needColorDict, buildingConfig, tokensBuilder);
  //console.log(tokenDict)

  return tokensBuilder.build();
}

export { legend, buildSemanticTokens, genAllPossibleWord };
