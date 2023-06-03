enum ExcludeRanges {
  CommentString = "comment and string",
  Comment = "comment",
  String = "string",
  None = "none"
}

enum SingleQuoteAndBackQuoteHighlight {
  SQ = "single quote",
  SQAndBQC = "single quote and backquote's comma only",
  SQAndBQAll = "single quote and backquote's all",
  BQC = "backquote's comma only",
  BQAll = "backquote's all",
  None = "none"
}

enum SingleQuoteAndBackQuoteExcludedRanges {
  SQ = "single quote",
  SQBQButComma = "single quote and backquote, but comma is saved",
  SQAndBQ = "single quote and backquote's all",
  BQButComma = "backquote, but comma is saved",
  BQ = "backquote's all",
  None = "none"
}

export { ExcludeRanges, SingleQuoteAndBackQuoteHighlight, SingleQuoteAndBackQuoteExcludedRanges };
