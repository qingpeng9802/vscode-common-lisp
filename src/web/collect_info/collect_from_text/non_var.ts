import * as vscode from 'vscode';

import { bisectLeft } from '../../common/algorithm';
import type { ScanDocRes } from '../ScanDocRes';
import { SymbolInfo } from '../SymbolInfo';
import {
  findMatchPairExactP, addToDictArr, getValidGroupRes,
  getValidGroupInd, isRangeIntExcludedRanges
} from '../collect_util';

import { processVars } from './lambda_list';

const notAllowDes = new Set([
  'defsetf', 'define-modify-macro', 'defgeneric',
  'defmethod', 'defun', 'define-method-combination'
]);
const allowDes = new Set(['defmacro', 'define-compiler-macro', 'define-setf-expander']);

function collectKeyword(
  regex: RegExp, nameGroup: number[], document: vscode.TextDocument, text: string, excludedRange: [number, number][]
): Map<string, SymbolInfo[]> {
  const uri = document.uri;

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

    if (isRangeIntExcludedRanges(numRange, excludedRange)) {
      continue;
    }

    let kind = vscode.SymbolKind.Function;
    const currK = r[3].toLowerCase();
    if (currK === 'deftype') {
      kind = vscode.SymbolKind.TypeParameter;
    } else if (currK === 'defpackage') {
      kind = vscode.SymbolKind.Package;
    } else if (currK === 'defconstant') {
      kind = vscode.SymbolKind.Constant;
    } else if (currK === 'defstruct') {
      kind = vscode.SymbolKind.Struct;
    } else if (currK === 'defvar' || currK === 'defparameter') {
      kind = vscode.SymbolKind.Variable;
    } else if (currK === 'define-condition' || currK === 'defclass') {
      kind = vscode.SymbolKind.Class;
    } else { }

    const nameRange = new vscode.Range(
      document.positionAt(numRange[0]),
      document.positionAt(numRange[1]),
    );
    addToDictArr(defNames, defName.toLowerCase(), new SymbolInfo(
      defName.toLowerCase(), undefined, undefined, new vscode.Location(uri, nameRange), kind, numRange
    ));
  }
  return defNames;
}

function collectKeywordLambda(
  regex: RegExp, nameGroup: number[], pGroup: number[], document: vscode.TextDocument, scanDocRes: ScanDocRes,
  text: string, excludedRange: [number, number][]
): [Map<string, SymbolInfo[]>, Map<string, SymbolInfo[]>] {

  const uri = document.uri;

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

    if (isRangeIntExcludedRanges(numRange, excludedRange)) {
      continue;
    }

    const nameRange = new vscode.Range(
      document.positionAt(numRange[0]),
      document.positionAt(numRange[1]),
    );

    addToDictArr(defNames, defName.toLowerCase(), new SymbolInfo(
      defName.toLowerCase(), undefined, undefined,
      new vscode.Location(uri, nameRange), vscode.SymbolKind.Function, numRange
    ));

    // ---------------------------------- process vars ------------------------------

    // working in currtext
    const closedParentheseInd = findMatchPairExactP(r.indices[pGroup[0]][0], scanDocRes.pairMap);
    if (closedParentheseInd === -1) {
      continue;
    }


    const leftPInd = r.indices[pGroup[1]][0];

    // get lambda list, start with `(`
    const currK = r[3].toLowerCase();
    let allowDestructuring = false;
    if (notAllowDes.has(currK)) {
      allowDestructuring = false;
    } else if (allowDes.has(currK)) {
      allowDestructuring = true;
    } else { }

    const varsRes = processVars(leftPInd, scanDocRes, closedParentheseInd, allowDestructuring);
    if (varsRes === undefined) {
      continue;
    }
    const [vars, varsStrEnd] = varsRes;

    for (const [nn, rang] of vars) {
      if (isRangeIntExcludedRanges(rang, excludedRange)) {
        continue;
      }
      const lexicalScope: [number, number] = [rang[1], closedParentheseInd];

      const range = new vscode.Range(
        document.positionAt(rang[0]),
        document.positionAt(rang[1]),
      );

      addToDictArr(lambdaNames, nn.toLowerCase(), new SymbolInfo(
        nn.toLowerCase(), defName.toLowerCase(), lexicalScope,
        new vscode.Location(uri, range), vscode.SymbolKind.Variable, rang
      ));
    }

    if (currK === 'defsetf') {
      storeVar(
        lambdaNames, document, scanDocRes,
        leftPInd, closedParentheseInd, defName.toLowerCase(),
        excludedRange
      );
    }

  }
  //console.log(lambdaNames);
  return [defNames, lambdaNames];
}

function storeVar(
  lambdaNames: Map<string, SymbolInfo[]>,
  document: vscode.TextDocument, scanDocRes: ScanDocRes,
  leftPInd: number, closedParentheseInd: number, defNameLower: string,
  excludedRange: [number, number][]
) {
  const uri = document.uri;
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
    if (isRangeIntExcludedRanges(rang, excludedRange)) {
      continue;
    }
    const lexicalScope: [number, number] = [rang[1], closedParentheseInd];

    const range = new vscode.Range(
      document.positionAt(rang[0]),
      document.positionAt(rang[1]),
    );

    addToDictArr(lambdaNames, nn.toLowerCase(), new SymbolInfo(
      nn.toLowerCase(), defNameLower, lexicalScope,
      new vscode.Location(uri, range), vscode.SymbolKind.Variable, rang
    ));
  }

}

function collectGlobalDef(
  document: vscode.TextDocument, scanDocRes: ScanDocRes, excludedRange: [number, number][]
): [Map<string, SymbolInfo[]>, Map<string, SymbolInfo[]>] {

  // commonlisp.yaml def-name
  const keywordLambdaList = /(?<=#'|^|\s|\(|,@|,\.|,)(\()(\s*)(defsetf|define-modify-macro|defgeneric|defun|defmacro|define-method-combination|define-compiler-macro|define-setf-expander)\s+(\(\s*([#:A-Za-z0-9\+\-\*\/\@\$\%\^\&\_\=\<\>\~\!\?\[\]\{\}\.]+)\s*([#:A-Za-z0-9\+\-\*\/\@\$\%\^\&\_\=\<\>\~\!\?\[\]\{\}\.]+?)|([#:A-Za-z0-9\+\-\*\/\@\$\%\^\&\_\=\<\>\~\!\?\[\]\{\}\.]+?))((\s|\)))\s*(\()/igmd;
  const keywordLambdaListMethod = /(?<=#'|^|\s|\(|,@|,\.|,)(\()(\s*)(defmethod)\s+(\(\s*([#:A-Za-z0-9\+\-\*\/\@\$\%\^\&\_\=\<\>\~\!\?\[\]\{\}\.]+)\s*([#:A-Za-z0-9\+\-\*\/\@\$\%\^\&\_\=\<\>\~\!\?\[\]\{\}\.]+?)|([#:A-Za-z0-9\+\-\*\/\@\$\%\^\&\_\=\<\>\~\!\?\[\]\{\}\.]+?))((\s|\)))\s*[#:A-Za-z0-9\+\-\*\/\@\$\%\^\&\_\=\<\>\~\!\?\[\]\{\}\.]*?\s*(\()/igmd;

  // Note `defsetf` short form is matched below, long form is matched above, dup def-name is okay
  const keyword1 = /(?<=#'|^|\s|\(|,@|,\.|,)(\()(\s*)(defsetf|define-symbol-macro|deftype|defpackage|defconstant|defstruct|defvar|defparameter|define-condition|defclass)\s+\(?\s*([#:A-Za-z0-9\+\-\*\/\@\$\%\^\&\_\=\<\>\~\!\?\[\]\{\}\.]+?)(?=(\s|\(|\)))/igmd;

  const defNames0 = collectKeyword(keyword1, [4], document, scanDocRes.text, excludedRange);
  const [defNames1, lambdaNames1] = collectKeywordLambda(
    keywordLambdaList, [6, 7], [1, 10], document, scanDocRes, scanDocRes.text, excludedRange
  );
  const [defNames2, lambdaNames2] = collectKeywordLambda(
    keywordLambdaListMethod, [6, 7], [1, 10], document, scanDocRes, scanDocRes.text, excludedRange
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
  const nameRangeInd: [number, number] = [subMatchRes.indices![2][0] + baseInd, subMatchRes.indices![2][1] + baseInd];
  if (isRangeIntExcludedRanges(nameRangeInd, excludedRange)) {
    return false;
  }

  const nameRange = new vscode.Range(
    document.positionAt(nameRangeInd[0]),
    document.positionAt(nameRangeInd[1]),
  );

  lexicalScope = (lexicalScope === undefined) ? [nameRangeInd[1], closedParentheseInd] : lexicalScope;
  const uri = document.uri;

  addToDictArr(defLocalNames, defLocalName.toLowerCase(), new SymbolInfo(
    defLocalName.toLowerCase(), subMatchRes[3].toLowerCase(), lexicalScope,
    new vscode.Location(uri, nameRange), vscode.SymbolKind.Function, nameRangeInd
  ));

  // ---------------------------------- process vars ------------------------------

  // working in currtext
  const secondLeftPInd = subMatchRes.indices![3][0] + baseInd;
  const varsRes = processVars(secondLeftPInd, scanDocRes, multiContainClose, allowDestructuring);
  if (varsRes === undefined) {
    return false;
  }
  const [vars, varsStrEnd] = varsRes;

  // get lexical scope for lambda list
  for (const [nn, rang] of vars) {
    if (isRangeIntExcludedRanges(rang, excludedRange)) {
      continue;
    }
    const secondLexicalScope: [number, number] = [rang[1], multiContainClose];
    const range = new vscode.Range(
      document.positionAt(rang[0]),
      document.positionAt(rang[1]),
    );

    addToDictArr(localLambdaNames, nn.toLowerCase(), new SymbolInfo(
      nn.toLowerCase(), defLocalName.toLowerCase(), secondLexicalScope,
      new vscode.Location(uri, range), vscode.SymbolKind.Variable, rang
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
