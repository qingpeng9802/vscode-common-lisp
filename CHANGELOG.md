# Change Log

## [1.2.9] - 2023-11-19
### Added
- can optionally de-color `quote` parts

## [1.2.8] - 2023-10-04
### Changed
- engineering version only

## [1.2.7] - 2023-08-25
### Changed
- optimize the packaging size of this extension

## [1.2.6] - 2023-08-08
### Changed
- `README.md` update README
## [1.2.5] - 2023-07-25
### Added
- add hover provider for user-defined doc

### Changed
- refactor the folder layers

## [1.2.4] - 2023-06-27
### Added
- polish LOOP keywords highlighting

## [1.2.3] - 2023-06-27
### Fixed
- fix non-alphabetic auto-completion

## [1.2.2] - 2023-06-26
### Changed
- `README.md` update README

## [1.2.1] - 2023-06-26
### Added
- add LOOP keywords highlighting

### Fixed
- `comp_item_provider.ts` fix duplicated autocomplete items
- fix some minor bugs, no major feature changes
  
### Changed  
- `package.json` vscode compatibility is upgraded to 1.63 for pre-release feature
- refactor the trigger mechanism of the semantic analysis.  
  The response time should be reduced, but more frequent requests may take  
  more cpu time.  
  
### Deprecated
- old `pair_parser.ts`

### Removed
- In `WorkspaceConfig.ts`, `debounceTimeout` and `throttleTimeout` are removed
  
## [1.1.4] - 2022-06-29
### Changed
- `README.md` update README

## [1.1.3] - 2022-06-29
### Fixed
- `README.md` fix some typos

## [1.1.2] - 2022-06-28
### Added
- `src/web` become a web extension
- `syntaxes/commonlisp.yaml` improve syntax highlighting
- `syntaxes/cl_codeblock.yaml` for highlighting code block in Markdown

## [0.2.2] - 2022-05-30
### Fixed
- `syntaxes/commonlisp.yaml` fixed syntax highlighting

## [0.2.1] - 2022-05-24
### Added
- `syntaxes/commonlisp.yaml` added highlighting for formatted strings
- `syntaxes/commonlisp.tmLanguage.json` is automatically built from `syntaxes/commonlisp.yaml`

### Changed
- `syntaxes/commonlisp.yaml` more accurate highlighting of packages and literal symbols
- `snippets/commonlisp_snippets.json` more snippets

### Deprecated
- `syntaxes/commonlisp.tmLanguage` is achieved, and `syntaxes/commonlisp.yaml` will be actively maintained

## [0.1.4] - 2022-03-05
### Added
- `commonlisp_file_icon.svg` file for common lisp file icon

## [0.1.3] - 2021-12-09
### Changed
- `commonlisp.tmLanguage` fix variables highlighting

## [0.1.2] - 2021-12-01
### Changed
- `commonlisp.tmLanguage` changed highlighting colors and fixed color errors

## [0.0.2] - 2020-06-26
### Added
- `commonlisp.tmLanguage` file syntax highlighting
- `commonlisp.json` file for snippets