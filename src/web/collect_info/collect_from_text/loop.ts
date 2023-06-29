import * as vscode from 'vscode';

import { clValidSymbolSingleCharColonSet } from '../../common/cl_util';
import type { ScanDocRes } from '../ScanDocRes';
import { SymbolInfo } from '../SymbolInfo';
import { addToDictArr, getValidGroupRes, findMatchPairExactP, isRangeIntExcludedRanges, isSpace } from '../collect_util';
import { loopStartClauseKeywordSet } from '../loop_keywords';

import { processVars } from './lambda_list';

function findFollowingAnd(baseInd: number, varsStr: string, scanDocRes: ScanDocRes): [number, number][] {
  let varName = '';
  let varStart = -1;

  const andPosition: [number, number][] = [];
  let seeAnd = false;
  let startSingleVar = -1;

  let i = 0;
  const upper = varsStr.length;
  while (i < upper) {
    if (varsStr[i] === ';') {
      while (i < upper && varsStr[i] !== '\n') {
        ++i;
      }

    } else if (varsStr[i] === '|' && varsStr[i - 1] === '#') {
      while (i < upper && (varsStr[i] !== '#' || varsStr[i - 1] !== '|')) {
        ++i;
      }

    } else if (clValidSymbolSingleCharColonSet.has(varsStr[i])) {
      if (seeAnd) {
        startSingleVar = i;
      }

      if (varStart === -1) {
        varStart = i;
      }
      varName += varsStr[i];
      ++i;

    } else if (varsStr[i] === '(') {
      const idx = findMatchPairExactP(baseInd + i, scanDocRes.pairMap);
      if (idx === -1) {
        return andPosition;
      }
      const newInd = idx - baseInd;
      if (seeAnd) {
        andPosition.push([i, newInd]);
        seeAnd = false;
      }
      i = newInd;

    } else if (isSpace(varsStr[i]) || varsStr[i] === ')') {
      // cannot find match anymore
      if (varName && varStart !== -1 &&
        varName !== '.' &&
        !varName.includes(':') &&
        !varName.startsWith('&')
      ) {
        if (loopStartClauseKeywordSet.has(varName)) {
          return andPosition;
        }
        if (seeAnd && startSingleVar !== -1) {
          andPosition.push([startSingleVar, startSingleVar + varName.length]);
          startSingleVar = -1;
          seeAnd = false;
        }
        if (varName === 'and') {
          seeAnd = true;
        }
      }

      varStart = -1;
      varName = '';
      ++i;
    } else {
      ++i;
    }
  }
  return andPosition;
}

function collectLoopVar(
  document: vscode.TextDocument, scanDocRes: ScanDocRes, excludedRange: [number, number][]
): [Map<string, SymbolInfo[]>, [number, number][]] {
  // Practical Common Lisp 22. LOOP for Black Belts https://gigamonkeys.com/book/loop-for-black-belts.html
  // Common Lisp the Language, 2nd Edition 26.3.2. Kinds of Loop Clauses https://www.cs.cmu.edu/Groups/AI/html/cltl/clm/node240.html

  const text = scanDocRes.text;
  const defLocalNames: Map<string, SymbolInfo[]> = new Map<string, SymbolInfo[]>();
  const loopBlocks: [number, number][] = [];

  // commonlisp.yaml macro
  const matchRes = text.matchAll(/(?<=^|\s|\(|,@|,\.|,)(\()(\s*)(loop)(\s)/igmd);
  for (const r of matchRes) {
    if (r.indices === undefined) {
      continue;
    }

    // working in currtext
    const loopStart = r.indices[1][0];
    const closedParenthese = findMatchPairExactP(loopStart, scanDocRes.pairMap);
    if (closedParenthese === -1) {
      continue;
    }
    loopBlocks.push([loopStart, closedParenthese]);

    const subStart = r.indices[4][0];
    const subText = text.substring(subStart, closedParenthese);
    const subMatchRes = subText.matchAll(/(?<=^|\s|\(|,@|,\.|,):?(for|as|with|into|named)\s+(([#:A-Za-z0-9\+\-\*\/\@\$\%\^\&\_\=\<\>\~\!\?\[\]\{\}\.]+)\s|(\())/igmd);
    for (const subR of subMatchRes) {
      if (subR.indices === undefined) {
        continue;
      }

      const defLocalName = getValidGroupRes(subR, [3, 4]);
      if (defLocalName === undefined) {
        continue;
      }

      const containerName = subR[1].toLowerCase();
      if (defLocalName === '(') {
        const varsStart = subR.indices[4][0] + subStart;
        multiVars(defLocalNames, document, scanDocRes, excludedRange, varsStart, containerName, closedParenthese);
      } else {
        const nameRangeInd: [number, number] = [subR.indices[3][0] + subStart, subR.indices[3][1] + subStart];
        singleVar(defLocalNames, defLocalName, document, excludedRange, nameRangeInd, containerName, closedParenthese);
      }

      // process `and` after current declaration
      const afterKeyword = subR.indices[1][1];
      const baseInd = subStart + afterKeyword;
      const afterKeywordText = subText.substring(afterKeyword);
      const followingAnd = findFollowingAnd(baseInd, afterKeywordText, scanDocRes);
      for (const rang of followingAnd) {
        if (afterKeywordText[rang[0]] === '(') {
          const varsStart = rang[0] + baseInd;
          multiVars(defLocalNames, document, scanDocRes, excludedRange, varsStart, containerName, closedParenthese);
        } else {
          const nameRangeInd: [number, number] = [rang[0] + baseInd, rang[1] + baseInd];
          const name = afterKeywordText.substring(...rang);
          singleVar(defLocalNames, name, document, excludedRange, nameRangeInd, containerName, closedParenthese);
        }
      }

    }

  }
  return [defLocalNames, loopBlocks];
}

function singleVar(
  defLocalNames: Map<string, SymbolInfo[]>,
  defLocalName: string, document: vscode.TextDocument, excludedRange: [number, number][],
  nameRangeInd: [number, number], containerName: string, closedParenthese: number
) {
  const uri = document.uri;
  if (isRangeIntExcludedRanges(nameRangeInd, excludedRange)) {
    return;
  }

  const range = new vscode.Range(
    document.positionAt(nameRangeInd[0]),
    document.positionAt(nameRangeInd[1]),
  );

  const lexicalScope: [number, number] = [nameRangeInd[1], closedParenthese];

  addToDictArr(defLocalNames, defLocalName.toLowerCase(), new SymbolInfo(
    defLocalName.toLowerCase(), containerName, lexicalScope,
    new vscode.Location(uri, range), vscode.SymbolKind.Variable, nameRangeInd
  ));
}

function multiVars(
  defLocalNames: Map<string, SymbolInfo[]>,
  document: vscode.TextDocument, scanDocRes: ScanDocRes, excludedRange: [number, number][],
  varsStart: number, containerName: string, closedParenthese: number,
) {
  const uri = document.uri;
  const varsRes = processVars(varsStart, scanDocRes, closedParenthese, true);
  if (varsRes === undefined) {
    return;
  }
  const [vars, varsStrEnd] = varsRes;

  for (const [nn, rang] of vars) {
    if (nn.toLowerCase() === 'nil') {
      continue;
    }
    if (isRangeIntExcludedRanges(rang, excludedRange)) {
      continue;
    }
    const secondLexicalScope: [number, number] = [varsStrEnd, closedParenthese];
    const range = new vscode.Range(
      document.positionAt(rang[0]),
      document.positionAt(rang[1]),
    );

    addToDictArr(defLocalNames, nn.toLowerCase(), new SymbolInfo(
      nn.toLowerCase(), containerName, secondLexicalScope,
      new vscode.Location(uri, range), vscode.SymbolKind.Variable, rang
    ));
  }
}

export { collectLoopVar };
