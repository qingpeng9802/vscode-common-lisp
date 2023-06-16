import * as vscode from 'vscode';

import { SymbolInfo } from './SymbolInfo';
import { processVars } from './lambda_list';
import { findMatchPairParenthese } from './pair_parser';
import { addToDictArr, checkDefName, isRangeIntExcludedRanges } from './user_symbol_util';

function collectKeywordVars(document: vscode.TextDocument, text: string, ExcludedRange: [number, number][]): Record<string, SymbolInfo[]> {
  const uri = document.uri;

  const defLocalNames: Record<string, SymbolInfo[]> = {};

  // commonlisp.yaml special-operator | macro
  // `progv` allows binding one or more dynamic variables, is not implemented
  const matchRes1 = text.matchAll(/(?<=#'|\s|^)(\()(\s*)(lambda|let\*|let|symbol-macrolet|do\*|do|prog\*|prog|multiple-value-bind|destructuring-bind)\s+?(\()/igmd);

  for (const r of matchRes1) {
    if (r.index === undefined || r.indices === undefined) {
      continue;
    }

    // working in currtext
    const openParentheseInd = r.indices[3][0];
    const closedParenthese = findMatchPairParenthese(openParentheseInd, text);
    if (closedParenthese === -1) {
      continue;
    }
    const currText = text.substring(openParentheseInd, closedParenthese);
    const leftPInd = r.indices[4][0];

    // get vars list, start with `(`
    let isLambdaList = false;
    let allowDestructuring = false;
    if (r[3] === 'lambda') {
      isLambdaList = true;
    } else if (r[3] === 'destructuring-bind') {
      isLambdaList = true;
      allowDestructuring = true;
    } else { }

    const varsRes = processVars(leftPInd, openParentheseInd, currText, isLambdaList, allowDestructuring);
    if (varsRes === undefined) {
      continue;
    }
    const [vars, varsStrEnd] = varsRes;


    if (r[3] === 'let*' || r[3] === 'do*' || r[3] === 'prog*') {
      // get lexical scope
      // only for let* | do* | progn, sequencial binding
      for (const [nn, rang] of Object.entries(vars)) {
        const lexicalScope: [number, number] = [varsStrEnd, closedParenthese];
        if (isRangeIntExcludedRanges(rang, ExcludedRange)) {
          continue;
        }

        const range = new vscode.Range(
          document.positionAt(rang[0]),
          document.positionAt(rang[1]),
        );

        addToDictArr(
          defLocalNames, nn.toLowerCase(),
          new SymbolInfo(
            nn.toLowerCase(), r[3].toLowerCase(), lexicalScope, new vscode.Location(uri, range), vscode.SymbolKind.Variable, rang
          )
        );

      }

    } else {
      // get lexical scope
      // lexical scope valid after definition, that is, after next '()' pair
      const startValidPos = findMatchPairParenthese(leftPInd + 1 - openParentheseInd, currText) + openParentheseInd;
      if (startValidPos === -1) {
        continue;
      }
      const lexicalScope: [number, number] = [startValidPos, closedParenthese];

      for (const [nn, rang] of Object.entries(vars)) {
        if (isRangeIntExcludedRanges(rang, ExcludedRange)) {
          continue;
        }
        const range = new vscode.Range(
          document.positionAt(rang[0]),
          document.positionAt(rang[1]),
        );

        addToDictArr(
          defLocalNames, nn.toLowerCase(),
          new SymbolInfo(nn.toLowerCase(), r[3].toLowerCase(), lexicalScope, new vscode.Location(uri, range), vscode.SymbolKind.Variable, rang
          )
        );

      }

    }

  }
  //console.log(defLocalNames);
  return defLocalNames;
}

function collectKeywordSingleVar(document: vscode.TextDocument, text: string, ExcludedRange: [number, number][]): Record<string, SymbolInfo[]> {
  const uri = document.uri;

  const defLocalNames: Record<string, SymbolInfo[]> = {};

  // commonlisp.yaml macro
  const matchRes2 = text.matchAll(/(?<=#'|\s|^)(\()(\s*)(do-symbols|do-external-symbols|do-all-symbols|dolist|dotimes|pprint-logical-block|with-input-from-string|with-open-file|with-open-stream|with-output-to-string|with-package-iterator|with-hash-table-iterator)\s+?(\()\s*?([#:A-Za-z0-9\+\-\*\/\@\$\%\^\&\_\=\<\>\~\!\?\[\]\{\}\.]+)(\s|\)|\()/igmd);

  for (const r of matchRes2) {
    if (r.index === undefined || r.indices === undefined) {
      continue;
    }

    const defLocalName = checkDefName(r, [5]);
    if (defLocalName === undefined) {
      continue;
    }

    const nameRangeInd = r.indices[5];
    if (isRangeIntExcludedRanges(nameRangeInd, ExcludedRange)) {
      continue;
    }

    // console.log(`${defLocalName}: Range`);

    // working in currtext
    const openParentheseInd = r.indices[3][0];
    const closedParenthese = findMatchPairParenthese(openParentheseInd, text);
    if (closedParenthese === -1) {
      continue;
    }
    const currText = text.substring(openParentheseInd, closedParenthese);
    const leftPInd = r.indices[4][0];

    const startValidPos = findMatchPairParenthese(leftPInd + 1 - openParentheseInd, currText) + openParentheseInd;
    if (startValidPos === -1) {
      continue;
    }
    // console.log(`${defLocalName}: ${startValidPos} -> ${closedParenthese}`);
    const lexicalScope: [number, number] = [startValidPos, closedParenthese];

    const range = new vscode.Range(
      document.positionAt(nameRangeInd[0]),
      document.positionAt(nameRangeInd[1]),
    );

    addToDictArr(
      defLocalNames, defLocalName.toLowerCase(),
      new SymbolInfo(defLocalName.toLowerCase(), r[3].toLowerCase(), lexicalScope, new vscode.Location(uri, range), vscode.SymbolKind.Variable, nameRangeInd
      )
    );

  }

  return defLocalNames;
}

export { collectKeywordVars, collectKeywordSingleVar };
