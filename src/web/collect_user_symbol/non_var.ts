import * as vscode from 'vscode';

import type { ScanDocRes } from './ScanDocRes';
import { SymbolInfo } from './SymbolInfo';
import { processVars } from './lambda_list';
import { findMatchPairExactP, addToDictArr, checkDefName, getValidGroupInd, isRangeIntExcludedRanges } from './user_symbol_util';

const notAllowDes = new Set(['defsetf', 'define-modify-macro', 'defgeneric', 'defmethod', 'defun', 'define-method-combination']);
const allowDes = new Set(['defmacro', 'define-compiler-macro', 'define-setf-expander']);

function collectKeyword(regex: RegExp, nameGroup: number[], document: vscode.TextDocument, text: string, excludedRange: [number, number][]): Map<string, SymbolInfo[]> {
  const uri = document.uri;

  const defNames: Map<string, SymbolInfo[]> = new Map<string, SymbolInfo[]>();

  const matchRes = text.matchAll(regex);

  for (const r of matchRes) {
    if (r.indices === undefined) {
      continue;
    }

    // add function name
    const defName = checkDefName(r, nameGroup);
    const numRange = getValidGroupInd(r.indices, nameGroup);
    if (defName === undefined || numRange === undefined) {
      continue;
    }

    if (isRangeIntExcludedRanges(numRange, excludedRange)) {
      continue;
    }

    let kind = vscode.SymbolKind.Function;
    if (r[3] === 'deftype') {
      kind = vscode.SymbolKind.TypeParameter;
    } else if (r[3] === 'defpackage') {
      kind = vscode.SymbolKind.Package;
    } else if (r[3] === 'defconstant') {
      kind = vscode.SymbolKind.Constant;
    } else if (r[3] === 'defstruct') {
      kind = vscode.SymbolKind.Struct;
    } else if (r[3] === 'defvar' || r[3] === 'defparameter') {
      kind = vscode.SymbolKind.Variable;
    } else if (r[3] === 'define-condition' || r[3] === 'defclass') {
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

function collectKeywordLambda(regex: RegExp, nameGroup: number[], document: vscode.TextDocument, scanDocRes: ScanDocRes, text: string, excludedRange: [number, number][]):
  [Map<string, SymbolInfo[]>, Map<string, SymbolInfo[]>] {

  const uri = document.uri;

  const defNames: Map<string, SymbolInfo[]> = new Map<string, SymbolInfo[]>();
  const lambdaNames: Map<string, SymbolInfo[]> = new Map<string, SymbolInfo[]>();

  const matchRes = text.matchAll(regex);

  for (const r of matchRes) {
    if (r.indices === undefined) {
      continue;
    }

    // add function name
    const defName = checkDefName(r, nameGroup);
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
      defName.toLowerCase(), undefined, undefined, new vscode.Location(uri, nameRange), vscode.SymbolKind.Function, numRange
    ));

    // ---------------------------------- process vars ------------------------------

    // working in currtext
    const closedParentheseInd = findMatchPairExactP(r.indices[1][0], scanDocRes.pairMap);
    if (closedParentheseInd === -1) {
      continue;
    }


    const leftPInd = r.indices[10][0];

    // get lambda list, start with `(`
    let allowDestructuring = false;
    if (notAllowDes.has(r[3])) {
      allowDestructuring = false;
    } else if (allowDes.has(r[3])) {
      allowDestructuring = true;
    } else { }

    const varsRes = processVars(leftPInd, true, allowDestructuring, scanDocRes, closedParentheseInd);
    if (varsRes === undefined) {
      continue;
    }
    const [vars, varsStrEnd] = varsRes;

    for (const [nn, rang] of vars) {
      if (isRangeIntExcludedRanges(rang, excludedRange)) {
        continue;
      }
      const lexicalScope: [number, number] = [varsStrEnd, closedParentheseInd];

      const range = new vscode.Range(
        document.positionAt(rang[0]),
        document.positionAt(rang[1]),
      );

      addToDictArr(lambdaNames, nn.toLowerCase(), new SymbolInfo(
        nn.toLowerCase(), defName.toLowerCase(), lexicalScope, new vscode.Location(uri, range), vscode.SymbolKind.Variable, rang
      ));
    }

  }

  //console.log(lambdaNames);
  return [defNames, lambdaNames];
}


function collectGlobalDef(document: vscode.TextDocument, scanDocRes: ScanDocRes, excludedRange: [number, number][]):
  [Map<string, SymbolInfo[]>, Map<string, SymbolInfo[]>] {

  // commonlisp.yaml def-name
  const keywordLambdaList = /(?<=#'|\s|^)(\()(\s*)(defsetf|define-modify-macro|defgeneric|defmethod|defun|defmacro|define-method-combination|define-compiler-macro|define-setf-expander)\s+(\(\s*([#:A-Za-z0-9\+\-\*\/\@\$\%\^\&\_\=\<\>\~\!\?\[\]\{\}\.]+)\s*([#:A-Za-z0-9\+\-\*\/\@\$\%\^\&\_\=\<\>\~\!\?\[\]\{\}\.]+?)|([#:A-Za-z0-9\+\-\*\/\@\$\%\^\&\_\=\<\>\~\!\?\[\]\{\}\.]+?))((\s|\)))\s*(\()/igmd;

  // Note `defsetf` short form is matched below, long form is matched above, dup def-name is okay
  const keyword1 = /(?<=#'|\s|^)(\()(\s*)(defsetf|define-symbol-macro|deftype|defpackage|defconstant|defstruct|defvar|defparameter|define-condition|defclass)\s+\(?\s*([#:A-Za-z0-9\+\-\*\/\@\$\%\^\&\_\=\<\>\~\!\?\[\]\{\}\.]+?)(?=(\s|\(|\)))/igmd;

  const [defNames0, lambdaNames] = collectKeywordLambda(keywordLambdaList, [6, 7], document, scanDocRes, scanDocRes.text, excludedRange);
  const defNames1 = collectKeyword(keyword1, [4], document, scanDocRes.text, excludedRange);

  const defNames: Map<string, SymbolInfo[]> = new Map<string, SymbolInfo[]>();
  const dicts = [defNames0, defNames1];
  for (const d of dicts) {
    for (const [k, info] of d) {
      if (!defNames.has(k)) {
        defNames.set(k, []);
      }
      defNames.get(k)!.push(...info);
    }
  }

  return [defNames, lambdaNames];
}

function collectLocalDef(document: vscode.TextDocument, scanDocRes: ScanDocRes, excludedRange: [number, number][]):
  [Map<string, SymbolInfo[]>, Map<string, SymbolInfo[]>] {
  const uri = document.uri;
  const text = scanDocRes.text;
  const defLocalNames: Map<string, SymbolInfo[]> = new Map<string, SymbolInfo[]>();
  const localLambdaNames: Map<string, SymbolInfo[]> = new Map<string, SymbolInfo[]>();

  // commonlisp.yaml # keyword ((name (params)
  const matchRes = text.matchAll(/(?<=#'|\s|^)(\()(\s*)(macrolet|labels|flet)\s+(\()\s*(\()\s*([#:A-Za-z0-9\+\-\*\/\@\$\%\^\&\_\=\<\>\~\!\?\[\]\{\}\.]+?)((\s|\)))\s*(\()/igmd);

  for (const r of matchRes) {
    if (r.indices === undefined) {
      continue;
    }

    const defLocalName = checkDefName(r, [6]);
    if (defLocalName === undefined) {
      continue;
    }

    const nameRangeInd = r.indices[6];
    if (isRangeIntExcludedRanges(nameRangeInd, excludedRange)) {
      continue;
    }

    // working in currtext
    const closedParentheseInd = findMatchPairExactP(r.indices[1][0], scanDocRes.pairMap);
    if (closedParentheseInd === -1) {
      continue;
    }

    // get lexical scope
    let lexicalScope: [number, number] | undefined = undefined;
    if (r[3] === 'flet' || r[3] === 'macrolet') {
      // lexical scope valid after definition, that is, after next '()' pair
      const startValidPos = findMatchPairExactP(r.indices[4][0], scanDocRes.pairMap, closedParentheseInd);
      if (startValidPos === -1) {
        continue;
      }
      lexicalScope = [startValidPos, closedParentheseInd];

    } else if (r[3] === 'labels') {
      // lexical scope is valid immediately in definition itself
      lexicalScope = [r.indices[7][1], closedParentheseInd];

    } else { }
    if (lexicalScope === undefined) {
      continue;
    }

    const nameRange = new vscode.Range(
      document.positionAt(nameRangeInd[0]),
      document.positionAt(nameRangeInd[1]),
    );

    addToDictArr(defLocalNames, defLocalName.toLowerCase(), new SymbolInfo(
      defLocalName.toLowerCase(), r[3].toLowerCase(), lexicalScope, new vscode.Location(uri, nameRange), vscode.SymbolKind.Function, nameRangeInd
    ));

    // ---------------------------------- process vars ------------------------------

    // working in currtext
    const secondLeftPInd = r.indices[9][0];

    // get lambda list, start with `(`
    let allowDestructuring = false;
    if (r[3] === 'flet' || r[3] === 'labels') {
      allowDestructuring = true;
    } else if (r[3] === 'macrolet') {
      allowDestructuring = false;
    } else {
    }
    const varsRes = processVars(secondLeftPInd, true, allowDestructuring, scanDocRes, closedParentheseInd);
    if (varsRes === undefined) {
      continue;
    }
    const [vars, varsStrEnd] = varsRes;

    // get lexical scope for lambda list
    for (const [nn, rang] of vars) {
      if (isRangeIntExcludedRanges(rang, excludedRange)) {
        continue;
      }
      const secondLexicalScope: [number, number] = [varsStrEnd, closedParentheseInd];
      const range = new vscode.Range(
        document.positionAt(rang[0]),
        document.positionAt(rang[1]),
      );

      addToDictArr(localLambdaNames, nn.toLowerCase(), new SymbolInfo(
        nn.toLowerCase(), defLocalName.toLowerCase(), secondLexicalScope, new vscode.Location(uri, range), vscode.SymbolKind.Variable, rang
      ));
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
