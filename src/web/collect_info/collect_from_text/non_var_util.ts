import * as vscode from 'vscode';

import { isRangeIntExcludedRanges, bisectLeft } from '../../common/algorithm';
import { clValidSymbolSingleCharColonSet } from '../../common/cl_util';
import { SymbolInfo } from '../SymbolInfo';
import { addToDictArr, findMatchPairExactP, isSpace } from '../collect_util';

import type { ScanDocRes } from './ScanDocRes';
import { processVars } from './lambda_list';

const notAllowDes = new Set([
  'defsetf', 'define-modify-macro', 'defgeneric',
  'defmethod', 'defun', 'define-method-combination'
]);
const allowDes = new Set(['defmacro', 'define-compiler-macro', 'define-setf-expander']);
function allowDestructuring(currK: string) {
  if (notAllowDes.has(currK)) {
    return false;
  } else if (allowDes.has(currK)) {
    return true;
  } else {
    return false;
  }
}

function getKind(currK: string) {
  if (currK === 'deftype') {
    return vscode.SymbolKind.TypeParameter;
  } else if (currK === 'defpackage') {
    return vscode.SymbolKind.Package;
  } else if (currK === 'defconstant') {
    return vscode.SymbolKind.Constant;
  } else if (currK === 'defstruct') {
    return vscode.SymbolKind.Struct;
  } else if (currK === 'defvar' || currK === 'defparameter') {
    return vscode.SymbolKind.Variable;
  } else if (currK === 'define-condition' || currK === 'defclass') {
    return vscode.SymbolKind.Class;
  } else {
    return vscode.SymbolKind.Function;
  }
}

// `define-symbol-macro` has no docStr
// `lambda` is not included since it usually has no name
// `flet, labels, macrolet` are implemented separately
//
// documentation ] or documentation]
const hasDocStrRaw = new Set([
  'define-compiler-macro', 'defmacro', 'deftype', 'defun', 'defsetf', 'define-setf-expander',
  'defmethod', 'define-method-combination', 'defparameter', 'defvar', 'define-modify-macro', 'defstruct',
  'defconstant',
]);
// (:documentation string)
const hasDocStrKeyword = new Set([
  // 'define-method-combination', // actually not need to be captured here, it was captured in Raw
  'defgeneric', 'defpackage', 'define-condition', 'defclass',
]);

function getDocStr(currK: string, getDocStart: number, closedParentheseInd: number, scanDocRes: ScanDocRes) {
  if (hasDocStrRaw.has(currK)) {
    const getDocText = scanDocRes.text.substring(getDocStart, closedParentheseInd);
    return getDocStrRaw(getDocStart, getDocText, scanDocRes);
  } else if (hasDocStrKeyword.has(currK)) {
    const getDocText = scanDocRes.text.substring(getDocStart, closedParentheseInd);
    return getDocStrKeyword(getDocStart, getDocText, scanDocRes);
  } else {
    return undefined;
  }
}

function getDocStrRaw(
  baseInd: number, varsStr: string, scanDocRes: ScanDocRes,
): string | undefined {
  const upper = varsStr.length;
  let i = 0;
  while (i < upper) {
    if (varsStr[i] === ';') {
      while (i < upper && varsStr[i] !== '\n') {
        ++i;
      }

    } else if (varsStr[i] === '|' && varsStr[i - 1] === '#') {
      while (i < upper && (varsStr[i] !== '#' || varsStr[i - 1] !== '|')) {
        ++i;
      }

    } else if (varsStr[i] === '(') {
      const idx = findMatchPairExactP(baseInd + i, scanDocRes.pairMap);
      if (idx === -1) {
        return undefined;
      }
      const newInd = idx - baseInd;
      i = newInd;
    } else if (varsStr[i] === '"') {
      const strRangeEnd = scanDocRes.stringRangeMap.get(i + baseInd);
      if (strRangeEnd !== undefined) {
        return varsStr.substring(i + 1, strRangeEnd - baseInd - 1);
      }
    } else {
      ++i;
    }
  }
  return undefined;
}

function getDocStrKeyword(
  baseInd: number, varsStr: string, scanDocRes: ScanDocRes,
): string | undefined {
  let varName = '';
  let pendingClose = -1;
  let gotKeyword = false;

  const upper = varsStr.length;
  let i = 0;
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
      varName += varsStr[i];
      ++i;

    } else if (varsStr[i] === '(') {
      const idx = findMatchPairExactP(baseInd + i, scanDocRes.pairMap);
      if (idx === -1) {
        return undefined;
      }
      pendingClose = idx - baseInd;
      ++i;

    } else if (pendingClose !== -1 && (isSpace(varsStr[i]) || varsStr[i] === ')')) {
      if (varName && varName.toLowerCase().includes(':documentation')) {
        gotKeyword = true;
        ++i;
      } else {
        i = pendingClose;
        pendingClose = -1;
      }
      varName = '';

    } else if (gotKeyword && varsStr[i] === '"') {
      const strRangeEnd = scanDocRes.stringRangeMap.get(i + baseInd);
      if (strRangeEnd !== undefined) {
        return varsStr.substring(i + 1, strRangeEnd - baseInd - 1);
      }
    } else {
      ++i;
    }
  }
  return undefined;
}

function hasFirstKeyword(
  keywordStatus: string, varsStr: string
): boolean {
  let varName = '';
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
      varName += varsStr[i];
      ++i;

    } else if (varName && (isSpace(varsStr[i]) || varsStr[i] === ')')) {
      // cannot find match anymore
      if (varName.toLowerCase() === keywordStatus) {
        return true;
      } else {
        return false;
      }
    } else {
      ++i;
    }

  }
  return false;
}

function addNextPVars(
  fromNumPos: number, keywordStatus: string | undefined,
  scanDocRes: ScanDocRes, excludedRange: [number, number][], document: vscode.TextDocument,
  closedParentheseInd: number, lambdaNames: Map<string, SymbolInfo[]>, containerName: string
): number | undefined {
  const idx = bisectLeft(scanDocRes.pair, fromNumPos, item => item[0]);
  if (idx === -1 || scanDocRes.pair.length === idx) {
    return undefined;
  }
  const nextPOpen = scanDocRes.pair[idx][0];
  const nextPClose = scanDocRes.pair[idx][1];
  if (keywordStatus !== undefined && !hasFirstKeyword(
    keywordStatus, scanDocRes.text.substring(nextPOpen + 1, nextPClose)
  )) {
    return undefined;
  }

  const varsRes = processVars(nextPOpen, scanDocRes, nextPClose + 1, false);
  if (varsRes === undefined) {
    return nextPClose;
  }

  for (const [nn, rang] of varsRes[0]) {
    const nnLower = nn.toLowerCase();
    if (isRangeIntExcludedRanges(rang, excludedRange)) {
      continue;
    }

    const lexicalScope: [number, number] = [rang[1], closedParentheseInd];

    addToDictArr(lambdaNames, nnLower, new SymbolInfo(
      document, nnLower, containerName, lexicalScope,
      vscode.SymbolKind.Variable, rang
    ));
  }

  return nextPClose;
}

function getDefineMethodCombinationOtherVars(
  startPos: number,
  scanDocRes: ScanDocRes, excludedRange: [number, number][], document: vscode.TextDocument,
  closedParentheseInd: number, lambdaNames: Map<string, SymbolInfo[]>, containerName: string
) {
  // method-group-specifier
  const argsNumPos = addNextPVars(
    startPos, undefined,
    scanDocRes, excludedRange, document,
    closedParentheseInd, lambdaNames, containerName
  );
  if (argsNumPos === undefined) {
    return;
  }
  // args-lambda-list
  const genFunSymbolNumPos = addNextPVars(
    argsNumPos, ':arguments',
    scanDocRes, excludedRange, document,
    closedParentheseInd, lambdaNames, containerName
  );
  if (genFunSymbolNumPos === undefined) {
    return;
  }
  // generic-function-symbol
  addNextPVars(
    genFunSymbolNumPos, ':generic-function',
    scanDocRes, excludedRange, document,
    closedParentheseInd, lambdaNames, containerName
  );
}

function getDefsetfStoreVar(
  lambdaNames: Map<string, SymbolInfo[]>,
  document: vscode.TextDocument, scanDocRes: ScanDocRes,
  leftPInd: number, closedParentheseInd: number, defNameLower: string,
  excludedRange: [number, number][]
) {
  // (store-variable*)
  const idx = scanDocRes.pair.findIndex(item => item[0] === leftPInd);
  if (idx === -1) {
    return;
  }

  const [openStoreVar, closeStoreVarP] = scanDocRes.pair[idx + 1];
  const closeStoreVar = closeStoreVarP + 1;
  if (closeStoreVar >= closedParentheseInd) {
    return;
  }

  const varsRes = processVars(openStoreVar, scanDocRes, closeStoreVar, false);
  if (varsRes === undefined) {
    return;
  }

  const [vars, varsStrEnd] = varsRes;
  for (const [nn, rang] of vars) {
    const nnLower = nn.toLowerCase();
    if (isRangeIntExcludedRanges(rang, excludedRange)) {
      continue;
    }

    const lexicalScope: [number, number] = [rang[1], closedParentheseInd];

    addToDictArr(lambdaNames, nnLower, new SymbolInfo(
      document, nnLower, defNameLower, lexicalScope,
      vscode.SymbolKind.Variable, rang
    ));
  }

}

export {
  getKind,
  allowDestructuring,
  getDocStrRaw, getDocStrKeyword, getDocStr,
  getDefineMethodCombinationOtherVars,
  getDefsetfStoreVar
};
