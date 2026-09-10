import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

// React reconciles conditional siblings in the same key namespace.
// Inspect the real JSX, including conditionally displayed source details.
test("study screen siblings do not reuse keys when the answer is revealed", () => {
  const source = ts.createSourceFile("page.tsx", readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let checked = false;
  function visit(node) {
    if (ts.isJsxElement(node) && node.openingElement.attributes.properties.some((prop) => ts.isJsxAttribute(prop) && prop.name.getText(source) === "className" && prop.initializer?.getText(source) === '"page study-page"')) {
      const keys = [];
      function collect(child) {
        if (ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child)) {
          const opening = ts.isJsxElement(child) ? child.openingElement : child;
          const key = opening.attributes.properties.find((prop) => ts.isJsxAttribute(prop) && prop.name.getText(source) === "key");
          if (key) keys.push(key.initializer.getText(source));
          return; // Nested children have their own key namespace.
        }
        ts.forEachChild(child, collect);
      }
      node.children.forEach(collect);
      assert.ok(keys.length >= 2, "checks both the flashcard and conditional source details");
      assert.equal(new Set(keys).size, keys.length, `Duplicate sibling keys: ${keys.join(", ")}`);
      checked = true;
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(checked, "found the study screen");
});
