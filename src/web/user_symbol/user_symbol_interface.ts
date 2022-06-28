import * as vscode from 'vscode';

import { scanDoc } from './no_code';
import { collectGlobalDef, collectLocalDef } from './non_var';
import { collectKeywordSingleVar, collectKeywordVars } from './var';
import { DocSymbolInfo } from './DocSymbolInfo';
import { mergeSortedMXArr, mergeSortedIntervals, excludeRangesFromRanges } from '../algorithm';
import { SingleQuoteAndBackQuoteExcludedRanges } from '../entry/WorkspaceConfig';

import { workspaceConfig } from '../entry/init';

function getDocSymbolInfo(document: vscode.TextDocument) {

  const docRes = scanDoc(document);
  const commentRange = docRes.commentRange;
  const stringRange = docRes.stringRange;

  const commentAndStringRange = mergeSortedMXArr(commentRange, stringRange);

  let excludedRanges: [number, number][] = commentAndStringRange;

  switch (workspaceConfig.config['commonLisp.StaticAnalysis.SingleQuoteAndBackQuote.ExcludedRanges']) {
    case SingleQuoteAndBackQuoteExcludedRanges.BQ:
      excludedRanges = mergeSortedIntervals([
        ...commentAndStringRange,
        ...docRes.backquotePairRange,
        ...docRes.backquoteRange,
      ].sort((a, b) => a[0] - b[0])
      );

      break;

    case SingleQuoteAndBackQuoteExcludedRanges.BQButComma:
      const backquotePairAndSymbol = mergeSortedIntervals(
        [...docRes.backquotePairRange, ...docRes.backquoteRange].sort((a, b) => a[0] - b[0]));
      const commaPairAndSymbol = mergeSortedIntervals(
        [...docRes.commaPairRange, ...docRes.commaRange].sort((a, b) => a[0] - b[0]));
      const excludedComma = excludeRangesFromRanges(backquotePairAndSymbol, commaPairAndSymbol);

      excludedRanges = mergeSortedIntervals(
        [...commentAndStringRange, ...excludedComma].sort((a, b) => a[0] - b[0]));

      break;

    case SingleQuoteAndBackQuoteExcludedRanges.SQ:
      excludedRanges =
        mergeSortedIntervals([
          ...commentAndStringRange,
          ...docRes.quotedPairRange,
          ...docRes.quotedRange
        ].sort((a, b) => a[0] - b[0])
        );

      break;

    case SingleQuoteAndBackQuoteExcludedRanges.SQBQButComma:
      const backquotePairAndSymbol2 = mergeSortedIntervals(
        [...docRes.backquotePairRange, ...docRes.backquoteRange].sort((a, b) => a[0] - b[0]));
      const commaPairAndSymbol2 = mergeSortedIntervals(
        [...docRes.commaPairRange, ...docRes.commaRange].sort((a, b) => a[0] - b[0]));
      const excludedComma2 = excludeRangesFromRanges(backquotePairAndSymbol2, commaPairAndSymbol2);

      excludedRanges = mergeSortedIntervals([
        ...commentAndStringRange,
        ...docRes.quotedPairRange,
        ...docRes.quotedRange,
        ...excludedComma2
      ].sort((a, b) => a[0] - b[0]));
      break;

    case SingleQuoteAndBackQuoteExcludedRanges.SQAndBQ:
      excludedRanges = mergeSortedIntervals([
        ...commentAndStringRange,
        ...docRes.backquotePairRange,
        ...docRes.backquoteRange,
        ...docRes.quotedPairRange,
        ...docRes.quotedRange,
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


  return new DocSymbolInfo(document, docRes, commentRange, stringRange, commentAndStringRange, globalDef, globalNamedLambda, localDef, localNamedLambda, localAnonLambda, localAnonSingle);
}

export { getDocSymbolInfo };
