const { AppError, asyncHandler } = require('../middleware/error.middleware');
const { generate, textOf } = require('../services/ai.service');
const { declarations, runTool } = require('../services/assistantTools.service');
const { readPoint } = require('../utils/geo');

const MAX_MESSAGES = 20;
const MAX_TOOL_ROUNDS = 3; // model → tools → model … at most this many times per message
const DATA_URL = /^data:(image\/(?:png|jpe?g|webp|gif));base64,(.+)$/;
const ROLE_TEXT = { user: 'driver', provider: 'charging station provider', admin: 'ChargeHub admin' };
const FALLBACK_REPLY = 'Sorry, I could not answer that. Please try asking in a different way.';
const LOGIN_REPLY = `I can check **live stations**, charging time and cost, and your bookings once you sign in.

- Sign in or create a free driver account
- Then ask me again, and I'll look it up for you`;

const systemPrompt = (user) => {
  const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'full', timeStyle: 'short' });
  const vehicle = user?.vehicleInfo?.vehicleName || user?.vehicleInfo?.vehicleModel;
  const battery = user?.vehicleInfo?.batteryCapacity;
  const who = user
    ? `The user is signed in as a ${ROLE_TEXT[user.role]}${vehicle ? ` who drives a ${vehicle}${battery ? ` (${battery} battery)` : ''}` : ''}.`
    : 'The user is not signed in; live data needs a sign-in.';

  return `You are "Ask Me", the assistant of ChargeHub, an EV charging platform in Tamil Nadu, India. Now: ${now} (IST). ${who}

What you do:
- EV charging tips, battery care, connector types and compatibility, EV cars and bikes, charging problems, how ChargeHub works.
- Live data through your tools: nearby stations (find_stations), the driver's bookings (get_my_bookings), charging time and cost at a station (estimate_charge). Use a tool whenever the question needs live data. Never invent stations, prices, distances or bookings.
- When the user names a vehicle, pass its usual usable battery size (kWh) and maximum charging power to estimate_charge.
- You cannot book, cancel or pay. Drivers book with the "Book slot" button on a station card; cancellations are on the Bookings page. Payment is made at the station after the provider verifies the session OTP.
- When an image is sent, identify the EV, connector or problem shown.

How you write:
- Reply in the language the user writes in (English, Tamil, Hindi, ...).
- Start with a one-sentence direct answer, then at most 5 short "- " bullet points when they help. Stay under 120 words unless the user asks for detail.
- Use **bold** only for key names and numbers. For a long answer you may use short "### " headings. No tables, no code blocks, no emojis.
- When find_stations returns stations, the app shows them as cards (distance, drive time, power, connectors, price, Book slot button) right below your reply. So answer in at most two sentences and no bullet points: name the best one and why. Do not repeat the card details.
- If nothing matches, say so and suggest which filter to relax.`;
};

// Chat history ({ role, content, image?, context? }) → Gemini "contents". `context` carries what an earlier answer
// showed (e.g. station ids) so follow-up questions can refer to it.
const toGeminiContents = (messages) => messages.slice(-MAX_MESSAGES).map((msg) => {
  const parts = [];
  const text = [msg.content, msg.context && `[${msg.context}]`].filter(Boolean).join('\n\n');
  if (text) parts.push({ text: String(text).slice(0, 4000) });
  const image = typeof msg.image === 'string' && msg.image.match(DATA_URL);
  if (image) parts.push({ inline_data: { mime_type: image[1], data: image[2] } });
  return { role: msg.role === 'assistant' ? 'model' : 'user', parts };
}).filter(m => m.parts.length);

// Where "near me" is: the location the app sent, else the signed-in user's saved default location
const originOf = (req) => {
  const sent = readPoint(req.body.location);
  if (sent) return { ...sent, label: String(req.body.location.label || '').slice(0, 120) || undefined };
  const saved = readPoint(req.user?.defaultCoordinates);
  return saved && { ...saved, label: req.user.defaultLocation };
};

// @route   POST /api/chat   (anyone; live-data tools need a signed-in user)
// Returns { reply, stations?, fromLabel?, context?, needsLogin?, needsLocation? }
exports.chat = asyncHandler(async (req, res) => {
  const { messages } = req.body;
  if (!Array.isArray(messages) || !messages.length) throw new AppError(400, 'Message is required');

  const contents = toGeminiContents(messages);
  const toolContext = { user: req.user, origin: originOf(req) };
  const extras = {};
  for (let round = 0; ; round++) {
    const reply = await generate({ system: systemPrompt(req.user), contents, tools: declarations });
    const calls = (reply.parts || []).filter(p => p.functionCall).map(p => p.functionCall);
    if (calls.length && !req.user) return res.json({ success: true, data: { reply: LOGIN_REPLY, needsLogin: true } });
    if (!calls.length || round === MAX_TOOL_ROUNDS) {
      return res.json({ success: true, data: { reply: textOf(reply) || FALLBACK_REPLY, ...extras } });
    }

    const outputs = await Promise.all(calls.map(call => runTool(call, toolContext)));
    outputs.forEach(output => Object.assign(extras, output.extras));
    contents.push(reply, {
      role: 'user',
      parts: calls.map(({ id, name }, i) => ({ functionResponse: { ...(id && { id }), name, response: outputs[i].result } }))
    });
  }
});
