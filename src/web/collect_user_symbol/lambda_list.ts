import { clValidSymbolSingleCharColonSet } from '../common/cl_util';

import type { ScanDocRes } from './ScanDocRes';
import { findMatchPairExactP, isSpace } from './user_symbol_util';

const destructuringKeywordStatusSet = new Set(['&optional', '&key', '&aux']);
const pparamKeywordStatusSet = new Set(['&optional', '&key']);

function processRecList(varsStr: string, baseInd: number, scanDocRes: ScanDocRes, allowDestructuring: boolean, keywordStatus: string):
  Map<string, [number, number]> {
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

      if (!allowDestructuring) {
        justOneVarAfterP(i + 1, baseInd, varsStr, newInd, res); // i+1 skip current `(`
      } else {
        res = destructuring(i, newInd, varsStr, baseInd, scanDocRes, res, keywordStatus, allowDestructuring);
      }
      i = newInd;

    } else if (isSpace(varsStr[i]) || varsStr[i] === ')') {
      // cannot find match anymore
      const endState = endStr(currName, currStart, baseInd, res);
      if (endState === 1) {
        if (pparamKeywordStatusSet.has(keywordStatus)) {
          pparam(i, varsStr.length, varsStr, baseInd, scanDocRes, res);
        }
      } else if (endState === -1) {
        keywordStatus = currName;
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
 
function pparam(i: number, newInd: number, varsStr: string, baseInd: number, scanDocRes: ScanDocRes, res: Map<string, [number, number]>) {
  // supplied-p-parameter
  let internalInd = i;
  while (internalInd < newInd && isSpace(varsStr[internalInd])) {
    ++internalInd;
  }
  if (varsStr[internalInd] === '(') {
    const idx = findMatchPairExactP(baseInd + internalInd, scanDocRes.pairMap);
    if (idx === -1) {
      return false;
    }
    const initFormEnd = idx - baseInd;
    internalInd = initFormEnd;
  }
  while (internalInd < newInd && !isSpace(varsStr[internalInd])) {
    ++internalInd;
  }
  while (internalInd < newInd && isSpace(varsStr[internalInd])) {
    ++internalInd;
  }

  let pParam = '';
  let pParamStart = -1;
  while (internalInd < newInd && clValidSymbolSingleCharColonSet.has(varsStr[internalInd]) && varsStr[internalInd] !== ')') {
    if (!pParam) {
      pParamStart = internalInd;
    }
    pParam += varsStr[internalInd];
    ++internalInd;
  }
  if (pParam && pParamStart !== -1) {
    //console.log(`h|${pParam}: ${baseInd + pParamStart} -> ${baseInd + pParamStart + pParam.length}`);
    res.set(pParam, [baseInd + pParamStart, baseInd + pParamStart + pParam.length]);
  }
  return true;
}

function destructuringKeyword(i: number, newInd: number, varsStr: string, baseInd: number, scanDocRes: ScanDocRes, res: Map<string, [number, number]>, keywordStatus: string, allowDestructuring: boolean) {
  let varName = '';
  let varStart = -1;

  // skip current `(`
  ++i;
  while (i < newInd && isSpace(varsStr[i])) {
    ++i;
  }
  while (i < newInd) {
    // see embedded
    if (varsStr[i] === '(') {
      const idx = findMatchPairExactP(baseInd + i, scanDocRes.pairMap);
      if (idx === -1) {
        break;
      }
      const embeddedEnd = idx - baseInd;
      if (varsStr[i - 1] === '`' || varsStr[i - 1] === '\'') {
        i = embeddedEnd;
        continue;
      }
      const embeddedStr = varsStr.substring(i, embeddedEnd);

      //console.log(`Rec...ing|${keywordStatus}`)
      const addRes = processRecList(embeddedStr, baseInd + i, scanDocRes, allowDestructuring, keywordStatus);
      return new Map([...res, ...addRes]);
    }

    if (clValidSymbolSingleCharColonSet.has(varsStr[i])) {
      if (varStart === -1) {
        varStart = i;
      }
      varName += varsStr[i];
    } else if (isSpace(varsStr[i]) || varsStr[i] === ')') {
      if (varName && varStart !== -1 && varName !== '.' && !varName.includes(':')) {
        //console.log(`b|${varName}: ${baseInd + varStart} -> ${baseInd + varStart + varName.length}`);
        res.set(varName, [baseInd + varStart, baseInd + varStart + varName.length]);

        if (keywordStatus === '&optional' || keywordStatus === '&key') {
          pparam(i, newInd, varsStr, baseInd, scanDocRes, res);
        }
        break;
      }

      varName = '';
      varStart = -1;
    }

    ++i;
  }
  return res;

}

function destructuring(i: number, newInd: number, varsStr: string, baseInd: number, scanDocRes: ScanDocRes, res: Map<string, [number, number]>, keywordStatus: string, allowDestructuring: boolean) {
  // may have multiple vars in current pair
  // `( var*`
  if (destructuringKeywordStatusSet.has(keywordStatus)) {
    const workingStr = varsStr.substring(i, newInd);
    const addRes = processRecList(workingStr, baseInd + i, scanDocRes, allowDestructuring, keywordStatus);
    return new Map([...res, ...addRes]);
    //return destructuringKeyword(i, newInd, varsStr, baseInd, scanDocRes, res, keywordStatus, allowDestructuring);
  } else {
    // case: keywordStatus is ''
    // case: not &optional, &key or &aux
    // just pass current pair
    console.log(`Rec...ing|${keywordStatus} at ${i}, ${baseInd + i}`)
    const workingStr = varsStr.substring(i, newInd);
    const addRes = processRecList(workingStr, baseInd + i, scanDocRes, allowDestructuring, keywordStatus);
    return new Map([...res, ...addRes]);
  }
}

function processList(varsStr: string, baseInd: number, scanDocRes: ScanDocRes):
  Map<string, [number, number]> {
  const res: Map<string, [number, number]> = new Map<string, [number, number]>();

  let currName = '';
  let currStart = -1;
  let i = 1;

  while (i < varsStr.length) {
    //console.log(`${i}: ${varsStr[i]}|${currName}|${currStart}`);

    if (varsStr[i] === ';') {
      while (i < varsStr.length && varsStr[i] !== '\n') {
        ++i;
      }

    } else if (varsStr[i] === '|' && varsStr[i - 1] === '#') {
      while (i < varsStr.length && (varsStr[i] !== '#' || varsStr[i - 1] !== '|')) {
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

      justOneVarAfterP(i + 1, baseInd, varsStr, newInd, res); // i+1 skip current `(`
      i = newInd;

    } else if (isSpace(varsStr[i]) || varsStr[i] === ')') {
      // cannot find match anymore
      endStr(currName, currStart, baseInd, res);
      currStart = -1;
      currName = '';
      ++i;

    } else {
      ++i;
    }

  }

  return res;
}

function justOneVarAfterP(i: number, baseInd: number, varsStr: string, newInd: number, res: Map<string, [number, number]>): boolean {
  let varName = '';
  let varStart = -1;

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

    } else if (isSpace(varsStr[i]) || varsStr[i] === ')') {
      // cannot find match anymore
      if (endStr(varName, varStart, baseInd, res) === 1) {
        return true;
      }
      varStart = -1;
      varName = '';

    }

    ++i;
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

function endStr(currName: string, currStart: number, baseInd: number, res: Map<string, [number, number]>): number {
  // just no dup reset
  if (currName && currStart !== -1 && currName !== '.' && !currName.includes(':')) {
    if (currName.startsWith('&')) {
      return -1;
    } else {
      //console.log(`endStr|${currName}: ${baseInd + currStart} -> ${baseInd + currStart + currName.length}`);
      res.set(currName, [baseInd + currStart, baseInd + currStart + currName.length]);
      return 1;
    }

  }
  return 0;
}

// `varStr` must start from and contain first '('
// `leftPOffset` is the absolute index of whole text when i == 0 [ind at '(']
function processVars(leftPOffset: number, isLambdaList: boolean, allowDestructuring: boolean, scanDocRes: ScanDocRes, validUpper: number): [Map<string, [number, number]>, number] | undefined {
  //const res: Map<string, [number, number]> = new Map<string, [number, number]>();

  const varsStrStart = leftPOffset;
  const varsStrEnd: number = findMatchPairExactP(leftPOffset, scanDocRes.pairMap, validUpper);
  if (varsStrEnd === -1) {
    return undefined;
  }
  const varsStr = scanDocRes.text.substring(varsStrStart, varsStrEnd);

  if (isLambdaList) {
    return [processRecList(varsStr, leftPOffset, scanDocRes, allowDestructuring, ''), varsStrEnd];
  } else {
    return [processList(varsStr, leftPOffset, scanDocRes), varsStrEnd];
  }

}

export { processVars };
