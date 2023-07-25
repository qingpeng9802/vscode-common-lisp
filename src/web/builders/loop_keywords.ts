import * as vscode from 'vscode';

// http://www.lispworks.com/documentation/lcl50/loop/loop-index.html
// http://www.lispworks.com/documentation/lw51/CLHS/Body/m_loop.htm
// https://lispcookbook.github.io/cl-cookbook/iteration.html
const loopKeywordsTokenMap = new Map<string, string | [string, string[]]>([
  // Part 1. follow clauses
  // name
  ['named', 'keyword'],
  // prologue
  ['initially', 'keyword'],
  // epilogue
  ['finally', 'keyword'],
  // variable initialization and stepping
  ['for', 'keyword'],
  ['as', 'keyword'],
  ['with', 'keyword'],
  ['repeat', 'keyword'],

  // Part 2. follow clauses
  // unconditional execution
  ['do', 'keyword'],
  ['doing', 'keyword'],
  ['return', 'keyword'],
  //value accumulation
  ['collect', 'function'],
  ['collecting', 'function'],
  ['append', 'function'],
  ['appending', 'function'],
  ['nconc', 'function'],
  ['nconcing', 'function'],
  ['count', 'function'],
  ['counting', 'function'],
  ['sum', 'function'],
  ['summing', 'function'],
  ['maximize', 'function'],
  ['maximizing', 'function'],
  ['minimize', 'function'],
  ['minimizing', 'function'],
  // used by value accumulation above
  ['into', 'keyword'],
  // macro End-Test Control Clause Keyword
  //['loop-finish', 'macro'],//colored
  // conditional execution
  ['thereis', 'keyword'],
  ['always', 'keyword'],
  ['never', 'keyword'],
  ['if', 'keyword'],
  ['when', 'keyword'],
  ['unless', 'keyword'],
  ['while', 'keyword'],
  ['until', 'keyword'],
  ['else', 'keyword'],
  ['end', 'keyword'],

  // Part 3. NOT follow clauses
  // adv. for order
  ['then', 'macro'],
  // pronoun
  ['it', 'macro'],
  // preposition
  ['=', 'macro'], // override color
  //['and', 'macro'], //colored
  ['to', 'macro'],
  ['upto', 'macro'],
  ['downto', 'macro'],
  ['below', 'macro'],
  ['above', 'macro'],
  ['by', 'macro'],
  ['from', 'macro'],
  ['downfrom', 'macro'],
  ['upfrom', 'macro'],
  ['in', 'macro'],
  ['of', 'macro'],
  ['on', 'macro'],
  ['across', 'macro'],
  // others
  ['being', 'macro'],
  ['each', 'macro'],
  ['the', 'macro'],
  ['using', 'macro'],

  // Part 4. NOT follow clauses
  // noun
  ['hash-key', 'macro'],
  ['hash-keys', 'macro'],
  ['hash-value', 'macro'],
  ['hash-values', 'macro'],
  ['present-symbol', 'macro'],
  ['present-symbols', 'macro'],
  ['external-symbol', 'macro'],
  ['external-symbols', 'macro'],
  ['symbol', 'macro'],
  ['symbols', 'macro'],

  // type
  ['nil', 'macro'],
  ['t', 'macro'],
  ['fixnum', 'type'],
  ['float', 'type'],
  ['integer', 'type'],
  ['number', 'type'],
  ['of-type', 'type'],
]);

const loopKeywordsCompItemMap = new Map<string, vscode.CompletionItemKind>([
  // Part 1. follow clauses
  // name
  ['named', vscode.CompletionItemKind.Keyword],
  // prologue
  ['initially', vscode.CompletionItemKind.Keyword],
  // epilogue
  ['finally', vscode.CompletionItemKind.Keyword],
  // variable initialization and stepping
  ['for', vscode.CompletionItemKind.Keyword],
  ['as', vscode.CompletionItemKind.Keyword],
  ['with', vscode.CompletionItemKind.Keyword],
  ['repeat', vscode.CompletionItemKind.Keyword],

  // Part 2. follow clauses
  // unconditional execution
  ['do', vscode.CompletionItemKind.Keyword],
  ['doing', vscode.CompletionItemKind.Keyword],
  ['return', vscode.CompletionItemKind.Keyword],
  //value accumulation
  ['collect', vscode.CompletionItemKind.Function],
  ['collecting', vscode.CompletionItemKind.Function],
  ['append', vscode.CompletionItemKind.Function],
  ['appending', vscode.CompletionItemKind.Function],
  ['nconc', vscode.CompletionItemKind.Function],
  ['nconcing', vscode.CompletionItemKind.Function],
  ['count', vscode.CompletionItemKind.Function],
  ['counting', vscode.CompletionItemKind.Function],
  ['sum', vscode.CompletionItemKind.Function],
  ['summing', vscode.CompletionItemKind.Function],
  ['maximize', vscode.CompletionItemKind.Function],
  ['maximizing', vscode.CompletionItemKind.Function],
  ['minimize', vscode.CompletionItemKind.Function],
  ['minimizing', vscode.CompletionItemKind.Function],
  // used by value accumulation above
  ['into', vscode.CompletionItemKind.Keyword],
  // macro End-Test Control Clause Keyword
  //['loop-finish', vscode.CompletionItemKind.Keyword],//colored
  // conditional execution
  ['thereis', vscode.CompletionItemKind.Keyword],
  ['always', vscode.CompletionItemKind.Keyword],
  ['never', vscode.CompletionItemKind.Keyword],
  ['if', vscode.CompletionItemKind.Keyword],
  ['when', vscode.CompletionItemKind.Keyword],
  ['unless', vscode.CompletionItemKind.Keyword],
  ['while', vscode.CompletionItemKind.Keyword],
  ['until', vscode.CompletionItemKind.Keyword],
  ['else', vscode.CompletionItemKind.Keyword],
  ['end', vscode.CompletionItemKind.Keyword],

  // Part 3. NOT follow clauses
  // adv. for order
  ['then', vscode.CompletionItemKind.Keyword],
  // pronoun
  ['it', vscode.CompletionItemKind.Keyword],
  // preposition
  ['=', vscode.CompletionItemKind.Keyword], // override color
  //['and', vscode.CompletionItemKind.Keyword], //colored
  ['to', vscode.CompletionItemKind.Keyword],
  ['upto', vscode.CompletionItemKind.Keyword],
  ['downto', vscode.CompletionItemKind.Keyword],
  ['below', vscode.CompletionItemKind.Keyword],
  ['above', vscode.CompletionItemKind.Keyword],
  ['by', vscode.CompletionItemKind.Keyword],
  ['from', vscode.CompletionItemKind.Keyword],
  ['downfrom', vscode.CompletionItemKind.Keyword],
  ['upfrom', vscode.CompletionItemKind.Keyword],
  ['in', vscode.CompletionItemKind.Keyword],
  ['of', vscode.CompletionItemKind.Keyword],
  ['on', vscode.CompletionItemKind.Keyword],
  ['across', vscode.CompletionItemKind.Keyword],
  // others
  ['being', vscode.CompletionItemKind.Keyword],
  ['each', vscode.CompletionItemKind.Keyword],
  ['the', vscode.CompletionItemKind.Keyword],
  ['using', vscode.CompletionItemKind.Keyword],

  // Part 4. NOT follow clauses
  // noun
  ['hash-key', vscode.CompletionItemKind.Keyword],
  ['hash-keys', vscode.CompletionItemKind.Keyword],
  ['hash-value', vscode.CompletionItemKind.Keyword],
  ['hash-values', vscode.CompletionItemKind.Keyword],
  ['present-symbol', vscode.CompletionItemKind.Keyword],
  ['present-symbols', vscode.CompletionItemKind.Keyword],
  ['external-symbol', vscode.CompletionItemKind.Keyword],
  ['external-symbols', vscode.CompletionItemKind.Keyword],
  ['symbol', vscode.CompletionItemKind.Keyword],
  ['symbols', vscode.CompletionItemKind.Keyword],

  // type
  ['nil', vscode.CompletionItemKind.Keyword],
  ['t', vscode.CompletionItemKind.Keyword],
  ['fixnum', vscode.CompletionItemKind.TypeParameter],
  ['float', vscode.CompletionItemKind.TypeParameter],
  ['integer', vscode.CompletionItemKind.TypeParameter],
  ['number', vscode.CompletionItemKind.TypeParameter],
  ['of-type', vscode.CompletionItemKind.TypeParameter],
]);

const loopKeywordsSet = new Set(loopKeywordsTokenMap.keys());

export { loopKeywordsTokenMap, loopKeywordsCompItemMap, loopKeywordsSet };
