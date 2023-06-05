// to avoid overhead of passing huge string
interface docObj {
  readonly doc: string;
  readonly docLength: number;
}

// return result is rightafter `)`, not at `)`
function findMatchPairParentheseDebug(index: number, doc: string): number {
  // to avoid overhead of passing huge string
  const docObj = {
    doc: doc,
    docLength: doc.length
  };

  const [success, res] = eatParentheseDebug(index, docObj);

  if (!success) {
    // console.log(`start: ${index}, needclose: ${res}`);
    return -1;
  }
  //console.log(res);
  return res;
}

// return result is rightafter `)`, not at `)`
function findMatchPairParenthese(index: number, doc: string): number {
  // to avoid overhead of passing huge string
  const docObj = {
    doc: doc,
    docLength: doc.length
  };

  const res = eatParenthese(index, docObj);

  return res;
}

// not eat `;` here, rightafter `;`
function eatLineComment(index: number, docObj: docObj): number {
  const doc = docObj.doc;

  while (index < docObj.docLength && doc[index] !== '\n') {
    //console.log(`LC| ${index}: ${doc[index]}`);
    ++index;
  }
  return index === docObj.docLength ? -1 : index + 1;
}

// not eat `#|` here, rightafter `#|`
function eatBlockComment(index: number, docObj: docObj): number {
  const doc = docObj.doc;

  let prevc = doc[index - 1];
  while (
    index < docObj.docLength &&
    (doc[index] !== '#' || prevc !== '|')
  ) {
    //console.log(`BC| ${index}: ${doc[index]}`);
    prevc = doc[index];
    ++index;
  }
  return index === docObj.docLength ? -1 : index + 1;
}

// not eat `"` here, rightafter `"`
function eatDoubleQuote(index: number, docObj: docObj): number {
  const doc = docObj.doc;

  while (index < docObj.docLength) {
    //console.log(`DQ| ${index}: ${doc[index]}`);
    switch (doc[index]) {
      case '\\':
        ++index;
        ++index;
        break;

      case '"':
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

// start rightafter `'(`, that is, first `(` will not be eaten in this function
function eatParenthese(index: number, docObj: docObj): number {
  const doc = docObj.doc;

  let needClose = 1;

  let prevc = doc[index - 1];
  // NOTE: since we start rightafter `(`, so we do not check index-1>0
  while (needClose !== 0 && index < docObj.docLength) {
    //console.log(`QP| ${index}: ${doc[index]}`);
    const c = doc[index];

    switch (c) {
      case '(':
        // just add 1
        ++needClose;

        ++index;
        break;

      case ')':
        //console.log(`closing: [${close}, ${index}]`);
        if (needClose === 0) {
          return -1;
        }
        --needClose;

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

      default:

        ++index;
        break;
    }

    prevc = doc[index - 1];
  }
  return needClose ? -1 : index + 1;
}

// start rightafter `'(`, that is, first `(` will not be eaten in this function
function eatParentheseDebug(index: number, docObj: docObj): [true, number] | [false, number | undefined] {
  const doc = docObj.doc;

  const needCloseStack = [index];

  let needClose = 1;

  let prevc = doc[index - 1];
  // NOTE: since we start rightafter `(`, so we do not check index-1>0
  while (needClose !== 0 && index < docObj.docLength) {

    const c = doc[index];

    switch (c) {
      case '(':
        // just add 1
        needCloseStack.push(index);
        ++needClose;

        ++index;
        break;

      case ')':
        if (needClose === 0) {
          return [false, index];
        }

        needCloseStack.pop();
        //const close = needCloseStack.pop();
        //console.log(`closing: [${close}, ${index}]`);

        --needClose;

        ++index;
        break;

      case '"':
        // skip string
        index = eatDoubleQuote(index + 1, docObj);
        if (index === -1) {
          return [false, needCloseStack.at(-1)];
        } else {
          break;
        }

      case ';':
        // skip line comment
        index = eatLineComment(index + 1, docObj);
        if (index === -1) {
          return [false, needCloseStack.at(-1)];
        } else {
          break;
        }

      case '|':
        // skip comment
        if (prevc === '#') {
          index = eatBlockComment(index + 1, docObj);
          if (index === -1) {
            return [false, needCloseStack.at(-1)];
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
            return [false, needCloseStack.at(-1)];
          } else {
            break;
          }
        } else {
          ++index;
          ++index;
          break;
        }

      default:

        ++index;
        break;
    }

    prevc = doc[index - 1];

  }
  return needClose ? [false, needCloseStack.at(-1)] : [true, index + 1];
}

export { findMatchPairParenthese };
