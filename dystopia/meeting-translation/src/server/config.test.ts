import { describe, expect, it } from "vitest";

import { loadConfig } from "./config.js";

describe("loadConfig", () => {
  it("requires the Bedrock model identifier", () => {
    expect(() =>
      loadConfig({
        AWS_REGION: "ap-northeast-1",
        BEDROCK_MODEL_ID: "",
        MEETING_BASE_PATH: "/translate",
      }),
    ).toThrow("BEDROCK_MODEL_ID is required");
  });

  it("requires each mandatory environment value", () => {
    expect(() => loadConfig({ BEDROCK_MODEL_ID: "model", MEETING_BASE_PATH: "/translate" })).toThrow(
      "AWS_REGION is required",
    );
    expect(() => loadConfig({ AWS_REGION: "ap-northeast-1", BEDROCK_MODEL_ID: "model" })).toThrow(
      "MEETING_BASE_PATH is required",
    );
  });

  it("requires the base path to start with a slash", () => {
    expect(() =>
      loadConfig({
        AWS_REGION: "ap-northeast-1",
        BEDROCK_MODEL_ID: "model",
        MEETING_BASE_PATH: "translate",
      }),
    ).toThrow("MEETING_BASE_PATH must start with /");
  });

  it("returns only server configuration and parses the newline glossary", () => {
    expect(
      loadConfig({
        AWS_REGION: "ap-northeast-1",
        BEDROCK_MODEL_ID: "model",
        MEETING_BASE_PATH: "/translate",
        TRANSLATION_GLOSSARY: "Panic Boat\nDystopia\n",
        AWS_ACCESS_KEY_ID: "not-exposed",
        AWS_SECRET_ACCESS_KEY: "not-exposed",
      }),
    ).toEqual({
      awsRegion: "ap-northeast-1",
      bedrockModelId: "model",
      basePath: "/translate",
      glossary: ["Panic Boat", "Dystopia"],
    });
  });
});
