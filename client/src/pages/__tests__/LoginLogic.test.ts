import assert from "node:assert/strict";
import { test } from "node:test";
import { shouldFocusSignup, shouldOpenSignupOnAuthError } from "@/pages/loginHelpers";

test("shouldOpenSignupOnAuthError returns true when account is missing", () => {
  assert.equal(shouldOpenSignupOnAuthError("account_not_found"), true);
  assert.equal(shouldOpenSignupOnAuthError("missing_password"), false);
  assert.equal(shouldOpenSignupOnAuthError(undefined), false);
});

test("shouldFocusSignup returns true when signup is visible", () => {
  assert.equal(shouldFocusSignup(true), true);
  assert.equal(shouldFocusSignup(false), false);
});
