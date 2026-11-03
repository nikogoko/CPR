// Receives a menu screenshot, asks Claude to read it, returns structured rows.
const Anthropic = require("@anthropic-ai/sdk");
const { denied } = require("../../lib/auth");

// Structured output: the reply is guaranteed to be valid JSON in exactly this shape.
// (This model does not allow forcing a tool, so we ask for a JSON reply instead.)
const FORMAT = {
  type: "json_schema",
  schema: {
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
          required: ["item", "size", "sale_price", "regular_price", "notes"],
          additionalProperties: false
        }
      },
      unreadable_cards: { type: "integer", description: "Number of product cards you could see but could not read reliably" }
    },
    required: ["items", "unreadable_cards"],
    additionalProperties: false
  }
};

const PROMPT =
  "This is a screenshot of one menu category of a restaurant in a food-delivery app (the text may be Georgian). " +
  "Record EVERY product card visible; there may be 20 or more. " +
  "Ignore floating banners or promos that apply to the whole order (for example 'get ₾12 off ₾30 orders'), buttons, and the page description text. " +
  "If a card is partly hidden and its name or price cannot be read, do not guess: skip it and count it in unreadable_cards. " +
  "Never invent values.";

const fail = (statusCode, error) => ({ statusCode, body: JSON.stringify({ error }) });

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method not allowed" };
  const deny = denied(event);
  if (deny) return deny;

  const apiKey = (process.env.ANTHROPIC_API_KEY || "").trim();
  if (!apiKey)
    return fail(500, "The server has no ANTHROPIC_API_KEY set. Add it in Netlify (Site configuration > Environment variables, with the Functions scope), then redeploy.");

  try {
    const { image, mediaType } = JSON.parse(event.body);
    const client = new Anthropic({ apiKey, maxRetries: 1 });
    const response = await client.messages.create({
      model: "claude-sonnet-5-5",
      max_tokens: 16000,
      output_config: { effort: "low", format: FORMAT },   // reading text off a screenshot needs little deliberation
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType || "image/jpeg", data: image } },
          { type: "text", text: PROMPT }
        ]
      }]
    });

    if (response.stop_reason === "refusal") return fail(502, "Claude declined to read this image.");
    if (response.stop_reason === "max_tokens") return fail(502, "Too many products to read at once. Try a smaller screenshot.");

    const text = response.content.find((b) => b.type === "text")?.text;
    let out;
    try { out = JSON.parse(text); } catch { return fail(502, "Claude's reply could not be understood. Please try again."); }
    return { statusCode: 200, body: JSON.stringify({ items: out.items || [], unreadable: out.unreadable_cards || 0 }) };
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError)
      return fail(502, "Anthropic rejected the API key. Check ANTHROPIC_API_KEY in Netlify (re-paste it, no spaces) and redeploy.");
    if (e instanceof Anthropic.RateLimitError) return fail(502, "Claude is busy right now. Wait a moment and try again.");
    if (e instanceof Anthropic.APIError) return fail(502, e.error?.error?.message || e.message);   // e.g. "credit balance is too low"
    return fail(500, e.message);
  }
};
