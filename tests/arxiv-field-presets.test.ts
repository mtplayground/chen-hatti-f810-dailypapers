import assert from "node:assert/strict";
import test from "node:test";

import {
  getArxivFieldPreset,
  listArxivFieldPresets,
  resolveArxivFieldKeywords,
} from "../src/services/arxiv-field-presets";

void test("arXiv field presets expose required fields with keyword mappings", () => {
  const presets = listArxivFieldPresets();
  assert.deepEqual(
    presets.map((preset) => preset.id),
    ["llm-agents", "computer-vision", "robotics", "nlp", "systems", "custom"],
  );
  assert.ok(getArxivFieldPreset("LLM/Agents").keywords.includes("AI agents"));
  assert.ok(getArxivFieldPreset("Computer Vision").keywords.includes("object detection"));
  assert.ok(getArxivFieldPreset("Robotics").keywords.includes("motion planning"));
  assert.ok(getArxivFieldPreset("NLP").keywords.includes("machine translation"));
  assert.ok(getArxivFieldPreset("Systems").keywords.includes("database systems"));
});

void test("arXiv field keyword resolver supports presets and custom keywords", () => {
  const preset = resolveArxivFieldKeywords({ field: "llm-agents" });
  assert.ok(preset);
  assert.equal(preset.field.id, "llm-agents");
  assert.equal(preset.source, "preset");
  assert.ok(preset.keywords.includes("retrieval augmented generation"));

  const custom = resolveArxivFieldKeywords({
    field: "custom",
    keywords: [" graph learning ", "graph learning", "causal discovery"],
  });
  assert.ok(custom);
  assert.deepEqual(custom.keywords, ["graph learning", "causal discovery"]);
  assert.equal(custom.source, "custom");

  assert.throws(
    () => resolveArxivFieldKeywords({ field: "custom" }),
    /require at least one keyword/,
  );
});
