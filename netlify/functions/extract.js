// Receives a menu screenshot, asks Claude to read it, returns structured rows.
const { denied } = require("../../lib/auth");

const TOOL = {
  name: "record_menu",
  description: "Record every product card visible in the menu screenshot.",
  input_schema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            item: { type: "string", description: "Product name exactly as written (keep the original script, do not translate)" },
            size: { type: "string", description: "Size from the category heading, written like '33 cm'. Empty string if no heading is visible." },
            sale_price: { type: "string", description: "Current price, digits only like 34.00, no currency" },
            regular_price: { type: "string", description: "Struck-through old price, digits only. Empty string if the card has none." },
            notes: { type: "string", description: "Discount line and badge text on the card, exactly as written (e.g. '20% discount on selected products', 'Popular'). Empty string if none." }
          },
          required: ["item", "size", "sale_price", "regular_price", "notes"]
        }
      },
      unreadable_cards: { type: "integer", description: "Number of product cards you could see but could not read reliably" }
    },
    required: ["items", "unreadable_cards"]
  }
};

const PROMPT =
  "This is a screenshot of one menu category of a restaurant in a food-delivery app (the text may be Georgian). " +
  "Record EVERY product card visible; there may be 20 or more. " +
  "Ignore floating banners or promos that apply to the whole order (for example 'get ₾12 off ₾30 orders'), buttons, and the page description text. " +
  "If a card is partly hidden and its name or price cannot be read, do not guess: skip it and count it in unreadable_cards. " +
  "Never invent values.";

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method not allowed" };
  const deny = denied(event);
  if (deny) return deny;

  try {
    const { image, mediaType } = JSON.parse(event.body);
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-5-5",
        max_tokens: 8000,
        tools: [TOOL],
        tool_choice: { type: "tool", name: "record_menu" },
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType || "image/jpeg", data: image } },
            { type: "text", text: PROMPT }
          ]
        }]
      })
    });
    const data = await res.json();
    if (!res.ok) return { statusCode: 502, body: JSON.stringify({ error: data.error?.message || "Claude API error" }) };
    if (data.stop_reason === "max_tokens")
      return { statusCode: 502, body: JSON.stringify({ error: "Too many products to read at once. Try a smaller screenshot." }) };
    const out = data.content.find((c) => c.type === "tool_use")?.input || {};
    return { statusCode: 200, body: JSON.stringify({ items: out.items || [], unreadable: out.unreadable_cards || 0 }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
