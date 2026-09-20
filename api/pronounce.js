// api/pronounce.js
// Nhận audio WAV (base64, 16kHz mono PCM) + văn bản mẫu từ trình duyệt,
// gửi lên Azure Speech để chấm điểm phát âm chi tiết đến từng âm (phoneme).
// API Key đọc từ Environment Variables trên Vercel -> khách không nhìn thấy được.

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const key = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION;
  if (!key || !region) {
    return res.status(500).json({
      error: 'Server chưa cấu hình AZURE_SPEECH_KEY / AZURE_SPEECH_REGION. Vào Vercel > Settings > Environment Variables để thêm (xem README-azure.md).'
    });
  }

  try {
    const { audioBase64, referenceText } = req.body;
    if (!audioBase64) return res.status(400).json({ error: 'Thiếu dữ liệu âm thanh' });
    if (!referenceText) return res.status(400).json({ error: 'Thiếu văn bản mẫu để so sánh' });

    const audioBuffer = Buffer.from(audioBase64, 'base64');

    const pronAssessmentConfig = Buffer.from(JSON.stringify({
      ReferenceText: referenceText,
      GradingSystem: 'HundredMark',
      Granularity: 'Phoneme',
      EnableMiscue: true,
      Dimension: 'Comprehensive',
    })).toString('base64');

    const url = `https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1` +
      `?language=en-US&format=detailed`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    const azureRes = await fetch(url, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': key,
        'Content-Type': 'audio/wav; codecs=audio/pcm; samplerate=16000',
        'Accept': 'application/json',
        'Pronunciation-Assessment': pronAssessmentConfig,
      },
      body: audioBuffer,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const data = await azureRes.json();

    if (data.RecognitionStatus && data.RecognitionStatus !== 'Success') {
      return res.status(200).json({ error: 'Không nghe rõ giọng nói, thử lại gần micro hơn nhé.' });
    }

    const nbest = (data.NBest && data.NBest[0]) || null;
    if (!nbest) {
      return res.status(200).json({ error: 'Không nhận được kết quả chấm điểm, thử lại nhé.' });
    }

    const pa = nbest.PronunciationAssessment || {};
    const words = (nbest.Words || []).map(w => ({
      word: w.Word,
      accuracyScore: (w.PronunciationAssessment && w.PronunciationAssessment.AccuracyScore) || 0,
      errorType: (w.PronunciationAssessment && w.PronunciationAssessment.ErrorType) || 'None',
      phonemes: (w.Phonemes || []).map(p => ({
        phoneme: p.Phoneme,
        accuracyScore: (p.PronunciationAssessment && p.PronunciationAssessment.AccuracyScore) || 0,
      })),
    }));

    return res.status(200).json({
      overallScore: pa.PronScore || 0,
      accuracyScore: pa.AccuracyScore || 0,
      fluencyScore: pa.FluencyScore || 0,
      completenessScore: pa.CompletenessScore || 0,
      words,
    });
  } catch (err) {
    const msg = err.name === 'AbortError'
      ? 'Chấm điểm mất quá lâu, thử lại với đoạn ngắn hơn nhé.'
      : ('Lỗi gọi Azure: ' + err.message);
    return res.status(500).json({ error: msg });
  }
};
