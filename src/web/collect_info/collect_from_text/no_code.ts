import { ScanDocRes } from '../ScanDocRes';
import { isSpace } from '../collect_util';

const passSet = new Set([',', '@', '.', '#', '`', '\'']);

// return result is rightafter `)`, not at `)`
function scanDoc(text: string): ScanDocRes {
  const scanDocRes = new ScanDocRes(text);

  eatDoc(0, text, text.length, scanDocRes);
  // console.log(scanDocRes)

  return scanDocRes;
}

// not eat `;` here, rightafter `;`
function eatLineComment(index: number, text: string, textLength: number, scanDocRes: ScanDocRes): number {
  const startLineComment = index - 1;
  while (index < textLength && text[index] !== '\n') {
    //console.log(`LC| ${index}: ${doc[index]}`);
    ++index;
  }
  scanDocRes.commentRange.push([startLineComment, index + 1]);
  return (index === textLength) ? -1 : index + 1;
}

// not eat `#|` here, rightafter `#|`
function eatBlockComment(index: number, text: string, textLength: number, scanDocRes: ScanDocRes): number {
  const startBlockComment = index - 2;
  let prevc = text[index - 1];
  while (
    index < textLength &&
    (text[index] !== '#' || prevc !== '|')
  ) {
    //console.log(`BC| ${index}: ${doc[index]}`);
    prevc = text[index];
    ++index;
  }
  scanDocRes.commentRange.push([startBlockComment, index + 1]);
  return (index === textLength) ? -1 : index + 1;
}

// not eat `"` here, rightafter `"`
function eatDoubleQuote(index: number, text: string, textLength: number, scanDocRes: ScanDocRes): number {
  const startString = index - 1;
  while (index < textLength) {
    //console.log(`DQ| ${index}: ${doc[index]}`);
    switch (text[index]) {
      case '\\':
        ++index;
        ++index;
        break;

      case '"':
        scanDocRes.stringRange.push([startString, index + 1]);
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
function eatSharpsignBackslash(index: number, text: string, textLength: number,): number {
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

function eatSingleQuoteOrSingleBackQuote(index: number, text: string, textLength: number,): number {
  while (index < textLength) {
    const c = text[index];
    if (!isSpace(c) && c !== ')') {
      //console.log(`SQ| ${index}: ${doc[index]}`);
      ++index;
    } else {
      break;
    }
  }

  return index;
}

// start rightafter `'(`, that is, first `(` will not be eaten in this function
function eatDoc(index: number, text: string, textLength: number, scanDocRes: ScanDocRes): -1 | undefined {
  let needClose = 0;

  let quotedPairStartNeedClose: [number, number] | undefined = undefined;
  let backquotePairStartNeedClose: [number, number] | undefined = undefined;
  let commaPairStartNeedClose: [number, number] | undefined = undefined;

  const needCloseStack = [];

  let prevc = '';
  // NOTE: since we start rightafter `(`, so we do not check index-1>0
  while (index < textLength) {
    //console.log(`QP| ${index}: ${doc[index]}`);
    const c = text[index];

    switch (c) {
      case '(':
        // just add 1
        needCloseStack.push(index);
        ++needClose;

        ++index;
        break;

      case ')': {
        if (needClose === 0) {
          ++index;
          break;
        }

        const left = needCloseStack.pop();
        if (left !== undefined) {
          scanDocRes.pair.push([left, index]);
        }

        //console.log(`closing: [${close}, ${index}]`);
        --needClose;
        if (quotedPairStartNeedClose !== undefined && needClose === quotedPairStartNeedClose[1]) {
          scanDocRes.quotedPairRange.push([quotedPairStartNeedClose[0], index + 1]);
          quotedPairStartNeedClose = undefined;
        }
        if (backquotePairStartNeedClose !== undefined && needClose === backquotePairStartNeedClose[1]) {
          scanDocRes.backquotePairRange.push([backquotePairStartNeedClose[0], index + 1]);
          backquotePairStartNeedClose = undefined;
        }
        if (commaPairStartNeedClose !== undefined && needClose === commaPairStartNeedClose[1]) {
          scanDocRes.commaPairRange.push([commaPairStartNeedClose[0], index + 1]);
          commaPairStartNeedClose = undefined;
        }

        ++index;
        break;
      }
      case '"':
        // skip string
        index = eatDoubleQuote(index + 1, text, textLength, scanDocRes);
        if (index === -1) {
          return -1;
        }
        break;

      case ';':
        // skip line comment
        index = eatLineComment(index + 1, text, textLength, scanDocRes);
        if (index === -1) {
          return -1;
        }
        break;

      case '|':
        // skip comment
        if (prevc === '#') {
          index = eatBlockComment(index + 1, text, textLength, scanDocRes);
          if (index === -1) {
            return -1;
          }
          break;
        } else {
          ++index;
          break;
        }

      case '\\':
        if (prevc === '#') {
          index = eatSharpsignBackslash(index + 1, text, textLength);
          if (index === -1) {
            return -1;
          }
          break;
        } else {
          ++index;
          ++index;
          break;
        }

      case '\'':
        if (quotedPairStartNeedClose === undefined && index + 1 < textLength) {
          if (prevc !== '#') {
            const open = collectRange(index, needClose, scanDocRes.quotedRange, text, textLength);
            if (open !== undefined) {
              quotedPairStartNeedClose = open;
            }
          }
        }

        ++index;
        break;

      case '`':
        if (backquotePairStartNeedClose === undefined && index + 1 < textLength) {
          if (text[index + 1] === ',') {
            ++index;
            ++index;
            break;
          }
          const open = collectRange(index, needClose, scanDocRes.backquoteRange, text, textLength);
          if (open !== undefined) {
            backquotePairStartNeedClose = open;
          }
        }
        ++index;
        break;

      case ',':
        if (commaPairStartNeedClose === undefined && index + 1 < textLength) {
          const open = collectRange(index, needClose, scanDocRes.commaRange, text, textLength);
          if (open !== undefined) {
            commaPairStartNeedClose = open;
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

  scanDocRes.pair.sort(
    (a, b) => a[0] - b[0]
  );
  return undefined;
}

function collectRange(
  index: number, needClose: number, rangeCollector: [number, number][], text: string, textLength: number
): [number, number] | undefined {
  let tempInd = index + 1;
  while (tempInd < textLength && passSet.has(text[tempInd])) {
    ++tempInd;
  }

  if (text[tempInd] === '(') {
    return [tempInd, needClose];
  } else {
    while (tempInd < textLength && !isSpace(text[tempInd]) && text[tempInd] !== ')') {
      ++tempInd;
    }
    rangeCollector.push([index + 1, tempInd]);
  }
  return undefined;
}


export { scanDoc };
