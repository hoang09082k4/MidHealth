import { config } from './config.js';

const SUPPORTED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    documentType: { type: 'STRING', enum: ['citizen', 'insurance', 'unknown'] },
    fullName: { type: 'STRING', nullable: true },
    dateOfBirth: { type: 'STRING', nullable: true },
    gender: { type: 'STRING', enum: ['male', 'female', 'other'], nullable: true },
    citizenId: { type: 'STRING', nullable: true },
    healthInsuranceNumber: { type: 'STRING', nullable: true },
    address: { type: 'STRING', nullable: true },
    province: { type: 'STRING', nullable: true },
    district: { type: 'STRING', nullable: true },
    ward: { type: 'STRING', nullable: true },
    nationality: { type: 'STRING', nullable: true },
    placeOfOrigin: { type: 'STRING', nullable: true },
    expiryDate: { type: 'STRING', nullable: true },
    validFrom: { type: 'STRING', nullable: true },
    validTo: { type: 'STRING', nullable: true },
    confidence: { type: 'NUMBER' },
    missingFields: { type: 'ARRAY', items: { type: 'STRING' } },
    warnings: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['documentType', 'confidence', 'missingFields', 'warnings'],
};

function cleanText(value, maxLength = 300) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text ? text.slice(0, maxLength) : '';
}

function cleanDate(value) {
  const text = cleanText(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return '';
  const date = new Date(`${text}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text ? '' : text;
}

function cleanDigits(value, lengths) {
  const digits = String(value || '').replace(/\D/g, '');
  return lengths.includes(digits.length) ? digits : '';
}

function parseStructuredResponse(data) {
  const text = data?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || '')
    .join('')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  if (!text) throw new Error('Dịch vụ nhận diện không trả về dữ liệu.');

  const objectStart = text.indexOf('{');
  const objectEnd = text.lastIndexOf('}');
  const jsonText = objectStart >= 0 && objectEnd > objectStart
    ? text.slice(objectStart, objectEnd + 1)
    : text;
  return JSON.parse(jsonText);
}

function inferAddressParts(address, province, district, ward) {
  const parts = cleanText(address, 300).split(',').map((part) => part.trim()).filter(Boolean);
  return {
    province: province || (parts.length >= 2 ? parts.at(-1) : ''),
    district: district || (parts.length >= 3 ? parts.at(-2) : ''),
    ward: ward || (parts.length >= 3 ? parts.at(-3) : ''),
  };
}

function normalizeResult(payload, requestedType) {
  const documentType = ['citizen', 'insurance'].includes(payload?.documentType)
    ? payload.documentType
    : requestedType;
  const address = cleanText(payload?.address, 300);
  const addressParts = inferAddressParts(
    address,
    cleanText(payload?.province, 80),
    cleanText(payload?.district, 80),
    cleanText(payload?.ward, 80),
  );
  const result = {
    documentType,
    fullName: cleanText(payload?.fullName, 120),
    dateOfBirth: cleanDate(payload?.dateOfBirth),
    gender: ['male', 'female', 'other'].includes(payload?.gender) ? payload.gender : '',
    citizenId: cleanDigits(payload?.citizenId, [9, 12]),
    healthInsuranceNumber: cleanText(payload?.healthInsuranceNumber, 20).replace(/[^A-Za-z0-9]/g, '').toUpperCase(),
    address,
    province: addressParts.province,
    district: addressParts.district,
    ward: addressParts.ward,
    nationality: cleanText(payload?.nationality, 80),
    placeOfOrigin: cleanText(payload?.placeOfOrigin, 200),
    expiryDate: cleanDate(payload?.expiryDate),
    validFrom: cleanDate(payload?.validFrom),
    validTo: cleanDate(payload?.validTo),
    confidence: Math.max(0, Math.min(1, Number(payload?.confidence) || 0)),
    missingFields: Array.isArray(payload?.missingFields) ? payload.missingFields.map((item) => cleanText(item, 60)).filter(Boolean).slice(0, 12) : [],
    warnings: Array.isArray(payload?.warnings) ? payload.warnings.map((item) => cleanText(item, 160)).filter(Boolean).slice(0, 8) : [],
  };

  const identityField = documentType === 'citizen' ? result.citizenId : result.healthInsuranceNumber;
  const recognizedCount = [identityField, result.fullName, result.dateOfBirth, result.gender, result.address].filter(Boolean).length;
  return { ...result, recognizedCount };
}

export async function scanMedicalCard(payload = {}) {
  if (!config.geminiApiKey) {
    return { ok: false, status: 503, data: { message: 'Dịch vụ nhận diện ảnh chưa được cấu hình GEMINI_API_KEY.' } };
  }

  const documentType = payload.documentType === 'insurance' ? 'insurance' : 'citizen';
  const mimeType = String(payload.mimeType || '').toLowerCase();
  const imageBase64 = String(payload.imageBase64 || '').replace(/^data:image\/[^;]+;base64,/, '');
  if (!SUPPORTED_MIME_TYPES.has(mimeType) || !/^[A-Za-z0-9+/=\r\n]+$/.test(imageBase64)) {
    return { ok: false, status: 400, data: { message: 'Ảnh không hợp lệ. Chỉ hỗ trợ JPG, PNG hoặc WebP.' } };
  }
  const approximateBytes = Math.floor(imageBase64.length * 0.75);
  if (!imageBase64 || approximateBytes > MAX_IMAGE_BYTES) {
    return { ok: false, status: 413, data: { message: 'Ảnh vượt quá giới hạn 5 MB sau khi xử lý.' } };
  }

  const requestedLabel = documentType === 'citizen' ? 'mặt trước CCCD/CMND Việt Nam' : 'mặt trước thẻ bảo hiểm y tế Việt Nam';
  const prompt = `
Bạn đang đọc ${requestedLabel} để hỗ trợ người dùng tự điền biểu mẫu y tế.
Hãy tự nhận hướng xoay của ảnh và đọc chính xác chữ tiếng Việt có dấu.
Chỉ lấy dữ liệu thực sự nhìn thấy trên ảnh. Không suy đoán, không tự bổ sung và không sửa số bằng kiến thức bên ngoài.
Ngày phải trả về YYYY-MM-DD. Giới tính trả về male, female hoặc other.
Địa chỉ là nơi thường trú/nơi cư trú trên CCCD; với BHYT chỉ lấy địa chỉ khi thực sự được in trên thẻ.
Với CCCD, số định danh thường có 12 chữ số; có thể đối chiếu QR nếu nhìn thấy nhưng không được bịa nội dung QR.
Với BHYT, lấy đúng mã số/mã thẻ được in cạnh nhãn Mã số hoặc Mã thẻ, không lấy ngày tháng làm mã.
missingFields liệt kê các trường quan trọng không đọc được. warnings mô tả ảnh mờ, lóa, cắt mất góc hoặc dữ liệu không chắc chắn.
confidence từ 0 đến 1 phản ánh độ chắc chắn tổng thể.
`.trim();

  const models = [...new Set([config.geminiModel, 'gemini-2.5-flash-lite'])];
  const requestRecognition = (model) => fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      signal: AbortSignal.timeout(30_000),
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': config.geminiApiKey,
      },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [
            { inlineData: { mimeType, data: imageBase64 } },
            { text: prompt },
          ],
        }],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 900,
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
        },
      }),
    },
  );

  try {
    let response;
    let parsed;
    let lastRequestError;
    for (const [index, model] of models.entries()) {
      response = undefined;
      const attempts = index === models.length - 1 ? 2 : 1;
      for (let attempt = 0; attempt < attempts; attempt += 1) {
        try {
          response = await requestRecognition(model);
        } catch (requestError) {
          lastRequestError = requestError;
          console.warn(`Card recognition model ${model} failed:`, requestError?.cause?.code || requestError?.message);
          continue;
        }

        if (!response.ok) break;
        const data = await response.json().catch(() => ({}));
        try {
          parsed = parseStructuredResponse(data);
          break;
        } catch (parseError) {
          lastRequestError = parseError;
          response = undefined;
          console.warn(`Card recognition model ${model} returned invalid JSON; retrying.`);
        }
      }

      if (parsed) break;
      const canUseFallback = index < models.length - 1
        && (!response || [429, 500, 502, 503, 504].includes(response.status));
      if (!canUseFallback) break;
      console.warn(`Card recognition model ${model} is unavailable; using fallback model.`);
    }

    if (parsed) {
      const result = normalizeResult(parsed, documentType);
      if (result.documentType !== documentType) {
        return { ok: false, status: 422, data: { message: `Ảnh đã chọn không phải ${documentType === 'citizen' ? 'CCCD/CMND' : 'thẻ BHYT'}.` } };
      }
      const hasIdentityNumber = documentType === 'citizen' ? result.citizenId : result.healthInsuranceNumber;
      if (!hasIdentityNumber || result.recognizedCount < 3) {
        return { ok: false, status: 422, data: { message: 'Ảnh chưa đủ rõ để lấy thông tin chính xác. Vui lòng tải ảnh chụp trọn thẻ, rõ chữ và không bị lóa.' } };
      }
      return { ok: true, status: 200, data: result };
    }

    if (!response) throw lastRequestError || new Error('No card recognition model was available.');
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = cleanText(data?.error?.message, 200);
      const serviceBusy = [429, 500, 502, 503, 504].includes(response.status);
      return {
        ok: false,
        status: response.status === 429 ? 429 : 502,
        data: {
          message: serviceBusy
            ? 'Dịch vụ nhận diện đang bận. Vui lòng thử lại sau ít phút.'
            : detail || 'Không thể nhận diện ảnh lúc này.',
        },
      };
    }
    throw lastRequestError || new Error('Dịch vụ nhận diện trả về dữ liệu không hợp lệ.');
  } catch (error) {
    console.error('Card recognition request failed:', error?.cause?.code || error?.message || error);
    const isTimeout = error?.name === 'TimeoutError' || error?.name === 'AbortError';
    return {
      ok: false,
      status: isTimeout ? 504 : 502,
      data: {
        message: isTimeout
          ? 'Dịch vụ nhận diện phản hồi quá chậm. Vui lòng thử lại sau ít phút.'
          : 'Không thể kết nối dịch vụ nhận diện ảnh. Vui lòng kiểm tra kết nối mạng của backend.',
      },
    };
  }
}
