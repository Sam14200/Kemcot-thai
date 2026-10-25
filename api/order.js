const PRICE = 1250;
const DELIVERY = { inside: 70, outside: 120 };
const PRODUCT_NAME = "Cem Cot Thai";

function toEnglishDigits(value) {
  return value.replace(/[০-৯]/g, (digit) => String("০১২৩৪৫৬৭৮৯".indexOf(digit)));
}

function sendJson(res, status, body) {
  res.status(status).json(body);
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.error("Telegram order endpoint is missing required environment variables");
    return sendJson(res, 500, { error: "Order service is not configured" });
  }

  const body = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return sendJson(res, 400, { error: "Invalid order details" });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const phone = typeof body.phone === "string"
    ? toEnglishDigits(body.phone).replace(/[\s-]/g, "")
    : "";
  const address = typeof body.address === "string" ? body.address.trim() : "";
  const area = body.area;
  const qty = Number(body.qty);

  if (
    name.length < 2 || name.length > 100 ||
    !/^(\+?880)?01[3-9]\d{8}$/.test(phone) ||
    address.length < 5 || address.length > 500 ||
    !Object.prototype.hasOwnProperty.call(DELIVERY, area) ||
    !Number.isInteger(qty) || qty < 1 || qty > 5
  ) {
    return sendJson(res, 400, { error: "Invalid order details" });
  }

  const subtotal = PRICE * qty;
  const delivery = DELIVERY[area];
  const total = subtotal + delivery;
  const formatPrice = (amount) => `${amount.toLocaleString("bn-BD")} টাকা`;
  const message = [
    `নতুন অর্ডার - ${PRODUCT_NAME}`,
    "-----------------------------",
    `নাম: ${name}`,
    `মোবাইল: ${phone}`,
    `ঠিকানা: ${address}`,
    `ডেলিভারির এলাকা: ${area === "inside" ? "ঢাকার ভেতরে" : "ঢাকার বাইরে"}`,
    `পরিমাণ: ${qty.toLocaleString("bn-BD")}`,
    `পণ্যের দাম: ${formatPrice(subtotal)}`,
    `ডেলিভারি চার্জ: ${formatPrice(delivery)}`,
    `সর্বমোট: ${formatPrice(total)}`,
  ].join("\n");

  try {
    const telegramResponse = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: message }),
    });

    if (!telegramResponse.ok) {
      console.error("Telegram rejected an order message", telegramResponse.status);
      return sendJson(res, 502, { error: "Could not deliver order" });
    }
  } catch {
    console.error("Could not reach Telegram to deliver an order");
    return sendJson(res, 502, { error: "Could not deliver order" });
  }

  return sendJson(res, 200, { ok: true });
};
