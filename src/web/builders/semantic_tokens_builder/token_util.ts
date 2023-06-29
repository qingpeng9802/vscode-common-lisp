import * as vscode from 'vscode';

const tokenTypes = new Map<string, number>();
const tokenModifiers = new Map<string, number>();

const legend = getLegend();

function getLegend() {
  const tokenTypesLegend: string[] = [
    'namespace',
    'class',
    'enum',
    'interface',
    'struct',
    'typeParameter',
    'type',
    'parameter',
    'variable',
    'property',
    'enumMember',
    'decorator',
    'event',
    'function',
    'method',
    'macro',
    'label',
    'comment',
    'string',
    'keyword',
    'number',
    'regexp',
    'operator',
    '' // placeholder for unknown
  ];

  const tokenModifiersLegend: string[] = [
    'declaration',
    'definition',
    'readonly',
    'static',
    'deprecated',
    'abstract',
    'async',
    'modification',
    'documentation',
    'defaultLibrary',
  ];

  tokenTypesLegend.forEach((tokenType, index) => tokenTypes.set(tokenType, index));
  tokenModifiersLegend.forEach((tokenModifier, index) => tokenModifiers.set(tokenModifier, index));

  return new vscode.SemanticTokensLegend(tokenTypesLegend, tokenModifiersLegend);
}

const vscodeKindToTokenType: Map<vscode.SymbolKind, string | [string, string[]]> =
  new Map<vscode.SymbolKind, string | [string, string[]]>([
    // no direct mapping
    [vscode.SymbolKind.File, 'variable'],
    // no direct mapping
    [vscode.SymbolKind.Module, 'namespace'],
    [vscode.SymbolKind.Namespace, 'namespace'],
    // no direct mapping
    [vscode.SymbolKind.Package, 'type'],
    [vscode.SymbolKind.Class, 'class'],
    [vscode.SymbolKind.Method, 'method'],
    [vscode.SymbolKind.Property, 'property'],
    [vscode.SymbolKind.Field, ''],
    [vscode.SymbolKind.Constructor, ''],
    [vscode.SymbolKind.Enum, 'enum'],
    [vscode.SymbolKind.Interface, 'interface'],
    [vscode.SymbolKind.Function, 'function'],
    [vscode.SymbolKind.Variable, 'variable'],
    [vscode.SymbolKind.Constant, ['variable', ['readonly']]],

    [vscode.SymbolKind.String, 'string'],
    [vscode.SymbolKind.Number, 'number'],
    // no direct mapping
    [vscode.SymbolKind.Boolean, ''],
    // no direct mapping
    [vscode.SymbolKind.Array, ''],
    // no direct mapping
    [vscode.SymbolKind.Object, ''],
    // no direct mapping
    [vscode.SymbolKind.Key, ''],
    // no direct mapping
    [vscode.SymbolKind.Null, ''],
    [vscode.SymbolKind.EnumMember, 'enumMember'],
    [vscode.SymbolKind.Struct, 'struct'],
    [vscode.SymbolKind.Event, 'event'],
    [vscode.SymbolKind.Operator, 'operator'],
    [vscode.SymbolKind.TypeParameter, 'typeParameter']
  ]);

// https://github.com/microsoft/vscode-extension-samples/blob/main/semantic-tokens-sample/src/extension.ts#L45-L65
function _encodeTokenType(tokenType: string): number {
  if (tokenTypes.has(tokenType)) {
    return tokenTypes.get(tokenType)!;
  } else if (tokenType === 'notInLegend') {
    return tokenTypes.size + 2;
  }
  return 0;
}

function _encodeTokenModifiers(strTokenModifiers: string[]): number {
  let result = 0;
  for (const tokenModifier of strTokenModifiers) {
    if (tokenModifiers.has(tokenModifier)) {
      result = result | (1 << tokenModifiers.get(tokenModifier)!);
    } else if (tokenModifier === 'notInLegend') {
      result = result | (1 << tokenModifiers.size + 2);
    }
  }
  return result;
}

export {
  legend, vscodeKindToTokenType,
  _encodeTokenType, _encodeTokenModifiers
};
