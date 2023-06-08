import { excludeRangesFromRanges, mergeSortedIntervals, mergeSortedMXArr } from '../common/algorithm';
import { ExcludeRanges, SingleQuoteAndBackQuoteHighlight } from '../common/enum';

class ScanDocRes {
  public readonly commentRange: [number, number][] = [];
  public readonly stringRange: [number, number][] = [];
  public readonly quotedRange: [number, number][] = [];
  public readonly quotedPairRange: [number, number][] = [];
  public readonly backquoteRange: [number, number][] = [];
  public readonly backquotePairRange: [number, number][] = [];
  public readonly commaRange: [number, number][] = [];
  public readonly commaPairRange: [number, number][] = [];

  // cache for later use
  private _commentAndStringRange: [number, number][] | undefined = undefined;

  constructor() {

  }

  get commentAndStringRange() {
    if (this._commentAndStringRange === undefined) {
      this._commentAndStringRange = mergeSortedMXArr(this.commentRange, this.stringRange);
    }
    return this._commentAndStringRange;
  }

  private getExcludedRanges(excludedRangesCfg: ExcludeRanges): [number, number][] {
    switch (excludedRangesCfg) {
      case ExcludeRanges.CommentString:
        return this.commentAndStringRange;
      case ExcludeRanges.Comment:
        return this.commentRange;
      case ExcludeRanges.String:
        return this.stringRange;
      case ExcludeRanges.None:
        return [];
      default:
        return [];
    }
  }

  public getExcludedRangesWithSQAndBQ(buildingConfig: Record<string, any>): [number, number][] {
    const excludedRangesCfg = buildingConfig['commonLisp.DocumentSemanticTokensProvider.ExcludedRanges'];
    const SQAndBQHighlightCfg = buildingConfig['commonLisp.DocumentSemanticTokensProvider.SingleQuoteAndBackQuote.Highlight'];
    let excludedRanges: [number, number][] = this.getExcludedRanges(excludedRangesCfg);

    switch (SQAndBQHighlightCfg) {
      case SingleQuoteAndBackQuoteHighlight.SQ:
        excludedRanges = mergeSortedIntervals([
          ...excludedRanges,
          ...this.backquotePairRange,
          ...this.backquoteRange,
        ].sort((a, b) => a[0] - b[0])
        );
        break;

      case SingleQuoteAndBackQuoteHighlight.SQAndBQC: {
        const backquotePairAndSymbol = mergeSortedIntervals(
          [...this.backquotePairRange, ...this.backquoteRange].sort((a, b) => a[0] - b[0]));
        const commaPairAndSymbol = mergeSortedIntervals(
          [...this.commaPairRange, ...this.commaRange].sort((a, b) => a[0] - b[0]));
        const excludedComma = excludeRangesFromRanges(backquotePairAndSymbol, commaPairAndSymbol);

        excludedRanges = mergeSortedIntervals(
          [...excludedRanges, ...excludedComma].sort((a, b) => a[0] - b[0]));
        break;
      }
      case SingleQuoteAndBackQuoteHighlight.SQAndBQAll:
        // nothing
        break;

      case SingleQuoteAndBackQuoteHighlight.BQC: {
        const backquotePairAndSymbol2 = mergeSortedIntervals(
          [...this.backquotePairRange, ...this.backquoteRange].sort((a, b) => a[0] - b[0]));
        const commaPairAndSymbol2 = mergeSortedIntervals(
          [...this.commaPairRange, ...this.commaRange].sort((a, b) => a[0] - b[0]));
        const excludedComma2 = excludeRangesFromRanges(backquotePairAndSymbol2, commaPairAndSymbol2);

        excludedRanges = mergeSortedIntervals([
          ...excludedRanges,
          ...this.quotedPairRange,
          ...this.quotedRange,
          ...excludedComma2
        ].sort((a, b) => a[0] - b[0]));
        break;
      }
      case SingleQuoteAndBackQuoteHighlight.BQAll:
        excludedRanges = mergeSortedIntervals([
          ...excludedRanges,
          ...this.quotedPairRange,
          ...this.quotedRange,
        ].sort((a, b) => a[0] - b[0])
        );
        break;

      case SingleQuoteAndBackQuoteHighlight.None:
        excludedRanges = mergeSortedIntervals([
          ...excludedRanges,
          ...this.backquotePairRange,
          ...this.backquoteRange,
          ...this.quotedPairRange,
          ...this.quotedRange,
        ].sort((a, b) => a[0] - b[0])
        );
        break;

      default:
        break;
    }

    return excludedRanges;
  }

  public getExcludedRangesWithBackQuote(buildingConfig: Record<string, any>): [number, number][] {
    const excludedRangesCfg = buildingConfig['commonLisp.ReferenceProvider.ExcludedRanges'];
    const backQuoteCfg = buildingConfig['commonLisp.ReferenceProvider.BackQuoteFilter.enabled'];
    let excludedRanges: [number, number][] = this.getExcludedRanges(excludedRangesCfg);

    if (backQuoteCfg) {
      const backquotePairAndSymbol = mergeSortedIntervals(
        [...this.backquotePairRange, ...this.backquoteRange].sort((a, b) => a[0] - b[0]));
      const commaPairAndSymbol = mergeSortedIntervals(
        [...this.commaPairRange, ...this.commaRange].sort((a, b) => a[0] - b[0]));
      const excludedComma = excludeRangesFromRanges(backquotePairAndSymbol, commaPairAndSymbol);

      excludedRanges = mergeSortedIntervals(
        [...excludedRanges, ...excludedComma].sort((a, b) => a[0] - b[0]));
    }

    return excludedRanges;
  }
}

export { ScanDocRes };
