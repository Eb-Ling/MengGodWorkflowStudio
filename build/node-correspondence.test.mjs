import test from "node:test";
import assert from "node:assert/strict";
import { nodeCorrespondence } from "./node-correspondence.mjs";
test("每个内置节点都有实际编译见证，双目标源码映射、控制流和淡出公式正确", () => {
  const report = nodeCorrespondence();
  assert.equal(report.count, 84);
  assert.equal(report.pixels.length, 17);
});
