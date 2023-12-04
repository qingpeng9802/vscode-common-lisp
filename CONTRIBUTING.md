# Developer Guide
Welcome, and thank you for your interest in this project!  
Hoping this guide will be helpful to you whether you would like to contribute, fork, or learn this repository :)

> Please note that we will discuss the implementation of [programmatic-language-features](https://code.visualstudio.com/api/language-extensions/programmatic-language-features) in the folder `./src`  first. If you are interested in [declarative language features](https://code.visualstudio.com/api/language-extensions/overview#declarative-language-features), see the part [declarative-language-features](#declarative-language-features).

## Architecture  
Let us first take a brief look at the design of this project.  

![layers](./images/doc/layers.png)  

The image above shows the layers of the source code. `entry` initializes the extension and applies the vscode workspace configuration to the extension. `provider_interface` registers the providers in vscode. `builders` prepare the data structures from the raw text string/processed semantic information for vscode language features. `collect_info` collects the semantic information from the raw text string. `common` includes some constants and algorithms. `doc` is the interface for getting documentation.  

If you are interested in a more detailed dependency graph, you can find the dependency graph in [`./images/doc/dependency_graph.svg`](./images/doc/dependency_graph.svg). Also, you can generate the dependency graph by running
> You may need to run `sudo apt install graphviz` first
```shell
npx depcruise src --no-config --include-only "^src" --output-type dot | dot -T svg > ./images/doc/dependency_graph.svg
```

## Data Flow  
![data_flow](./images/doc/data_flow.svg)  

Please do not trust the correspondence between naming in the data flow diagram and naming in the source code since the naming in the source code is subject to change.  

## How it works 

### Global State Manager Part
This part is above the dashed line in the Data Flow diagram. `entry` includes this part.  
The config listener will listen to the config change from vscode. Then, the config listener will call other functions to register the correct providers and pass the building config to `structuredInfo`. If you are interested in the configuration of this extension, see
[Configuration](https://github.com/qingpeng9802/vscode-common-lisp/wiki/Configuration).  
Also, the dirty listener will set the dirty flag to true in `structuredInfo` when a text/editor change event is received.  

### Core Functionality Part
This part is below the dashed line in the Data Flow diagram. The core functionality is in this part. First, if you are not familiar with vscode extension, please just check [patterns-and-principles](https://vscode-docs.readthedocs.io/en/stable/extensions/patterns-and-principles/) and [programmatic-language-features](https://code.visualstudio.com/api/language-extensions/programmatic-language-features).  
When vscode requests language information from a provider, the provider will call `updateResultByDoc` to get updated semantic information. Then, the provider will return the information to vscode. If you are interested in how the provider works, you can check the samples in [vscode-extension-samples samples](https://github.com/microsoft/vscode-extension-samples#samples) which used API `languages.`  

## Compile & Package 

### Setup  
Run `npm install`  

### Development
- How to add a vscode provider?  
    1. add a pair (k, v) in `TraceableDisposables.disposables` 
    2. add a pair (k, v) in `TraceableDisposables.cfgMapDisposable`
    3. add a case in `TraceableDisposables.registerProviderByName`
    4. add a config (k, v) in `WorkspaceConfig.config`
    5. add a config in `contributes.configuration.properties` in `package.json`

- How to change the parsing process?  
    The parsing process is in `collect_from_text`, and the symbol information is stored in `Map{name: SymbolInfo}`

- How to change the vscode-formated language information?  
    `builders` prepare the vscode-formated language information. See `export{}` to understand what information the builder is building.

### Compile  
Run `npm run esbuildc` for compiling once;  
Run `npm run esbuildw` for watch mode;  
Run `npm run esbuildp` for production.  

> Please remember to run `npm run tscc` for TypeScript type checking separately.  

For more commands, check them in `"scripts"` in `package.json`.

Note that we are trying to use `esbuild` as the bundler since it is faster than `webpack`. However, we still keep `webpack` for `vsce package`.  

`Parcel` shows worse performance than `webpack` in this project, but the cli commands are saved below for those who might be interested. Maybe we will try `swcpack` in the future.  
```json
"parcelc": "parcel build ./src/web/extension.ts --dist-dir ./dist/web --no-optimize",
"parcelw": "parcel watch ./src/web/extension.ts --dist-dir ./dist/web --no-optimize",
"parcelp": "parcel build ./src/web/extension.ts --dist-dir ./dist/web --no-source-maps",
```

### Debug
See [debugging-the-extension](https://code.visualstudio.com/api/get-started/your-first-extension#debugging-the-extension). Note that `"preLaunchTask": "npm: esbuildc"` in `launch.json` is disabled in this project so you need to run `npm run esbuildc` (or just enable `"preLaunchTask"`) before launching the debugger.  

### Linting
Run `npm run lint` for linting.  
Most errors and warnings can be fixed automatically by running `npm run lint -- --fix`. 

Run `npx unimported` to check if there are any dangling files.

### Test
There are no tests now. The features of this project are still changing. Most of the time needs to be allocated for polishing the features.  

Run `npm test` for testing.

### Package vsix
Run `npm i -g @vscode/vsce` to install `vsce` globally since `vsce` is not in the `package.json`.  

Run `vsce package`.  
Then, you will get a `common-lisp-x.x.x.vsix` in your `./` .
> `.vscodeignore` uses whitelist mode. Run `npx vsce ls` to check what has been packaged.

If you would like to use the packaged `.vsix` extension, you can load the `.vsix` extension to vscode by referring to [extension-marketplace install-from-a-vsix](https://code.visualstudio.com/docs/editor/extension-marketplace#_install-from-a-vsix).  

## Version Control
The version number is in the format MAJOR.MINOR.PATCH. We do not comply with the *Semantic Versioning* strictly. We save x.x.0 for the *alpha version* and x.x.1 for the *beta version*.  
  
## Code Style  
We are trying to write dumb code. TypeScript has many fancy syntax features, however, we would not like to use them too much. We are trying to maintain the best readability while utilizing some useful syntax features.

We do not use `prettier` in the linter, and the reason is basically [Why I don't use Prettier_antfu](https://antfu.me/posts/why-not-prettier).  

According to [The Art of Unix Programming, Chapter 4. Modularity, Encapsulation and Optimal Module Size](http://catb.org/esr/writings/taoup/html/ch04s01.html),
we are trying to keep <200 logical lines of code and <400 physical lines of code per file for maintainability.  
Run `find ./src -name '*.ts' | xargs wc -l` to check the physical lines of code of `./src`.

## Declarative Language Features  

### Syntax Highlight
#### Introduction
We have two syntax files in `./syntaxes`, and we use `./syntaxes/scripts/build_grammar.mjs` to convert them into `json` format:
- `commonlisp.yaml` is the main syntax of Common Lisp.
- `cl_codeblock.yaml` is the [injection grammar](https://code.visualstudio.com/api/language-extensions/syntax-highlight-guide#injection-grammars) for Markdown.

If you need to modify the syntax, here are some helpful materials:  
[Syntax Highlight Guide](https://code.visualstudio.com/api/language-extensions/syntax-highlight-guide),
[TextMate grammars](https://macromates.com/manual/en/language_grammars),
[making_language_grammar](https://gist.github.com/Aerijo/b8c82d647db783187804e86fa0a604a1#file-making_language_grammar-md),
[textmatebundle](https://www.apeth.com/nonblog/stories/textmatebundle.html),
[regex101](https://regex101.com/),
[Common Lisp HyperSpec](https://www.lispworks.com/documentation/HyperSpec/Front/).

#### Workflow
Mastering the TextMate grammars is very difficult. If you are a beginner, you can try to start with a small work sample and then work on it incrementally.  
The recommended workflow is:  
1. `git add`
2. construct a regex and verify the regex in [regex101](https://regex101.com/)
3. add the regex to the syntax
4. convert the syntax into `json` and test the syntax in real world

#### Maintain grammar health
1. After you modified the grammar, run `npm run bg` to rebuild the grammar.  
2. Then, run `npm run testg` to test the grammar with the fixtures in `syntaxes/fixtures/baselines`.
    > You may optionally run `npx tsc -p syntaxes/scripts/tsconfig.json` to generate `gen_record.mjs`.
3. Check if it is the test result you expected. Run `npm run diff` to find the differences between the baselines and generated.
4. If the changes are what you expect, run `npm run accept` to accept the new baselines.

### Snippet
In `./declaratives/commonlisp_snippets.json`.
See [Snippet Guide](https://code.visualstudio.com/api/language-extensions/snippet-guide) and [creating-your-own-snippets](https://code.visualstudio.com/docs/editor/userdefinedsnippets#_creating-your-own-snippets).

### Language Configuration
In `./declaratives/language-configuration.json`.
See [Language Configuration Guide](https://code.visualstudio.com/api/language-extensions/language-configuration-guide).
