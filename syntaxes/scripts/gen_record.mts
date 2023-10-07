/*
  Copyright (c) Microsoft Corporation
  All rights reserved.

  MIT License

  Permission is hereby granted, free of charge, to any person obtaining a copy
  of this software and associated documentation files (the "Software"), to deal
  in the Software without restriction, including without limitation the rights
  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
  copies of the Software, and to permit persons to whom the Software is
  furnished to do so, subject to the following conditions:

  The above copyright notice and this permission notice shall be included in
  all copies or substantial portions of the Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
  THE SOFTWARE.
*/
// Ported from https://github.com/microsoft/TypeScript-TmLanguage/blob/master/tests/build.ts

import { promises as fsPromises } from 'fs';
import * as path from 'path';

import oniguruma from 'vscode-oniguruma';
import vt from 'vscode-textmate';

const FUSED_MODE = true;

// Part 1: config grammar names

/** `scopeName` in the grammar file */
enum GrammarScopeName {
  lisp = 'source.commonlisp',
}
/** file name of the grammar file */
const grammarFileNames: Map<GrammarScopeName, string> = new Map([
  [GrammarScopeName.lisp, 'commonlisp.tmLanguage.json']
]);
const syntaxes_root = './syntaxes/';
/** get the path of the grammar file */
const getGrammarPath = (scopeName: GrammarScopeName) =>
  path.join(syntaxes_root, grammarFileNames.get(scopeName)!);

// Part 2: get vscode-textmate registry

/** get vscode-textmate registry */
async function getRegistery() {
  // load Oniguruma lib
  const onigPath = path.resolve('./node_modules/vscode-oniguruma/release/onig.wasm');
  const wasmBin = (await fsPromises.readFile(onigPath)).buffer;
  const vscodeOnigurumaLib: Promise<vt.IOnigLib> =
    oniguruma.loadWASM(wasmBin).then(() => {
      return {
        createOnigScanner(patterns) { return new oniguruma.OnigScanner(patterns); },
        createOnigString(s) { return new oniguruma.OnigString(s); }
      };
    });

  return new vt.Registry({
    onigLib: vscodeOnigurumaLib,
    loadGrammar: async function (scopeName: GrammarScopeName) {
      const path = getGrammarPath(scopeName);
      if (!path) {
        return null;
      }
      const content = await fsPromises.readFile(path, { encoding: 'utf-8' });
      const rawGrammar = vt.parseRawGrammar(content, path);
      return rawGrammar;
    }
  });
}

// Part 3: generate scopes

/** the struct for iterating in vscode-textmate */
interface Grammar {
  scopeName: GrammarScopeName;
  grammar: vt.IGrammar;
  ruleStack: vt.StateStack;
}

/** get tokens and iterate the ruleStack */
function tokenizeLine(mainGrammar: Grammar, line: string) {
  const lineTokens = mainGrammar.grammar.tokenizeLine(line, mainGrammar.ruleStack);
  mainGrammar.ruleStack = lineTokens.ruleStack;
  return lineTokens.tokens;
}

/** generate the record */
function writeTokenLine(token: vt.IToken, outputLines: string[], prevScope: string): string {
  const startingSpaces = ' '.repeat(token.startIndex + 1);
  const locatingString = '^'.repeat(token.endIndex - token.startIndex);

  const hasInvalidTokenScopeExtension = (token: vt.IToken) =>
    token.scopes.some(scope => !scope.endsWith('.commonlisp'));
  const hasInvalidScopeExtension =
    hasInvalidTokenScopeExtension(token) ? 'has_INCORRECT_SCOPE_EXTENSION' : '';

  const scope = `sc ${token.scopes.slice(1,).join(' ')}${hasInvalidScopeExtension}`; // replace `source.commonlisp` with `sc`

  // fuse the indicators while getting the same scope
  if (FUSED_MODE && scope === prevScope) {
    outputLines[outputLines.length - 2] += '^';
    return scope;
  }

  // add indicator
  outputLines.push(startingSpaces + locatingString);
  // add scope name
  outputLines.push(startingSpaces + scope);

  return scope;
}

/** iterate the lines of the text and produce the record */
function generateScopesWorker(mainGrammar: Grammar, oriLineArr: string[]): string {
  const cleanCodeLines: string[] = [];
  const recordLines: string[] = [];

  for (const oriLine of oriLineArr) {
    // console.log(`\nTokenizing line: ${oriLine}`);
    cleanCodeLines.push(oriLine);
    recordLines.push(`>${oriLine}`);

    let prevScope = '';
    const mainLineTokens = tokenizeLine(mainGrammar, oriLine);
    for (const token of mainLineTokens) {
      // Notice that `\n` is added to every token so lastIndex+1.
      // https://github.com/microsoft/vscode-textmate/issues/15#issuecomment-227128870
      // you may VSCODE_TEXTMATE_DEBUG=true
      //console.log(
      //  ` - token [${token.startIndex} -> ${token.endIndex}] `.padEnd(22, ' ') +
      //  `|${oriLine.substring(token.startIndex, token.endIndex)}|\n` +
      //  `${' '.repeat(22)}${token.scopes.join(', ')}`
      //);
      prevScope = writeTokenLine(token, recordLines, prevScope);
    }
  }

  const result =
    `original file\n` +
    `-----------------------------------\n` +
    `${cleanCodeLines.join('\n')}` +
    `\n` +
    `-----------------------------------\n` +
    `\n` +
    `Grammar: ${grammarFileNames.get(mainGrammar.scopeName)!}\n` +
    `-----------------------------------\n` +
    `${recordLines.join('\n')}`;
  //console.log(result);
  return result;
}

/** API for turning string into record.
 *  pass vt.IGrammer to avoid loading grammar again.
*/
function generateScopes(text: string, grammar: vt.IGrammar) {
  //const text = await fsPromises.readFile('syntaxes/fixtures/cases/demo.lsp', { encoding: 'utf-8' });

  const oriLineArr = text.split(/\r\n|\r|\n/);

  const initGrammar = (scopeName: GrammarScopeName) => {
    //const grammar = await (await getRegistery()).loadGrammar(scopeName);
    return {
      scopeName: scopeName,
      grammar: grammar,
      ruleStack: vt.INITIAL
    };
  };

  return generateScopesWorker(
    initGrammar(GrammarScopeName.lisp),
    oriLineArr
  );
}

export {
  GrammarScopeName,
  generateScopes,
  getRegistery,
};
