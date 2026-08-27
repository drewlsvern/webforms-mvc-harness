import { test } from "node:test";
import assert from "node:assert/strict";
import { resolvePresenterId } from "./resolvePresenter.ts";

test("resolves an interface-named reference by stripping the leading I", () => {
  assert.equal(resolvePresenterId("IOrderPresenter", ["OrderPresenter"]), "OrderPresenter");
});

test("resolves an exact match with no I-prefix stripping needed", () => {
  assert.equal(resolvePresenterId("OrderPresenter", ["OrderPresenter"]), "OrderPresenter");
});

test("returns null when nothing matches, rather than guessing", () => {
  assert.equal(resolvePresenterId("ICustomerPresenter", ["OrderPresenter"]), null);
});
