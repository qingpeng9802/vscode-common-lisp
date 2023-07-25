import { clValidSymbolSingleCharColonSet } from '../../common/cl_util';
import { findMatchPairExactP, isSpace } from '../collect_util';

import type { ScanDocRes } from './ScanDocRes';

const suppliedPParameterSet = new Set(['&optional', '&key']);

function processRecList(
  varsStr: string, baseInd: number, scanDocRes: ScanDocRes,
  keywordStatus: string, allowDestructuring = false
): Map<string, [number, number]> {
  let res: Map<string, [number, number]> = new Map<string, [number, number]>();

  let currName = '';
  let currStart = -1;
  let i = 1;

  // console.log(`processRecList: ${varsStr}`);

  while (i < varsStr.length) {
    //console.log(`${i}: ${varsStr[i]}|${currName}|${currStart}`);

    if (varsStr[i] === ';') {
      while (i < varsStr.length && varsStr[i] !== '\n') {
        //console.log(`LC| ${index}: ${doc[index]}`);
        ++i;
      }

    } else if (varsStr[i] === '|' && varsStr[i - 1] === '#') {
      while (i < varsStr.length && (varsStr[i] !== '#' || varsStr[i - 1] !== '|')) {
        //console.log(`BC| ${index}: ${doc[index]}`);
        ++i;
      }

    } else if (varsStr[i] === '#') {
      const idx = skipReaderMarcro(i, baseInd, varsStr, scanDocRes.pairMap);
      if (idx < 0) {
        return res;
      }
      i = idx;

    } else if (clValidSymbolSingleCharColonSet.has(varsStr[i])) {
      // `var`
      if (currStart === -1) {
        currStart = i;
      }

      currName += varsStr[i];
      ++i;

    } else if (varsStr[i] === '(') {
      // `( var`
      const idx = findMatchPairExactP(baseInd + i, scanDocRes.pairMap);
      if (idx === -1) {
        return res;
      }
      const newInd = idx - baseInd;
      if (varsStr[i - 1] === '`' || varsStr[i - 1] === '\'') {
        // skip pair
        i = newInd;
        continue;
      }

      if (!allowDestructuring || keywordStatus !== '') {
        const needPParameter = suppliedPParameterSet.has(keywordStatus);
        justEatOneVar(i + 1, baseInd, varsStr, newInd, scanDocRes, res, needPParameter); // i+1 skip current `(`
      } else {
        //console.log(`Rec...ing|${keywordStatus} at ${i}, ${baseInd + i}`);
        const workingStr = varsStr.substring(i, newInd);
        const addRes = processRecList(workingStr, baseInd + i, scanDocRes, '', allowDestructuring);
        res = new Map([...res, ...addRes]);
      }
      i = newInd;

    } else if (isSpace(varsStr[i]) || varsStr[i] === ')') {
      // cannot find match anymore
      const endState = endName(currName, currStart, baseInd, res);
      if (endState === -1) {
        keywordStatus = currName.toLowerCase();
      }

      currStart = -1;
      currName = '';
      ++i;

    } else {
      ++i;
    }
  }
  // console.log(res);
  return res;
}

function justEatOneVar(
  i: number, baseInd: number, varsStr: string, newInd: number, scanDocRes: ScanDocRes,
  res: Map<string, [number, number]>, needPParameter = false
): boolean {
  let varName = '';
  let varStart = -1;

  // (var [init-form [supplied-p-parameter]]) total 3 items
  let countItem = 0;

  while (i < newInd) {
    if (varsStr[i] === ';') {
      while (i < newInd && varsStr[i] !== '\n') {
        ++i;
      }

    } else if (varsStr[i] === '|' && varsStr[i - 1] === '#') {
      while (i < newInd && (varsStr[i] !== '#' || varsStr[i - 1] !== '|')) {
        ++i;
      }

    } else if (clValidSymbolSingleCharColonSet.has(varsStr[i])) {
      if (varStart === -1) {
        varStart = i;
      }
      varName += varsStr[i];
      ++i;

    } else if (needPParameter && countItem === 1 && varsStr[i] === '(') {
      const idx = findMatchPairExactP(baseInd + i, scanDocRes.pairMap);
      if (idx === -1) {
        return false;
      }
      const newInd = idx - baseInd;
      i = newInd;
      countItem = 2;

    } else if (isSpace(varsStr[i]) || varsStr[i] === ')') {
      // cannot find match anymore
      if (needPParameter) {
        if (countItem === 0) {
          if (endName(varName, varStart, baseInd, res) === 1) {
            countItem = 1;
          }
        } else if (countItem === 1) {
          if (endName(varName, varStart, baseInd, res, true) === 1) {
            countItem = 2;
          }
        } else if (countItem === 2) {
          if (endName(varName, varStart, baseInd, res) === 1) {
            return true;
          }
        }

      } else {
        if (endName(varName, varStart, baseInd, res) === 1) {
          return true;
        }
      }

      varStart = -1;
      varName = '';
      ++i;
    } else {
      ++i;
    }

  }
  return false;
}

function skipReaderMarcro(i: number, baseInd: number, varsStr: string, pairMap: Map<number, number>): number {
  //skip reader macro #+ & #-
  if (i + 1 < varsStr.length && (varsStr[i + 1] === '+' || varsStr[i + 1] === '-')) {
    if (i + 2 < varsStr.length) {

      if (varsStr[i + 2] === '(' && i + 3 < varsStr.length) {
        // skip pair
        const newInd = findMatchPairExactP(baseInd + i + 2, pairMap);
        return newInd - baseInd;
      } else {
        // skip str
        while (i < varsStr.length && !isSpace(varsStr[i]) && varsStr[i] !== ')') {
          ++i;
        }
        return i;
      }

    } else {
      return -1;
    }
  }

  ++i;
  return i;
}

function endName(
  currName: string, currStart: number, baseInd: number, res: Map<string, [number, number]>, drop = false
): number {
  // just no dup reset
  if (currName && currStart !== -1 && currName !== '.' && !currName.includes(':')) {
    if (currName.startsWith('&')) {
      return -1;
    } else {
      //console.log(`endStr|${currName}: ${baseInd + currStart} -> ${baseInd + currStart + currName.length}`);
      if (!drop) {
        res.set(currName, [baseInd + currStart, baseInd + currStart + currName.length]);
      }
      return 1;
    }

  }
  return 0;
}

// `varStr` must start from and contain first '('
// `leftPOffset` is the absolute index of whole text when i == 0 [ind at '(']
function processVars(
  leftPOffset: number, scanDocRes: ScanDocRes, validUpper: number, allowDestructuring: boolean,
): [Map<string, [number, number]>, number] | undefined {
  //const res: Map<string, [number, number]> = new Map<string, [number, number]>();

  const varsStrStart = leftPOffset;
  const varsStrEnd: number = findMatchPairExactP(leftPOffset, scanDocRes.pairMap, validUpper);
  if (varsStrEnd === -1) {
    return undefined;
  }
  const varsStr = scanDocRes.text.substring(varsStrStart, varsStrEnd);

  return [processRecList(varsStr, leftPOffset, scanDocRes, '', allowDestructuring), varsStrEnd];
}

export { processVars };
