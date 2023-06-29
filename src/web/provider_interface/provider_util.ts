import * as vscode from 'vscode';

import { clValidWithColonSharp } from '../common/cl_util';

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

export { getCLWordRangeAtPosition };
