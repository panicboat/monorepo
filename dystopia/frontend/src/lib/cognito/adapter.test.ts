import { afterEach, describe, expect, it } from "vitest";
import { _resetCognitoInstance, cognito, cognitoAdapterKind } from "./adapter";

const originalCognitoAdapter = process.env.COGNITO_ADAPTER;
const ADAPTER_ERROR = 'COGNITO_ADAPTER must be "aws" or "fake"';

describe("cognito", () => {
  afterEach(() => {
    if (originalCognitoAdapter === undefined) {
      delete process.env.COGNITO_ADAPTER;
    } else {
      process.env.COGNITO_ADAPTER = originalCognitoAdapter;
    }
    _resetCognitoInstance();
  });

  it("throws when COGNITO_ADAPTER is unset", () => {
    delete process.env.COGNITO_ADAPTER;

    expect(() => cognito()).toThrow(ADAPTER_ERROR);
  });

  it("throws when COGNITO_ADAPTER is empty", () => {
    process.env.COGNITO_ADAPTER = "";

    expect(() => cognito()).toThrow(ADAPTER_ERROR);
  });

  it("throws when COGNITO_ADAPTER is unknown", () => {
    process.env.COGNITO_ADAPTER = "local";

    expect(() => cognito()).toThrow(ADAPTER_ERROR);
  });
});

describe("cognitoAdapterKind", () => {
  afterEach(() => {
    if (originalCognitoAdapter === undefined) {
      delete process.env.COGNITO_ADAPTER;
    } else {
      process.env.COGNITO_ADAPTER = originalCognitoAdapter;
    }
  });

  it("returns aws when COGNITO_ADAPTER is aws", () => {
    process.env.COGNITO_ADAPTER = "aws";

    expect(cognitoAdapterKind()).toBe("aws");
  });

  it("returns fake when COGNITO_ADAPTER is fake", () => {
    process.env.COGNITO_ADAPTER = "fake";

    expect(cognitoAdapterKind()).toBe("fake");
  });
});
