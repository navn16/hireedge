const Anthropic = require('@anthropic-ai/sdk');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { prompt, fileBase64, fileType } = req.body;

    if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

    // Trim key to remove any accidental whitespace
    const apiKey = (process.env.ANTHROPIC_API_KEY || '').trim();
    if (!apiKey) return res.status(500).json({ error: 'API key not configured', debug: 'empty key' });

    const client = new Anthropic({ apiKey });

    let messages;

    if (fileBase64 && fileType === 'pdf') {
      messages = [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: fileBase64 }
          },
          { type: 'text', text: prompt }
        ]
      }];
    } else {
      messages = [{ role: 'user', content: prompt }];
    }

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages
    });

    const text = response.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('');

    return res.status(200).json({ text });

  } catch (err) {
    console.error('Error:', err);
    return res.status(500).json({ error: err.message });
  }
};
