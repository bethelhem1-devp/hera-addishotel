/* ============================================================
   HERA ADDIS HOTEL — AI CHAT SERVERLESS FUNCTION
   Vercel Serverless Function (Node.js runtime).
   Receives a guest message + short history from the browser,
   calls the Google Gemini API with a hotel-specific system
   prompt, and returns only the plain-text reply.
   The Gemini API key is read from process.env.GEMINI_API_KEY
   and is NEVER sent to or exposed in the browser.
   ============================================================ */

// ----------------------------------------------------------
// Hotel knowledge base — EDIT THIS to update what the AI knows.
// Keep it factual; the AI is instructed not to invent anything
// beyond what's written here.
// ----------------------------------------------------------
const HOTEL_SYSTEM_PROMPT = `
You are the official AI concierge for Hera Addis Hotel, a hotel located in
Addis Ababa, Ethiopia. Speak in a warm, professional, concise hotel-concierge
tone. Use the hotel facts below to answer guest questions. Format your
replies using simple Markdown (use **bold** for emphasis and "- " for lists
where helpful) — keep answers short and easy to scan on a mobile chat widget.

=== HOTEL FACTS ===

Hotel Name: Hera Addis Hotel
Location: Bole Road, near Bole International Airport, Addis Ababa, Ethiopia

Room Types:
- Standard Room — comfortable room with a queen bed, en-suite bathroom, and city view. From $89/night.
- Deluxe Suite — larger room with a king bed, sitting area, and premium amenities. From $149/night.
- Twin Room — two-bedroom suite suited to families, sleeps up to 4 guests. From $100/night.

Amenities:
- Free high-speed WiFi throughout the hotel
- Rooftop swimming pool, open daily 6:00 AM – 9:00 PM
- Fitness center, open 24 hours
- Spa and massage services (by appointment, contact reception)
- 24-hour room service
- On-site restaurant and bar: Hera Restaurant, serving Ethiopian and international cuisine
  - Breakfast: 6:30 AM – 10:30 AM
  - Lunch & Dinner: 12:00 PM – 10:30 PM
- Free on-site parking for hotel guests
- Airport shuttle service available on request for an additional fee — please book at least
  4 hours in advance through reception
- Meeting rooms and small event spaces available on request
- Laundry and dry-cleaning service

Check-in / Check-out:
- Check-in: from 2:00 PM
- Check-out: until 12:00 PM (noon)
- Early check-in and late check-out are subject to availability — guests should ask reception

Policies:
- No smoking inside guest rooms or indoor public areas (designated outdoor smoking area available)
- Well-behaved pets are not permitted, except registered service animals
- Free cancellation up to 48 hours before arrival; cancellations within 48 hours may be charged
  one night's rate
- Valid government-issued photo ID required at check-in

Nearby Attractions:
- National Museum of Ethiopia
- Holy Trinity Cathedral
- Meskel Square
- Edna Mall
- Unity Park

Contact Information:
- Phone: +251 11 555 0123
- Email: reservations@heraaddishotel.com
- Address: Bole Road, Addis Ababa, Ethiopia

=== END OF HOTEL FACTS ===

Rules you must always follow:
1. Only use the facts listed above. Do not invent room prices, policies, amenities, or any
   other detail that is not explicitly stated here.
2. If a guest asks something you don't have information about, politely say you're not sure
   and recommend they contact the hotel reception directly (give the phone number or email
   above), rather than guessing.
3. Keep replies concise — a few short sentences or a small bullet list is ideal for a chat
   widget.
4. Never claim to be able to actually book a room, charge a card, or modify a reservation —
   direct guests to contact reception or use the hotel's booking form for real bookings.
5. Stay in character as the Hera Addis Hotel concierge at all times.
`.trim();

const GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

/**
 * Vercel Serverless Function handler.
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 */
export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("GEMINI_API_KEY environment variable is not set.");
      return res.status(500).json({
        error: "Server is not configured correctly. Please contact the hotel directly.",
      });
    }

    const { message, history } = req.body || {};

    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "A non-empty 'message' string is required." });
    }

    // Basic length guard to avoid abuse / runaway costs
    if (message.length > 1000) {
      return res.status(400).json({ error: "Message is too long." });
    }

    const safeHistory = Array.isArray(history) ? history.slice(-12) : [];

    // Convert our simple {role, content} history into Gemini's "contents" format.
    // Gemini expects roles "user" and "model" (not "assistant").
    const contents = safeHistory
      .filter((m) => m && typeof m.content === "string" && (m.role === "user" || m.role === "assistant"))
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

    // Append the latest guest message
    contents.push({ role: "user", parts: [{ text: message }] });

    const geminiRequestBody = {
      systemInstruction: {
        parts: [{ text: HOTEL_SYSTEM_PROMPT }],
      },
      contents,
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 400,
      },
    };

    const geminiResponse = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geminiRequestBody),
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error("Gemini API error:", geminiResponse.status, errorText);
      return res.status(502).json({
        error: "The assistant is temporarily unavailable. Please contact reception directly.",
      });
    }

    const geminiData = await geminiResponse.json();

    const reply =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
      "I'm sorry, I couldn't come up with an answer just now. Please contact our reception for help.";

    return res.status(200).json({ reply });
  } catch (err) {
    console.error("Unexpected error in /api/chat:", err);
    return res.status(500).json({
      error: "Something went wrong. Please try again or contact the hotel directly.",
    });
  }
}