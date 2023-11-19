import * as vscode from 'vscode';

import type { SymbolInfo } from '../../collect_info/SymbolInfo';
import { isRangeIntExcludedRanges } from '../../common/algorithm';
import type { DocSymbolInfo } from '../DocSymbolInfo';
import { getScopedSameNameWordsExcludeItself } from '../builders_util';

import { _encodeTokenType, _encodeTokenModifiers, vscodeKindToTokenType } from './token_util';
import { overrideQuote, updateLoop } from './update_util';

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

  // overlap in order!
  updateTokenDict(currDocSymbolInfo, excludedRanges, needColorDict, 'local', tokensBuilder);
  updateTokenDict(currDocSymbolInfo, excludedRanges, needColorDict, 'global', tokensBuilder);

  updateLoop(currDocSymbolInfo, excludedRanges, tokensBuilder);

  // 1. tried to de-color all single-quoted parts
  // vscode semantic highlighting does not support multi-line tokens
  // so we split the multi-line tokens into multiple single-line tokens manually.
  // This may have a negative impact on performance.
  if (buildingConfig.get('commonLisp.DocumentSemanticTokensProvider.NotColorQuoted') === true) {
    overrideQuote(currDocSymbolInfo, tokensBuilder);
  }
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
      setParsedToken(tokensBuilder, item, startPos, isGlobal);
      // color its scope
      const scopedSameNameWords = getScopedSameNameWordsExcludeItself(item, needColorDict, currDocSymbolInfo);
      for (const rang of scopedSameNameWords) {
        if (isRangeIntExcludedRanges(rang, excludedRanges)) {
          continue;
        }

        const startPos = currDocSymbolInfo.document.positionAt(rang[0]);
        setParsedToken(tokensBuilder, item, startPos);
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
) {
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
        return;
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
}

function buildSemanticTokens(
  currDocSymbolInfo: DocSymbolInfo, needColorDict: Map<string, [number, number][]>, buildingConfig: Map<string, any>
): vscode.SemanticTokens {
  const tokensBuilder = new vscode.SemanticTokensBuilder();

  getTokenDict(currDocSymbolInfo, needColorDict, buildingConfig, tokensBuilder);

  return tokensBuilder.build();
}

export { buildSemanticTokens, genAllPossibleWord };
