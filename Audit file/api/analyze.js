const https = require('https');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) { res.status(500).json({ error: 'API key not configured.' }); return; }

  try {
    const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

    const result = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Length': Buffer.byteLength(body)
        }
      };
      const request = https.request(options, (response) => {
        let raw = '';
        response.on('data', chunk => { raw += chunk; });
        response.on('end', () => {
          try { resolve({ status: response.statusCode, data: JSON.parse(raw) }); }
          catch (e) { reject(new Error('Anthropic returned non-JSON: ' + raw.slice(0, 200))); }
        });
      });
      request.on('error', reject);
      request.write(body);
      request.end();
    });

    res.status(result.status).json(result.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
