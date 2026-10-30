// Stub out "server-only" so modules that import it can run in node:test
const Module = require("node:module");
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request === "server-only") {
    return require.resolve("./noop.cjs");
  }
  return origResolve.call(this, request, parent, isMain, options);
};
