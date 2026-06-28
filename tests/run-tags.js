// tests/run-tags.js — Helper: prints JSON from tags.js functions.
// Called with env vars that control config paths.
// Args: functionName [arg]
import { getUserTag, getProjectTag, getTags } from "../src/tags.js";

const fn = process.argv[2];
const arg = process.argv[3] || process.cwd();

let result;
switch (fn) {
  case "getUserTag":
    result = { tag: getUserTag() };
    break;
  case "getProjectTag":
    result = { tag: getProjectTag(arg) };
    break;
  case "getTags":
    result = getTags(arg);
    break;
  case "multi":
    // For deterministic/diff tests
    result = {
      a: getProjectTag(arg),
      b: getProjectTag(process.argv[4] || arg),
      same: getProjectTag(arg) === getProjectTag(process.argv[4] || arg),
      diff: getProjectTag(arg) !== getProjectTag(process.argv[4] || arg),
    };
    break;
  default:
    result = { error: `Unknown function: ${fn}` };
}

console.log(JSON.stringify(result));
