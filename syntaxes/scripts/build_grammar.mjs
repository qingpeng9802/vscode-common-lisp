'use strict';

import { promises as fsPromises } from 'fs';

import { load } from 'js-yaml';

const syntaxes_root = 'syntaxes/';
const INPUT_GRAM_PATH = `${syntaxes_root}commonlisp.yaml`;
const OUTPUT_GRAM_PATH = `${syntaxes_root}commonlisp.tmLanguage.json`;
const INPUT_INJMD_GRAM_PATH = `${syntaxes_root}cl_codeblock.yaml`;
const OUTPUT_INJMD_GRAM_PATH = `${syntaxes_root}cl_codeblock.tmLanguage.json`;

/**
 * @param {string} inputFilePath
 * @param {string} outputFilePath
 * @return {Promise<void>}
 */
async function buildGrammar(inputFilePath, outputFilePath) {
  const inputFile = await fsPromises.readFile(inputFilePath, { encoding: 'utf8' });
  const jsonDoc = load(inputFile);
  await fsPromises.writeFile(outputFilePath, JSON.stringify(jsonDoc, null, 2));
}

await buildGrammar(INPUT_GRAM_PATH, OUTPUT_GRAM_PATH);
await buildGrammar(INPUT_INJMD_GRAM_PATH, OUTPUT_INJMD_GRAM_PATH);

export { buildGrammar };
