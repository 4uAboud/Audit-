module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  const send = (status, obj) => { res.statusCode = status; res.end(JSON.stringify(obj)); };

  try {
    if (req.method === 'OPTIONS') { res.statusCode = 200; res.end('{}'); return; }
    if (req.method !== 'POST') { send(405, { error: 'Method not allowed' }); return; }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) { send(500, { error: 'API key not configured.' }); return; }

    let bodyStr;
    if (req.body && typeof req.body === 'object') {
      bodyStr = JSON.stringify(req.body);
    } else if (typeof req.body === 'string') {
      bodyStr = req.body;
    } else {
      bodyStr = await new Promise((resolve, reject) => {
        let chunks = '';
        req.on('data', c => { chunks += c; });
        req.on('end', () => resolve(chunks));
        req.on('error', reject);
      });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 55000);

    let response;
    try {
      response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: bodyStr,
        signal: controller.signal
      });
    } finally {
      clearTimeout(timer);
    }

    const text = await response.text();
    let data;
    try { data = JSON.parse(text); }
    catch (e) { send(500, { error: 'Anthropic non-JSON: ' + text.slice(0, 200) }); return; }

    send(response.status, data);
  } catch (err) {
    send(500, { error: err.name === 'AbortError' ? 'Request timed out — try reducing image count or try again.' : err.message });
  }
};
