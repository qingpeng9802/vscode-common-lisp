import * as vscode from 'vscode';

import {
  getDocByName, getDocByNameNonAlphabetic,
  _non_alphabetic, non_alphabetic_index_str,
  loop_keyword_str
} from '../../doc/get_doc';
import { loopKeywordsCompItemMap, loopKeywordsSet } from '../loop_keywords';

import { OriSymbolsCompItem } from './OriSymbolsCompItem';
import { clOriSymbolsByKind, ClSymbolKind } from './cl_kind';

const clKindToVscodeCIKind: Map<ClSymbolKind, vscode.CompletionItemKind> =
  new Map<ClSymbolKind, vscode.CompletionItemKind>([
    [ClSymbolKind.Accessor, vscode.CompletionItemKind.Method],
    [ClSymbolKind.Function, vscode.CompletionItemKind.Function],
    [ClSymbolKind.LocalFunction, vscode.CompletionItemKind.Function],
    [ClSymbolKind.StandardGenericFunction, vscode.CompletionItemKind.Function],
    [ClSymbolKind.Class, vscode.CompletionItemKind.Class],
    [ClSymbolKind.SystemClass, vscode.CompletionItemKind.Class],
    [ClSymbolKind.ConditionType, vscode.CompletionItemKind.Class],
    [ClSymbolKind.ConstantVariable, vscode.CompletionItemKind.Constant],
    [ClSymbolKind.Declaration, vscode.CompletionItemKind.Keyword],
    [ClSymbolKind.Macro, vscode.CompletionItemKind.Keyword],
    [ClSymbolKind.LocalMacro, vscode.CompletionItemKind.Keyword],
    [ClSymbolKind.MacroLambdaList, vscode.CompletionItemKind.Keyword],
    [ClSymbolKind.OrdinaryLambdaList, vscode.CompletionItemKind.Keyword],
    [ClSymbolKind.SpecialForm, vscode.CompletionItemKind.Keyword],
    [ClSymbolKind.SpecialOperator, vscode.CompletionItemKind.Keyword],
    [ClSymbolKind.Symbol, vscode.CompletionItemKind.Keyword],
    [ClSymbolKind.Type, vscode.CompletionItemKind.TypeParameter],
    [ClSymbolKind.TypeSpecifier, vscode.CompletionItemKind.Method],
    [ClSymbolKind.Variable, vscode.CompletionItemKind.Variable]
  ]);


function assignKindAndDoc(
  symbolsArr: string[], kind: vscode.CompletionItemKind
): vscode.CompletionItem[] {
  const citems: vscode.CompletionItem[] = [];
  for (const s of symbolsArr) {
    // prevent duplicated items in NonAlphabetic
    const prefix = s[0];
    if (prefix === '&' || prefix === '*') {
      continue;
    }

    const ci = new vscode.CompletionItem(s, kind);
    const doc = getDocByName(s.toLowerCase());
    if (doc !== undefined) {
      ci.documentation = doc;
    }

    citems.push(ci);
  }
  return citems;
}

// Currently, VS Code does not support sort of autocompletion items.
// (https://github.com/microsoft/vscode/issues/80444)
// Thus, the order of symbol is not matter here.
function genOriSymbols(): vscode.CompletionItem[] {
  const citems: vscode.CompletionItem[] = [];
  // integrity check
  const completeSymbols: string[] = [];
  for (const [k, partSymbols] of clOriSymbolsByKind) {
    const kind = clKindToVscodeCIKind.get(k)!;
    citems.push(...assignKindAndDoc(partSymbols, kind));
    completeSymbols.push(...partSymbols);
  }
  if (completeSymbols.length !== 978) {
    console.warn(`[Autocompletion] Got ${completeSymbols.length}. \
    Please make sure all 978 commonlisp symbols have been included.`);
  }
  if (citems.length !== 923) {
    // not 978 since we filtered `&` and `*` out
    console.warn(`[Autocompletion] Built incomplete kind list (${citems.length}) of symbols`);
  }

  return citems;
}

// Index - Non-Alphabetic
function assignKindAndDocNonAlphabetic(
  prefix: string, symbolsArr: string[], kind: vscode.CompletionItemKind
): vscode.CompletionItem[] {
  const citems: vscode.CompletionItem[] = [];
  for (const s of symbolsArr) {
    const fullKeyword = prefix + s;
    const ci = new vscode.CompletionItem(fullKeyword, kind);

    if (prefix === '#' || prefix === '~') {
      // we do not get doc for `#` and `~`
      ci.documentation = new vscode.MarkdownString(non_alphabetic_index_str);
      ci.documentation.isTrusted = true;
      ci.documentation.supportHtml = true;

    } else if (prefix === '&' || prefix === '*') {
      const doc = getDocByName(fullKeyword.toLowerCase());
      ci.documentation = doc;

    } else if (prefix === ':') {
      const doc = getDocByNameNonAlphabetic(s);
      ci.documentation = doc;

    } else { }

    citems.push(ci);
  }
  return citems;
}

function genNonAlphabeticDict(): Map<string, vscode.CompletionItem[]> {
  const d: Map<string, vscode.CompletionItem[]> = new Map<string, vscode.CompletionItem[]>();

  for (const [k, v] of Object.entries(_non_alphabetic)) {
    if (k === '#' || k === '&' || k === '~') {
      d.set(k, assignKindAndDocNonAlphabetic(k, v, vscode.CompletionItemKind.Keyword));

    } else if (k === '*') {
      d.set(k, assignKindAndDocNonAlphabetic(k, v, vscode.CompletionItemKind.Variable));

    } else if (k === ':') {
      d.set(k, assignKindAndDocNonAlphabetic(k, v, vscode.CompletionItemKind.Property));
    } else {
      console.warn(`[Autocompletion] Unknown non-alphabetic key: ${k}`);
    }
  }
  return d;
}

function genLoopKeywords() {
  // http://www.lispworks.com/documentation/lw51/CLHS/Body/m_loop.htm#loop
  // https://lispcookbook.github.io/cl-cookbook/iteration.html
  const citems: vscode.CompletionItem[] = [];
  for (const k of loopKeywordsSet) {
    const item = new vscode.CompletionItem(k, loopKeywordsCompItemMap.get(k));

    item.detail = 'LOOP keyword';

    item.documentation = new vscode.MarkdownString(loop_keyword_str);
    item.documentation.isTrusted = true;
    item.documentation.supportHtml = true;

    citems.push(item);
  }

  return citems;
}

function genAllOriSymbols() {
  const oriSymbols: vscode.CompletionItem[] = genOriSymbols();

  const nonAlphabeticDict: Map<string, vscode.CompletionItem[]> = genNonAlphabeticDict();
  const afterAmpersand: vscode.CompletionItem[] = nonAlphabeticDict.get('&')!;
  const afterAsterisk: vscode.CompletionItem[] = nonAlphabeticDict.get('*')!;
  const afterColon: vscode.CompletionItem[] = nonAlphabeticDict.get(':')!;
  const afterTilde: vscode.CompletionItem[] = nonAlphabeticDict.get('~')!;
  const afterSharpsign: vscode.CompletionItem[] = nonAlphabeticDict.get('#')!;

  const loopSymbols: vscode.CompletionItem[] = genLoopKeywords();

  return new OriSymbolsCompItem(
    oriSymbols, afterAmpersand, afterAsterisk, afterColon, afterTilde, afterSharpsign, loopSymbols
  );
}


export { genAllOriSymbols };
