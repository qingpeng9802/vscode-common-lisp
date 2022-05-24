'use strict';

import { promises as fsPromises } from 'fs';
import { load } from 'js-yaml';

const inputFilePath = 'syntaxes/commonlisp.yaml'
const outputFilePath = 'syntaxes/commonlisp.tmLanguage.json'

try {
    const file = await fsPromises.readFile(inputFilePath);
    const jsonDoc = load(file, 'utf8');
    await fsPromises.writeFile(outputFilePath, JSON.stringify(jsonDoc, null, 2));
} catch (e) {
    console.log(e);
}
