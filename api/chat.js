export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not set in environment variables' });
  }

  const { messages, systemPrompt } = req.body;
  if (!messages || !systemPrompt) {
    return res.status(400).json({ error: 'Missing messages or systemPrompt' });
  }

  // ── Fetch live knowledge base from Google Sheet (published as CSV) ──
  let knowledgeBase = '';
  const sheetUrl = process.env.KNOWLEDGE_SHEET_URL;

  if (sheetUrl) {
    try {
      const csvRes = await fetch(sheetUrl);
      const csvText = await csvRes.text();
      knowledgeBase = parseCSVToQA(csvText);
    } catch (e) {
      console.error('Sheet fetch error:', e.message);
      // If sheet fails, chatbot still works using base systemPrompt only
    }
  }

  // ── Fetch live menu from a second Google Sheet tab (published as CSV) ──
  let menuBlock = '';
  const menuSheetUrl = process.env.MENU_SHEET_URL;

  if (menuSheetUrl) {
    try {
      const menuCsvRes = await fetch(menuSheetUrl);
      const menuCsvText = await menuCsvRes.text();
      menuBlock = parseCSVToMenu(menuCsvText);
    } catch (e) {
      console.error('Menu sheet fetch error:', e.message);
    }
  }

  let fullSystemPrompt = systemPrompt;

  if (menuBlock) {
    fullSystemPrompt += `

--- LIVE MENU (updated by restaurant owner, this is the current and correct menu) ---
${menuBlock}
--- END OF LIVE MENU ---

IMPORTANT: The menu above is the definitive, up-to-date menu. Use these exact dishes, prices, and categories when answering menu questions — ignore any older menu info in your earlier instructions.`;
  }

  if (knowledgeBase) {
    fullSystemPrompt += `

--- LIVE FAQ KNOWLEDGE BASE (updated daily by restaurant owner) ---
${knowledgeBase}
--- END OF FAQ KNOWLEDGE BASE ---

IMPORTANT: If a customer's question closely matches one of the Q&A pairs above, use that exact answer. This data is more current than anything else in your instructions.`;
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    // Keep only the most recent messages to control prompt size and avoid rate limits
    const recentMessages = messages.slice(-10);
    const geminiMessages = recentMessages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: fullSystemPrompt }] },
        contents: geminiMessages,
        generationConfig: {
          maxOutputTokens: 800,
          temperature: 0.6,
          topP: 0.9,
          // Disable "thinking" tokens — for a simple FAQ/menu bot these just
          // eat into maxOutputTokens and cause replies to cut off mid-sentence.
          thinkingConfig: { thinkingBudget: 0 }
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Gemini API error:', JSON.stringify(data));

      // Give the customer a sensible message instead of a raw error.
      // Rate limit (free tier = 10 requests/min) is the most common cause.
      let friendlyReply;
      if (response.status === 429) {
        friendlyReply = "We're getting a lot of questions right now. Please wait a few seconds and try again, or call us at 022 2820 2735.";
      } else {
        friendlyReply = "I'm unable to retrieve that information right now. Please try again in a moment, or call us at 022 2820 2735.";
      }

      // Return 200 with a reply field so the frontend always shows something coherent
      return res.status(200).json({
        reply: friendlyReply,
        error: data.error?.message,
        statusCode: response.status
      });
    }

    const candidate = data.candidates?.[0];
    const finishReason = candidate?.finishReason;
    let reply = candidate?.content?.parts?.[0]?.text;

    if (!reply) {
      console.error('Empty response from Gemini. finishReason:', finishReason, JSON.stringify(data));
      reply = "Sorry, that took a moment too long to process. Could you ask again?";
    }

    return res.status(200).json({ reply, usedKnowledgeBase: !!knowledgeBase, finishReason });

  } catch (error) {
    console.error('Server error:', error.message);
    return res.status(200).json({
      reply: "I'm having trouble connecting right now. Please try again in a moment, or call us at 022 2820 2735.",
      error: error.message
    });
  }
}

// ── Convert published Google Sheet CSV into Q&A text block ──
function parseCSVToQA(csv) {
  const lines = csv.trim().split('\n');
  const rows = lines.slice(1); // skip header row (Question, Answer)
  let result = '';
  for (const row of rows) {
    const cols = parseCSVLine(row);
    if (cols.length >= 2 && cols[0].trim()) {
      result += `Q: ${cols[0].trim()}\nA: ${cols[1].trim()}\n\n`;
    }
  }
  return result;
}

// ── Convert published Google Sheet CSV into a grouped menu text block ──
// Expected columns (header row): Category, Dish, Price, Description, Available
// Description and Available are optional. Available = "N"/"No" hides the item.
function parseCSVToMenu(csv) {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return '';

  const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());
  const catIdx = headers.indexOf('category');
  const dishIdx = headers.indexOf('dish');
  const priceIdx = headers.indexOf('price');
  const descIdx = headers.indexOf('description');
  const availIdx = headers.indexOf('available');

  if (dishIdx === -1) return ''; // sheet not in expected format

  const menu = {};
  const order = []; // preserve category order as they appear

  for (const row of lines.slice(1)) {
    const cols = parseCSVLine(row);
    const dish = (cols[dishIdx] || '').trim();
    if (!dish) continue;

    if (availIdx !== -1) {
      const avail = (cols[availIdx] || '').trim().toLowerCase();
      if (avail === 'n' || avail === 'no') continue;
    }

    const category = catIdx !== -1 && cols[catIdx]?.trim() ? cols[catIdx].trim() : 'Menu';
    const price = priceIdx !== -1 ? (cols[priceIdx] || '').trim() : '';
    const desc = descIdx !== -1 ? (cols[descIdx] || '').trim() : '';

    let line = `- ${dish}`;
    if (price) line += ` — ₹${price}`;
    if (desc) line += ` (${desc})`;

    if (!menu[category]) {
      menu[category] = [];
      order.push(category);
    }
    menu[category].push(line);
  }

  let result = '';
  for (const category of order) {
    result += `${category}:\n${menu[category].join('\n')}\n\n`;
  }
  return result.trim();
}

// Handles commas inside quoted fields correctly
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current); current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}
