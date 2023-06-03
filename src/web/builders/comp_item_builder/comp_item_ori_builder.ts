import * as vscode from 'vscode';

import _non_alphabetic from '../../cl_data/cl_non_alphabetic.json';

import { clOriSymbolsByKind, ClSymbolKind } from './symbols_by_kind';
import { getDocByName, getDocByNameNonAlphabetic } from '../../doc/get_doc';
import { OriSymbolsCompItem } from './OriSymbols';

const clKindToVscodeCIKind: Record<ClSymbolKind, vscode.CompletionItemKind> = {
  [ClSymbolKind.Accessor]: vscode.CompletionItemKind.Method,
  [ClSymbolKind.Function]: vscode.CompletionItemKind.Function,
  [ClSymbolKind.LocalFunction]: vscode.CompletionItemKind.Function,
  [ClSymbolKind.StandardGenericFunction]: vscode.CompletionItemKind.Function,
  [ClSymbolKind.Class]: vscode.CompletionItemKind.Class,
  [ClSymbolKind.SystemClass]: vscode.CompletionItemKind.Class,
  [ClSymbolKind.Type]: vscode.CompletionItemKind.Class,
  [ClSymbolKind.ConditionType]: vscode.CompletionItemKind.Class,
  [ClSymbolKind.ConstantVariable]: vscode.CompletionItemKind.Constant,
  [ClSymbolKind.Declaration]: vscode.CompletionItemKind.Keyword,
  [ClSymbolKind.Macro]: vscode.CompletionItemKind.Keyword,
  [ClSymbolKind.LocalMacro]: vscode.CompletionItemKind.Keyword,
  [ClSymbolKind.MacroLambdaList]: vscode.CompletionItemKind.Keyword,
  [ClSymbolKind.OrdinaryLambdaList]: vscode.CompletionItemKind.Keyword,
  [ClSymbolKind.SpecialForm]: vscode.CompletionItemKind.Keyword,
  [ClSymbolKind.SpecialOperator]: vscode.CompletionItemKind.Keyword,
  [ClSymbolKind.Symbol]: vscode.CompletionItemKind.Keyword,
  [ClSymbolKind.Type]: vscode.CompletionItemKind.TypeParameter,
  [ClSymbolKind.TypeSpecifier]: vscode.CompletionItemKind.Method,
  [ClSymbolKind.Variable]: vscode.CompletionItemKind.Variable
};


function assignKindAndDoc(
  symbolsArr: string[], kind: vscode.CompletionItemKind
): vscode.CompletionItem[] {
  const citems: vscode.CompletionItem[] = [];
  for (const s of symbolsArr) {
    const ci = new vscode.CompletionItem(s, kind);
    const doc = getDocByName(s);

    doc ? ci.documentation = doc : undefined;

    citems.push(ci);
  }
  return citems;
}

function genOriSymbols(): vscode.CompletionItem[] {
  const citems: vscode.CompletionItem[] = [];
  for (const [k, partSymbols] of Object.entries(clOriSymbolsByKind)) {
    const kind = clKindToVscodeCIKind[k as ClSymbolKind];
    citems.push(...assignKindAndDoc(partSymbols, kind));
  }
  if (citems.length !== 978) {
    console.log(`[Autocompletion] Built incomplete kind list (${citems.length}) of symbols`);
  }

  return citems;
}

// Index - Non-Alphabetic
// http://www.lispworks.com/documentation/lw50/CLHS/Front/X_Mast_9.htm
function assignKindAndDocNonAlphabetic(
  symbolsArr: string[], prefix: string, kind: vscode.CompletionItemKind
): vscode.CompletionItem[] {
  const citems: vscode.CompletionItem[] = [];
  for (const s of symbolsArr) {
    const ci = new vscode.CompletionItem(s, kind);

    if (prefix === '#' || prefix === '~') {
      // we do not get doc for `#` and `~`
      ci.documentation = new vscode.MarkdownString(`\n\n[[Docs]](http://www.lispworks.com/documentation/lw50/CLHS/Front/X_Mast_9.htm)`);
      ci.documentation.isTrusted = true;
      ci.documentation.supportHtml = true;

    } else if (prefix === '&' || prefix === '*') {
      const doc = getDocByName(prefix + s);
      ci.documentation = doc ? doc : undefined;

    } else if (prefix === ':') {
      const doc = getDocByNameNonAlphabetic(s);
      ci.documentation = doc ? doc : undefined;

    } else { }

    citems.push(ci);
  }
  return citems;
}

function genNonAlphabeticDict(): Record<string, vscode.CompletionItem[]> {
  const d: Record<string, vscode.CompletionItem[]> = {};
  const non_alphabetic: Record<string, any> = _non_alphabetic;

  for (const [k, v] of Object.entries(non_alphabetic)) {
    if (k === '#' || k === '&' || k === '~') {
      d[k] = assignKindAndDocNonAlphabetic(v, k, vscode.CompletionItemKind.Keyword);

    } else if (k === '*') {
      d[k] = assignKindAndDocNonAlphabetic(v, k, vscode.CompletionItemKind.Variable);

    } else if (k === ':') {
      d[k] = assignKindAndDocNonAlphabetic(v, k, vscode.CompletionItemKind.Property);
    } else {
      console.warn(`[Autocompletion] Unknown non-alphabetic key: ${k}`);
    }
  }
  return d;
}

function genAllOriSymbols() {
  const oriSymbols: vscode.CompletionItem[] = genOriSymbols();

  const nonAlphabeticDict: Record<string, vscode.CompletionItem[]> = genNonAlphabeticDict();
  const afterAmpersand: vscode.CompletionItem[] = nonAlphabeticDict['&'];
  const afterAsterisk: vscode.CompletionItem[] = nonAlphabeticDict['*'];
  const afterColon: vscode.CompletionItem[] = nonAlphabeticDict[':'];
  const afterTilde: vscode.CompletionItem[] = nonAlphabeticDict['~'];
  const afterSharpsign: vscode.CompletionItem[] = nonAlphabeticDict['#'];

  return new OriSymbolsCompItem(oriSymbols, afterAmpersand, afterAsterisk, afterColon, afterTilde, afterSharpsign);
}


export { genAllOriSymbols };
