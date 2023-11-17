import type * as vscode from 'vscode';

import { excludeRangesFromRanges, isRangeIntExcludedRanges, mergeSortedIntervals } from '../../common/algorithm';
import type { DocSymbolInfo } from '../DocSymbolInfo';
import { loopKeywordsSet, loopKeywordsTokenMap } from '../loop_keywords';

import { _encodeTokenType, _encodeTokenModifiers } from './token_util';

function updateLoop(
  currDocSymbolInfo: DocSymbolInfo,
  excludedRanges: [number, number][],
  tokensBuilder: vscode.SemanticTokensBuilder,
  coloredPosMap: Map<number, [number, number]>,
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
      const encodedTT = _encodeTokenType(tokenType);
      const encodedTMs = _encodeTokenModifiers(tokenModifiers);
      tokensBuilder.push(
        startPos.line, startPos.character, word.length,
        encodedTT, encodedTMs
      );
      coloredPosMap.set(rindex, [encodedTT, encodedTMs]);
      //const key = `loop ${word}|${startPos.line},${startPos.character},${word.length}`;
      //console.log(key);
    }

  }
}

function getlineEndRanges(text: string): [number, number][] {
  const reg = /\r\n|\r|\n/gm;
  const matchRes = text.matchAll(reg);
  const lineEndRanges: [number, number][] = [];
  for (const r of matchRes) {
    if (r.index !== undefined) {
      // +1 to fit into `excludeRangesFromRanges`
      lineEndRanges.push([r.index + 1, r.index + r.length]);
    }
  }
  return lineEndRanges;
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
  ].sort((a, b) => a[0] - b[0]));


  const lineEndRanges = getlineEndRanges(currDocSymbolInfo.docRes.text);
  const breakLineTextColorRanges = excludeRangesFromRanges(textColorRanges, lineEndRanges);

  for (const textRange of breakLineTextColorRanges) {
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

function updatePairMatchFirstWord(
  currDocSymbolInfo: DocSymbolInfo,
  coloredPosMap: Map<number, [number, number]>,
  tokensBuilder: vscode.SemanticTokensBuilder,
) {
  const pair = currDocSymbolInfo.docRes.pair;
  const text = currDocSymbolInfo.docRes.text;
  for (const p of pair) {
    const leftP = p[0];
    const rightP = p[1];

    let textInd = leftP + 1; // index-safe is guaranteed by p[1]
    while (textInd < rightP && /\s/.test(text[textInd])) {
      textInd += 1;
    }

    if (coloredPosMap.has(textInd)) {
      const [encodedTT, encodedTMs] = coloredPosMap.get(textInd)!;
      const startPosLeftP = currDocSymbolInfo.document.positionAt(leftP);
      tokensBuilder.push(
        startPosLeftP.line, startPosLeftP.character, 1,
        encodedTT, encodedTMs
      );
      const startPosRightP = currDocSymbolInfo.document.positionAt(rightP);
      tokensBuilder.push(
        startPosRightP.line, startPosRightP.character, 1,
        encodedTT, encodedTMs
      );
    }

  }

}

export {
  updateLoop,
  overrideQuote,
  overrideNotFormattedString,
  updatePairMatchFirstWord
};
