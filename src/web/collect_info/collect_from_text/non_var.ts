import * as vscode from 'vscode';

import { isRangeIntExcludedRanges, bisectLeft } from '../../common/algorithm';
import { SymbolInfo } from '../SymbolInfo';
import {
  findMatchPairExactP, addToDictArr,
  getValidGroupRes, getValidGroupInd,
} from '../collect_util';

import type { ScanDocRes } from './ScanDocRes';
import { processVars } from './lambda_list';
import {
  getKind, allowDestructuring, getDocStrRaw, getDocStr,
  getDefsetfStoreVar, getDefineMethodCombinationOtherVars
} from './non_var_util';

function collectKeyword(
  regex: RegExp, nameGroup: number[], document: vscode.TextDocument, scanDocRes: ScanDocRes,
  excludedRange: [number, number][]
): Map<string, SymbolInfo[]> {
  const text = scanDocRes.text;

  const defNames: Map<string, SymbolInfo[]> = new Map<string, SymbolInfo[]>();

  const matchRes = text.matchAll(regex);
  for (const r of matchRes) {
    if (r.indices === undefined) {
      continue;
    }

    // add function name
    const defName = getValidGroupRes(r, nameGroup);
    const numRange = getValidGroupInd(r.indices, nameGroup);
    if (defName === undefined || numRange === undefined) {
      continue;
    }
    const defNameLower = defName.toLowerCase();

    if (isRangeIntExcludedRanges(numRange, excludedRange)) {
      continue;
    }

    const closedParentheseInd = findMatchPairExactP(r.indices[1][0], scanDocRes.pairMap);
    if (closedParentheseInd === -1) {
      continue;
    }

    const currK = r[3].toLowerCase();
    const docStr = getDocStr(currK, r.indices[4][1], closedParentheseInd, scanDocRes);
    const kind = getKind(currK);

    addToDictArr(defNames, defNameLower, new SymbolInfo(
      document, defNameLower, undefined, undefined, kind, numRange, docStr
    ));
  }
  return defNames;
}

function collectKeywordLambda(
  regex: RegExp, nameGroup: number[], pGroup: number[], document: vscode.TextDocument, scanDocRes: ScanDocRes,
  excludedRange: [number, number][]
): [Map<string, SymbolInfo[]>, Map<string, SymbolInfo[]>] {
  const text = scanDocRes.text;

  const defNames: Map<string, SymbolInfo[]> = new Map<string, SymbolInfo[]>();
  const lambdaNames: Map<string, SymbolInfo[]> = new Map<string, SymbolInfo[]>();

  const matchRes = text.matchAll(regex);

  for (const r of matchRes) {
    if (r.indices === undefined) {
      continue;
    }

    // add function name
    const defName = getValidGroupRes(r, nameGroup);
    const numRange = getValidGroupInd(r.indices, nameGroup);
    if (defName === undefined || numRange === undefined) {
      continue;
    }
    const defNameLower = defName.toLowerCase();

    if (isRangeIntExcludedRanges(numRange, excludedRange)) {
      continue;
    }

    const closedParentheseInd = findMatchPairExactP(r.indices[pGroup[0]][0], scanDocRes.pairMap);
    if (closedParentheseInd === -1) {
      continue;
    }
    // ---------------------------------- process vars ------------------------------

    // working in currtext
    const leftPInd = r.indices[pGroup[1]][0];

    // get lambda list, start with `(`
    const currK = r[3].toLowerCase();
    const varsRes = processVars(leftPInd, scanDocRes, closedParentheseInd, allowDestructuring(currK));
    if (varsRes === undefined) {
      continue;
    }
    const [vars, varsStrEnd] = varsRes;

    const docStr = getDocStr(currK, varsStrEnd, closedParentheseInd, scanDocRes);

    // is deferred to get docStr
    addToDictArr(defNames, defNameLower, new SymbolInfo(
      document, defNameLower, undefined, undefined,
      vscode.SymbolKind.Function, numRange, docStr
    ));

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

    if (currK === 'defsetf') {
      getDefsetfStoreVar(
        lambdaNames, document, scanDocRes,
        leftPInd, closedParentheseInd, defNameLower,
        excludedRange
      );
    }

    if (currK === 'define-method-combination') {
      getDefineMethodCombinationOtherVars(
        varsStrEnd, scanDocRes, excludedRange, document,
        closedParentheseInd, lambdaNames, defNameLower
      );
    }

  }
  //console.log(lambdaNames);
  return [defNames, lambdaNames];
}

function collectGlobalDef(
  document: vscode.TextDocument, scanDocRes: ScanDocRes, excludedRange: [number, number][]
): [Map<string, SymbolInfo[]>, Map<string, SymbolInfo[]>] {

  // commonlisp.yaml def-name
  const keywordLambdaList = /(?<=#'|^|\s|\(|,@|,\.|,)(\()(\s*)(defsetf|define-modify-macro|defgeneric|defun|defmacro|define-method-combination|define-compiler-macro|define-setf-expander)\s+(\(\s*([#:A-Za-z0-9\+\-\*\/\@\$\%\^\&\_\=\<\>\~\!\?\[\]\{\}\.]+)\s*([#:A-Za-z0-9\+\-\*\/\@\$\%\^\&\_\=\<\>\~\!\?\[\]\{\}\.]+?)|([#:A-Za-z0-9\+\-\*\/\@\$\%\^\&\_\=\<\>\~\!\?\[\]\{\}\.]+?))((\s|\)))\s*(\()/igmd;
  const keywordLambdaListMethod = /(?<=#'|^|\s|\(|,@|,\.|,)(\()(\s*)(defmethod)\s+(\(\s*([#:A-Za-z0-9\+\-\*\/\@\$\%\^\&\_\=\<\>\~\!\?\[\]\{\}\.]+)\s*([#:A-Za-z0-9\+\-\*\/\@\$\%\^\&\_\=\<\>\~\!\?\[\]\{\}\.]+?)|([#:A-Za-z0-9\+\-\*\/\@\$\%\^\&\_\=\<\>\~\!\?\[\]\{\}\.]+?))((\s|\)))\s*[#:A-Za-z0-9\+\-\*\/\@\$\%\^\&\_\=\<\>\~\!\?\[\]\{\}\.]*?\s*(\()/igmd;

  // Note `defsetf` and `define-method-combination`
  // short form is matched below, long form is matched above, dup def-name is okay
  const keyword1 = /(?<=#'|^|\s|\(|,@|,\.|,)(\()(\s*)(defsetf|define-method-combination|define-symbol-macro|deftype|defpackage|defconstant|defstruct|defvar|defparameter|define-condition|defclass)\s+\(?\s*([#:A-Za-z0-9\+\-\*\/\@\$\%\^\&\_\=\<\>\~\!\?\[\]\{\}\.]+?)(?=(\s|\(|\)))/igmd;

  const defNames0 = collectKeyword(keyword1, [4], document, scanDocRes, excludedRange);
  const [defNames1, lambdaNames1] = collectKeywordLambda(
    keywordLambdaList, [6, 7], [1, 10], document, scanDocRes, excludedRange
  );
  const [defNames2, lambdaNames2] = collectKeywordLambda(
    keywordLambdaListMethod, [6, 7], [1, 10], document, scanDocRes, excludedRange
  );


  const defNames: Map<string, SymbolInfo[]> = new Map<string, SymbolInfo[]>();
  for (const d of [defNames0, defNames1, defNames2]) {
    for (const [k, info] of d) {
      if (!defNames.has(k)) {
        defNames.set(k, []);
      }
      defNames.get(k)!.push(...info);
    }
  }
  const lambdaNames: Map<string, SymbolInfo[]> = new Map<string, SymbolInfo[]>();
  for (const d of [lambdaNames1, lambdaNames2]) {
    for (const [k, info] of d) {
      if (!lambdaNames.has(k)) {
        lambdaNames.set(k, []);
      }
      lambdaNames.get(k)!.push(...info);
    }
  }

  return [defNames, lambdaNames];
}

function subBlock(
  baseInd: number,
  subMatchRes: RegExpMatchArray | null,
  document: vscode.TextDocument,
  scanDocRes: ScanDocRes,
  excludedRange: [number, number][],
  lexicalScope: [number, number] | undefined,
  closedParentheseInd: number,
  multiContainClose: number,
  allowDestructuring: boolean,
  defLocalNames: Map<string, SymbolInfo[]>,
  localLambdaNames: Map<string, SymbolInfo[]>
) {
  if (subMatchRes === null) {
    return false;
  }

  // start matching
  const defLocalName = getValidGroupRes(subMatchRes, [2]);
  if (defLocalName === undefined) {
    return false;
  }
  const defLocalNameLower = defLocalName.toLowerCase();
  const nameRangeInd: [number, number] = [subMatchRes.indices![2][0] + baseInd, subMatchRes.indices![2][1] + baseInd];
  if (isRangeIntExcludedRanges(nameRangeInd, excludedRange)) {
    return false;
  }
  // ---------------------------------- process vars ------------------------------

  // working in currtext
  const secondLeftPInd = subMatchRes.indices![3][0] + baseInd;
  const varsRes = processVars(secondLeftPInd, scanDocRes, multiContainClose, allowDestructuring);
  if (varsRes === undefined) {
    return false;
  }
  const [vars, varsStrEnd] = varsRes;

  const docStr = getDocStrRaw(varsStrEnd, scanDocRes.text.substring(varsStrEnd, multiContainClose), scanDocRes);
  lexicalScope = (lexicalScope === undefined) ? [nameRangeInd[1], closedParentheseInd] : lexicalScope;

  // is deferred to get docStr
  addToDictArr(defLocalNames, defLocalNameLower, new SymbolInfo(
    document, defLocalNameLower, subMatchRes[3].toLowerCase(),
    lexicalScope, vscode.SymbolKind.Function, nameRangeInd, docStr
  ));

  // get lexical scope for lambda list
  for (const [nn, rang] of vars) {
    const nnLower = nn.toLowerCase();
    if (isRangeIntExcludedRanges(rang, excludedRange)) {
      continue;
    }

    const secondLexicalScope: [number, number] = [rang[1], multiContainClose];

    addToDictArr(localLambdaNames, nnLower, new SymbolInfo(
      document, nnLower, defLocalNameLower,
      secondLexicalScope, vscode.SymbolKind.Variable, rang
    ));
  }

  return true;
}

function collectLocalDef(
  document: vscode.TextDocument, scanDocRes: ScanDocRes, excludedRange: [number, number][]
): [Map<string, SymbolInfo[]>, Map<string, SymbolInfo[]>] {
  const defLocalNames: Map<string, SymbolInfo[]> = new Map<string, SymbolInfo[]>();
  const localLambdaNames: Map<string, SymbolInfo[]> = new Map<string, SymbolInfo[]>();

  const text = scanDocRes.text;
  // commonlisp.yaml # keyword ((name (params)
  const matchRes = text.matchAll(/(?<=#'|^|\s|\(|,@|,\.|,)(\()(\s*)(macrolet|labels|flet)\s+(\()\s*(\()/igmd);

  for (const r of matchRes) {
    if (r.indices === undefined) {
      continue;
    }

    const closedParentheseInd = findMatchPairExactP(r.indices[1][0], scanDocRes.pairMap);
    if (closedParentheseInd === -1) {
      continue;
    }

    // working in currtext
    const multiContainOpen = r.indices[4][0];
    const multiContainClose = findMatchPairExactP(multiContainOpen, scanDocRes.pairMap);
    if (multiContainClose === -1) {
      continue;
    }

    // get lexical scope
    let lexicalScope: [number, number] | undefined = undefined;
    const currK = r[3].toLowerCase();
    if (currK === 'flet' || currK === 'macrolet') {
      // lexical scope valid after definition, that is, after next '()' pair
      const startValidPos = findMatchPairExactP(multiContainOpen, scanDocRes.pairMap, closedParentheseInd);
      if (startValidPos === -1) {
        continue;
      }
      lexicalScope = [startValidPos, closedParentheseInd];
    } else if (currK === 'labels') {
      // lexical scope is valid immediately in definition itself
      // defer to sub block
    } else { }

    // get lambda list, start with `(`
    let allowDestructuring = false;
    if (currK === 'flet' || currK === 'labels') {
      allowDestructuring = true;
    } else if (currK === 'macrolet') {
      allowDestructuring = false;
    } else { }


    // multiple definitions in this currtext (()()()...)
    const subMatch = /(?<=#'|^|\s|\(|,@|,\.|,)(\()([#:A-Za-z0-9\+\-\*\/\@\$\%\^\&\_\=\<\>\~\!\?\[\]\{\}\.]+?)\s*(\()/imd;
    let open = r.indices[5][0];
    while (open < multiContainClose) {
      const currDefClose = findMatchPairExactP(open, scanDocRes.pairMap);
      if (currDefClose === -1 || currDefClose >= multiContainClose) {
        break;
      }
      const subText = text.substring(open, currDefClose);
      const subMatchRes = subText.match(subMatch);
      if (subMatchRes !== null) {
        subBlock(
          open,
          subMatchRes, document, scanDocRes, excludedRange,
          lexicalScope, closedParentheseInd, currDefClose,
          allowDestructuring,
          defLocalNames, localLambdaNames);
      }


      const openIdx = bisectLeft(scanDocRes.pair, currDefClose, item => item[0]);
      if (openIdx === -1) {
        break;
      }
      open = scanDocRes.pair[openIdx][0];
    }
  }
  /* sort by lexical scope start, we do not need it since we have `findInnermost`
  for (const arrScope of defLocalNames.values()) {
    arrScope.sort((a, b) => {
      return a[0].start.isBefore(b[0].start) ? -1 : 1;
    });
  }
  */
  // console.log(defLocalNames);

  return [defLocalNames, localLambdaNames];
}


export {
  collectGlobalDef, collectLocalDef
};
