import type * as vscode from 'vscode';

import { DocSymbolInfo } from './DocSymbolInfo';
import { scanDoc } from './no_code';
import { collectGlobalDef, collectLocalDef } from './non_var';
import { collectKeywordSingleVar, collectKeywordVars } from './var';

function getDocSymbolInfo(document: vscode.TextDocument, buildingConfig: Record<string, any>) {
  const text = document.getText();
  const scanDocRes = scanDoc(text);
  const excludedRanges = scanDocRes.getExcludedRangesForStaticAnalysis(buildingConfig);

  const [globalDef, globalNamedLambda] = collectGlobalDef(document, text, excludedRanges);
  const [localDef, localNamedLambda] = collectLocalDef(document, text, excludedRanges);

  const localAnonLambda = collectKeywordVars(document, text, excludedRanges);
  const localAnonSingle = collectKeywordSingleVar(document, text, excludedRanges);

  return new DocSymbolInfo(
    document, scanDocRes,
    globalDef, globalNamedLambda,
    localDef, localNamedLambda,
    localAnonLambda, localAnonSingle);
}

export { getDocSymbolInfo };
