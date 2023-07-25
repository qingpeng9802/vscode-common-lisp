import * as vscode from 'vscode';

import { clValidWithColonSharp } from '../common/cl_util';

// no using lexical scope
// Common Lisp the Language, 2nd Edition
// 7.1. Reference https://www.cs.cmu.edu/Groups/AI/html/cltl/clm/node78.html#SECTION001111000000000000000
function isQuote(document: vscode.TextDocument, position: vscode.Position): vscode.Range | undefined {
  const parentheseRange = document.getWordRangeAtPosition(position, /(?<=^|\s|\(|,@|,\.|,)\s*?quote\s*?[A-Za-z0-9\+\-\*\/\@\$\%\^\&\_\=\<\>\~\!\?\[\]\{\}\.]+?\s*?(?=(\s|\(|\)))/igm);
  const quoteSymbolRange = document.getWordRangeAtPosition(position, /(?<=^|\s|\(|,@|,\.|,)'[A-Za-z0-9\+\-\*\/\@\$\%\^\&\_\=\<\>\~\!\?\[\]\{\}\.]+?(?=(\s|\(|\)))/igm);
  return (parentheseRange !== undefined) ? parentheseRange : quoteSymbolRange;
}

function getCLWordRangeAtPosition(
  document: vscode.TextDocument, position: vscode.Position): vscode.Range | undefined {
  const range = document.getWordRangeAtPosition(position, clValidWithColonSharp);
  if (range === undefined) {
    return undefined;
  }
  const word = document.getText(range);

  // http://www.lispworks.com/documentation/lw60/CLHS/Body/02_df.htm
  // ,@
  if (word.startsWith('@')) {
    const prevc = document.getText(new vscode.Range(range.start.translate(0, -1), range.start));
    if (prevc === ',') {
      return range.with(range.start.translate(0, 1));
    }
  }

  return range;
}

export {
  isQuote,
  getCLWordRangeAtPosition
};
