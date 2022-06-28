import { clValidSymbolSingleCharColonSharpSet } from '../cl_util';

import { findMatchPairParenthese } from "./pair_parser";

function processRecList(varsStr: string, baseInd: number, keywordStatus: string, allowDestructuring: boolean):
  Record<string, [number, number]> {
  const res: Record<string, [number, number]> = {};

  let currName = '';
  let currStart = -1;
  let i = 1;

  // console.log(`processRecList: ${varsStr}`);

  while (i < varsStr.length) {
    //console.log(`${i}: ${varsStr[i]}|${currName}|${currStart}`);

    if (varsStr[i] === '#') {
      //skip reader macro #+ & #-
      if (i + 1 < varsStr.length && (varsStr[i + 1] === '+' || varsStr[i + 1] === '-')) {
        if (i + 2 < varsStr.length) {
          if (varsStr[i + 2] === '(' && i + 3 < varsStr.length) {
            const newInd = findMatchPairParenthese(i + 3, varsStr);
            if (newInd === -1) {
              return res;
            }

            i = newInd;
            continue;
          } else {
            while (i < varsStr.length && !/\s/.test(varsStr[i]) && varsStr[i] !== ')') {
              ++i;
            }
            continue;
          }

        } else {
          return res;
        }
      }

    } else if (clValidSymbolSingleCharColonSharpSet.has(varsStr[i])) {
      // `var`
      if (currStart === -1) {
        currStart = i;
      }

      currName += varsStr[i];
      ++i;

    } else if (varsStr[i] === '(') {
      if (i + 1 === varsStr.length) {
        return res;
      }

      // `( var`
      const newInd = findMatchPairParenthese(i + 1, varsStr);
      if (newInd === -1) {
        return res;
      }
      if (varsStr[i - 1] === '`' || varsStr[i - 1] === '\'') {
        i = newInd;
        continue;
      }

      if (!allowDestructuring) {
        // skip current `(`
        ++i;
        while (i < newInd && /\s/.test(varsStr[i])) {
          ++i;
        }
        let afterVar = '';
        let afterVarStart = -1;
        while (i < newInd && clValidSymbolSingleCharColonSharpSet.has(varsStr[i]) && varsStr[i] !== ')') {
          if (!afterVar) {
            afterVarStart = i;
          }
          afterVar += varsStr[i];
          ++i;
        }
        if (afterVar && afterVarStart !== -1) {
          //console.log(`h|${afterVar}: ${baseInd + afterVarStart} -> ${baseInd + afterVarStart + afterVar.length}`);
          res[afterVar] = [baseInd + afterVarStart, baseInd + afterVarStart + afterVar.length];
        }

      } else {


        if (!keywordStatus) {
          // getting embedded
          const workingStr = varsStr.substring(i, newInd);

          //console.log(`Rec...ing|${keywordStatus}`)
          const addRes = processRecList(workingStr, baseInd + i, keywordStatus, allowDestructuring);
          Object.assign(res, addRes);
        } else {
          // `( var`
          if (keywordStatus === '&optional' || keywordStatus === '&key' || keywordStatus === '&aux') {
            let varName = '';
            let varStart = -1;

            // skip current `(`
            ++i;
            while (i < newInd && /\s/.test(varsStr[i])) {
              ++i;
            }
            while (i < newInd) {
              // see embedded
              if (varsStr[i] === '(') {
                if (i + 1 === varsStr.length) {
                  return res;
                }
                const embeddedEnd = findMatchPairParenthese(i + 1, varsStr);
                if (embeddedEnd === -1) {
                  return res;
                }
                if (varsStr[i - 1] === '`' || varsStr[i - 1] === '\'') {
                  i = embeddedEnd;
                  continue;
                }
                const embeddedStr = varsStr.substring(i, embeddedEnd);

                //console.log(`Rec...ing|${keywordStatus}`)
                const addRes = processRecList(embeddedStr, baseInd + i, keywordStatus, allowDestructuring);
                Object.assign(res, addRes);

                i = embeddedEnd;
                break;
              }

              if (clValidSymbolSingleCharColonSharpSet.has(varsStr[i])) {
                if (varStart === -1) {
                  varStart = i;
                }
                varName += varsStr[i];
              } else if (/\s/.test(varsStr[i]) || varsStr[i] === ')') {
                if (varName && varStart !== -1 && varName !== '.' && !varName.includes(':')) {
                  //console.log(`b|${varName}: ${baseInd + varStart} -> ${baseInd + varStart + varName.length}`);
                  res[varName] = [baseInd + varStart, baseInd + varStart + varName.length];

                  // supplied-p-parameter
                  if (keywordStatus === '&optional' || keywordStatus === '&key') {
                    let internalInd = i;
                    while (internalInd < newInd && /\s/.test(varsStr[internalInd])) {
                      ++internalInd;
                    }
                    if (varsStr[internalInd] === '(') {
                      const initFormEnd = findMatchPairParenthese(internalInd + 1, varsStr);
                      if (initFormEnd === -1) {
                        return res;
                      }
                      internalInd = initFormEnd;
                    }
                    while (internalInd < newInd && !/\s/.test(varsStr[internalInd])) {
                      ++internalInd;
                    }
                    while (internalInd < newInd && /\s/.test(varsStr[internalInd])) {
                      ++internalInd;
                    }

                    let pParam = '';
                    let pParamStart = -1;
                    while (internalInd < newInd && clValidSymbolSingleCharColonSharpSet.has(varsStr[internalInd]) && varsStr[internalInd] !== ')') {
                      if (!pParam) {
                        pParamStart = internalInd;
                      }
                      pParam += varsStr[internalInd];
                      ++internalInd;
                    }
                    if (pParam && pParamStart !== -1) {
                      //console.log(`h|${pParam}: ${baseInd + pParamStart} -> ${baseInd + pParamStart + pParam.length}`);
                      res[pParam] = [baseInd + pParamStart, baseInd + pParamStart + pParam.length];
                    }
                  }

                  break;
                }

                varName = '';
                varStart = -1;

              } else { }

              ++i;
            }
            // single var
          } else {
            const embeddedStr = varsStr.substring(i, newInd);
            //console.log(`Rec...ing|${keywordStatus}`)
            const addRes = processRecList(embeddedStr, baseInd + i, keywordStatus, allowDestructuring);
            Object.assign(res, addRes);
          }
        }
      }

      i = newInd;

      // cannot find match anymore
    } else if (/\s/.test(varsStr[i]) || varsStr[i] === ')') {
      // just no dup reset
      if (currName && currStart !== -1 && currName !== '.' && !currName.includes(':')) {
        if (currName.startsWith('&')) {
          keywordStatus = currName;
        } else {
          //console.log(`a|${currName}: ${baseInd + currStart} -> ${baseInd + currStart + currName.length}`);
          res[currName] = [baseInd + currStart, baseInd + currStart + currName.length];
        }
      }

      currStart = -1;
      currName = '';
      ++i;

    } else {

      ++i;

    }
  }
  // console.log(res);
  return res;
}

function processList(varsStr: string, baseInd: number):
  Record<string, [number, number]> {
  const res: Record<string, [number, number]> = {};

  let currName = '';
  let currStart = -1;
  let i = 1;

  while (i < varsStr.length) {
    //console.log(`${i}: ${varsStr[i]}|${currName}|${currStart}`);

    if (varsStr[i] === '#') {
      //skip reader macro #+ & #-
      if (i + 1 < varsStr.length && (varsStr[i + 1] === '+' || varsStr[i + 1] === '-')) {
        if (i + 2 < varsStr.length) {
          if (varsStr[i + 2] === '(' && i + 3 < varsStr.length) {
            const newInd = findMatchPairParenthese(i + 3, varsStr);
            if (newInd === -1) {
              return res;
            }

            i = newInd;
            continue;
          } else {
            while (i < varsStr.length && !/\s/.test(varsStr[i]) && varsStr[i] !== ')') {
              ++i;
            }
            continue;
          }

        } else {
          return res;
        }
      }

    } else if (clValidSymbolSingleCharColonSharpSet.has(varsStr[i])) {
      // `var`
      if (currStart === -1) {
        currStart = i;
      }

      currName += varsStr[i];
      ++i;

    } else if (varsStr[i] === '(') {
      if (i + 1 === varsStr.length) {
        return res;
      }

      // `( var`
      const newInd = findMatchPairParenthese(i + 1, varsStr);
      if (newInd === -1) {
        return res;
      }
      if (varsStr[i - 1] === '`' || varsStr[i - 1] === '\'') {
        i = newInd;
        continue;
      }

      let varName = '';
      let varStart = -1;

      // skip current `(`
      ++i;
      while (i < newInd) {
        if (clValidSymbolSingleCharColonSharpSet.has(varsStr[i])) {
          if (varStart === -1) {
            varStart = i;
          }
          varName += varsStr[i];
        } else if (/\s/.test(varsStr[i]) || varsStr[i] === ')') {
          if (varName && varStart !== -1 && varName !== '.') {
            //console.log(`d|${varName}: ${baseInd + varStart} -> ${baseInd + varStart + varName.length}`);
            res[varName] = [baseInd + varStart, baseInd + varStart + varName.length];
            break;
          }
          varName = '';
          varStart = -1;

        } else { }

        ++i;
      }

      i = newInd;

      // cannot find match anymore
    } else if (/\s/.test(varsStr[i]) || varsStr[i] === ')') {
      // just no dup reset
      if (currName && currStart !== -1 && currName !== '.') {
        if (!currName.startsWith('&')) {
          //console.log(`c|${currName}: ${baseInd + currStart} -> ${baseInd + currStart + currName.length}`);
          res[currName] = [baseInd + currStart, baseInd + currStart + currName.length];
        }
      }

      currStart = -1;
      currName = '';
      ++i;

    } else {

      ++i;

    }
  }

  return res;
}

// `varStr` must start from and contain first '('
// `leftPOffset` is the absolute index of whole text when i == 0 [ind at '(']
function processVars(leftPOffset: number, currTextStartOffset: number, currText: string, isLambdaList: boolean, allowDestructuring: boolean): [Record<string, [number, number]>, number] | undefined {
  //const res: Record<string, [number, number]> = {};

  const varsStrStart = leftPOffset - currTextStartOffset;
  const varsStrEnd: number = findMatchPairParenthese(varsStrStart + 1, currText);
  if (varsStrEnd === -1) {
    return undefined;
  }
  const varsStr = currText.substring(varsStrStart, varsStrEnd);

  if (isLambdaList) {
    return [processRecList(varsStr, leftPOffset, '', allowDestructuring), currTextStartOffset + varsStrEnd];
  } else {
    return [processList(varsStr, leftPOffset), currTextStartOffset + varsStrEnd];
  }

}

export { processVars };
