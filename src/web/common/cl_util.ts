import type * as vscode from 'vscode';

const CL_MODE: vscode.DocumentSelector = 'commonlisp';

// string, only for common lisp original symbols
const clOriSymbolChars = /[A-Za-z12\+\-\*\/\&\=\<\>]+/igm;

// single char, only for common lisp original symbols
const clValidSymbolSingleCharSet: Set<string> = new Set([
  'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
  '+', '-', '*', '/', '@', '$', '%', '^', '&', '_', '=', '<', '>', '~', '.', '!', '?', '[', ']', '{', '}']);
const clValidSymbolSingleCharColonSet: Set<string> = new Set([
  'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
  '+', '-', '*', '/', '@', '$', '%', '^', '&', '_', '=', '<', '>', '~', '.', '!', '?', '[', ']', '{', '}', ':']);
const clValidSymbolSingleCharColonSharpSet: Set<string> = new Set([
  'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
  '+', '-', '*', '/', '@', '$', '%', '^', '&', '_', '=', '<', '>', '~', '.', '!', '?', '[', ']', '{', '}', ':', '#']);
const clValidSymbolSingleChar = /[A-Za-z0-9\+\-\*\/\@\$\%\^\&\_\=\<\>\~\!\?\[\]\{\}\.]/i;

function isStringClValidSymbol(str: string): boolean {
  for (const c of str) {
    if (!clValidSymbolSingleCharSet.has(c)) {
      return false;
    }
  }
  return true;
}

// CL-ANSI 2.1.4 Character Syntax Types
const clValidSymbolChars = /[A-Za-z0-9\+\-\*\/\@\$\%\^\&\_\=\<\>\~\!\?\[\]\{\}\.]+/igm;

// start with `:` (non-alphabetic)
const clValidStartWithColon = /:?[A-Za-z0-9\+\-\*\/\@\$\%\^\&\_\=\<\>\~\!\?\[\]\{\}\.]+/igm;

// start with `:` (non-alphabetic)
const clValidWithColonSharp = /[#:A-Za-z0-9\+\-\*\/\@\$\%\^\&\_\=\<\>\~\!\?\[\]\{\}\.]+/igm;

function escapeRegExp(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\\/\-]/g, '\\$&'); // $& means the whole matched string
}

export {
  CL_MODE,
  escapeRegExp,
  // clOriSymbolChars,
  // clValidSymbolSingleChar,
  clValidSymbolSingleCharSet,
  isStringClValidSymbol,
  clValidSymbolSingleCharColonSet,
  clValidSymbolSingleCharColonSharpSet,
  clValidSymbolChars,
  clValidStartWithColon,
  clValidWithColonSharp
};
