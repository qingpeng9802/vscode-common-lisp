'use strict';

import { promises as fsPromises } from 'fs';
import * as path from 'path';

import { generateScopes, getRegistery, GrammarScopeName } from './gen_record.mjs';

const syntaxes_root = 'syntaxes/';
const generatedFolder = `${syntaxes_root}fixtures/generated`;
const baselineFolder = `${syntaxes_root}fixtures/baselines`;
const casesFolder = `${syntaxes_root}fixtures/cases`;

/**
 * @param {string} file
 * @return {Promise<boolean>}
 */
async function checkFileExists(file) {
  try {
    await fsPromises.access(file, fsPromises.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * @return {Promise<void>}
 */
async function ensureCleanGeneratedFolder() {
  if (await checkFileExists(generatedFolder)) {
    for (const f of await fsPromises.readdir(generatedFolder)) {
      await fsPromises.unlink(path.join(generatedFolder, f));
    }
    await fsPromises.rmdir(generatedFolder);
  }
  await fsPromises.mkdir(generatedFolder);
}

/**
 * @param {string} c
 * @param {IGrammar} grammar
 * @return {Promise<[string, string]>}
 */
async function generateAndWrite(c, grammar) {
  const caseText = await fsPromises.readFile(
    path.join(casesFolder, c),
    { encoding: 'utf8' }
  );

  const generatedText = generateScopes(caseText, grammar);
  const caseName = path.parse(c);
  const recordName = `${caseName.name}.record.txt`;
  await fsPromises.writeFile(
    path.join(generatedFolder, recordName),
    generatedText
  ); // write generated text

  return [recordName, generatedText];
}

/**
 * @return {Promise<IGrammar>}
 */
async function getGrammar() {
  const grammar = await (await getRegistery()).loadGrammar(GrammarScopeName.lisp);
  if (grammar === null) {
    throw new TypeError('the loading result of grammar is null, expected vt.IGrammar');
  }
  return grammar;
}

export {
  ensureCleanGeneratedFolder,
  getGrammar,
  checkFileExists,
  generateAndWrite,
  generatedFolder,
  baselineFolder,
  casesFolder
};
