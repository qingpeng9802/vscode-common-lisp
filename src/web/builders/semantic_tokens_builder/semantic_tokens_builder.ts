import * as vscode from 'vscode';

import type { SymbolInfo } from '../../collect_info/SymbolInfo';
import { isRangeIntExcludedRanges, excludeRangesFromRanges, mergeSortedIntervals } from '../../common/algorithm';
import type { DocSymbolInfo } from '../DocSymbolInfo';
import { getScopedSameNameWordsExcludeItself } from '../builders_util';
import { loopKeywordsTokenMap, loopKeywordsSet } from '../loop_keywords';

import { _encodeTokenType, _encodeTokenModifiers, vscodeKindToTokenType } from './token_util';

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
  const tokenDictLocal = updateTokenDict(currDocSymbolInfo, excludedRanges, needColorDict, 'local', tokensBuilder);
  const tokenDictGlobal = updateTokenDict(currDocSymbolInfo, excludedRanges, needColorDict, 'global', tokensBuilder);
  updateLoop(currDocSymbolInfo, excludedRanges, tokensBuilder);

  // vscode semantic highlighting does not support multi-line token, does not work
  // overrideQuote(currDocSymbolInfo, tokensBuilder);
  // not sure if it can cover all cases or not
  // overrideNotFormattedString(currDocSymbolInfo, tokensBuilder);
}

function updateTokenDict(
  currDocSymbolInfo: DocSymbolInfo,
  excludedRanges: [number, number][],
  needColorDict: Map<string, [number, number][]>,
  updateScope: 'global' | 'local',
  tokensBuilder: vscode.SemanticTokensBuilder
) {
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

function updateLoop(
  currDocSymbolInfo: DocSymbolInfo,
  excludedRanges: [number, number][],
  tokensBuilder: vscode.SemanticTokensBuilder
) {
  const document = currDocSymbolInfo.document;
  const text = document.getText();

  for (const blockRange of currDocSymbolInfo.loopBlocks) {
    const [start, end] = blockRange;
    const currText = text.substring(start, end);

    const reg = /(?<=[^:A-Za-z0-9\-\=])([:A-Za-z0-9\-\=]+)(?=[^:A-Za-z0-9\-\=])/igm;
    const matchRes = currText.matchAll(reg);

    for (const r of matchRes) {
      const word = r[1].toLowerCase();
      if (
        !loopKeywordsSet.has(word) &&
        // some people would like use : before the keyword
        !(word.includes(':') && loopKeywordsSet.has(word.substring(word.indexOf(':') + 1)))
      ) {
        continue;
      }

      const rindex = r.index! + start;
      const numRange: [number, number] = [rindex, rindex + word.length];
      if (isRangeIntExcludedRanges(numRange, excludedRanges)) {
        continue;
      }

      const tokenMapRes = loopKeywordsTokenMap.get(
        word.startsWith(':') ? word.substring(1) : word
      );
      if (tokenMapRes === undefined) {
        //console.warn(`cannot get tokenMap for name: ${word}`);
        continue;
      }
      let tokenType = '';
      let tokenModifiers: string[] = [];
      if (Array.isArray(tokenMapRes)) {
        tokenType = tokenMapRes[0];
        tokenModifiers = tokenMapRes[1];
      } else {
        tokenType = tokenMapRes;
        tokenModifiers = [];
      }

      const startPos = document.positionAt(rindex);
      tokensBuilder.push(
        startPos.line, startPos.character, word.length,
        _encodeTokenType(tokenType), _encodeTokenModifiers(tokenModifiers)
      );
      //const key = `loop ${word}|${startPos.line},${startPos.character},${word.length}`;
      //console.log(key);
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

  tokensBuilder.push(
    startPos.line, startPos.character, len,
    _encodeTokenType(tokenType), _encodeTokenModifiers(tokenModifiers)
  );
  //const key = `${item.name}|${startPos.line},${startPos.character},${item.name.length}`;
  //console.log(key);
}

function overrideQuote(
  currDocSymbolInfo: DocSymbolInfo,
  tokensBuilder: vscode.SemanticTokensBuilder
) {
  const scanDocRes = currDocSymbolInfo.docRes;
  const backquotePairAndSymbol = mergeSortedIntervals(
    [...scanDocRes.backquotePairRange, ...scanDocRes.backquoteRange].sort((a, b) => a[0] - b[0]));
  const commaPairAndSymbol = mergeSortedIntervals(
    [...scanDocRes.commaPairRange, ...scanDocRes.commaRange].sort((a, b) => a[0] - b[0]));
  const excludedComma = excludeRangesFromRanges(backquotePairAndSymbol, commaPairAndSymbol);

  const document = currDocSymbolInfo.document;
  const textColorRanges = mergeSortedIntervals([
    ...scanDocRes.quotedPairRange,
    ...scanDocRes.quotedRange,
    ...excludedComma
  ]);

  for (const textRange of textColorRanges) {
    const [start, end] = textRange;
    const startPos = document.positionAt(start);
    tokensBuilder.push(
      startPos.line, startPos.character, end - start,
      _encodeTokenType('operator'), _encodeTokenModifiers([])
    );
  }
}

function overrideNotFormattedString(
  currDocSymbolInfo: DocSymbolInfo,
  tokensBuilder: vscode.SemanticTokensBuilder
) {
  const document = currDocSymbolInfo.document;
  const text = document.getText();
  const reg = /(?<=^|\s|\()format[\S\s]*?"/igm;
  const matchRes = text.matchAll(reg);
  const doubleQSet = new Set<number>();
  for (const r of matchRes) {
    if (r.index === undefined) {
      continue;
    }
    doubleQSet.add(r.index + r[0].length - 1);
  }

  for (const strRange of currDocSymbolInfo.docRes.stringRange) {
    const [start, end] = strRange;
    if (!doubleQSet.has(start)) {
      // actually not formatted str
      const startPos = document.positionAt(start);
      tokensBuilder.push(
        startPos.line, startPos.character, end - start,
        _encodeTokenType('string'), _encodeTokenModifiers([])
      );
    }
  }
}

function buildSemanticTokens(
  currDocSymbolInfo: DocSymbolInfo, needColorDict: Map<string, [number, number][]>, buildingConfig: Map<string, any>
): vscode.SemanticTokens {
  const tokensBuilder = new vscode.SemanticTokensBuilder();

  const tokenDict = getTokenDict(currDocSymbolInfo, needColorDict, buildingConfig, tokensBuilder);
  //console.log(tokenDict)

  return tokensBuilder.build();
}

export { buildSemanticTokens, genAllPossibleWord };
