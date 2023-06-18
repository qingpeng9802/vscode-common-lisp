import * as vscode from 'vscode';

import _doc from '../cl_data/cl_doc.json';
import _doc_non_alphabetic from '../cl_data/cl_non_alphabetic_doc.json';

const non_alphabetic_index_str = `\n\n[[Docs]](http://www.lispworks.com/documentation/lw50/CLHS/Front/X_Mast_9.htm)`;

function _getDocByName(symbolName: string, _docJson: Record<string, any>): vscode.MarkdownString | undefined {
  const docByName = _docJson[symbolName.toLowerCase()];
  // console.log(docByName);
  if (docByName === undefined) {
    // console.log(`[GetDoc] Missing documentation for ${symbolName}`);
    return undefined;
  }

  const res = new vscode.MarkdownString(docByName);
  res.isTrusted = true;
  res.supportHtml = true;
  return res;
}

function getDocByName(symbolName: string): vscode.MarkdownString | undefined {
  return _getDocByName(symbolName, _doc);
}

function getDocByNameNonAlphabetic(symbolName: string): vscode.MarkdownString | undefined {
  if (symbolName.startsWith(':')) {
    symbolName = symbolName.substring(1);
  }

  const res = _getDocByName(symbolName, _doc_non_alphabetic);
  res?.appendMarkdown(non_alphabetic_index_str);
  return res;
}

export { getDocByName, getDocByNameNonAlphabetic, non_alphabetic_index_str };
