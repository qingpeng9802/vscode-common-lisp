import type * as vscode from 'vscode';

// to avoid overhead of passing huge string
interface docObj {
  readonly doc: string;
  readonly docLength: number;
  readonly commentRange: [number, number][];
  readonly stringRange: [number, number][];
  readonly quotedRange: [number, number][];
  readonly quotedPairRange: [number, number][];
  readonly backquoteRange: [number, number][];
  readonly backquotePairRange: [number, number][];
  readonly commaRange: [number, number][];
  readonly commaPairRange: [number, number][];
}

// return result is rightafter `)`, not at `)`
function scanDoc(document: vscode.TextDocument): docObj {
  const doc = document.getText();
  const commentRange: [number, number][] = [];
  const stringRange: [number, number][] = [];
  const quotedRange: [number, number][] = [];
  const quotedPairRange: [number, number][] = [];
  const backquoteRange: [number, number][] = [];
  const backquotePairRange: [number, number][] = [];
  const commaRange: [number, number][] = [];
  const commaPairRange: [number, number][] = [];

  // to avoid overhead of passing huge string
  const docObj = {
    doc: doc,
    docLength: doc.length,
    commentRange: commentRange,
    stringRange: stringRange,
    quotedRange: quotedRange,
    quotedPairRange: quotedPairRange,
    backquoteRange: backquoteRange,
    backquotePairRange: backquotePairRange,
    commaRange: commaRange,
    commaPairRange: commaPairRange,
  };

  eatDoc(0, docObj);
  // console.log(docObj)

  return docObj;
}

// not eat `;` here, rightafter `;`
function eatLineComment(index: number, docObj: docObj): number {
  const doc = docObj.doc;

  const startLineComment = index - 1;
  while (index < docObj.docLength && doc[index] !== '\n') {
    //console.log(`LC| ${index}: ${doc[index]}`);
    ++index;
  }
  docObj.commentRange.push([startLineComment, index + 1]);
  return index === docObj.docLength ? -1 : index + 1;
}

// not eat `#|` here, rightafter `#|`
function eatBlockComment(index: number, docObj: docObj): number {
  const doc = docObj.doc;

  const startBlockComment = index - 2;
  let prevc = doc[index - 1];
  while (
    index < docObj.docLength &&
    (doc[index] !== '#' || prevc !== '|')
  ) {
    //console.log(`BC| ${index}: ${doc[index]}`);
    prevc = doc[index];
    ++index;
  }
  docObj.commentRange.push([startBlockComment, index + 1]);
  return index === docObj.docLength ? -1 : index + 1;
}

// not eat `"` here, rightafter `"`
function eatDoubleQuote(index: number, docObj: docObj): number {
  const doc = docObj.doc;

  const startString = index - 1;
  while (index < docObj.docLength) {
    //console.log(`DQ| ${index}: ${doc[index]}`);
    switch (doc[index]) {
      case '\\':
        ++index;
        ++index;
        break;

      case '"':
        docObj.stringRange.push([startString, index + 1]);
        return index + 1;

      default:
        ++index;
        break;
    }
  }
  return -1;
}

// # CL-ANSI 2.4.8.1 Sharpsign Backslash
// start rightafter `#\`
// may include `)`, not add 1 for `index` when return
function eatSharpsignBackslash(index: number, docObj: docObj): number {
  const doc = docObj.doc;

  // do not use `g` flag in loop https://stackoverflow.com/questions/43827851/bug-with-regexp-test-javascript
  while (index < docObj.docLength) {
    const c = doc[index];
    if (!/\s/.test(c) && c !== ')' && c !== '(') {
      //console.log(`SB| ${index}: ${doc[index]}`);
      ++index;
    } else {
      break;
    }
  }
  return index === docObj.docLength ? -1 : index;
}

function eatSingleQuoteOrSingleBackQuote(index: number, docObj: docObj): number {
  const doc = docObj.doc;

  while (index < docObj.docLength) {
    const c = doc[index];
    if (!/\s/.test(c) && c !== ')') {
      //console.log(`SQ| ${index}: ${doc[index]}`);
      ++index;
    } else {
      break;
    }
  }

  return index;
}

// start rightafter `'(`, that is, first `(` will not be eaten in this function
function eatDoc(index: number, docObj: docObj): -1 | undefined {
  const doc = docObj.doc;

  const passSet = new Set([',', '@', '.', '#', '`', '\'']);

  let needClose = 0;

  let quotedPairStartNeedClose = undefined;
  let backquotePairStartNeedClose = undefined;
  let commaPairStartNeedClose = undefined;

  let prevc = '';
  // NOTE: since we start rightafter `(`, so we do not check index-1>0
  while (index < docObj.docLength) {
    //console.log(`QP| ${index}: ${doc[index]}`);
    const c = doc[index];

    switch (c) {
      case '(':
        // just add 1
        ++needClose;

        ++index;
        break;

      case ')':
        if (needClose === 0) {
          return -1;
        }
        //console.log(`closing: [${close}, ${index}]`);
        --needClose;
        if (quotedPairStartNeedClose && needClose === quotedPairStartNeedClose[1]) {
          docObj.quotedPairRange.push([quotedPairStartNeedClose[0], index + 1]);
          quotedPairStartNeedClose = undefined;
        }
        if (backquotePairStartNeedClose && needClose === backquotePairStartNeedClose[1]) {
          docObj.backquotePairRange.push([backquotePairStartNeedClose[0], index + 1]);
          backquotePairStartNeedClose = undefined;
        }
        if (commaPairStartNeedClose && needClose === commaPairStartNeedClose[1]) {
          docObj.commaPairRange.push([commaPairStartNeedClose[0], index + 1]);
          commaPairStartNeedClose = undefined;
        }

        ++index;
        break;

      case '"':
        // skip string
        index = eatDoubleQuote(index + 1, docObj);
        if (index === -1) {
          return -1;
        } else {
          break;
        }

      case ';':
        // skip line comment
        index = eatLineComment(index + 1, docObj);
        if (index === -1) {
          return -1;
        } else {
          break;
        }

      case '|':
        // skip comment
        if (prevc === '#') {
          index = eatBlockComment(index + 1, docObj);
          if (index === -1) {
            return -1;
          } else {
            break;
          }
        } else {
          ++index;
          break;
        }

      case '\\':
        if (prevc === '#') {
          index = eatSharpsignBackslash(index + 1, docObj);
          if (index === -1) {
            return -1;
          } else {
            break;
          }
        } else {
          ++index;
          ++index;
          break;
        }

      case '\'':
        if (quotedPairStartNeedClose === undefined && index + 1 < docObj.docLength) {
          let tempInd = index + 1;

          if (prevc !== '#') {
            while (tempInd < docObj.docLength && passSet.has(doc[tempInd])) {
              ++tempInd;
            }
            if (doc[tempInd] === '(') {
              quotedPairStartNeedClose = [tempInd, needClose];
            } else {
              while (tempInd < docObj.docLength && !/\s/.test(doc[tempInd]) && doc[tempInd] !== ')') {
                ++tempInd;
              }
              docObj.quotedRange.push([index + 1, tempInd]);
            }
          }
        }

        ++index;
        break;

      case '`':
        if (backquotePairStartNeedClose === undefined && index + 1 < docObj.docLength) {
          let tempInd = index + 1;

          if (doc[tempInd] === ',') {
            ++index;
            ++index;
            break;
          }

          while (tempInd < docObj.docLength && passSet.has(doc[tempInd])) {
            ++tempInd;
          }
          if (doc[tempInd] === '(') {
            backquotePairStartNeedClose = [tempInd, needClose];
          } else {
            while (tempInd < docObj.docLength && !/\s/.test(doc[tempInd]) && doc[tempInd] !== ')') {
              ++tempInd;
            }
            docObj.backquoteRange.push([index + 1, tempInd]);
          }

        }
        ++index;
        break;

      case ',':
        if (commaPairStartNeedClose === undefined && index + 1 < docObj.docLength) {
          let tempInd = index + 1;

          while (tempInd < docObj.docLength && passSet.has(doc[tempInd])) {
            ++tempInd;
          }
          if (doc[tempInd] === '(') {
            commaPairStartNeedClose = [tempInd, needClose];
          } else {
            while (tempInd < docObj.docLength && !/\s/.test(doc[tempInd]) && doc[tempInd] !== ')') {
              ++tempInd;
            }
            docObj.commaRange.push([index + 1, tempInd]);
          }

        }

        ++index;
        break;

      /*case '#':
      // skip macro reader, reset prevc
      while (/\d/.test(doc[index])) {
        ++index;
      }
      ++index;
      continue;
      */

      default:
        ++index;
        break;
    }

    prevc = c;
  }
  return undefined;
}


export { scanDoc };
