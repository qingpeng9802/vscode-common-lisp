import type * as vscode from 'vscode';

import { DocSymbolInfo } from './DocSymbolInfo';
import { collectLoopVar } from './collect_from_text/loop';
import { scanDoc } from './collect_from_text/no_code';
import { collectGlobalDef, collectLocalDef } from './collect_from_text/non_var';
import { collectKeywordSingleVar, collectKeywordVars } from './collect_from_text/var';

function getDocSymbolInfo(document: vscode.TextDocument, buildingConfig: Map<string, any>) {
  const text = document.getText();
  const scanDocRes = scanDoc(text);
  const excludedRanges = scanDocRes.getExcludedRangesForStaticAnalysis(buildingConfig);
  console.log(scanDocRes);

  const [globalDef, globalNamedLambda] = collectGlobalDef(document, scanDocRes, excludedRanges);
  const [localDef, localNamedLambda] = collectLocalDef(document, scanDocRes, excludedRanges);

  const [localAnonLambda, stepForm] = collectKeywordVars(document, scanDocRes, excludedRanges);
  const localAnonSingle = collectKeywordSingleVar(document, scanDocRes, excludedRanges);
  const [localAnonLoop, loopBlocks] = collectLoopVar(document, scanDocRes, excludedRanges);
  console.log(loopBlocks);
  return new DocSymbolInfo(
    document, scanDocRes,
    globalDef, globalNamedLambda,
    localDef, localNamedLambda,
    localAnonLambda, localAnonSingle, localAnonLoop,
    loopBlocks, stepForm
  );
}

export { getDocSymbolInfo };
