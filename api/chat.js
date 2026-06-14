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
    }
  }

  const fullSystemPrompt = knowledgeBase
    ? `${systemPrompt}

--- LIVE FAQ KNOWLEDGE BASE (updated daily by restaurant owner) ---
${knowledgeBase}
--- END OF FAQ KNOWLEDGE BASE ---

IMPORTANT: If a customer's question closely matches one of the Q&A pairs above, use that exact answer. This data is more current than anything else in your instructions.`
    : systemPrompt;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const geminiMessages = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: fullSystemPrompt }] },
        contents: geminiMessages,
        generationConfig: { maxOutputTokens: 300, temperature: 0.7 }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Gemini API error:', JSON.stringify(data));
      return res.status(response.status).json({
        error: data.error?.message || 'Gemini API error',
        details: data.error
      });
    }

    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text
      || "Sorry, I couldn't process that. Please call us directly!";

    return res.status(200).json({ reply, usedKnowledgeBase: !!knowledgeBase });

  } catch (error) {
    console.error('Server error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}

// ── Convert published Google Sheet CSV into Q&A text block ──
function parseCSVToQA(csv) {
  const lines = csv.trim().split('\n');
  const rows = lines.slice(1);
  let result = '';
  for (const row of rows) {
    const cols = parseCSVLine(row);
    if (cols.length >= 2 && cols[0].trim()) {
      result += `Q: ${cols[0].trim()}\nA: ${cols[1].trim()}\n\n`;
    }
  }
  return result;
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
