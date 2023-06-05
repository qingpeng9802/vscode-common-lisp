// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import type * as vscode from 'vscode';

import { init, workspaceConfig } from './entry/init';
import { structuredInfo } from './provider_interface/structured_info';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  init(context.subscriptions, workspaceConfig, structuredInfo);
}

// this method is called when your extension is deactivated
export function deactivate() { }
