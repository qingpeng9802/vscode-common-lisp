'use strict';

import { promises as fsPromises } from 'fs';
import { load } from 'js-yaml';

const INPUT_GRAM_PATH = 'syntaxes/commonlisp.yaml';
const OUTPUT_GRAM_PATH = 'syntaxes/commonlisp.tmLanguage.json';
const INPUT_INJMD_GRAM_PATH = 'syntaxes/cl_codeblock.yaml';
const OUTPUT_INJMD_GRAM_PATH = 'syntaxes/cl_codeblock.tmLanguage.json';

async function buildGrammar(inputFilePath, outputFilePath) {
  try {
    const inputFile = await fsPromises.readFile(inputFilePath);
    const jsonDoc = load(inputFile, 'utf8');
    await fsPromises.writeFile(outputFilePath, JSON.stringify(jsonDoc, null, 2));
  } catch (e) {
    console.warn(e);
  }
}

await buildGrammar(INPUT_GRAM_PATH, OUTPUT_GRAM_PATH);
await buildGrammar(INPUT_INJMD_GRAM_PATH, OUTPUT_INJMD_GRAM_PATH);

export { buildGrammar };
