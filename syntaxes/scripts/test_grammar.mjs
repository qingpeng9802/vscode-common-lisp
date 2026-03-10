'use strict';

import { promises as fsPromises } from 'fs';
import assert from 'node:assert';
import { describe, it } from 'node:test';
import * as path from 'path';

import {
  ensureCleanGeneratedFolder,
  getGrammar,
  checkFileExists,
  generateAndWrite,
  baselineFolder,
  casesFolder
} from './test_util.mjs';

/**
 * @param {string} recordName
 * @param {string} generatedText
 * @return {Promise<void>}
 */
async function assertMatchBaseline(recordName, generatedText) {
  const baselineFile = path.join(baselineFolder, recordName);

  if (await checkFileExists(baselineFile)) {
    const baselineText = await fsPromises.readFile(baselineFile, { encoding: 'utf8' });

    assert.strictEqual(generatedText, baselineText, `Expected [${recordName}]'s baseline to match.`);
  } else {
    assert(false, 'Baseline not found.');
  }
}

/**
 * @param {string[]} cases
 * @param {import('vscode-textmate').IGrammar} grammar
 * @return {void}
 */
function testIfMatchOn(cases, grammar) {
  describe(`generating and comparing records`, { concurrency: cases.length },
    () => {
      for (const c of cases) {
        it(`[${c}] record matching`, async () => {
          const [recordName, generatedText] = await generateAndWrite(c, grammar);
          await assertMatchBaseline(recordName, generatedText);
        });
      }
    }
  );
}

/**
 * @param {string[]} cases
 * @return {Promise<void>}
 */
async function generateRecordsFor(cases = []) {
  const allCases = await fsPromises.readdir(casesFolder);
  /** @type {string[]} */
  let needCases = [];

  if (cases.length !== 0) {
    const allCasesSet = new Set(allCases);
    // {name: fullNameBase}
    /** @type {Map<string, string>} */
    const allCaseNamesMap = new Map();
    allCases.forEach(c => {
      allCaseNamesMap.set(path.parse(c).name, c);
    });

    for (const c of cases) {
      if (allCasesSet.has(c)) {
        needCases.push(c);
      } else if (allCaseNamesMap.has(c)) {
        needCases.push(/**@type {string} */(allCaseNamesMap.get(c)));
      }
    }
  } else {
    needCases = allCases;
  }

  await ensureCleanGeneratedFolder();
  testIfMatchOn(needCases, await getGrammar());
}

await generateRecordsFor(process.argv.slice(2));

export { generateRecordsFor };
