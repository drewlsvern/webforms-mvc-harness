import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCodeBehind, findModelRefs } from "./parseCodeBehind.ts";

test("a model reference only inside a comment is not recorded", () => {
  const result = parseCodeBehind(`
    public partial class OrderList : System.Web.UI.Page
    {
      // uses OrderModel internally, see presenter
    }
  `);
  assert.deepEqual(result.modelRefs, []);
});

test("a model reference only inside a string literal is not recorded", () => {
  const result = parseCodeBehind(`
    public partial class OrderList : System.Web.UI.Page
    {
      private string note = "OrderModel";
    }
  `);
  assert.deepEqual(result.modelRefs, []);
});

test("a declared field type is found without needing the fallback scan", () => {
  const result = parseCodeBehind(`
    public class OrderPresenter
    {
      private readonly OrderModel _order;
    }
  `);
  assert.deepEqual(result.modelRefs, ["OrderModel"]);
});

test("a generic type argument is found via the declaration-position pattern", () => {
  const result = parseCodeBehind(`
    public class OrderPresenter
    {
      private List<OrderModel> _orders;
    }
  `);
  assert.deepEqual(result.modelRefs, ["OrderModel"]);
});

test("an instantiation is found via the declaration-position pattern", () => {
  const result = parseCodeBehind(`
    public class OrderPresenter
    {
      void Load() { var order = new OrderModel(); }
    }
  `);
  assert.deepEqual(result.modelRefs, ["OrderModel"]);
});

test("a usage with no declaration position still matches via the fallback scan (no regression)", () => {
  const result = parseCodeBehind(`
    public class OrderPresenter
    {
      object Load(object value) { return (OrderModel)value; }
    }
  `);
  assert.deepEqual(result.modelRefs, ["OrderModel"]);
});

test("findModelRefs is exported for scanning presenter files directly", () => {
  const refs = findModelRefs(`
    public class OrderPresenter
    {
      private readonly OrderModel _order;
      private readonly CustomerViewModel _customer; // used for the summary panel
      private string sql = "SELECT * FROM OrderModel WHERE Id = @id";
    }
  `);
  assert.deepEqual([...refs].sort(), ["CustomerViewModel", "OrderModel"]);
});
