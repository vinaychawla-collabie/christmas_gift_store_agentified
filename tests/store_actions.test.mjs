// The rest of "Test every action" in the agentify-website skill's references/site_actions.md:
// each action's rules and boundaries, prices worked out by hand, dates, focus, old
// messages, page forms and privacy. Runs in its own process, so it has its own page.
// Run: node --test "<site>/tests/*.test.mjs"
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { ActionRegistry } from "../runtime/actions.js";
import { AgentNetwork } from "../runtime/kernel.js";
import { buildToolTable, dispatchToolCall, runAgent } from "../runtime/runner.js";
import { TraceBus } from "../runtime/trace.js";
import { StubDocument } from "./stub_document.mjs";
import { StubElement } from "./stub_element.mjs";
import { StubOption } from "./stub_option.mjs";
import { ScriptedModel } from "./scripted_model.mjs";

const NETWORK_NAME = "north_pole_gift_co";
const BASE = "http://localhost:8080";

globalThis.document = StubDocument.fromHtml(await readFile(new URL("../index.html", import.meta.url), "utf8"), `${BASE}/`);
globalThis.Option = StubOption;
const { App } = await import("../script.js");
const { registerActions } = await import("../site-actions.js");
const { AssistantMount } = await import("../site.js");

/** Pin today's date (UTC) with the page's own hook and redraw the page. */
function setToday(month, day, year = 2026) {
  App.clock = () => new Date(Date.UTC(year, month - 1, day, 15, 0, 0));
  App.page.render();
}
setToday(12, 10);

const config = JSON.parse(await readFile(new URL(`../${NETWORK_NAME}.network.json`, import.meta.url), "utf8"));
const manifest = JSON.parse(await readFile(new URL("../agent-manifest.json", import.meta.url), "utf8"));
const network = new AgentNetwork(config, NETWORK_NAME);
const scope = {base: BASE, network: NETWORK_NAME};
const registry = new ActionRegistry();
await registerActions({register: registry.register.bind(registry, scope)});
const ctx = {
  network: network, manifest: manifest, actions: registry, baseOrigin: BASE, displayOrigin: new URL(BASE).host,
  trace: new TraceBus(), isTop: true, frontMan: network.findFrontMan(), history: [], llm: new ScriptedModel([]),
  confirmWebsiteActions: async () => true,
};
const table = await buildToolTable(ctx, network.getAgentSpec(network.findFrontMan()), [], null);
const $ = (id) => document.getElementById(id);

/** Call a website tool as the model would, with approval, and return its result. */
async function call(name, args) {
  const receipt = await dispatchToolCall(ctx, table.toolByName.get(`website_${name}`), args, null, []);
  assert.equal(receipt.status, "succeeded", JSON.stringify(receipt));
  return receipt.result;
}

/** Read the state through the read tool. */
function state() {
  return call("get_store_state", {});
}

/** Empty the cart and coupon through the page, then fill it through the tools. */
async function cartWith(lines, coupon) {
  const current = (await state()).cart.lines.map((l) => ({id: l.id, quantity: 0}));
  if (current.length) {
    assert.equal(App.page.setCartQuantities(current).ok, true);
  }
  if (App.page.coupon) {
    App.page.setCoupon("");
  }
  if (lines.length) {
    assert.equal((await call("set_cart_quantities", {lines: lines})).ok, true);
  }
  if (coupon) {
    assert.equal((await call("set_coupon", {code: coupon})).ok, true);
  }
  return state();
}

/** Valid order details for the current cart. */
async function details(overrides = {}) {
  return {
    name: "Ann Lee", email: "ann@example.com", shippingMethod: "standard",
    address: "1 Main St, Erie, PA 16501", giftMessage: "", expectedVersion: (await state()).cart.version, ...overrides,
  };
}

/** Forget focus, then list what got it. */
function clearFocus() {
  for (const element of document.elements.values()) {
    element.focused = false;
  }
}
function focusedIds() {
  return [...document.elements].filter(([, e]) => e.focused).map(([id]) => id);
}

/** Expect a refusal that changes neither the state nor the page. */
async function expectRefusal(name, args, reason) {
  const before = await state();
  const page = document.snapshot();
  const result = await call(name, args);
  assert.equal(result.ok, false);
  assert.equal(result.reason, reason);
  assert.deepEqual(await state(), before);
  // The page may show the refusal only where the page's own controls would; tool
  // refusals change nothing at all.
  assert.deepEqual(document.snapshot(), page);
}

test("the read changes nothing and gives dates and amounts the model can use", async () => {
  const page = document.snapshot();
  const s = await state();
  assert.deepEqual(document.snapshot(), page);
  assert.deepEqual(s.today, {iso: "2026-12-10", label: "Thu, Dec 10, 2026"});
  assert.equal(s.catalog.length, 12);
  assert.deepEqual(s.catalog.find((p) => p.id === "P008"), {
    id: "P008", name: "LED Light-Up Train Set", category: "Toys", price: "$79.99", forWhom: ["kids", "family"], minAge: 5,
    inStock: true, description: "Battery-powered train with 12 track pieces that circles the tree. Batteries not included."});
  assert.equal(s.catalog.find((p) => p.id === "P011").inStock, false);
  assert.deepEqual(s.delivery.map((d) => [d.id, d.cost, d.orderBy.iso, d.orderBy.label, d.arrivesByChristmas]), [
    ["standard", "$5.99", "2026-12-16", "Wed, Dec 16, 2026", true],
    ["express", "$14.99", "2026-12-21", "Mon, Dec 21, 2026", true],
    ["pickup", "$0.00", "2026-12-24", "Thu, Dec 24, 2026", true],
  ]);
  // Every policy row the page shows is in the read, with the help email for returns.
  assert.equal(s.policies.length, 7);
  assert.ok(s.policies.find((p) => p.topic === "Returns").text.includes("help@northpolegift.example"));
  assert.equal($("policy-list").children.length, 14);
  assert.equal($("today-label").textContent, "Thu, Dec 10, 2026");
});

test("Christmas delivery dates on each side of every cutoff, and after Christmas", async () => {
  const cases = [
    [[12, 16], "standard", true, "Wed, Dec 16, 2026"],
    [[12, 17], "standard", false, "Wed, Dec 16, 2026"],
    [[12, 21], "express", true, "Mon, Dec 21, 2026"],
    [[12, 22], "express", false, "Mon, Dec 21, 2026"],
    [[12, 24], "pickup", true, "Thu, Dec 24, 2026"],
    [[12, 25], "pickup", false, "Thu, Dec 24, 2026"],
    // After December 25 the next Christmas counts.
    [[12, 26], "standard", true, "Thu, Dec 16, 2027"],
    [[1, 5, 2027], "express", true, "Tue, Dec 21, 2027"],
  ];
  for (const [[m, d, y], method, arrives, label] of cases) {
    setToday(m, d, y);
    const entry = (await state()).delivery.find((x) => x.id === method);
    assert.equal(entry.arrivesByChristmas, arrives, `${method} on ${m}/${d}`);
    assert.equal(entry.orderBy.label, label);
  }
  // The page's table follows the same clock.
  setToday(12, 17);
  const standardRow = $("ship-table").children[0];
  assert.equal(standardRow.children[4].textContent, "❌ No");
  // A late order is allowed, and the dialog says it will miss Christmas.
  await cartWith([{id: "P005", quantity: 1}]);
  const content = AssistantMount.dialogContent({action: "place_order", origin: BASE, effect: "irreversible", arguments: await details()});
  assert.equal(content.details["By Christmas"], "No: the order-by date was Wed, Dec 16, 2026");
  setToday(12, 10);
});

test("add_to_cart: adds, keeps gift wrap, accepts the limit and refuses past it", async () => {
  await cartWith([]);
  clearFocus();
  let result = await call("add_to_cart", {id: "P004", quantity: 3, giftWrap: true});
  assert.equal(result.ok, true);
  assert.deepEqual(result.cart.lines.map((l) => [l.id, l.quantity, l.giftWrap, l.lineTotal]), [["P004", 3, true, "$59.97"]]);
  // A later add without giftWrap keeps the wrap already chosen.
  result = await call("add_to_cart", {id: "P004", quantity: 7});
  assert.deepEqual(result.cart.lines.map((l) => [l.id, l.quantity, l.giftWrap]), [["P004", 10, true]]);
  assert.equal($("cart-count").textContent, "10");
  assert.deepEqual(focusedIds(), []);
  await expectRefusal("add_to_cart", {id: "P004", quantity: 1}, "You can order up to 10 of each gift. The cart already has 10.");
  await expectRefusal("add_to_cart", {id: "P011", quantity: 1}, "Scented Candle Trio is out of stock.");
  // The schema refuses what the model may not send, and nothing runs.
  for (const bad of [{id: "P999", quantity: 1}, {id: "P001", quantity: 0}, {id: "P001", quantity: 11}, {id: "P001", quantity: 1.5}, {id: "P001"}, {id: "P001", quantity: 1, extra: true}]) {
    const before = await state();
    await assert.rejects(dispatchToolCall(ctx, table.toolByName.get("website_add_to_cart"), bad, null, []), /Invalid arguments|Missing arguments|Unexpected arguments/);
    assert.deepEqual(await state(), before);
  }
});

test("set_cart_quantities: sets, removes and checks every line before changing any", async () => {
  await cartWith([{id: "P001", quantity: 1}, {id: "P002", quantity: 1, giftWrap: true}]);
  let result = await call("set_cart_quantities", {lines: [{id: "P002", quantity: 4}, {id: "P001", quantity: 0}, {id: "P009", quantity: 2, giftWrap: true}]});
  assert.equal(result.ok, true);
  // P002 keeps its wrap when giftWrap is left out; P001 is gone; P009 is new.
  assert.deepEqual(result.cart.lines.map((l) => [l.id, l.quantity, l.giftWrap]), [["P002", 4, true], ["P009", 2, true]]);
  result = await call("set_cart_quantities", {lines: [{id: "P002", quantity: 4, giftWrap: false}]});
  assert.deepEqual(result.cart.lines.map((l) => [l.id, l.giftWrap]), [["P002", false], ["P009", true]]);
  // One bad line refuses the whole call, even when it comes after good ones.
  await expectRefusal("set_cart_quantities", {lines: [{id: "P002", quantity: 1}, {id: "P011", quantity: 1}]}, "Scented Candle Trio is out of stock.");
  await expectRefusal("set_cart_quantities", {lines: [{id: "P002", quantity: 1}, {id: "P002", quantity: 2}]}, "P002 is listed twice.");
  // Setting an out-of-stock gift, or one not in the cart, to 0 is allowed and changes nothing in the cart.
  result = await call("set_cart_quantities", {lines: [{id: "P011", quantity: 0}]});
  assert.deepEqual(result.cart.lines.map((l) => l.id), ["P002", "P009"]);
  await assert.rejects(dispatchToolCall(ctx, table.toolByName.get("website_set_cart_quantities"), {lines: []}, null, []), /Invalid arguments/);
});

test("set_coupon: applies, refuses with the site's reason and removes", async () => {
  await cartWith([{id: "P005", quantity: 1}]);
  await expectRefusal("set_coupon", {code: "JINGLE5"}, "JINGLE5 needs a merchandise subtotal of $30.00. The cart has $15.99.");
  await expectRefusal("set_coupon", {code: "FREEGIFTS"}, "FREEGIFTS is not a valid coupon code.");
  await expectRefusal("set_coupon", {code: ""}, "No coupon is applied.");
  let result = await call("set_coupon", {code: "  holly10 "});
  assert.equal(result.cart.coupon, "HOLLY10");
  assert.equal(result.cart.discount, "-$1.59");
  assert.equal($("coupon-remove").hidden, false);
  result = await call("set_coupon", {code: ""});
  assert.equal(result.cart.coupon, "");
  assert.equal($("coupon-remove").hidden, true);
  // A coupon that stops qualifying after a cart change stays saved but is not applied, and
  // the cart says why.
  await cartWith([{id: "P005", quantity: 2}], "JINGLE5");
  result = await call("set_cart_quantities", {lines: [{id: "P005", quantity: 1}]});
  assert.equal(result.cart.discount, "$0.00");
  assert.equal(result.cart.couponNote, "JINGLE5 needs a merchandise subtotal of $30.00, so it is not applied.");
});

test("totals match amounts worked out by hand, on both sides of each pricing rule", async () => {
  const totalOf = async (lines, coupon, method) => {
    await cartWith(lines, coupon);
    const c = App.page.checkOrder(await details({shippingMethod: method, address: method === "pickup" ? "" : "1 Main St, Erie, PA 16501"}));
    assert.equal(c.ok, true, c.reason);
    return [c.subtotal, c.discount, c.giftWrap, c.shipping, c.tax, c.total];
  };
  // $54.99 - $5.00 = $49.99, under $50: standard shipping is charged. Tax 6% of $49.99 = $2.9994 → $3.00.
  assert.deepEqual(await totalOf([{id: "P006", quantity: 1}], "JINGLE5", "standard"), ["$54.99", "-$5.00", "$0.00", "$5.99", "$3.00", "$58.98"]);
  // $55.97 - $5.59 (10%, rounded down) = $50.38: free standard shipping. Tax 6% of $50.38 = $3.0228 → $3.02.
  // The catalog cannot make exactly $50.00 (every price ends in 99), so these are the nearest carts.
  assert.deepEqual(await totalOf([{id: "P004", quantity: 2}, {id: "P005", quantity: 1}], "HOLLY10", "standard"), ["$55.97", "-$5.59", "$0.00", "$0.00", "$3.02", "$53.40"]);
  // Gift wrap is per line and taxed: + $4.99, tax 6% of $55.37 = $3.3222 → $3.32.
  assert.deepEqual(await totalOf([{id: "P004", quantity: 2, giftWrap: true}, {id: "P005", quantity: 1}], "HOLLY10", "standard"), ["$55.97", "-$5.59", "$4.99", "$0.00", "$3.32", "$58.69"]);
  // Tax on exactly half a cent rounds up: 6% of $118.75 = $7.125 → $7.13.
  assert.deepEqual(await totalOf([{id: "P001", quantity: 3}, {id: "P010", quantity: 3}], "HOLLY10", "standard"), ["$131.94", "-$13.19", "$0.00", "$0.00", "$7.13", "$125.88"]);
  // Shipping methods differ, so a swapped argument changes the total.
  assert.deepEqual(await totalOf([{id: "P005", quantity: 1}], "", "express"), ["$15.99", "$0.00", "$0.00", "$14.99", "$0.96", "$31.94"]);
  assert.deepEqual(await totalOf([{id: "P005", quantity: 1}], "", "pickup"), ["$15.99", "$0.00", "$0.00", "$0.00", "$0.96", "$16.95"]);
  // The largest order: 10 of each of the 11 gifts in stock, all wrapped, HOLLY10, express.
  // $3,848.90 - $384.89 + $54.89 = $3,518.90; tax $211.134 → $211.13; + $14.99 = $3,745.02.
  const all = (await state()).catalog.filter((p) => p.inStock).map((p) => ({id: p.id, quantity: 10, giftWrap: true}));
  assert.deepEqual(await totalOf(all, "HOLLY10", "express"), ["$3,848.90", "-$384.89", "$54.89", "$14.99", "$211.13", "$3,745.02"]);
});

test("place_order: empty cart, limits and smallest values, and pickup without an address", async () => {
  await cartWith([]);
  const empty = await details();
  const content = AssistantMount.dialogContent({action: "place_order", origin: BASE, effect: "irreversible", arguments: empty});
  assert.equal(content.refusal, "The cart is empty.");
  assert.deepEqual(App.page.placeOrder(empty), {ok: false, reason: "The cart is empty.", field: "cart"});
  // Every text field at the site's own limit is accepted.
  await cartWith([{id: "P005", quantity: 1}]);
  const longest = await details({name: "N".repeat(80), email: `${"e".repeat(108)}@example.com`, address: "A".repeat(200), giftMessage: "G".repeat(200)});
  assert.equal(longest.email.length, 120);
  let order = (await call("place_order", longest)).order;
  assert.equal(order.name.length, 80);
  assert.equal(order.giftMessage.length, 200);
  // The smallest accepted values.
  await cartWith([{id: "P005", quantity: 1}]);
  order = (await call("place_order", await details({name: "Al", email: "a@b.co", address: "1 Elm St"}))).order;
  assert.deepEqual([order.name, order.email, order.address], ["Al", "a@b.co", "1 Elm St"]);
  // Pickup needs no address and stores none, even when one is given.
  await cartWith([{id: "P005", quantity: 1}]);
  order = (await call("place_order", await details({shippingMethod: "pickup", address: "ignored street 123"}))).order;
  assert.deepEqual([order.delivery, order.address, order.shipping], ["Store pickup", "", "$0.00"]);
  await cartWith([{id: "P005", quantity: 1}]);
  order = (await call("place_order", await details({shippingMethod: "pickup", address: ""}))).order;
  assert.equal(order.total, "$16.95");
});

test("a cart change in the same turn passes the new version to place_order", async () => {
  await cartWith([]);
  const added = await call("add_to_cart", {id: "P003", quantity: 1});
  const result = await call("place_order", await details({expectedVersion: added.cart.version}));
  assert.equal(result.ok, true);
  assert.equal(result.order.lines[0].name, "Ugly Christmas Sweater");
});

test("writes move no focus and clear the page's earlier error message", async () => {
  await cartWith([{id: "P001", quantity: 1}]);
  // The page's own quantity box refuses 11 and shows an error.
  // Row: emoji, body (name, controls: quantity label > input, wrap label, remove), line total.
  const qty = $("cart-lines").children[0].children[1].children[1].children[0].children[0];
  assert.equal(qty.type, "number");
  qty.value = "11";
  qty.dispatch("change");
  assert.equal($("cart-message").textContent, "You can order up to 10 of each gift.");
  assert.equal($("cart-message").className, "error");
  // The coupon form refuses a bad code and shows an error.
  $("coupon-code").value = "BADCODE";
  $("coupon-form").dispatch("submit");
  assert.equal($("coupon-message").textContent, "BADCODE is not a valid coupon code.");
  clearFocus();
  await call("add_to_cart", {id: "P001", quantity: 1});
  assert.equal($("cart-message").textContent, "Added 1 × Wooden Reindeer Pull Toy.");
  assert.equal($("coupon-message").textContent, "");
  assert.deepEqual(focusedIds(), []);
  // A checkout refusal on the page, then an order from the assistant, clears it.
  $("c-name").value = "Ann Lee";
  $("c-email").value = "not-an-email";
  $("checkout-form").dispatch("submit");
  assert.equal($("c-email").validationMessage, "Enter a valid email address.");
  assert.equal($("checkout-message").textContent, "Enter a valid email address.");
  clearFocus();
  const result = await call("place_order", await details());
  assert.equal(result.ok, true);
  assert.equal($("c-email").validationMessage, "");
  assert.match($("checkout-message").textContent, /^🎉 Order NP-/);
  assert.deepEqual(focusedIds(), []);
  // The page's handlers do move focus to the refused field.
  $("c-name").value = "";
  $("c-email").value = "";
  App.page.addItem("P001", 1);
  $("checkout-form").dispatch("submit");
  assert.equal($("c-name").validationMessage, "Enter the full name for the order.");
  assert.deepEqual(focusedIds(), ["c-name"]);
});

test("the page's own forms show the site's message for each refusal", async () => {
  await cartWith([{id: "P005", quantity: 1}]);
  const fill = (values) => {
    for (const [id, value] of Object.entries(values)) {
      $(id).value = value;
    }
    $("checkout-form").dispatch("submit");
  };
  fill({"c-name": "Ann Lee", "c-email": "ann@example.com", "c-ship": "standard", "c-address": "", "c-gift": ""});
  assert.equal($("c-address").validationMessage, "Enter the full shipping address, with city and ZIP code.");
  fill({"c-address": "1 Main St, Erie, PA 16501", "c-gift": "G".repeat(201)});
  assert.equal($("c-gift").validationMessage, "The gift message can be at most 200 characters.");
  // Pickup hides the address field.
  $("c-ship").value = "pickup";
  $("c-ship").dispatch("change");
  assert.equal($("c-address-wrap").hidden, true);
  $("c-ship").value = "standard";
  $("c-ship").dispatch("change");
  assert.equal($("c-address-wrap").hidden, false);
  $("c-gift").value = "";
});

test("no result the model gets holds an earlier customer's personal details", async () => {
  // An earlier customer on this computer orders with an email, an address and a note.
  await cartWith([{id: "P006", quantity: 1}]);
  const secret = {name: "Priya Secretname", email: "priya.private@example.com", address: "77 Hidden Way, Erie, PA 16509", giftMessage: "Call me at 814-555-0199"};
  App.page.placeOrder({...secret, shippingMethod: "standard", expectedVersion: App.page.version});
  // The next visitor's assistant reads the page and works with the cart.
  await cartWith([{id: "P004", quantity: 1}], "HOLLY10");
  const results = [await state(), await call("add_to_cart", {id: "P005", quantity: 1}), await call("set_cart_quantities", {lines: [{id: "P005", quantity: 2}]}),
    await call("set_coupon", {code: ""}), await call("set_coupon", {code: "nope"})];
  results.push(AssistantMount.dialogContent({action: "place_order", origin: BASE, effect: "irreversible", arguments: await details()}));
  const seen = JSON.stringify(results);
  for (const value of [...Object.values(secret), "Priya", "Secretname", "814-555-0199", "Hidden Way"]) {
    assert.ok(!seen.includes(value), `A result contains "${value}".`);
  }
  // The order list the model reads is exactly what the page shows.
  const listed = (await state()).orders[0];
  assert.deepEqual(Object.keys(listed), ["orderId", "placedOn", "status", "delivery", "arrivesByChristmas", "items", "total"]);
  assert.ok(JSON.stringify(document.snapshot()["orders-list"]).includes(listed.orderId));
  assert.ok(!JSON.stringify(document.snapshot()).includes("Priya"));
});

/**
 * Answer this page's confirmation dialog with one of its buttons as soon as it opens.
 *
 * :param label: The button label to press.
 * :param seen: Collects each dialog's title and details.
 * :return: A confirmation callback for the runner.
 */
function pressInDialog(label, seen) {
  return async (items) => {
    const answer = AssistantMount.review(items);
    const dialog = document.body.children.at(-1);
    assert.equal(dialog.open, true, "The page's dialog did not open.");
    seen.push({title: dialog.children[0].textContent, details: dialog.children[2].children.map((c) => c.textContent)});
    dialog.querySelectorAll("button").find((b) => b.textContent === label).dispatch("click");
    return answer;
  };
}

test("a whole turn through the runtime: shop, confirm in the page's dialog, decline another", async () => {
  document.provide("#ns-input", [new StubElement("textarea")]);
  await cartWith([]);
  const version = (await state()).cart.version;
  const script = [
    {tool: "website_get_store_state", arguments: {}},
    {tool: "website_add_to_cart", arguments: {id: "P006", quantity: 1, giftWrap: true}},
    {tool: "website_get_store_state", arguments: {}},
    {tool: "website_place_order", arguments: {name: "Ann Lee", email: "ann@example.com", shippingMethod: "pickup", expectedVersion: version + 1}},
    {text: "Your order is placed."},
  ];
  const seen = [];
  const model = new ScriptedModel(script);
  const run = {...ctx, llm: model, trace: new TraceBus(), confirmWebsiteActions: pressInDialog("Place the order", seen)};
  const result = await runAgent(run, run.frontMan, "Order the plaid blanket, gift wrapped, for pickup. Ann Lee, ann@example.com", null, []);
  assert.equal(result.text, "Your order is placed.");
  // The runner sent each receipt back to the model.
  const receipts = model.toolResults(4);
  assert.deepEqual(receipts.map((r) => r.status), ["succeeded", "succeeded", "succeeded", "succeeded"]);
  const order = receipts[3].result.order;
  // $54.99 + $4.99 wrap = $59.98; tax 6% = $3.5988 → $3.60; pickup free: $63.58.
  assert.equal(order.total, "$63.58");
  assert.equal(seen[0].title, "Place this order?");
  assert.ok(seen[0].details.includes("$63.58"));
  assert.ok(seen[0].details.includes("1 × Cozy Plaid Blanket (gift wrapped) — $54.99"));
  assert.equal((await state()).orders[0].orderId, order.orderId);

  // A second order the visitor declines: the receipt says cancelled and nothing changes.
  await cartWith([{id: "P009", quantity: 1}]);
  const before = await state();
  const declineModel = new ScriptedModel([
    {tool: "website_place_order", arguments: {name: "Ann Lee", email: "ann@example.com", shippingMethod: "express", address: "1 Main St, Erie, PA 16501", expectedVersion: before.cart.version}},
    {text: "Okay, I did not place it."},
  ]);
  const declined = [];
  const run2 = {...ctx, llm: declineModel, trace: new TraceBus(), confirmWebsiteActions: pressInDialog("Keep shopping", declined)};
  await runAgent(run2, run2.frontMan, "Place it with express.", null, []);
  assert.equal(declineModel.toolResults(1)[0].status, "cancelled");
  assert.deepEqual(await state(), before);

  // A stale version: the page's check refuses before any dialog, and the model gets the reason.
  const staleModel = new ScriptedModel([
    {tool: "website_place_order", arguments: {name: "Ann Lee", email: "ann@example.com", shippingMethod: "pickup", expectedVersion: before.cart.version - 1}},
    {text: "The cart changed."},
  ]);
  const run3 = {...ctx, llm: staleModel, trace: new TraceBus(), confirmWebsiteActions: AssistantMount.review};
  const dialogs = document.body.children.length;
  await runAgent(run3, run3.frontMan, "Place it.", null, []);
  assert.equal(document.body.children.length, dialogs, "A dialog opened for a stale cart.");
  const toolMessage = staleModel.calls[1].messages.find((m) => m.role === "tool").content;
  assert.match(toolMessage, /The cart changed \(version \d+, not \d+\)/);
  assert.deepEqual(await state(), before);
});
