import * as vscode from 'vscode';

import type { SymbolInfo } from '../../collect_info/SymbolInfo';
import { isRangeIntExcludedRanges } from '../../common/algorithm';
import type { DocSymbolInfo } from '../DocSymbolInfo';
import { getScopedSameNameWordsExcludeItself } from '../builders_util';

import { _encodeTokenType, _encodeTokenModifiers, vscodeKindToTokenType } from './token_util';
import { overrideQuote, updateLoop, updatePairMatchFirstWord } from './update_util';

function genAllPossibleWord(
  currDocSymbolInfo: DocSymbolInfo
): [Map<string, [number, number][]>, [string, [number, number]][]] {
  const text = currDocSymbolInfo.docRes.text;
  //const t = performance.now();

  // slow regex
  // eslint-disable-next-line max-len
  // const reg = /((?<=,)@?([#:A-Za-z0-9\+\-\*\/\@\$\%\^\&\_\=\<\>\~\!\?\[\]\{\}\.]+)|(?<=[^A-Za-z0-9\+\-\*\/\@\$\%\^\&\_\=\<\>\~\!\?\[\]\{\}\.\,])([#:A-Za-z0-9\+\-\*\/\@\$\%\^\&\_\=\<\>\~\!\?\[\]\{\}\.]+))(?=[^A-Za-z0-9\+\-\*\/\@\$\%\^\&\_\=\<\>\~\!\?\[\]\{\}\.])/igmd;

  // not start with colon
  const reg = /((?<=[^A-Za-z0-9\+\-\*\/\@\$\%\^\&\_\=\<\>\~\!\?\[\]\{\}\.\,]|,@)([#:A-Za-z0-9\+\-\*\/\@\$\%\^\&\_\=\<\>\~\!\?\[\]\{\}\.]+)|(?<=,)[#:A-Za-z0-9\+\-\*\/\$\%\^\&\_\=\<\>\~\!\?\[\]\{\}\.][#:A-Za-z0-9\+\-\*\/\@\$\%\^\&\_\=\<\>\~\!\?\[\]\{\}\.]*)(?=[^A-Za-z0-9\+\-\*\/\@\$\%\^\&\_\=\<\>\~\!\?\[\]\{\}\.])/igm;
  const matchRes = text.matchAll(reg);

  const needColorDict: Map<string, [number, number][]> = new Map<string, [number, number][]>();
  const globalOrderedRanges: [string, [number, number]][] = [];

  const allNames = currDocSymbolInfo.allNames;
  allNames.forEach(v => {
    needColorDict.set(v, []);
  });
  const globalDef = new Set(currDocSymbolInfo.globalDef.keys());


  for (const r of matchRes) {
    const word = r[1].toLowerCase();
    const hasName = needColorDict.get(word);

    if (hasName !== undefined) {
      const ind = r.index!;
      const rindex = ind;
      const numRange: [number, number] = [rindex, rindex + word.length];
      hasName.push(numRange);

      if (globalDef.has(word)) {
        globalOrderedRanges.push([word, numRange]);
      }
    }
  }
  //console.log(`token: ${performance.now() - t} ms`);
  return [needColorDict, globalOrderedRanges];
}

function getTokenDict(
  currDocSymbolInfo: DocSymbolInfo,
  needColorDict: Map<string, [number, number][]>,
  buildingConfig: Map<string, any>,
  tokensBuilder: vscode.SemanticTokensBuilder
) {
  // config
  const excludedRanges: [number, number][] =
    currDocSymbolInfo.docRes.getExcludedRangesForDocumentSemanticTokensProvider(buildingConfig);

  // colored position collector
  // {index, [encodeTokenType, encodeTokenModifiers]}
  // Note that the `index` should be no-translated result, that is,
  // `index` should be the 1st character of current string.
  // For example, `sb-c::instrument-consing` should be the index of `s` instead of `i`.
  let coloredPosMap: Map<number, [number, number]> = new Map<number, [number, number]>();

  // overlap in order!
  updateTokenDict(currDocSymbolInfo, excludedRanges, needColorDict, 'local', tokensBuilder, coloredPosMap);

  // Due to the restrictions below, we cannot make this feature optional
  // https://github.com/microsoft/vscode/issues/580
  // https://github.com/microsoft/vscode/issues/68647
  updatePairMatchFirstWord(currDocSymbolInfo, coloredPosMap, tokensBuilder);

  coloredPosMap = new Map<number, [number, number]>();

  updateTokenDict(currDocSymbolInfo, excludedRanges, needColorDict, 'global', tokensBuilder, coloredPosMap);

  updateLoop(currDocSymbolInfo, excludedRanges, tokensBuilder, coloredPosMap);
  updatePairMatchFirstWord(currDocSymbolInfo, coloredPosMap, tokensBuilder);
  coloredPosMap = new Map<number, [number, number]>();

  // 1. tried to de-color all single-quoted parts
  // vscode semantic highlighting does not support multi-line token, does not work
  overrideQuote(currDocSymbolInfo, tokensBuilder);
  //
  // 2. tried to de-color all no-formatted strings
  // not sure if it can cover all cases or not
  // overrideNotFormattedString(currDocSymbolInfo, tokensBuilder);

}

function updateTokenDict(
  currDocSymbolInfo: DocSymbolInfo,
  excludedRanges: [number, number][],
  needColorDict: Map<string, [number, number][]>,
  updateScope: 'global' | 'local',
  tokensBuilder: vscode.SemanticTokensBuilder,
  coloredPosMap: Map<number, [number, number]>,
) {
  const isGlobal = updateScope === 'global';
  const d = isGlobal ? currDocSymbolInfo.globalDef : currDocSymbolInfo.allLocal;

  for (const [name, info] of d) {
    // this is left to `yaml grammar` style guide
    if (name.startsWith(':')) {
      continue;
    }
    // do not override global variables color, this is left to `yaml grammar` file
    if (isGlobal && (
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
      const startPos = item.startPos;
      const encoded = setParsedToken(tokensBuilder, item, startPos, isGlobal);
      if (encoded !== undefined) {
        coloredPosMap.set(item.numRange[0], encoded);
      }

      // color its scope
      const scopedSameNameWords = getScopedSameNameWordsExcludeItself(item, needColorDict, currDocSymbolInfo);
      for (const rang of scopedSameNameWords) {
        if (isRangeIntExcludedRanges(rang, excludedRanges)) {
          continue;
        }

        const startPos = currDocSymbolInfo.document.positionAt(rang[0]);
        const encoded = setParsedToken(tokensBuilder, item, startPos);
        if (encoded !== undefined) {
          coloredPosMap.set(rang[0], encoded);
        }
      }

    }
  }

}

// dependency injection tokensBuilder
function setParsedToken(
  tokensBuilder: vscode.SemanticTokensBuilder,
  item: SymbolInfo,
  startPos: vscode.Position,
  isGlobal = true
): [number, number] | undefined {
  const nameStr = item.name;
  const packagePrefixIndScope = nameStr.indexOf(':');
  let len = nameStr.length;
  if (packagePrefixIndScope !== -1) {
    // `::`
    const lastPackagePrefixIndScope = nameStr.lastIndexOf(':');
    if (lastPackagePrefixIndScope + 1 < nameStr.length) {
      const subItemName = nameStr.substring(lastPackagePrefixIndScope + 1);
      if (
        isGlobal &&
        (subItemName.startsWith('+') && subItemName.endsWith('+')) ||
        (subItemName.startsWith('*') && subItemName.endsWith('*'))) {
        return undefined;
      }
    }
    startPos = startPos.translate(0, packagePrefixIndScope);
    len = len - packagePrefixIndScope;
  }

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
  const encodedTT = _encodeTokenType(tokenType);
  const encodedTMs = _encodeTokenModifiers(tokenModifiers);

  tokensBuilder.push(
    startPos.line, startPos.character, len,
    encodedTT, encodedTMs
  );
  //const key = `${item.name}|${startPos.line},${startPos.character},${item.name.length}`;
  //console.log(key);

  return [encodedTT, encodedTMs];
}

function buildSemanticTokens(
  currDocSymbolInfo: DocSymbolInfo, needColorDict: Map<string, [number, number][]>, buildingConfig: Map<string, any>
): vscode.SemanticTokens {
  const tokensBuilder = new vscode.SemanticTokensBuilder();

  getTokenDict(currDocSymbolInfo, needColorDict, buildingConfig, tokensBuilder);

  return tokensBuilder.build();
}

export { buildSemanticTokens, genAllPossibleWord };
