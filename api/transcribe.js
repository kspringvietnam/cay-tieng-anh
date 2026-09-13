// api/transcribe.js
// Nhận audio (base64) từ trình duyệt, gửi lên OpenAI để chuyển giọng nói thành chữ.
// API Key đọc từ Environment Variables trên Vercel -> khách không nhìn thấy được.

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'Server chưa cấu hình OPENAI_API_KEY. Vào Vercel > Settings > Environment Variables để thêm.'
    });
  }

  try {
    const { audioBase64, mimeType } = req.body;
    if (!audioBase64) {
      return res.status(400).json({ error: 'Thiếu dữ liệu âm thanh' });
    }

    const buffer = Buffer.from(audioBase64, 'base64');
    const blob = new Blob([buffer], { type: mimeType || 'audio/webm' });

    const formData = new FormData();
    formData.append('file', blob, 'recording.webm');
    // Dùng bản mini cho rẻ — đủ chính xác cho câu nói ngắn hằng ngày.
    formData.append('model', 'gpt-4o-mini-transcribe');
    // Không ép cứng 1 ngôn ngữ vì app khuyến khích học viên có thể nói cả tiếng Anh lẫn tiếng Việt.

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + apiKey },
      body: formData,
      signal: controller.signal
    });
    clearTimeout(timeout);

    const data = await response.json();
    if (data.error) {
      return res.status(response.status).json({ error: data.error.message || 'Lỗi từ OpenAI' });
    }
    return res.status(200).json({ text: data.text || '' });
  } catch (err) {
    const msg = err.name === 'AbortError'
      ? 'Nhận diện giọng nói mất quá lâu, thử lại với đoạn ngắn hơn nhé.'
      : ('Lỗi nhận diện giọng nói: ' + err.message);
    return res.status(500).json({ error: msg });
  }
};
