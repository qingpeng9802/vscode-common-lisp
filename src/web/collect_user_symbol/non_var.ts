import * as vscode from 'vscode';

import { SymbolInfo } from './SymbolInfo';
import { processVars } from './lambda_list';
import { findMatchPairParenthese } from './pair_parser';
import { addToDictArr, checkDefName, getValidGroupInd, isRangeIntExcludedRanges } from './user_symbol_util';

function collectKeyword(regex: RegExp, nameGroup: number[], document: vscode.TextDocument, text: string, excludedRange: [number, number][]): Record<string, SymbolInfo[]> {
  const uri = document.uri;

  const defNames: Record<string, SymbolInfo[]> = {};

  const matchRes = text.matchAll(regex);

  for (const r of matchRes) {
    if (r.index === undefined || r.indices === undefined) {
      continue;
    }

    // add function name
    const defName = checkDefName(r, nameGroup);
    const nameRangeInd = getValidGroupInd(r.indices, nameGroup);
    if (defName === undefined || nameRangeInd === undefined) {
      continue;
    }

    if (isRangeIntExcludedRanges(nameRangeInd, excludedRange)) {
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
      document.positionAt(nameRangeInd[0]),
      document.positionAt(nameRangeInd[1]),
    );
    addToDictArr(defNames, defName.toLowerCase(), new SymbolInfo(
      defName.toLowerCase(), undefined, undefined, new vscode.Location(uri, nameRange), kind, nameRangeInd));
  }
  return defNames;
}

function collectKeywordLambda(regex: RegExp, nameGroup: number[], document: vscode.TextDocument, text: string, excludedRange: [number, number][]):
  [Record<string, SymbolInfo[]>, Record<string, SymbolInfo[]>] {

  const uri = document.uri;

  const defNames: Record<string, SymbolInfo[]> = {};
  const lambdaNames: Record<string, SymbolInfo[]> = {};

  const matchRes = text.matchAll(regex);

  for (const r of matchRes) {
    if (r.index === undefined || r.indices === undefined) {
      continue;
    }

    // add function name
    const defName = checkDefName(r, nameGroup);
    const nameRangeInd = getValidGroupInd(r.indices, nameGroup);
    if (defName === undefined || nameRangeInd === undefined) {
      continue;
    }

    if (isRangeIntExcludedRanges(nameRangeInd, excludedRange)) {
      continue;
    }

    const nameRange = new vscode.Range(
      document.positionAt(nameRangeInd[0]),
      document.positionAt(nameRangeInd[1]),
    );

    addToDictArr(
      defNames, defName.toLowerCase(),
      new SymbolInfo(
        defName.toLowerCase(), undefined, undefined, new vscode.Location(uri, nameRange), vscode.SymbolKind.Function, nameRangeInd
      )
    );

    // ---------------------------------- process vars ------------------------------

    // working in currtext
    const openParentheseInd = r.indices[3][0];

    const closedParentheseInd = findMatchPairParenthese(openParentheseInd, text);
    if (closedParentheseInd === -1) {
      continue;
    }

    const currText = text.substring(openParentheseInd, closedParentheseInd);
    const leftPInd = r.indices[10][0];

    // get lambda list, start with `(`
    let allowDestructuring = false;
    if (['defsetf', 'define-modify-macro', 'defgeneric', 'defmethod', 'defun', 'define-method-combination'].includes(r[3])) {
      allowDestructuring = false;
    } else if (['defmacro', 'define-compiler-macro', 'define-setf-expander'].includes(r[3])) {
      allowDestructuring = true;
    } else { }

    const varsRes = processVars(leftPInd, openParentheseInd, currText, true, allowDestructuring);
    if (varsRes === undefined) {
      continue;
    }
    const [vars, varsStrEnd] = varsRes;

    for (const [nn, rang] of Object.entries(vars)) {
      if (isRangeIntExcludedRanges(rang, excludedRange)) {
        continue;
      }
      const lexicalScope: [number, number] = [varsStrEnd, closedParentheseInd];

      const range = new vscode.Range(
        document.positionAt(rang[0]),
        document.positionAt(rang[1]),
      );

      addToDictArr(
        lambdaNames, nn.toLowerCase(),
        new SymbolInfo(
          nn.toLowerCase(), defName.toLowerCase(), lexicalScope, new vscode.Location(uri, range), vscode.SymbolKind.Variable, rang
        )
      );
    }

  }

  //console.log(lambdaNames);
  return [defNames, lambdaNames];
}


function collectGlobalDef(document: vscode.TextDocument, text: string, excludedRange: [number, number][]):
  [Record<string, SymbolInfo[]>, Record<string, SymbolInfo[]>] {

  // commonlisp.yaml def-name
  const keywordLambdaList = /(?<=#'|\s|^)(\()(\s*)(defsetf|define-modify-macro|defgeneric|defmethod|defun|defmacro|define-method-combination|define-compiler-macro|define-setf-expander)\s+(\(\s*([#:A-Za-z0-9\+\-\*\/\@\$\%\^\&\_\=\<\>\~\!\?\[\]\{\}\.]+)\s*([#:A-Za-z0-9\+\-\*\/\@\$\%\^\&\_\=\<\>\~\!\?\[\]\{\}\.]+?)|([#:A-Za-z0-9\+\-\*\/\@\$\%\^\&\_\=\<\>\~\!\?\[\]\{\}\.]+?))((\s|\)))\s*(\()/igmd;

  // Note `defsetf` short form is matched below, long form is matched above, dup def-name is okay
  const keyword1 = /(?<=#'|\s|^)(\()(\s*)(defsetf|define-symbol-macro|deftype|defpackage|defconstant|defstruct|defvar|defparameter|define-condition|defclass)\s+\(?\s*([#:A-Za-z0-9\+\-\*\/\@\$\%\^\&\_\=\<\>\~\!\?\[\]\{\}\.]+?)(?=(\s|\(|\)))/igmd;

  const [defNames0, lambdaNames] = collectKeywordLambda(keywordLambdaList, [6, 7], document, text, excludedRange);
  const defNames1 = collectKeyword(keyword1, [4], document, text, excludedRange);

  const defNames: Record<string, SymbolInfo[]> = {};
  const dicts = [defNames0, defNames1];
  for (const d of dicts) {
    for (const [k, info] of Object.entries(d)) {
      for (const item of info) {
        addToDictArr(defNames, k, item);
      }
    }
  }

  return [defNames, lambdaNames];
}

function collectLocalDef(document: vscode.TextDocument, text: string, excludedRange: [number, number][]):
  [Record<string, SymbolInfo[]>, Record<string, SymbolInfo[]>] {
  const uri = document.uri;

  const defLocalNames: Record<string, SymbolInfo[]> = {};
  const localLambdaNames: Record<string, SymbolInfo[]> = {};

  // commonlisp.yaml # keyword ((name (params)
  const matchRes = text.matchAll(/(?<=#'|\s|^)(\()(\s*)(macrolet|labels|flet)\s+(\()\s*(\()\s*([#:A-Za-z0-9\+\-\*\/\@\$\%\^\&\_\=\<\>\~\!\?\[\]\{\}\.]+?)((\s|\)))\s*(\()/igmd);

  for (const r of matchRes) {
    if (r.index === undefined || r.indices === undefined) {
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
    const openParentheseInd = r.indices[3][0];
    const closedParentheseInd = findMatchPairParenthese(openParentheseInd, text);
    if (closedParentheseInd === -1) {
      continue;
    }
    const currText = text.substring(openParentheseInd, closedParentheseInd);
    const leftPInd = r.indices[4][0];

    // get lexical scope
    let lexicalScope: [number, number] | undefined = undefined;
    if (r[3] === 'flet' || r[3] === 'macrolet') {
      // lexical scope valid after definition, that is, after next '()' pair
      const startValidPos = findMatchPairParenthese(leftPInd + 1 - openParentheseInd, currText) + openParentheseInd;
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

    addToDictArr(
      defLocalNames, defLocalName.toLowerCase(),
      new SymbolInfo(
        defLocalName.toLowerCase(), r[3].toLowerCase(), lexicalScope, new vscode.Location(uri, nameRange), vscode.SymbolKind.Function, nameRangeInd
      )
    );

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
    const varsRes = processVars(secondLeftPInd, openParentheseInd, currText, true, allowDestructuring);
    if (varsRes === undefined) {
      continue;
    }
    const [vars, varsStrEnd] = varsRes;

    // get lexical scope for lambda list


    for (const [nn, rang] of Object.entries(vars)) {
      if (isRangeIntExcludedRanges(rang, excludedRange)) {
        continue;
      }
      const secondLexicalScope: [number, number] = [varsStrEnd, closedParentheseInd];
      const range = new vscode.Range(
        document.positionAt(rang[0]),
        document.positionAt(rang[1]),
      );

      addToDictArr(
        localLambdaNames, nn.toLowerCase(),
        new SymbolInfo(
          nn.toLowerCase(), defLocalName.toLowerCase(), secondLexicalScope, new vscode.Location(uri, range), vscode.SymbolKind.Variable, rang
        )
      );
    }

  }

  /* sort by lexical scope start, we do not need it since we have `findInnermost`
  for (const arrScope of Object.values(defLocalNames)) {
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
