import { test } from "node:test";
import assert from "node:assert/strict";
import { stripCommentsAndStrings } from "./csharpSource.ts";

test("strips line comments without truncating code", () => {
  const out = stripCommentsAndStrings('int x = 1; // OrderModel note\nint y = 2;');
  assert.ok(!out.includes("OrderModel"));
  assert.ok(out.includes("int y = 2;"));
});

test("strips block comments", () => {
  const out = stripCommentsAndStrings("/* OrderModel here */ int x = 1;");
  assert.ok(!out.includes("OrderModel"));
  assert.ok(out.includes("int x = 1;"));
});

test("strips string literal contents", () => {
  const out = stripCommentsAndStrings('var s = "OrderModel";');
  assert.ok(!out.includes("OrderModel"));
});

test("a URL containing // inside a string is not mistaken for a line comment", () => {
  const out = stripCommentsAndStrings('Response.Redirect("http://example.com/OrderModel"); int y = 2;');
  assert.ok(!out.includes("OrderModel"));
  assert.ok(out.includes("int y = 2;"), "code after the string on the same line must survive");
});

test("an escaped quote inside a string does not end the string early", () => {
  const out = stripCommentsAndStrings('var s = "say \\"OrderModel\\" now"; int y = 2;');
  assert.ok(!out.includes("OrderModel"));
  assert.ok(out.includes("int y = 2;"));
});

test("a char literal containing a double-quote does not trigger a runaway string scan", () => {
  const out = stripCommentsAndStrings("char q = '\"'; var m = OrderModel;");
  assert.ok(out.includes("OrderModel"), "code after the char literal must survive and not be swallowed as a string");
});
