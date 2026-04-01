const https = require('https');

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  const send = (status, obj) => {
    res.statusCode = status;
    res.end(JSON.stringify(obj));
  };

  try {
    if (req.method === 'OPTIONS') { res.statusCode = 200; res.end('{}'); return; }
    if (req.method !== 'POST') { send(405, { error: 'Method not allowed' }); return; }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) { send(500, { error: 'API key not configured.' }); return; }

    // Read body manually — req.body may be undefined for large payloads
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

    const result = await new Promise((resolve, reject) => {
      const buf = Buffer.from(bodyStr, 'utf8');
      const options = {
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Length': buf.length
        }
      };
      const request = https.request(options, (response) => {
        let raw = '';
        response.on('data', chunk => { raw += chunk; });
        response.on('end', () => {
          try { resolve({ status: response.statusCode, data: JSON.parse(raw) }); }
          catch (e) { reject(new Error('Anthropic non-JSON: ' + raw.slice(0, 300))); }
        });
      });
      request.on('error', reject);
      request.write(buf);
      request.end();
    });

    send(result.status, result.data);
  } catch (err) {
    send(500, { error: err.message || 'Unknown error' });
  }
};
