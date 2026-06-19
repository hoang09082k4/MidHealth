import { apiBaseUrl } from './api_base';

function normalizeText(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase();
}

function includesAny(text, terms = []) {
  return terms.some((term) => text.includes(term));
}

function shouldOfferFollowupSuggestions(message = '') {
  const text = normalizeText(message);
  return includesAny(text, [
    'goi y',
    'gioi thieu',
    'huong dan',
    'cach',
    'nen',
    'tim',
    'chon',
    'dat lich',
    'dat kham',
    'xem',
    'mo',
    'khi nao',
    'co bac si',
    'co the kham',
  ]);
}

function isQuotaError(value = '') {
  const text = String(value).toLowerCase();
  return text.includes('quota')
    || text.includes('rate-limit')
    || text.includes('rate limit')
    || text.includes('generate_content_free_tier')
    || text.includes('you exceeded your current quota')
    || text.includes('generativelanguage.googleapis.com');
}

function contextualFallback(message = '') {
  const text = normalizeText(message);
  const actions = [];
  let suggestedPrompts = [];
  const canSuggest = shouldOfferFollowupSuggestions(message);

  if (includesAny(text, ['dat lich', 'dat kham', 'kham benh', 'bac si', 'benh vien', 'phong kham'])) {
    actions.push({ label: 'Về trang đặt khám', url: '/dat-kham/bac-si' });
    suggestedPrompts = canSuggest ? ['Tôi nên đặt khám chuyên khoa nào?', 'Gợi ý bác sĩ phù hợp', 'Xem phiếu khám điện tử'] : [];
  }

  if (includesAny(text, ['phieu kham', 'lich hen', 'ho so kham', 'ho so benh nhan'])) {
    actions.push({ label: 'Xem phiếu khám điện tử', url: '/phieu-kham-dien-tu' });
    suggestedPrompts = canSuggest ? ['Tôi muốn đặt lịch khám mới', 'Hướng dẫn đặt lịch khám'] : [];
  }

  if (includesAny(text, ['tin y te', 'bai viet', 'kien thuc suc khoe'])) {
    actions.push({ label: 'Mở Tin Y tế', url: '/tin-tuc' });
    suggestedPrompts = canSuggest ? ['Khi nào cần đi cấp cứu?'] : [];
  }

  if (includesAny(text, ['trieu chung', 'dau', 'benh', 'khoa nao', 'chuyen khoa nao', 'cap cuu', 'nguy hiem'])) {
    suggestedPrompts = canSuggest ? ['Gợi ý bác sĩ phù hợp', 'Hướng dẫn đặt lịch khám', 'Khi nào cần đi cấp cứu?'] : [];
  }

  const reply = [
    'Hiện phần AI tạo câu trả lời tự do đã tạm hết hạn mức sử dụng. Bạn có thể thử lại sau ít phút.',
    actions.length ? 'Tôi đã giữ lại các nút phù hợp với nội dung bạn vừa hỏi.' : '',
    includesAny(text, ['trieu chung', 'dau', 'benh', 'cap cuu', 'nguy hiem'])
      ? 'Nếu có triệu chứng nặng như khó thở, đau ngực, ngất, đau dữ dội hoặc tình trạng xấu đi nhanh, bạn nên đi cấp cứu ngay.'
      : '',
  ].filter(Boolean).join('\n');

  return {
    reply,
    intent: 'ai_unavailable',
    action: actions[0] || null,
    actions,
    suggestedPrompts,
  };
}

export async function sendChatbotMessage({ message, history, token }) {
  const response = await fetch(`${apiBaseUrl}/api/chatbot`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ message, history }),
  });

  const result = await response.json();
  if (!response.ok) {
    if (isQuotaError(result.message)) return contextualFallback(message);
    throw new Error(result.message || 'Trợ lý AI chưa sẵn sàng.');
  }

  if (isQuotaError(result.data?.reply || result.message)) {
    return contextualFallback(message);
  }

  return result.data;
}
