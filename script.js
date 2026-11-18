// North Pole Gift Co. storefront (ES module: exports App for site.js and site-actions.js). One page object, App.page, keeps the catalog rules, the
// cart and this browser's orders. The page's own buttons and forms call its methods.
// Money is handled in integer cents. All text is rendered with textContent.

/** The gift catalog. */
const CATALOG = [
  {id: "P001", name: "Wooden Reindeer Pull Toy", category: "Toys", priceCents: 2499, recipients: ["kids"], minAge: 2, inStock: true, emoji: "🦌",
    description: "Hand-finished beech wood reindeer on wheels with a red pull string."},
  {id: "P002", name: "Snow Globe Music Box", category: "Decor", priceCents: 3999, recipients: ["kids", "adults", "family"], minAge: 6, inStock: true, emoji: "🔮",
    description: "Glass snow globe with a tiny village that plays a Christmas tune when wound."},
  {id: "P003", name: "Ugly Christmas Sweater", category: "Apparel", priceCents: 4499, recipients: ["teens", "adults"], minAge: 12, inStock: true, emoji: "🧶",
    description: "Knitted acrylic sweater with a light-up reindeer nose. One size per order: tell us in the gift message."},
  {id: "P004", name: "Gingerbread House Kit", category: "Treats", priceCents: 1999, recipients: ["kids", "family"], minAge: 4, inStock: true, emoji: "🏠",
    description: "Pre-baked gingerbread panels, icing and candy. Contains wheat, egg and milk."},
  {id: "P005", name: "Glass Tree Ornament", category: "Decor", priceCents: 1599, recipients: ["kids", "teens", "adults", "family"], minAge: 0, inStock: true, emoji: "🎄",
    description: "Hand-painted red and gold glass bauble with a ribbon hanger."},
  {id: "P006", name: "Cozy Plaid Blanket", category: "Home", priceCents: 5499, recipients: ["adults", "family"], minAge: 0, inStock: true, emoji: "🧣",
    description: "Oversized red and green tartan fleece blanket, 60 x 80 inches."},
  {id: "P007", name: "Gourmet Hot Cocoa Set", category: "Treats", priceCents: 2999, recipients: ["teens", "adults", "family"], minAge: 0, inStock: true, emoji: "☕",
    description: "Four cocoa blends, marshmallows and two ceramic mugs. Contains milk."},
  {id: "P008", name: "LED Light-Up Train Set", category: "Toys", priceCents: 7999, recipients: ["kids", "family"], minAge: 5, inStock: true, emoji: "🚂",
    description: "Battery-powered train with 12 track pieces that circles the tree. Batteries not included."},
  {id: "P009", name: "Santa Paws Pet Stocking", category: "Home", priceCents: 2199, recipients: ["pet lovers"], minAge: 0, inStock: true, emoji: "🐾",
    description: "Stocking filled with natural dog treats and two squeaky toys."},
  {id: "P010", name: "The Night Before Christmas (Illustrated)", category: "Books", priceCents: 1899, recipients: ["kids", "family"], minAge: 3, inStock: true, emoji: "📖",
    description: "Hardcover illustrated edition of the classic poem."},
  {id: "P011", name: "Scented Candle Trio", category: "Home", priceCents: 3499, recipients: ["adults"], minAge: 0, inStock: false, emoji: "🕯️",
    description: "Pine, cinnamon and sugar cookie soy candles."},
  {id: "P012", name: "Elf Pajama Set", category: "Apparel", priceCents: 3299, recipients: ["kids", "teens"], minAge: 3, inStock: true, emoji: "🧝",
    description: "Soft cotton two-piece elf pajamas in kids' and teen sizes."},
];

/** Store facts. They render the policies section and the delivery table. */
const STORE = {
  categories: ["Toys", "Decor", "Apparel", "Treats", "Home", "Books"],
  recipients: ["kids", "teens", "adults", "family", "pet lovers"],
  maxPerItem: 10,
  giftWrapCents: 499,
  freeShippingCents: 5000,
  taxRateBasisPoints: 600,
  shipping: [
    {id: "standard", label: "Standard", costCents: 599, speed: "5-7 business days", cutoff: [12, 16]},
    {id: "express", label: "Express", costCents: 1499, speed: "2 business days", cutoff: [12, 21]},
    {id: "pickup", label: "Store pickup", costCents: 0, speed: "ready in 2 hours", cutoff: [12, 24]},
  ],
  coupons: {
    HOLLY10: {kind: "percent", value: 10, minSubtotalCents: 0, text: "10% off merchandise"},
    JINGLE5: {kind: "fixed", value: 500, minSubtotalCents: 3000, text: "$5.00 off a merchandise subtotal of $30.00 or more"},
  },
  policies: [
    ["Gift wrap", "$4.99 per cart line, whatever the quantity."],
    ["Shipping", "Standard $5.99, free when merchandise after discount is $50.00 or more. Express $14.99. Store pickup is free."],
    ["Sales tax", "6% on merchandise after discount, plus gift wrap. Shipping is not taxed."],
    ["Limits", "Up to 10 of each gift per order."],
    ["Coupons", "One coupon per order. HOLLY10: 10% off merchandise. JINGLE5: $5.00 off a merchandise subtotal of $30.00 or more."],
    ["Returns", "Unopened items can be returned within 30 days of delivery, and holiday orders until January 31. Returns are handled by email at help@northpolegift.example, not on this site."],
    ["Payment", "This is a demo store: no payment is taken and nothing ships."],
  ],
};

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const WEEKDAY = new Intl.DateTimeFormat("en-US", {weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC"});

/**
 * The storefront page object.
 */
export class App {
  /** The one page object, created at startup. */
  static page = null;

  /** Today's date. Tests replace this to pin the date. */
  static clock() {
    return new Date();
  }

  /**
   * Format cents as dollars, such as "$1,234.50" or "-$5.00".
   *
   * :param cents: An integer amount in cents.
   * :return: The amount as the page shows it.
   */
  static money(cents) {
    const sign = cents < 0 ? "-" : "";
    const abs = Math.abs(cents);
    return `${sign}$${Math.floor(abs / 100).toLocaleString("en-US")}.${String(abs % 100).padStart(2, "0")}`;
  }

  /**
   * Describe a calendar date both ways the agent needs it.
   *
   * :param year: Year. :param month: 1-12. :param day: 1-31.
   * :return: {iso: "2026-12-16", label: "Wed, Dec 16, 2026"}.
   */
  static dateInfo(year, month, day) {
    const date = new Date(Date.UTC(year, month - 1, day));
    return {iso: date.toISOString().slice(0, 10), label: WEEKDAY.format(date)};
  }

  /**
   * Create the page object over the page's elements.
   *
   * :param doc: The page document.
   * :param storage: Web storage for the cart and orders, or null.
   */
  constructor(doc, storage) {
    this.doc = doc;
    this.storage = storage;
    this.cart = new Map();     // id -> {quantity, giftWrap}, in the order items were added
    this.coupon = "";
    this.version = 0;
    this.orders = [];
    this.el = {};
    for (const id of ["cart-count", "product-grid", "product-status", "f-q", "f-category", "f-recipient", "f-max", "f-stock",
      "filters", "f-reset", "cart-message", "cart-lines", "cart-totals", "coupon-form", "coupon-code", "coupon-remove",
      "coupon-message", "checkout-form", "c-name", "c-email", "c-ship", "c-address", "c-address-wrap", "c-gift",
      "place-order", "checkout-message", "today-label", "ship-table", "policy-list", "orders-empty", "orders-list", "hero-note"]) {
      this.el[id] = doc.getElementById(id);
    }
  }

  // ------------------------------------------------------------------ business rules

  /** :return: The catalog item with this id, or undefined. */
  static item(id) {
    return CATALOG.find((p) => p.id === id);
  }

  /** :return: Every catalog id, in catalog order. */
  catalogIds() {
    return CATALOG.map((p) => p.id);
  }

  /** :return: Today's UTC calendar date as [year, month, day]. */
  static todayParts() {
    const now = App.clock();
    return [now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate()];
  }

  /**
   * Work out the order-by date for Christmas delivery with one shipping method.
   *
   * :param method: A STORE.shipping entry.
   * :return: {orderBy, arrivesByChristmas}. After December 25 the dates are next year's.
   */
  static christmasDelivery(method) {
    const [y, m, d] = App.todayParts();
    const today = y * 10000 + m * 100 + d;
    const year = (m === 12 && d > 25) ? y + 1 : y;
    const cutoff = year * 10000 + method.cutoff[0] * 100 + method.cutoff[1];
    return {orderBy: App.dateInfo(year, method.cutoff[0], method.cutoff[1]), arrivesByChristmas: today <= cutoff};
  }

  /**
   * Price the cart.
   *
   * :param shippingId: A shipping method id, or "" to leave shipping out.
   * :return: The lines and totals in cents and as shown.
   */
  priceCart(shippingId) {
    const lines = [];
    let subtotal = 0;
    let wrap = 0;
    for (const [id, line] of this.cart) {
      const p = App.item(id);
      const lineTotal = p.priceCents * line.quantity;
      subtotal += lineTotal;
      if (line.giftWrap) {
        wrap += STORE.giftWrapCents;
      }
      lines.push({id: id, name: p.name, quantity: line.quantity, giftWrap: line.giftWrap,
        unitPrice: App.money(p.priceCents), lineTotal: App.money(lineTotal)});
    }
    let discount = 0;
    let couponNote = "";
    if (this.coupon) {
      const c = STORE.coupons[this.coupon];
      if (subtotal < c.minSubtotalCents) {
        couponNote = `${this.coupon} needs a merchandise subtotal of ${App.money(c.minSubtotalCents)}, so it is not applied.`;
      } else if (c.kind === "percent") {
        discount = Math.floor(subtotal * c.value / 100);
      } else {
        discount = Math.min(c.value, subtotal);
      }
    }
    let shipping = 0;
    const method = STORE.shipping.find((s) => s.id === shippingId);
    if (method) {
      shipping = method.costCents;
      if (method.id === "standard" && subtotal - discount >= STORE.freeShippingCents) {
        shipping = 0;
      }
    }
    const taxable = subtotal - discount + wrap;
    // Round half up to the cent.
    const tax = Math.floor((taxable * STORE.taxRateBasisPoints + 5000) / 10000);
    const total = taxable + shipping + tax;
    return {
      lines: lines,
      itemCount: lines.reduce((n, l) => n + l.quantity, 0),
      coupon: this.coupon,
      couponNote: couponNote,
      subtotal: App.money(subtotal),
      giftWrap: App.money(wrap),
      discount: App.money(-discount),
      shipping: method ? App.money(shipping) : "chosen at checkout",
      tax: App.money(tax),
      total: App.money(total),
      totalCents: total,
      cents: {subtotal: subtotal, giftWrap: wrap, discount: discount, shipping: shipping, tax: tax, total: total},
    };
  }

  /**
   * Check one cart line without changing anything.
   *
   * :return: null when it is fine, or a refusal.
   */
  static checkLine(id, quantity, giftWrap) {
    const p = App.item(id);
    if (!p) {
      return {ok: false, reason: `There is no gift with id ${id}.`, field: "id"};
    }
    if (!Number.isInteger(quantity) || quantity < 0) {
      return {ok: false, reason: "Quantity must be a whole number of 0 or more.", field: "quantity"};
    }
    if (quantity > STORE.maxPerItem) {
      return {ok: false, reason: `You can order up to ${STORE.maxPerItem} of each gift.`, field: "quantity"};
    }
    if (quantity > 0 && !p.inStock) {
      return {ok: false, reason: `${p.name} is out of stock.`, field: "id"};
    }
    if (giftWrap !== undefined && typeof giftWrap !== "boolean") {
      return {ok: false, reason: "Gift wrap must be yes or no.", field: "giftWrap"};
    }
    return null;
  }

  // ------------------------------------------------------------------ operations

  /**
   * The part of an order the "Your orders" panel shows. The name, email, address and gift
   * message stay out: on a shared computer they belong to whoever placed the order.
   *
   * :param order: A stored order.
   * :return: A plain copy of the shown fields.
   */
  static shownOrder(order) {
    return {
      orderId: order.orderId,
      placedOn: {...order.placedOn},
      status: order.status,
      delivery: order.delivery,
      arrivesByChristmas: order.arrivesByChristmas,
      items: order.lines.map((l) => `${l.quantity} × ${l.name}`).join(", "),
      total: order.total,
    };
  }

  /**
   * Read the page state as plain JSON.
   *
   * :return: Today's date, the catalog, the cart with its version, delivery dates,
   *   policies and this browser's orders as the page shows them.
   */
  getState() {
    const [y, m, d] = App.todayParts();
    return {
      today: App.dateInfo(y, m, d),
      catalog: CATALOG.map((p) => ({id: p.id, name: p.name, category: p.category, price: App.money(p.priceCents),
        forWhom: [...p.recipients], minAge: p.minAge, inStock: p.inStock, description: p.description})),
      cart: {version: this.version, ...this.priceCart("")},
      delivery: STORE.shipping.map((s) => ({id: s.id, name: s.label, cost: App.money(s.costCents), speed: s.speed,
        ...App.christmasDelivery(s)})),
      policies: STORE.policies.map(([topic, text]) => ({topic: topic, text: text})),
      orders: this.orders.map(App.shownOrder),
    };
  }

  /**
   * Add a quantity of one gift to the cart, keeping the rest of the cart.
   *
   * :return: {ok: true, cart} with the new version, or a refusal that changes nothing.
   */
  addItem(id, quantity, giftWrap = false) {
    if (!Number.isInteger(quantity) || quantity < 1) {
      return {ok: false, reason: "Quantity must be a whole number of 1 or more.", field: "quantity"};
    }
    const current = this.cart.get(id);
    const total = (current ? current.quantity : 0) + quantity;
    const refusal = App.checkLine(id, total, giftWrap);
    if (refusal) {
      if (refusal.field === "quantity" && current) {
        refusal.reason += ` The cart already has ${current.quantity}.`;
      }
      return refusal;
    }
    this.cart.set(id, {quantity: total, giftWrap: Boolean(giftWrap) || Boolean(current && current.giftWrap)});
    return this.changed("cart-message", `Added ${quantity} × ${App.item(id).name}.`);
  }

  /**
   * Set exact quantities and gift wrap for listed gifts. 0 removes a gift. Every line is
   * checked before any changes.
   *
   * :param lines: [{id, quantity, giftWrap?}].
   * :return: {ok: true, cart}, or a refusal that changes nothing.
   */
  setCartQuantities(lines) {
    if (!Array.isArray(lines) || lines.length === 0) {
      return {ok: false, reason: "List at least one gift to change.", field: "lines"};
    }
    const seen = new Set();
    for (const line of lines) {
      if (seen.has(line.id)) {
        return {ok: false, reason: `${line.id} is listed twice.`, field: "lines"};
      }
      seen.add(line.id);
      const refusal = App.checkLine(line.id, line.quantity, line.giftWrap);
      if (refusal) {
        return refusal;
      }
    }
    for (const line of lines) {
      if (line.quantity === 0) {
        this.cart.delete(line.id);
      } else {
        const current = this.cart.get(line.id);
        const wrap = line.giftWrap === undefined ? Boolean(current && current.giftWrap) : line.giftWrap;
        this.cart.set(line.id, {quantity: line.quantity, giftWrap: wrap});
      }
    }
    return this.changed("cart-message", "Cart updated.");
  }

  /**
   * Apply a coupon code, or remove the coupon with "".
   *
   * :return: {ok: true, cart}, or a refusal that changes nothing.
   */
  setCoupon(code) {
    const normalized = String(code || "").trim().toUpperCase();
    if (normalized === "") {
      if (!this.coupon) {
        return {ok: false, reason: "No coupon is applied.", field: "code"};
      }
      this.coupon = "";
      return this.changed("coupon-message", "Coupon removed.");
    }
    const coupon = STORE.coupons[normalized];
    if (!coupon) {
      return {ok: false, reason: `${normalized} is not a valid coupon code.`, field: "code"};
    }
    const subtotal = this.priceCart("").cents.subtotal;
    if (subtotal < coupon.minSubtotalCents) {
      return {ok: false, reason: `${normalized} needs a merchandise subtotal of ${App.money(coupon.minSubtotalCents)}. The cart has ${App.money(subtotal)}.`, field: "code"};
    }
    this.coupon = normalized;
    return this.changed("coupon-message", `Coupon ${normalized} applied: ${coupon.text}.`);
  }

  /**
   * Check an order without changing anything. placeOrder() runs the same check first.
   *
   * :param details: {name, email, shippingMethod, address?, giftMessage?, expectedVersion}.
   * :return: {ok: true, ...the order it would place}, or a refusal.
   */
  checkOrder(details) {
    if (details.expectedVersion !== this.version) {
      return {ok: false, reason: `The cart changed (version ${this.version}, not ${details.expectedVersion}). Read the cart again and check it with the visitor.`, field: "expectedVersion"};
    }
    if (this.cart.size === 0) {
      return {ok: false, reason: "The cart is empty.", field: "cart"};
    }
    for (const [id, line] of this.cart) {
      const refusal = App.checkLine(id, line.quantity, line.giftWrap);
      if (refusal) {
        return refusal;
      }
    }
    const name = String(details.name || "").trim();
    const email = String(details.email || "").trim();
    const address = String(details.address || "").trim();
    const giftMessage = String(details.giftMessage || "").trim();
    if (name.length < 2) {
      return {ok: false, reason: "Enter the full name for the order.", field: "name"};
    }
    if (name.length > 80) {
      return {ok: false, reason: "The name can be at most 80 characters.", field: "name"};
    }
    if (!EMAIL.test(email) || email.length > 120) {
      return {ok: false, reason: "Enter a valid email address.", field: "email"};
    }
    const method = STORE.shipping.find((s) => s.id === details.shippingMethod);
    if (!method) {
      return {ok: false, reason: "Choose standard, express or store pickup.", field: "shippingMethod"};
    }
    if (method.id !== "pickup" && address.length < 8) {
      return {ok: false, reason: "Enter the full shipping address, with city and ZIP code.", field: "address"};
    }
    if (address.length > 200) {
      return {ok: false, reason: "The address can be at most 200 characters.", field: "address"};
    }
    if (giftMessage.length > 200) {
      return {ok: false, reason: "The gift message can be at most 200 characters.", field: "giftMessage"};
    }
    const priced = this.priceCart(method.id);
    return {
      ok: true,
      name: name,
      email: email,
      shippingMethod: method.id,
      delivery: method.label,
      address: method.id === "pickup" ? "" : address,
      giftMessage: giftMessage,
      christmas: App.christmasDelivery(method),
      ...priced,
    };
  }

  /**
   * Place a demo order for the current cart. No payment is taken.
   *
   * :param details: As for checkOrder().
   * :return: {ok: true, order}, or the refusal from checkOrder().
   */
  placeOrder(details) {
    const check = this.checkOrder(details);
    if (!check.ok) {
      return check;
    }
    const bytes = new Uint8Array(3);
    globalThis.crypto.getRandomValues(bytes);
    const [y, m, d] = App.todayParts();
    const order = {
      orderId: "NP-" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase(),
      placedOn: App.dateInfo(y, m, d),
      status: "Received (demo order: no payment taken, nothing ships)",
      name: check.name,
      email: check.email,
      delivery: check.delivery,
      shippingMethod: check.shippingMethod,
      address: check.address,
      giftMessage: check.giftMessage,
      arrivesByChristmas: check.christmas.arrivesByChristmas,
      lines: check.lines,
      coupon: check.couponNote ? "" : check.coupon,
      subtotal: check.subtotal,
      giftWrap: check.giftWrap,
      discount: check.discount,
      shipping: check.shipping,
      tax: check.tax,
      total: check.total,
    };
    this.orders.unshift(order);
    this.cart.clear();
    this.coupon = "";
    this.version += 1;
    this.save();
    this.clearFieldErrors();
    // Show the result where the page's own button shows it, whoever placed the order.
    this.setMessage("checkout-message", `🎉 Order ${order.orderId} placed. Total ${order.total}. `
      + (order.arrivesByChristmas ? "It should arrive by Christmas." : "It may arrive after Christmas."), "success");
    this.render();
    return {ok: true, order: JSON.parse(JSON.stringify(order)), cartVersion: this.version};
  }

  /**
   * Finish a cart change: bump the version, save, clear old messages and re-render.
   */
  changed(messageId, text) {
    this.version += 1;
    this.save();
    for (const id of ["cart-message", "coupon-message"]) {
      this.setMessage(id, id === messageId ? text : "", id === messageId ? "success" : "");
    }
    this.render();
    return {ok: true, cart: {version: this.version, ...this.priceCart("")}};
  }

  // ------------------------------------------------------------------ storage

  save() {
    if (!this.storage) {
      return;
    }
    try {
      this.storage.setItem("npg-cart", JSON.stringify({items: [...this.cart], coupon: this.coupon}));
      this.storage.setItem("npg-orders", JSON.stringify(this.orders.slice(0, 20)));
    } catch (error) {
      console.warn("Could not save the cart", error);
    }
  }

  load() {
    if (!this.storage) {
      return;
    }
    try {
      const saved = JSON.parse(this.storage.getItem("npg-cart") || "null");
      if (saved && Array.isArray(saved.items)) {
        for (const [id, line] of saved.items) {
          if (line && !App.checkLine(id, line.quantity, Boolean(line.giftWrap)) && line.quantity > 0) {
            this.cart.set(id, {quantity: line.quantity, giftWrap: Boolean(line.giftWrap)});
          }
        }
        if (STORE.coupons[saved.coupon]) {
          this.coupon = saved.coupon;
        }
      }
      const orders = JSON.parse(this.storage.getItem("npg-orders") || "[]");
      if (Array.isArray(orders)) {
        this.orders = orders;
      }
    } catch (error) {
      console.warn("Could not read the saved cart", error);
    }
  }

  // ------------------------------------------------------------------ rendering

  make(tag, text, className) {
    const node = this.doc.createElement(tag);
    if (text !== undefined) {
      node.textContent = text;
    }
    if (className) {
      node.className = className;
    }
    return node;
  }

  setMessage(id, text, kind) {
    this.el[id].textContent = text;
    this.el[id].className = kind;
  }

  clearFieldErrors() {
    for (const id of ["c-name", "c-email", "c-ship", "c-address", "c-gift"]) {
      this.el[id].setCustomValidity("");
    }
  }

  render() {
    this.renderProducts();
    this.renderCart();
    this.renderDelivery();
    this.renderOrders();
  }

  filteredCatalog() {
    const q = String(this.el["f-q"].value || "").trim().toLowerCase();
    const words = q.split(/[^a-z0-9]+/).filter((w) => w.length > 1);
    const category = this.el["f-category"].value;
    const recipient = this.el["f-recipient"].value;
    const max = this.el["f-max"].value === "" ? null : Number(this.el["f-max"].value);
    const stockOnly = Boolean(this.el["f-stock"].checked);
    return CATALOG.filter((p) => {
      const text = `${p.name} ${p.description} ${p.category}`.toLowerCase();
      return (!category || p.category === category)
        && (!recipient || p.recipients.includes(recipient))
        && (max === null || !(max >= 0) || p.priceCents <= Math.round(max * 100))
        && (!stockOnly || p.inStock)
        && words.every((w) => text.includes(w));
    });
  }

  renderProducts() {
    const products = this.filteredCatalog();
    this.el["product-status"].textContent = products.length ? `${products.length} gift(s) found.` : "No gifts match those filters.";
    const cards = [];
    for (const p of products) {
      const card = this.make("article", undefined, "card");
      const badges = this.make("div");
      for (const r of p.recipients) {
        badges.append(this.make("span", r, "badge"));
      }
      if (!p.inStock) {
        badges.append(this.make("span", "Out of stock", "badge out"));
      }
      const wrapLabel = this.make("label", undefined, "check");
      const wrap = this.make("input");
      wrap.type = "checkbox";
      wrapLabel.append(wrap, ` Gift wrap (+${App.money(STORE.giftWrapCents)})`);
      const button = this.make("button", p.inStock ? "Add to cart" : "Out of stock");
      button.type = "button";
      button.disabled = !p.inStock;
      button.addEventListener("click", this.onAdd.bind(this, p.id, wrap));
      const age = p.minAge ? ` Ages ${p.minAge}+.` : "";
      card.append(this.make("div", p.emoji, "emoji"), this.make("h3", p.name), this.make("div", App.money(p.priceCents), "price"),
        badges, this.make("p", p.description + age, "muted small"), wrapLabel, button);
      cards.push(card);
    }
    this.el["product-grid"].replaceChildren(...cards);
  }

  renderCart() {
    const priced = this.priceCart("");
    this.el["cart-count"].textContent = String(priced.itemCount);
    const rows = [];
    for (const line of priced.lines) {
      const row = this.make("div", undefined, "line");
      const controls = this.make("div", undefined, "line-controls");
      const qtyLabel = this.make("label", "Qty ", "check");
      const qty = this.make("input");
      qty.type = "number";
      qty.min = "0";
      qty.max = String(STORE.maxPerItem);
      qty.value = String(line.quantity);
      qty.setAttribute("aria-label", `Quantity of ${line.name}`);
      qty.addEventListener("change", this.onQuantity.bind(this, line.id, qty));
      qtyLabel.append(qty);
      const wrapLabel = this.make("label", undefined, "check");
      const wrap = this.make("input");
      wrap.type = "checkbox";
      wrap.checked = line.giftWrap;
      wrap.addEventListener("change", this.onWrap.bind(this, line.id, wrap));
      wrapLabel.append(wrap, " Gift wrap");
      const remove = this.make("button", "Remove", "secondary");
      remove.type = "button";
      remove.addEventListener("click", this.onRemove.bind(this, line.id));
      controls.append(qtyLabel, wrapLabel, remove);
      const body = this.make("div");
      body.append(this.make("div", line.name), controls);
      row.append(this.make("span", App.item(line.id).emoji), body, this.make("strong", line.lineTotal));
      rows.push(row);
    }
    if (!rows.length) {
      rows.push(this.make("p", "Your cart is empty.", "muted"));
    }
    this.el["cart-lines"].replaceChildren(...rows);
    const totals = [["Subtotal", priced.subtotal]];
    if (priced.cents.giftWrap) {
      totals.push(["Gift wrap", priced.giftWrap]);
    }
    if (priced.cents.discount) {
      totals.push([`Discount (${priced.coupon})`, priced.discount]);
    }
    totals.push(["Tax", priced.tax], ["Total before shipping", priced.total]);
    const totalRows = totals.map(([label, value], i) => {
      const div = this.make("div", undefined, i === totals.length - 1 ? "grand" : "");
      div.append(this.make("span", label), this.make("span", value));
      return div;
    });
    if (priced.couponNote) {
      totalRows.push(this.make("p", priced.couponNote, "error"));
    }
    this.el["cart-totals"].replaceChildren(...totalRows);
    this.el["coupon-remove"].hidden = !priced.coupon;
    this.el["place-order"].disabled = priced.lines.length === 0;
  }

  renderDelivery() {
    const [y, m, d] = App.todayParts();
    this.el["today-label"].textContent = App.dateInfo(y, m, d).label;
    const rows = STORE.shipping.map((s) => {
      const info = App.christmasDelivery(s);
      const tr = this.make("tr");
      tr.append(this.make("td", s.label), this.make("td", App.money(s.costCents)), this.make("td", s.speed),
        this.make("td", info.orderBy.label), this.make("td", info.arrivesByChristmas ? "✅ Yes" : "❌ No"));
      return tr;
    });
    this.el["ship-table"].replaceChildren(...rows);
  }

  renderOrders() {
    this.el["orders-empty"].hidden = this.orders.length > 0;
    const items = this.orders.map((stored) => {
      const o = App.shownOrder(stored);
      const li = this.make("li");
      li.append(this.make("strong", o.orderId), ` · ${o.placedOn.label} · ${o.total} · ${o.delivery} · ${o.items} · ${o.status}`);
      return li;
    });
    this.el["orders-list"].replaceChildren(...items);
  }

  renderStatic() {
    for (const c of STORE.categories) {
      this.el["f-category"].append(new Option(c, c));
    }
    for (const r of STORE.recipients) {
      this.el["f-recipient"].append(new Option(r, r));
    }
    for (const s of STORE.shipping) {
      this.el["c-ship"].append(new Option(`${s.label} (${App.money(s.costCents)})`, s.id));
    }
    this.el["c-ship"].value = "standard";
    const terms = [];
    for (const [topic, text] of STORE.policies) {
      terms.push(this.make("dt", topic), this.make("dd", text));
    }
    this.el["policy-list"].replaceChildren(...terms);
    this.el["hero-note"].textContent = `Gift wrap on any item for ${App.money(STORE.giftWrapCents)}. Free standard shipping on ${App.money(STORE.freeShippingCents)} or more.`;
  }

  // ------------------------------------------------------------------ page handlers

  onAdd(id, wrapBox) {
    const result = this.addItem(id, 1, Boolean(wrapBox.checked));
    if (!result.ok) {
      this.setMessage("cart-message", result.reason, "error");
    }
  }

  onQuantity(id, input) {
    const quantity = Number(input.value);
    const result = this.setCartQuantities([{id: id, quantity: quantity}]);
    if (!result.ok) {
      this.setMessage("cart-message", result.reason, "error");
      this.renderCart();
    }
  }

  onWrap(id, box) {
    const line = this.cart.get(id);
    const result = this.setCartQuantities([{id: id, quantity: line ? line.quantity : 0, giftWrap: Boolean(box.checked)}]);
    if (!result.ok) {
      this.setMessage("cart-message", result.reason, "error");
    }
  }

  onRemove(id) {
    this.setCartQuantities([{id: id, quantity: 0}]);
  }

  onCoupon(event) {
    event.preventDefault();
    const result = this.setCoupon(this.el["coupon-code"].value);
    if (result.ok) {
      this.el["coupon-code"].value = "";
    } else {
      this.setMessage("coupon-message", result.reason, "error");
    }
  }

  onRemoveCoupon() {
    this.setCoupon("");
  }

  onShipChange() {
    const pickup = this.el["c-ship"].value === "pickup";
    this.el["c-address-wrap"].hidden = pickup;
  }

  onCheckout(event) {
    event.preventDefault();
    this.clearFieldErrors();
    const result = this.placeOrder({
      name: this.el["c-name"].value,
      email: this.el["c-email"].value,
      shippingMethod: this.el["c-ship"].value,
      address: this.el["c-address"].value,
      giftMessage: this.el["c-gift"].value,
      expectedVersion: this.version,
    });
    if (!result.ok) {
      const field = {name: "c-name", email: "c-email", shippingMethod: "c-ship", address: "c-address", giftMessage: "c-gift"}[result.field];
      if (field) {
        this.el[field].setCustomValidity(result.reason);
        this.el[field].focus();
      }
      this.setMessage("checkout-message", result.reason, "error");
      return;
    }
    for (const id of ["c-name", "c-email", "c-address", "c-gift"]) {
      this.el[id].value = "";
    }
  }

  onFieldInput(id) {
    this.el[id].setCustomValidity("");
  }

  /**
   * Wire the page's own controls and draw the page.
   */
  start() {
    this.load();
    this.renderStatic();
    this.el.filters.addEventListener("submit", (event) => {
      event.preventDefault();
      this.renderProducts();
    });
    this.el["f-reset"].addEventListener("click", () => {
      this.el["f-q"].value = "";
      this.el["f-category"].value = "";
      this.el["f-recipient"].value = "";
      this.el["f-max"].value = "";
      this.el["f-stock"].checked = false;
      this.renderProducts();
    });
    this.el["coupon-form"].addEventListener("submit", this.onCoupon.bind(this));
    this.el["coupon-remove"].addEventListener("click", this.onRemoveCoupon.bind(this));
    this.el["c-ship"].addEventListener("change", this.onShipChange.bind(this));
    this.el["checkout-form"].addEventListener("submit", this.onCheckout.bind(this));
    for (const id of ["c-name", "c-email", "c-address", "c-gift"]) {
      this.el[id].addEventListener("input", this.onFieldInput.bind(this, id));
    }
    this.onShipChange();
    this.render();
  }
}

/** :return: The browser's localStorage, or null where it is missing or blocked. */
function pageStorage() {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch (error) {
    return null;
  }
}

App.page = new App(document, pageStorage());
App.page.start();
