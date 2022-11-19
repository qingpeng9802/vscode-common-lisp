import * as vscode from 'vscode';

import { addToDictArr, isRangeIntExcludedRanges } from '../user_symbol/collect_symbol_util';
import { DocSymbolInfo } from '../user_symbol/DocSymbolInfo';
import { bisectRight, excludeRangesFromRanges, mergeSortedIntervals } from '../algorithm';
import { ParsedToken } from './ParsedToken';
import { SingleQuoteAndBackQuoteHighlight } from '../entry/WorkspaceConfig';

import { updateInfo } from '../entry/listen_update';
import { workspaceConfig } from '../entry/common';

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
};

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
  for (let i = 0; i < strTokenModifiers.length; i++) {
    const tokenModifier = strTokenModifiers[i];
    if (tokenModifiers.has(tokenModifier)) {
      result = result | (1 << tokenModifiers.get(tokenModifier)!);
    } else if (tokenModifier === 'notInLegend') {
      result = result | (1 << tokenModifiers.size + 2);
    }
  }
  return result;
}

const vscodeKindToTokenType: Record<vscode.SymbolKind, string | [string, string[]]> = {
  // no direct mapping
  [vscode.SymbolKind.File]: 'variable',
  // no direct mapping
  [vscode.SymbolKind.Module]: 'namespace',
  [vscode.SymbolKind.Namespace]: 'namespace',
  // no direct mapping
  [vscode.SymbolKind.Package]: 'type',
  [vscode.SymbolKind.Class]: 'class',
  [vscode.SymbolKind.Method]: 'method',
  [vscode.SymbolKind.Property]: 'property',
  [vscode.SymbolKind.Field]: '',
  [vscode.SymbolKind.Constructor]: '',
  [vscode.SymbolKind.Enum]: 'enum',
  [vscode.SymbolKind.Interface]: 'interface',
  [vscode.SymbolKind.Function]: 'function',
  [vscode.SymbolKind.Variable]: 'variable',
  [vscode.SymbolKind.Constant]: ['variable', ['readonly']],

  [vscode.SymbolKind.String]: 'string',
  [vscode.SymbolKind.Number]: 'number',
  // no direct mapping
  [vscode.SymbolKind.Boolean]: '',
  // no direct mapping
  [vscode.SymbolKind.Array]: '',
  // no direct mapping
  [vscode.SymbolKind.Object]: '',
  // no direct mapping
  [vscode.SymbolKind.Key]: '',
  // no direct mapping
  [vscode.SymbolKind.Null]: '',
  [vscode.SymbolKind.EnumMember]: 'enumMember',
  [vscode.SymbolKind.Struct]: 'struct',
  [vscode.SymbolKind.Event]: 'event',
  [vscode.SymbolKind.Operator]: 'operator',
  [vscode.SymbolKind.TypeParameter]: 'typeParameter',
};

// @sideEffect: needColorDict: Record<string, [number, number][]>
// @sideEffect: globalOrderedRanges: [string, [number, number]][]
function genAllPossibleWord(currDocSymbolInfo: DocSymbolInfo):
  [Record<string, [number, number][]>, [string, [number, number]][]] {
  const text = currDocSymbolInfo.document.getText();

  // not start with colon
  const reg = /(?<=[^A-Za-z0-9\+\-\*\/\@\$\%\^\&\_\=\<\>\~\!\?\[\]\{\}\.])([#:A-Za-z0-9\+\-\*\/\@\$\%\^\&\_\=\<\>\~\!\?\[\]\{\}\.]+)(?=[^A-Za-z0-9\+\-\*\/\@\$\%\^\&\_\=\<\>\~\!\?\[\]\{\}\.])/igm;
  const matchRes = text.matchAll(reg);

  const needColorDict: Record<string, [number, number][]> = {};
  const globalOrderedRanges: [string, [number, number]][] = [];

  for (const r of matchRes) {
    if (r.index === undefined) {
      continue;
    }

    const word = r[1].toLowerCase();
    if (currDocSymbolInfo.allNames.has(word)) {
      addToDictArr(needColorDict, word, [r.index, r.index + word.length]);
    }
    if (currDocSymbolInfo.globalDef.hasOwnProperty(word)) {
      globalOrderedRanges.push([word, [r.index, r.index + word.length]]);
    }
  }

  return [needColorDict, globalOrderedRanges];
}

// @sideEffect: tokenDict: Record<string, ParsedToken>
function getTokenDict(currDocSymbolInfo: DocSymbolInfo) {
  const tokenDict: Record<string, ParsedToken> = {};

  // config
  let excludedRanges: [number, number][] = getNewExcludedRanges(
    currDocSymbolInfo,
    'commonLisp.DocumentSemanticTokensProvider.ExcludedRanges',
    'commonLisp.DocumentSemanticTokensProvider.SingleQuoteAndBackQuote.Highlight');

  updateTokenDict(currDocSymbolInfo, excludedRanges, updateInfo.needColorDict, tokenDict, 'global');
  updateTokenDict(currDocSymbolInfo, excludedRanges, updateInfo.needColorDict, tokenDict, 'local');

  return tokenDict;
}

function getNewExcludedRanges(currDocSymbolInfo: DocSymbolInfo, eRangeCfgName: string, sqBQCfgName: string) {
  const excludedRangesCfg = workspaceConfig.config[eRangeCfgName];
  let excludedRanges: [number, number][] = currDocSymbolInfo.getExcludedRanges(excludedRangesCfg);

  switch (workspaceConfig.config[sqBQCfgName]) {
    case SingleQuoteAndBackQuoteHighlight.SQ:
      excludedRanges = mergeSortedIntervals([
        ...excludedRanges,
        ...currDocSymbolInfo.docRes.backquotePairRange,
        ...currDocSymbolInfo.docRes.backquoteRange,
      ].sort((a, b) => a[0] - b[0])
      );
      break;

    case SingleQuoteAndBackQuoteHighlight.SQAndBQC:
      const backquotePairAndSymbol = mergeSortedIntervals(
        [...currDocSymbolInfo.docRes.backquotePairRange, ...currDocSymbolInfo.docRes.backquoteRange].sort((a, b) => a[0] - b[0]));
      const commaPairAndSymbol = mergeSortedIntervals(
        [...currDocSymbolInfo.docRes.commaPairRange, ...currDocSymbolInfo.docRes.commaRange].sort((a, b) => a[0] - b[0]));
      const excludedComma = excludeRangesFromRanges(backquotePairAndSymbol, commaPairAndSymbol);

      excludedRanges = mergeSortedIntervals(
        [...excludedRanges, ...excludedComma].sort((a, b) => a[0] - b[0]));

      break;

    case SingleQuoteAndBackQuoteHighlight.SQAndBQAll:
      // nothing
      break;

    case SingleQuoteAndBackQuoteHighlight.BQC:
      const backquotePairAndSymbol2 = mergeSortedIntervals(
        [...currDocSymbolInfo.docRes.backquotePairRange, ...currDocSymbolInfo.docRes.backquoteRange].sort((a, b) => a[0] - b[0]));
      const commaPairAndSymbol2 = mergeSortedIntervals(
        [...currDocSymbolInfo.docRes.commaPairRange, ...currDocSymbolInfo.docRes.commaRange].sort((a, b) => a[0] - b[0]));
      const excludedComma2 = excludeRangesFromRanges(backquotePairAndSymbol2, commaPairAndSymbol2);

      excludedRanges = mergeSortedIntervals([
        ...excludedRanges,
        ...currDocSymbolInfo.docRes.quotedPairRange,
        ...currDocSymbolInfo.docRes.quotedRange,
        ...excludedComma2
      ].sort((a, b) => a[0] - b[0]));
      break;

    case SingleQuoteAndBackQuoteHighlight.BQAll:
      excludedRanges = mergeSortedIntervals([
        ...excludedRanges,
        ...currDocSymbolInfo.docRes.quotedPairRange,
        ...currDocSymbolInfo.docRes.quotedRange,
      ].sort((a, b) => a[0] - b[0])
      );
      break;

    case SingleQuoteAndBackQuoteHighlight.None:
      excludedRanges = mergeSortedIntervals([
        ...excludedRanges,
        ...currDocSymbolInfo.docRes.backquotePairRange,
        ...currDocSymbolInfo.docRes.backquoteRange,
        ...currDocSymbolInfo.docRes.quotedPairRange,
        ...currDocSymbolInfo.docRes.quotedRange,
      ].sort((a, b) => a[0] - b[0])
      );
      break;

    default:
      break;
  }

  return excludedRanges;
}

function updateTokenDict(
  currDocSymbolInfo: DocSymbolInfo,
  excludedRanges: [number, number][],
  needColorDict: Record<string, [number, number][]>,
  tokenDict: Record<string, ParsedToken>,
  updateScope: 'global' | 'local'
) {
  let d = currDocSymbolInfo.globalDef;
  if (updateScope === 'local') {
    d = currDocSymbolInfo.allLocal;
  }

  for (const info of Object.values(d)) {
    for (const item of info) {
      // this is left to `yaml grammar` style guide
      if (item.name.startsWith(':')) {
        continue;
      }
      // do not override global variables color, this is left to `yaml grammar` file
      if (
        updateScope === 'global' && (
          (item.name.startsWith('+') && item.name.endsWith('+')) ||
          (item.name.startsWith('*') && item.name.endsWith('*')) ||
          item.kind === vscode.SymbolKind.Variable)
      ) {
        continue;
      }

      const tokenMapRes = vscodeKindToTokenType[item.kind];

      let tokenType: string = '';
      let tokenModifiers: string[] = [];
      if (Array.isArray(tokenMapRes)) {
        tokenType = tokenMapRes[0];
        tokenModifiers = tokenMapRes[1];
      } else {
        tokenType = tokenMapRes;
        tokenModifiers = [];
      }

      // color def itself
      const key: string = `${item.name}|${item.loc.range.start.line},${item.loc.range.start.character},${item.name.length}`;

      const packagePrefixIndSelf = item.name.indexOf(':');
      if (packagePrefixIndSelf !== -1) {
        // `::`
        const lastPackagePrefixIndSelf = item.name.lastIndexOf(':');
        if (lastPackagePrefixIndSelf + 1 < item.name.length) {
          const subItemName = item.name.substring(lastPackagePrefixIndSelf + 1);
          if (
            updateScope === 'global' && (
              (subItemName.startsWith('+') && subItemName.endsWith('+')) ||
              (subItemName.startsWith('*') && subItemName.endsWith('*')))) {
            continue;
          }
        }

        tokenDict[key] = new ParsedToken(item.loc.range.start.translate(0, packagePrefixIndSelf), item.name.length - packagePrefixIndSelf, tokenType, tokenModifiers);

      } else {
        tokenDict[key] = new ParsedToken(item.loc.range.start, item.name.length, tokenType, tokenModifiers);
      }

      // color its scope
      const currNeedColor = needColorDict[item.name];
      if (!currNeedColor || currNeedColor.length === 0) {
        continue;
      }

      const idxStart = item.scope ? bisectRight(currNeedColor, item.scope[0], item => item[0]) : 0;
      const idxEnd = item.scope ? bisectRight(currNeedColor, item.scope[1], item => item[0]) : currNeedColor.length;

      for (let i = idxStart; i < idxEnd; i++) {
        if (isRangeIntExcludedRanges(currNeedColor[i], excludedRanges)
        ) {
          continue;
        }

        const startPos =
          currDocSymbolInfo.document.positionAt(currNeedColor[i][0]);
        const key: string = `${item.name}|${startPos.line},${startPos.character},${item.name.length}`;

        const packagePrefixIndScope = item.name.indexOf(':');
        if (packagePrefixIndScope !== -1) {
          // `::`
          const lastPackagePrefixIndScope = item.name.lastIndexOf(':');
          if (lastPackagePrefixIndScope + 1 < item.name.length) {
            const subItemName = item.name.substring(lastPackagePrefixIndScope + 1);
            if (
              (subItemName.startsWith('+') && subItemName.endsWith('+')) ||
              (subItemName.startsWith('*') && subItemName.endsWith('*'))) {
              continue;
            }
          }

          tokenDict[key] = new ParsedToken(startPos.translate(0, packagePrefixIndScope), item.name.length - packagePrefixIndScope, tokenType, tokenModifiers);
        } else {
          tokenDict[key] = new ParsedToken(startPos, item.name.length, tokenType, tokenModifiers);
        }

      }

    }
  }
}

function buildSemanticTokens(currDocSymbolInfo: DocSymbolInfo): vscode.SemanticTokens {
  const tokensBuilder = new vscode.SemanticTokensBuilder();

  const tokenDict = getTokenDict(currDocSymbolInfo);
  //console.log(tokenDict)
  for (const t of Object.values(tokenDict)) {
    tokensBuilder.push(t.startPos.line, t.startPos.character, t.len, _encodeTokenType(t.tokenType), _encodeTokenModifiers(t.tokenModifiers));
  }

  return tokensBuilder.build();
}

export { legend, buildSemanticTokens, genAllPossibleWord };
