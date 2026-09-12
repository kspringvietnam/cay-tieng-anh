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
    const { system, messages, max_tokens } = req.body;
    // Cho phép client chỉ định max_tokens theo nhu cầu (câu ngắn thì nhỏ, dịch phụ đề dài thì lớn hơn),
    // nhưng luôn giới hạn trong khoảng an toàn để tránh vượt thời gian chờ của Vercel serverless.
    const safeMaxTokens = Math.max(200, Math.min(parseInt(max_tokens) || 800, 4096));

    // Bỏ qua request nếu client hủy (đóng tab / chuyển bài trong lúc đang chờ)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000); // tự hủy sau 25s tránh treo vô hạn

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: safeMaxTokens,
        system: system,
        messages: messages
      }),
      signal: controller.signal
    });
    clearTimeout(timeout);

    const data = await response.json();
    if(data.type === 'error'){
      return res.status(response.status).json({ error: (data.error && data.error.message) || 'Lỗi từ Anthropic API' });
    }
    return res.status(200).json(data);
  } catch (err) {
    const msg = err.name === 'AbortError' ? 'Yêu cầu mất quá lâu, thử lại với đoạn ngắn hơn nhé.' : ('Lỗi gọi AI: ' + err.message);
    return res.status(500).json({ error: msg });
  }
};
