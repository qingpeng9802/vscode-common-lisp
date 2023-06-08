import type * as vscode from 'vscode';

import { mergeSortedIntervals, excludeRangesFromRanges } from '../common/algorithm';
import { SingleQuoteAndBackQuoteExcludedRanges } from '../common/enum';

import { DocSymbolInfo } from './DocSymbolInfo';
import { scanDoc } from './no_code';
import { collectGlobalDef, collectLocalDef } from './non_var';
import { collectKeywordSingleVar, collectKeywordVars } from './var';

function getDocSymbolInfo(document: vscode.TextDocument, buildingConfig: Record<string, any>) {
  const scanDocRes = scanDoc(document);
  const commentAndStringRange = scanDocRes.commentAndStringRange;

  let excludedRanges: [number, number][] = commentAndStringRange;

  const saSQAndBQExcludedRangesCfg = buildingConfig['commonLisp.StaticAnalysis.SingleQuoteAndBackQuote.ExcludedRanges'];
  switch (saSQAndBQExcludedRangesCfg) {
    case SingleQuoteAndBackQuoteExcludedRanges.BQ:
      excludedRanges = mergeSortedIntervals([
        ...commentAndStringRange,
        ...scanDocRes.backquotePairRange,
        ...scanDocRes.backquoteRange,
      ].sort((a, b) => a[0] - b[0])
      );
      break;

    case SingleQuoteAndBackQuoteExcludedRanges.BQButComma: {
      const backquotePairAndSymbol = mergeSortedIntervals(
        [...scanDocRes.backquotePairRange, ...scanDocRes.backquoteRange].sort((a, b) => a[0] - b[0]));
      const commaPairAndSymbol = mergeSortedIntervals(
        [...scanDocRes.commaPairRange, ...scanDocRes.commaRange].sort((a, b) => a[0] - b[0]));
      const excludedComma = excludeRangesFromRanges(backquotePairAndSymbol, commaPairAndSymbol);

      excludedRanges = mergeSortedIntervals(
        [...commentAndStringRange, ...excludedComma].sort((a, b) => a[0] - b[0]));
      break;
    }
    case SingleQuoteAndBackQuoteExcludedRanges.SQ:
      excludedRanges =
        mergeSortedIntervals([
          ...commentAndStringRange,
          ...scanDocRes.quotedPairRange,
          ...scanDocRes.quotedRange
        ].sort((a, b) => a[0] - b[0])
        );
      break;

    case SingleQuoteAndBackQuoteExcludedRanges.SQBQButComma: {
      const backquotePairAndSymbol2 = mergeSortedIntervals(
        [...scanDocRes.backquotePairRange, ...scanDocRes.backquoteRange].sort((a, b) => a[0] - b[0]));
      const commaPairAndSymbol2 = mergeSortedIntervals(
        [...scanDocRes.commaPairRange, ...scanDocRes.commaRange].sort((a, b) => a[0] - b[0]));
      const excludedComma2 = excludeRangesFromRanges(backquotePairAndSymbol2, commaPairAndSymbol2);

      excludedRanges = mergeSortedIntervals([
        ...commentAndStringRange,
        ...scanDocRes.quotedPairRange,
        ...scanDocRes.quotedRange,
        ...excludedComma2
      ].sort((a, b) => a[0] - b[0]));
      break;
    }
    case SingleQuoteAndBackQuoteExcludedRanges.SQAndBQ:
      excludedRanges = mergeSortedIntervals([
        ...commentAndStringRange,
        ...scanDocRes.backquotePairRange,
        ...scanDocRes.backquoteRange,
        ...scanDocRes.quotedPairRange,
        ...scanDocRes.quotedRange,
      ].sort((a, b) => a[0] - b[0])
      );
      break;

    case SingleQuoteAndBackQuoteExcludedRanges.None:
      // nothing
      break;

    default:
      break;
  }

  const [globalDef, globalNamedLambda] = collectGlobalDef(document, excludedRanges);
  const [localDef, localNamedLambda] = collectLocalDef(document, excludedRanges);

  const localAnonLambda = collectKeywordVars(document, excludedRanges);
  const localAnonSingle = collectKeywordSingleVar(document, excludedRanges);

  return new DocSymbolInfo(
    document, scanDocRes,
    globalDef, globalNamedLambda,
    localDef, localNamedLambda,
    localAnonLambda, localAnonSingle);
}

export { getDocSymbolInfo };
