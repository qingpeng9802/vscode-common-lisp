import type * as vscode from 'vscode';

import { bisectRight } from '../../common/algorithm';
import type { DocSymbolInfo } from '../DocSymbolInfo';

class UserSymbolsCompItem {
  public readonly globalCItems: vscode.CompletionItem[] = [];
  public readonly localScopeCItems: [vscode.CompletionItem, [number, number]][] = [];

  constructor(currDocSymbolInfo: DocSymbolInfo) {
    for (const SIs of currDocSymbolInfo.globalDef.values()) {
      if (SIs !== undefined && SIs.length !== 0) {
        this.globalCItems.push(SIs[0].toCompletionItem());
      }
    }

    for (const SIs of currDocSymbolInfo.allLocal.values()) {
      for (const SI of SIs) {
        if (SI.scope === undefined) {
          continue;
        }
        this.localScopeCItems.push([SI.toCompletionItem(), SI.scope]);
      }
    }

    this.localScopeCItems.sort((a, b) => a[1][0] - b[1][0]); // sort by scope start
  }

  public getUserompletionItems(position: number): vscode.CompletionItem[] {
    const res: vscode.CompletionItem[] = this.globalCItems;

    const idx = bisectRight(this.localScopeCItems, position, item => item[1][0]);
    for (let i = idx - 1; i >= 0; --i) {
      const [compItem, numRange] = this.localScopeCItems[i];
      const [start, end] = numRange;
      // contains position
      if (start <= position && position <= end) {
        res.push(compItem);
      }
    }

    return res;
  }

}

export { UserSymbolsCompItem };
