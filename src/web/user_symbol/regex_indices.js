
// workaround https://github.com/microsoft/TypeScript/issues/44227
function matchAllWithIndices(text, regex) {
  return text.matchAll(regex);
}

export { matchAllWithIndices };
