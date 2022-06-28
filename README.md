# Common Lisp language support for VS Code
This VS Code extension supports Syntax Highlighting, Snippets, Completion, Hover, Definition, References, Document Symbol, Call Hierarchy, Semantic Tokens for Common Lisp.  

## Features

### Syntax Highlighting
<img src="https://raw.githubusercontent.com/qingpeng9802/vscode-common-lisp/master/images/syntax_dark_plus.png">  
  
<img src="https://raw.githubusercontent.com/qingpeng9802/vscode-common-lisp/master/images/syntax_light_plus.png">  

### Snippets
<img src="https://raw.githubusercontent.com/qingpeng9802/vscode-common-lisp/master/images/snippets.gif">

## Usage and Recommendation
Beginner's Guide: [Overview](https://code.visualstudio.com/docs/languages/overview).  

### Quick Guide  

File Types: `lisp`, `lsp`, `l`, `cl`, `asd`, `asdf` and you can add more by yourself: [adding-a-file-extension-to-a-language](https://code.visualstudio.com/docs/languages/overview#_adding-a-file-extension-to-a-language).

|Kind of Symbols                                           |Color (Dark+)|Color (Light+)|
|-|-|-|
|Macro, Declaration                                        | Blue        | Dark Blue    |
|Special Operator                                          | Purple      | Purple       |
|Accessor, Functions, Standard Generic Function            | Yellow      | Khaki        |
|Class, System Class, Type, Condition Type                 | Green       | Dark Green   |
|Keyword Package Symbol, Local Variable                    | Sky Blue    | Navy Blue    |
|Constant Variable                                         | Light Blue  | Blue         |
|Special Variable                                          | Red         | Brown        |
  
Snippets support: `defun`, `if`, `cond`, `let`, `let*`, `lambda`, etc.
  
For huge files, in some rare cases, semantic highlighting might lose synchronization when switching files or some large change happens quickly. You only need to type any character in the file to recover.

### Preference
The language identifier (id) is `commonlisp` .  

If you need customize your setting only for Common Lisp file, in `settings.json`, please add something like
```json
"[commonlisp]": {
  "editor.bracketPairColorization.enabled": false
}
```
  
Bracket pair colorization:  
- This is enabled [by default](https://code.visualstudio.com/updates/v1_67#_bracket-pair-colorization-enabled-by-default) in VS Code. Bracket pair colorization can be disabled by setting `"editor.bracketPairColorization.enabled": false`.  
(Thanks to the past contributions of [Bracket Pair Colorizer 2](https://marketplace.visualstudio.com/items?itemName=CoenraadS.bracket-pair-colorizer-2) )
  
Hover tootip:  
- If you find this disturbing, you can disable it in `Editor> Hover` or set a larger delay in `Editor> Hover:Delay`.

Quick suggestions:
- If you need suggestions while you are in an active snippet, you can disable `Editor> Suggest:Snippets Prevent Quick Suggestions`.
- If you need `Snippets` to be on the top of suggestions, you can set `"editor.snippetSuggestions": "top"`.

Semantic highlighting:
- Semantic highlighting can be disabled by setting `"editor.semanticHighlighting.enabled": false`.

Also, there are some built-in settings of this extension which can customize more **advanced preferences**,
for example, which language feature provider should be used, which token range should be excluded and how to deal with backquote part. See [wiki](https://github.com/qingpeng9802/vscode-common-lisp/wiki).  

If you need to disable all [Programmatic Language Features](https://code.visualstudio.com/api/language-extensions/programmatic-language-features), you can set `"commonLisp.StaticAnalysis.enabled": false` in this extension's built-in settings (under `Common Lisp` tab).

## Design
  
### Syntax Highlighting
Because of the funtional features of Common Lisp, we use the intuition of Common Lisp to design syntax highlighting instead of the intuition of non-functional language to design syntax highlighting. That is, we strictly follow the CL-ANSI 1.4.4.14 to classify the 978 external symbols in COMMON-LISP package. 

We processed [Common Lisp HyperSpec](http://www.lispworks.com/documentation/HyperSpec/Front/) to get the kind of each symbol. The result is in `./assets/COMMON-LISP-symbols.csv`, and please feel free to reuse the result :)  

We assign different colors to different kind of symbols, the assignment rule can be found in the start comment of `./syntaxes/commonlisp.yaml`. This file includes comments (related info in `CL-ANSI`) for all rules.  

> For best performance and profile consistency, please use VS Code 1.69.0 or later.  

### Static Analysis
Currently, we use a very simple hand-written parser and combine it with regex to parse the code. Thus, the accuracy, precision and performance are not good enough. However, we have no plans to further complicate the parser since it is like rebuilding a wheel (new parser) by using TypeScript.  

Since this extension is designed as a [Web Extension](https://code.visualstudio.com/api/extension-guides/web-extensions), we are considering using [node-tree-sitter](https://github.com/tree-sitter/node-tree-sitter) as the parser in the future. However, we have no plan to update the parser recently since we are still evaluating its impact on the architecture of VS Code language service (see [Anycode](https://github.com/microsoft/vscode-anycode)).


## Acknowledgement
draft proposed American National Standard for Information Systems—Programming Language—Common Lisp X3J13/94-101R [(CL-ANSI)](https://franz.com/support/documentation/cl-ansi-standard-draft-w-sidebar.pdf)  
[Common Lisp HyperSpec](http://www.lispworks.com/documentation/HyperSpec/Front/),
[vscode-scheme](https://github.com/sjhuangx/vscode-scheme),
[Scheme.tmLanguage](https://github.com/egrachev/sublime-scheme/blob/master/Scheme.tmLanguage),
[Lisp.tmLanguage](https://github.com/bradrobertson/sublime-packages/blob/master/Lisp/Lisp.tmLanguage),
[regex101](https://regex101.com/)  

### Image Credits
The `icon.png` is from [Common-Lisp.net](https://common-lisp.net/) and resized.  
The `commonlisp_file_icon.svg` is extracted from common lisp icon and colored with the purple in Conrad Barski's [Logo](http://www.lisperati.com/logo.html).  
`icon.png` and `commonlisp_file_icon.svg` are used under [Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/).  
The code segment in `Syntax Highlighting` is from [SBCL Repository](https://github.com/sbcl/sbcl).  
