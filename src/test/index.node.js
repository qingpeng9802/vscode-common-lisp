"use strict";

async function run() {
  const path = await import("path");
  const vitestNode = await import("vitest/node");

  //console.log(process.cwd());
  //console.log(__dirname);
  const projRoot = path.resolve(__dirname, '../..');

  const vitest = await vitestNode.startVitest(
    'test',
    [],
    {
      "root": projRoot,
      "dir": __dirname
    }
  );

  await vitest?.close();
}

exports.run = run;
