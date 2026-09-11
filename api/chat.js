// api/chat.js
// Hàm này chạy trên SERVER của Vercel, không chạy trên trình duyệt khách.
// API Key được đọc từ Environment Variables -> khách KHÔNG THỂ nhìn thấy key này
// dù có mở F12 / Developer Tools xem code.

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'Server chưa cấu hình ANTHROPIC_API_KEY. Vào Vercel > Settings > Environment Variables để thêm.'
    });
  }

  try {
    const { system, messages } = req.body;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        system: system,
        messages: messages
      })
    });

    const data = await response.json();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Lỗi gọi AI: ' + err.message });
  }
};
