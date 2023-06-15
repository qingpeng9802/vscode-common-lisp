# Developer Guide
Welcome, and thank you for your interest in this project!  
Hoping this guide will be helpful to you whether you would like to fork or learn this repository :)
## Introduction
Let us first take a brief look at the design of this project.  

## Architecture

## Version Control
The version number is in the format MAJOR.MINOR.PATCH. We do not comply *Semantic Versioning* strictly. We save x.x.0 for the phase of *alpha version* and x.x.1 for the phase of *beta version*. x.x.>=3 is used for the phase of *general availability*.  

## Environment & Testing
Transition to `esbuild`, but be careful use `tsc` for TypeScript type checking separately.  
although `Parcel` is using `swc`, it shows worse performance than `webpack`.  
Maybe we will try `swcpack` in the future.  
```json
"parcel-compile": "parcel build ./src/web/extension.ts --dist-dir ./dist/web --no-optimize",
"parcel-watch": "parcel watch ./src/web/extension.ts --dist-dir ./dist/web --no-optimize",
"parcel-package": "parcel build ./src/web/extension.ts --dist-dir ./dist/web --no-source-maps",
```
`npm install`

fast pace, breaking change, more time on feature

### Package vsix
Run `npm i -g vsce` to install `vsce` globally since `vsce` is not in the `package.json`.  

Run `vsce package`.  
Then, you will get a `common-lisp-x.x.x.vsix` in your `./` .

You can load your `.vsix` extension file by refering to [extension-marketplace install-from-a-vsix](https://code.visualstudio.com/docs/editor/extension-marketplace#_install-from-a-vsix).  

[programmatic-language-features](https://code.visualstudio.com/api/language-extensions/programmatic-language-features)  
[vscode-extension-samples samples](https://github.com/microsoft/vscode-extension-samples#samples)  
[patterns-and-principles](https://vscode-docs.readthedocs.io/en/stable/extensions/patterns-and-principles/)  

## Code Health
### Style
Just write dumb code. TypeScript has many fancy syntax features, however, we would not like to use them too much. We are trying to maintain best readability while utilizing some useful syntax features.
### Lines of code per file 
According to [The Art of Unix Programming, Chapter 4. Modularity, Encapsulation and Optimal Module Size](http://catb.org/esr/writings/taoup/html/ch04s01.html),
we are trying to keep <200 logical lines of code and <400 physical lines of code per file.  
Run `find ./src -name '*.ts' | xargs wc -l` to check the physical lines of code of `./src`.
### Linting
Run `npm run lint` for linting.  
Most errors and warnings are able to be fixed automatically by run `npm run lint -- --fix`.  
