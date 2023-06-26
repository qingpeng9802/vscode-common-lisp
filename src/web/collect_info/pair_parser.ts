import { bisectRight } from '../common/algorithm';

import { ScanDocRes } from './ScanDocRes';
import { isSpace } from './collect_util';

// return result is rightafter `)`, not at `)`
function findMatchPairAfterPDebug(index: number, text: string): number {
  const [success, res] = eatParentheseDebug(index, text, text.length);

  if (!success) {
    // console.log(`start: ${index}, needclose: ${res}`);
    return -1;
  }
  //console.log(res);
  return res;
}
/*
// return result is rightafter `)`, not at `)`
function findMatchPairAfterP(index: number, text: string): number {
  const res = eatParenthese(index, text, text.length);

  return res;
}

function findMatchPairAfterP(absindex: number, index: number, scanDocRes: ScanDocRes, text: string): number {
  const delta = absindex-index;
  const pair = scanDocRes.pair;

  let pairIdx = bisectRight(pair, absindex, item => item[0]);
  if (scanDocRes.text[absindex] === '(') {
    --pairIdx;
  }
  let newRes = undefined;
  if (pairIdx < 1 || pair[pairIdx - 1][1] < absindex) {
    //console.log('error ', index)
    newRes = -1;
  } else {
    newRes = pair[pairIdx - 1][1] + 1
  }
  const rnewRes = newRes - delta;

  const res = eatParenthese(index, text, text.length);
  if (rnewRes !== res) {
    console.log(absindex, index, res, rnewRes);
  }
  return res;
}
*/

// not eat `;` here, rightafter `;`
function eatLineComment(index: number, text: string, textLength: number): number {
  while (index < textLength && text[index] !== '\n') {
    //console.log(`LC| ${index}: ${doc[index]}`);
    ++index;
  }
  return (index === textLength) ? -1 : index + 1;
}

// not eat `#|` here, rightafter `#|`
function eatBlockComment(index: number, text: string, textLength: number): number {
  let prevc = text[index - 1];
  while (
    index < textLength &&
    (text[index] !== '#' || prevc !== '|')
  ) {
    //console.log(`BC| ${index}: ${doc[index]}`);
    prevc = text[index];
    ++index;
  }
  return (index === textLength) ? -1 : index + 1;
}

// not eat `"` here, rightafter `"`
function eatDoubleQuote(index: number, text: string, textLength: number): number {
  while (index < textLength) {
    //console.log(`DQ| ${index}: ${doc[index]}`);
    switch (text[index]) {
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
function eatSharpsignBackslash(index: number, text: string, textLength: number): number {
  // do not use `g` flag in loop https://stackoverflow.com/questions/43827851/bug-with-regexp-test-javascript
  while (index < textLength) {
    const c = text[index];
    if (!isSpace(c) && c !== ')' && c !== '(') {
      //console.log(`SB| ${index}: ${doc[index]}`);
      ++index;
    } else {
      break;
    }
  }
  return (index === textLength) ? -1 : index;
}

// start rightafter `'(`, that is, first `(` will not be eaten in this function
function eatParenthese(index: number, text: string, textLength: number): number {
  let needClose = 1;

  let prevc = text[index - 1];
  // NOTE: since we start rightafter `(`, so we do not check index-1>0
  while (needClose !== 0 && index < textLength) {
    //console.log(`QP| ${index}: ${doc[index]}`);
    const c = text[index];

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
        index = eatDoubleQuote(index + 1, text, textLength);
        if (index === -1) {
          return -1;
        } else {
          break;
        }

      case ';':
        // skip line comment
        index = eatLineComment(index + 1, text, textLength);
        if (index === -1) {
          return -1;
        } else {
          break;
        }

      case '|':
        // skip comment
        if (prevc === '#') {
          index = eatBlockComment(index + 1, text, textLength);
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
          index = eatSharpsignBackslash(index + 1, text, textLength);
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

    prevc = text[index - 1];
  }
  return (needClose !== 0) ? -1 : index;
}

// start rightafter `'(`, that is, first `(` will not be eaten in this function
function eatParentheseDebug(
  index: number, text: string, textLength: number
): [true, number] | [false, number | undefined] {
  const needCloseStack = [index];

  let needClose = 1;

  let prevc = text[index - 1];
  // NOTE: since we start rightafter `(`, so we do not check index-1>0
  while (needClose !== 0 && index < textLength) {

    const c = text[index];

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
        index = eatDoubleQuote(index + 1, text, textLength);
        if (index === -1) {
          return [false, needCloseStack.at(-1)];
        } else {
          break;
        }

      case ';':
        // skip line comment
        index = eatLineComment(index + 1, text, textLength);
        if (index === -1) {
          return [false, needCloseStack.at(-1)];
        } else {
          break;
        }

      case '|':
        // skip comment
        if (prevc === '#') {
          index = eatBlockComment(index + 1, text, textLength);
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
          index = eatSharpsignBackslash(index + 1, text, textLength);
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

    prevc = text[index - 1];

  }
  return (needClose !== 0) ? [false, needCloseStack.at(-1)] : [true, index];
}

