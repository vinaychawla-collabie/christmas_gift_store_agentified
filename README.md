# North Pole Gift Co. — agentified

A copy of `christmas_gift_store` with an AI assistant built into the page, made with the
`agentify-website` skill from
[cognizant-ai-labs/agentic-web](https://github.com/cognizant-ai-labs/agentic-web). The
assistant runs in the visitor's browser, uses the visitor's own LLM key, answers from the
store's real data and calls the store's own functions.

## Run it

From the folder that contains this one, with Node.js 22 or newer (`SKILL_DIR` is your
copy of `skills/agentify-website`):

```shell
node SKILL_DIR/scripts/serve_site.mjs christmas_gift_store_agentified --port 8080
```

Open http://127.0.0.1:8080/, scroll to **Ask North Pole Gift Co.**, expand
**⚙ AI model settings**, paste a key for the default provider (hosted Otari) or pick
another provider, and select **Save and start**. On `localhost` and `127.0.0.1` the
runtime also keeps saved keys in a cookie any local site can read, so use a key with a low
spending limit. Afterwards, select **Delete setup** under **Advanced settings (optional)**
and close the tab: the tab keeps using the key until it is closed.

**Privacy:** the assistant sends your messages, and the page data it reads (catalog, cart,
delivery dates, policies and the order list), to the LLM provider you choose.

## Check it

```shell
node SKILL_DIR/scripts/build_network.mjs christmas_gift_store_agentified/north_pole_gift_co.hocon --manifest christmas_gift_store_agentified/agent-manifest.json --check
node --test "christmas_gift_store_agentified/tests/*.test.mjs"
```

## The network

One front agent, `north_pole_gift_assistant`, with no specialists. Its tools:

| Tool | Effect | Wraps | What it does |
| --- | --- | --- | --- |
| `website_get_store_state` | read | `App.page.getState()` | Today's date, catalog, cart with version and totals, Christmas order-by dates, policies, orders as the page lists them |
| `website_add_to_cart` | write | `App.page.addItem()` | Adds a quantity of one gift, optional gift wrap, up to 10 per gift |
| `website_set_cart_quantities` | write | `App.page.setCartQuantities()` | Sets exact quantities and gift wrap; 0 removes; checks every line first |
| `website_set_coupon` | write | `App.page.setCoupon()` | Applies a coupon code, or removes it with `""` |
| `website_place_order` | irreversible | `App.page.placeOrder()` | Places a demo order after the visitor confirms in the page's dialog; refuses a stale cart version |

The runtime also adds `render_cruse` for chat forms and tables.

**It declines:** payment (orders are demo orders), gift cards, changing or cancelling a
placed order, returns or refunds (it points to the help email in the policies), parcel
tracking, personalization or engraving, and holding stock.

## Network URL

`<where this folder is hosted>/north_pole_gift_co`, for example
`http://127.0.0.1:8080/north_pole_gift_co` locally. Other agent sites that call it run it
in their visitor's browser and get none of this site's tools, so their assistant points
visitors to this page for the cart and ordering. This site calls no partner sites.

## Files

| File | Source |
| --- | --- |
| `index.html`, `styles.css`, `script.js` | The store, with the assistant section and styles added; `script.js` is now a module exporting `App` |
| `site.js` | Boots the assistant and shows the order confirmation dialog |
| `site-actions.js` | Registers the five actions |
| `north_pole_gift_co.hocon` | Source of the network |
| `north_pole_gift_co.network.json`, `agent-mcp.json`, `.well-known/`, `bridge/` | Written by `build_network.mjs`; do not edit |
| `agent-manifest.json`, `links.json` | Public bundle files |
| `runtime/` | The skill's browser runtime, unchanged |
| `tests/` | Node tests with a DOM stand-in and a scripted model |
| `_headers` | Hosting headers for Netlify-compatible hosts |

## Hosting

Any static host. Serve `agent-manifest.json`, `north_pole_gift_co.network.json`,
`links.json`, `agent-mcp.json`, `.well-known/nsdeploy.json` and
`.well-known/nsdeploy-agent.json` with `Access-Control-Allow-Origin: *`, and
`runtime/sandbox-worker.js` with
`Content-Security-Policy: default-src 'none'; script-src blob:; connect-src 'none'; worker-src 'none'`.
`_headers` does this on Netlify. Do not block framing of `bridge/`. Use HTTPS.
