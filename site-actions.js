// Registers the North Pole Gift Co. page operations with the agent runtime.
// agent-manifest.json loads this module through "actions.module". Only the names in
// "actions.agentTools" become model tools, called website_<name>.
// Every action wraps a method of the page object, App.page, which the page's own buttons
// and forms also call. No business rule lives in this file.
// Import the page script by the same URL the page uses (no ?v= query), or the actions
// get a second, separate copy of the page state.
import { App } from "./script.js";

/**
 * Describes the store's operations as actions the agents can call.
 */
class SiteActions {
  /**
   * Register every site action with the runtime.
   *
   * :param actions: The runtime registry facade with a register(definition) method.
   */
  static registerActions(actions) {
    actions.register(SiteActions.readStateAction());
    actions.register(SiteActions.addToCartAction());
    actions.register(SiteActions.setCartQuantitiesAction());
    actions.register(SiteActions.setCouponAction());
    actions.register(SiteActions.placeOrderAction());
  }

  /**
   * Describe the read action that returns the store's data and the visitor's cart.
   *
   * :return: The action definition.
   */
  static readStateAction() {
    return {
      name: "get_store_state",
      description: "Read today's date, the gift catalog (id, name, category, price, who it suits, minimum age, in stock), the cart with its version and totals, each delivery method's cost, speed, order-by date and whether it arrives by Christmas, the store policies, and the orders placed in this browser as the page lists them. The site does not check a recipient's age: minAge is a guide you apply.",
      effect: "read",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      execute: SiteActions.readState,
    };
  }

  /**
   * Return a fresh copy of the page state.
   *
   * :return: The page state as plain JSON data.
   */
  static readState() {
    return App.page.getState();
  }

  /**
   * Describe the write that adds one gift to the cart.
   *
   * :return: The action definition.
   */
  static addToCartAction() {
    return {
      name: "add_to_cart",
      description: "Add a quantity of one gift to the visible cart, keeping the rest. Adds to any quantity already there; up to 10 of each gift. Returns ok and the cart with its new version, or ok false with a reason. Does not place an order.",
      effect: "write",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["id", "quantity"],
        properties: {
          id: {
            type: "string",
            enum: App.page.catalogIds(),
            description: "Gift id from website_get_store_state.",
          },
          quantity: {
            type: "integer",
            minimum: 1,
            maximum: 10,
            description: "How many to add.",
          },
          giftWrap: {
            type: "boolean",
            description: "True to gift wrap this gift ($4.99 per cart line). Leave out for no change.",
          },
        },
      },
      execute: SiteActions.addToCart,
    };
  }

  /**
   * Add a gift through the page's own cart function.
   *
   * :param args: The validated arguments.
   * :return: The updated cart, or a refusal.
   */
  static addToCart(args) {
    return App.page.addItem(args.id, args.quantity, args.giftWrap === true);
  }

  /**
   * Describe the write that sets exact quantities and gift wrap.
   *
   * :return: The action definition.
   */
  static setCartQuantitiesAction() {
    return {
      name: "set_cart_quantities",
      description: "Set the exact quantity, and optionally gift wrap, of each listed gift. 0 removes it. Gifts not listed stay as they are. Every line is checked before anything changes. Returns ok and the cart with its new version, or ok false with a reason.",
      effect: "write",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["lines"],
        properties: {
          lines: {
            type: "array",
            minItems: 1,
            maxItems: 12,
            description: "The gifts to change.",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["id", "quantity"],
              properties: {
                id: {
                  type: "string",
                  enum: App.page.catalogIds(),
                  description: "Gift id from website_get_store_state.",
                },
                quantity: {
                  type: "integer",
                  minimum: 0,
                  maximum: 10,
                  description: "The new quantity; 0 removes the gift.",
                },
                giftWrap: {
                  type: "boolean",
                  description: "True or false to change gift wrap. Leave out to keep it.",
                },
              },
            },
          },
        },
      },
      execute: SiteActions.setCartQuantities,
    };
  }

  /**
   * Set quantities through the page's own cart function.
   *
   * :param args: The validated arguments.
   * :return: The updated cart, or a refusal.
   */
  static setCartQuantities(args) {
    return App.page.setCartQuantities(args.lines);
  }

  /**
   * Describe the write that applies or removes the coupon.
   *
   * :return: The action definition.
   */
  static setCouponAction() {
    return {
      name: "set_coupon",
      description: "Apply a coupon code the visitor gave to the cart, replacing any coupon there, or remove the coupon with an empty code. Returns ok and the cart with its new version, or ok false with the site's reason.",
      effect: "write",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["code"],
        properties: {
          code: {
            type: "string",
            maxLength: 40,
            description: "The code exactly as the visitor gave it, or \"\" to remove the coupon.",
          },
        },
      },
      execute: SiteActions.setCoupon,
    };
  }

  /**
   * Apply or remove a coupon through the page's own function.
   *
   * :param args: The validated arguments.
   * :return: The updated cart, or a refusal.
   */
  static setCoupon(args) {
    return App.page.setCoupon(args.code);
  }

  /**
   * Describe the irreversible order that the visitor must confirm.
   *
   * :return: The action definition.
   */
  static placeOrderAction() {
    return {
      name: "place_order",
      description: "Place a demo order for the whole current cart. The browser asks the visitor to confirm first. The site refuses a stale expectedVersion, an empty cart and missing or invalid details. Returns ok and the order with its order id and totals. No payment is taken.",
      effect: "irreversible",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["name", "email", "shippingMethod", "expectedVersion"],
        properties: {
          name: {
            type: "string",
            maxLength: 100,
            description: "The full name the visitor gave.",
          },
          email: {
            type: "string",
            maxLength: 200,
            description: "The email the visitor gave.",
          },
          shippingMethod: {
            type: "string",
            enum: ["standard", "express", "pickup"],
            description: "Delivery the visitor chose: standard, express or pickup (store pickup).",
          },
          address: {
            type: "string",
            maxLength: 250,
            description: "Full shipping address the visitor gave. Required unless pickup.",
          },
          giftMessage: {
            type: "string",
            maxLength: 250,
            description: "Optional gift message the visitor gave.",
          },
          expectedVersion: {
            type: "integer",
            minimum: 0,
            description: "The latest cart version in this turn: from website_get_store_state, or from a cart change made after that read.",
          },
        },
      },
      execute: SiteActions.placeOrder,
    };
  }

  /**
   * Place the order through the same function the page's checkout form uses.
   *
   * :param args: The validated, visitor-confirmed arguments.
   * :return: The order, or {ok: false, reason} when the site refuses it.
   */
  static placeOrder(args) {
    return App.page.placeOrder(args);
  }
}

// The runtime calls the module's registerActions export.
export const registerActions = SiteActions.registerActions;
