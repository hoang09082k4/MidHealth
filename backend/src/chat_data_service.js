import { hasSupabaseConfig, supabase } from './supabase.js';

const fallbackKnowledge = [
  {
    keywords: ['midhealth la gi', 'website nay la gi', 'ban la ai', 'tro ly la gi'],
    intent: 'knowledge_about_midhealth',
    reply: 'MidHealth là website hỗ trợ đặt lịch khám trực tuyến. Bạn có thể tìm bác sĩ, chuyên khoa, bệnh viện hoặc phòng khám phù hợp, chọn khung giờ khám và theo dõi phiếu khám điện tử.',
    actions: [],
    suggestedPrompts: ['Hướng dẫn đặt lịch khám', 'Tôi nên đặt khám chuyên khoa nào?'],
    priority: 10,
  },
  {
    keywords: ['co can dang nhap', 'dang nhap de lam gi', 'tai khoan de lam gi'],
    intent: 'knowledge_account',
    reply: 'Bạn nên đăng nhập để lưu hồ sơ bệnh nhân, đặt lịch nhanh hơn, xem lịch đã đặt và theo dõi phiếu khám điện tử. Nếu chỉ xem thông tin cơ bản, bạn vẫn có thể tham khảo trước trên website.',
    actions: [{ label: 'Đăng nhập', url: '/dang-nhap' }, { label: 'Đăng ký tài khoản', url: '/dang-ky' }],
    suggestedPrompts: ['Hướng dẫn đặt lịch khám', 'Xem phiếu khám điện tử'],
    priority: 20,
  },
  {
    keywords: ['phieu kham dien tu la gi', 'phieu kham', 'lich kham cua toi', 'xem lich hen'],
    intent: 'knowledge_ticket',
    reply: 'Phiếu khám điện tử giúp bạn xem thông tin lịch hẹn, người đi khám, cơ sở khám, thời gian khám và trạng thái lịch đã đặt. Thông tin này cần đăng nhập để bảo vệ dữ liệu bệnh nhân.',
    actions: [{ label: 'Xem phiếu khám điện tử', url: '/phieu-kham-dien-tu' }],
    suggestedPrompts: ['Tôi muốn đặt lịch khám mới', 'Tôi cần đăng nhập không?'],
    priority: 30,
  },
  {
    keywords: ['cach dat lich', 'huong dan dat lich', 'dat lich nhu the nao', 'dat kham nhu the nao'],
    intent: 'knowledge_booking_guide',
    reply: 'Để đặt lịch trên MidHealth, bạn chọn hướng đặt khám theo chuyên khoa, bác sĩ, bệnh viện hoặc phòng khám. Sau đó chọn khung giờ còn trống, nhập hồ sơ bệnh nhân, kiểm tra thông tin và xác nhận lịch hẹn.',
    actions: [{ label: 'Về trang đặt khám', url: '/dat-kham/bac-si' }],
    suggestedPrompts: ['Tôi nên đặt khám chuyên khoa nào?', 'Gợi ý bác sĩ phù hợp'],
    priority: 40,
  },
  {
    keywords: ['huy lich', 'doi lich', 'sua lich', 'huy hen'],
    intent: 'knowledge_appointment_change',
    reply: 'Bạn có thể vào phiếu khám điện tử để xem trạng thái lịch hẹn. Nếu lịch còn cho phép thao tác, bạn có thể hủy lịch trực tiếp. Với nhu cầu đổi lịch, bạn nên hủy lịch cũ nếu phù hợp rồi đặt lại khung giờ mới.',
    actions: [{ label: 'Xem phiếu khám điện tử', url: '/phieu-kham-dien-tu' }],
    suggestedPrompts: ['Hướng dẫn đặt lịch khám'],
    priority: 50,
  },
  {
    keywords: ['thanh toan', 'phi kham', 'gia kham', 'bao hiem', 'bhyt'],
    intent: 'knowledge_payment',
    reply: 'Chi phí khám có thể khác nhau theo bác sĩ, chuyên khoa, cơ sở khám và dịch vụ đi kèm. Nếu có thông tin bảo hiểm hoặc ưu đãi trong quy trình đặt khám, MidHealth sẽ hiển thị để bạn kiểm tra trước khi xác nhận.',
    actions: [{ label: 'Về trang đặt khám', url: '/dat-kham/bac-si' }],
    suggestedPrompts: ['Gợi ý bác sĩ phù hợp', 'Hướng dẫn đặt lịch khám'],
    priority: 60,
  },
  {
    keywords: ['bao mat', 'thong tin ca nhan', 'du lieu benh nhan', 'ho so benh nhan'],
    intent: 'knowledge_privacy',
    reply: 'Thông tin hồ sơ bệnh nhân và phiếu khám điện tử cần đăng nhập để hạn chế người khác xem nhầm dữ liệu của bạn. Bạn nên kiểm tra kỹ thông tin người đi khám trước khi xác nhận lịch.',
    actions: [{ label: 'Đăng nhập', url: '/dang-nhap' }],
    suggestedPrompts: ['Xem phiếu khám điện tử'],
    priority: 70,
  },
  {
    keywords: ['cam on', 'thanks', 'thank you'],
    intent: 'small_talk_thanks',
    reply: 'Không có gì. Nếu cần hỗ trợ thêm, bạn cứ nhắn nội dung mình đang thắc mắc.',
    actions: [],
    suggestedPrompts: [],
    priority: 80,
  },
];

const fallbackRules = [
  {
    symptomKeywords: ['dau bung', 'tieu chay', 'tao bon', 'day hoi', 'non', 'buon non', 'da day'],
    specialtyKeywords: ['tieu hoa', 'noi tong quat'],
    severity: 'normal',
    adviceText: 'Nếu đau bụng dữ dội, sốt cao, nôn liên tục, đi ngoài ra máu hoặc ngất, bạn nên đi cấp cứu ngay.',
    priority: 10,
  },
  {
    symptomKeywords: ['kho tho', 'dau nguc', 'ngat'],
    specialtyKeywords: ['ho hap', 'tim mach', 'noi tong quat'],
    severity: 'urgent',
    adviceText: 'Đây có thể là dấu hiệu cần cấp cứu. Nếu triệu chứng đang xảy ra, hãy gọi 115 hoặc đến cơ sở y tế gần nhất.',
    priority: 5,
  },
  {
    symptomKeywords: ['ho', 'viem hong', 'hen'],
    specialtyKeywords: ['ho hap', 'tai mui hong', 'noi tong quat'],
    severity: 'normal',
    adviceText: 'Nếu khó thở, tím tái, đau ngực hoặc sốt cao kéo dài, bạn nên đi khám sớm hoặc cấp cứu.',
    priority: 30,
  },
  {
    symptomKeywords: ['dau dau', 'mat ngu', 'chong mat'],
    specialtyKeywords: ['noi than kinh', 'noi tong quat'],
    severity: 'normal',
    adviceText: 'Nếu đau đầu dữ dội đột ngột, yếu liệt, nói khó hoặc mất ý thức, bạn nên đi cấp cứu ngay.',
    priority: 20,
  },
  {
    symptomKeywords: ['da', 'mun', 'ngua', 'di ung', 'phat ban'],
    specialtyKeywords: ['da lieu'],
    severity: 'normal',
    adviceText: 'Nếu phát ban lan nhanh, khó thở hoặc sưng môi/mặt, bạn nên đi cấp cứu ngay.',
    priority: 40,
  },
  {
    symptomKeywords: ['tim', 'huyet ap', 'hoi hop'],
    specialtyKeywords: ['tim mach', 'noi tong quat'],
    severity: 'normal',
    adviceText: 'Nếu đau ngực, khó thở, vã mồ hôi lạnh hoặc ngất, bạn nên đi cấp cứu ngay.',
    priority: 50,
  },
  {
    symptomKeywords: ['tre em', 'be', 'nhi'],
    specialtyKeywords: ['nhi khoa'],
    severity: 'normal',
    adviceText: 'Nếu trẻ li bì, khó thở, co giật hoặc sốt cao không hạ, bạn nên đưa trẻ đi cấp cứu.',
    priority: 60,
  },
  {
    symptomKeywords: ['thai', 'phu khoa', 'kinh nguyet'],
    specialtyKeywords: ['san phu khoa'],
    severity: 'normal',
    adviceText: 'Nếu đau bụng dữ dội khi mang thai, ra máu âm đạo hoặc choáng, bạn nên đi cấp cứu sản khoa ngay.',
    priority: 70,
  },
];

let rulesCache = {
  value: null,
  expiresAt: 0,
};

let knowledgeCache = {
  value: null,
  expiresAt: 0,
};

function normalizeSearchText(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase();
}

function hasTerm(text, term) {
  return new RegExp(`(^|\\s)${normalizeSearchText(term).replace(/\s+/g, '\\s+')}(\\s|$)`).test(text);
}

function hasLooseTerm(text, term) {
  const normalized = normalizeSearchText(term);
  return normalized.length > 2 && text.includes(normalized);
}

function mapRule(row) {
  return {
    symptomKeywords: row.symptom_keywords || row.symptomKeywords || [],
    specialtyKeywords: row.specialty_keywords || row.specialtyKeywords || [],
    severity: row.severity || 'normal',
    adviceText: row.advice_text || row.adviceText || '',
    priority: Number(row.priority || 100),
  };
}

export async function getSymptomRules() {
  const now = Date.now();
  if (rulesCache.value && now < rulesCache.expiresAt) return rulesCache.value;

  if (!hasSupabaseConfig) return fallbackRules;

  try {
    const { data, error } = await supabase
      .from('symptom_specialty_rules')
      .select('symptom_keywords, specialty_keywords, severity, advice_text, priority, is_active')
      .eq('is_active', true)
      .order('priority', { ascending: true });

    if (error) throw error;

    const rules = (data || []).map(mapRule).filter((rule) => rule.symptomKeywords.length && rule.specialtyKeywords.length);
    rulesCache = {
      value: rules.length ? rules : fallbackRules,
      expiresAt: now + 5 * 60 * 1000,
    };
    return rulesCache.value;
  } catch {
    rulesCache = {
      value: fallbackRules,
      expiresAt: now + 60 * 1000,
    };
    return fallbackRules;
  }
}

export async function findSymptomRule(message = '') {
  const text = normalizeSearchText(message);
  const rules = await getSymptomRules();
  return [...rules]
    .sort((a, b) => a.priority - b.priority)
    .find((rule) => rule.symptomKeywords.some((keyword) => hasTerm(text, keyword))) || null;
}

function mapKnowledge(row) {
  return {
    keywords: row.keywords || [],
    intent: row.intent || 'knowledge',
    reply: row.reply || '',
    actions: row.actions || [],
    suggestedPrompts: row.suggested_prompts || row.suggestedPrompts || [],
    priority: Number(row.priority || 100),
  };
}

export async function getKnowledgeBase() {
  const now = Date.now();
  if (knowledgeCache.value && now < knowledgeCache.expiresAt) return knowledgeCache.value;

  if (!hasSupabaseConfig) return fallbackKnowledge;

  try {
    const { data, error } = await supabase
      .from('chatbot_knowledge_base')
      .select('keywords, intent, reply, actions, suggested_prompts, priority, is_active')
      .eq('is_active', true)
      .order('priority', { ascending: true });

    if (error) throw error;

    const items = (data || []).map(mapKnowledge).filter((item) => item.keywords.length && item.reply);
    knowledgeCache = {
      value: items.length ? items : fallbackKnowledge,
      expiresAt: now + 5 * 60 * 1000,
    };
    return knowledgeCache.value;
  } catch {
    knowledgeCache = {
      value: fallbackKnowledge,
      expiresAt: now + 60 * 1000,
    };
    return fallbackKnowledge;
  }
}

export async function findKnowledgeAnswer(message = '') {
  const text = normalizeSearchText(message);
  const items = await getKnowledgeBase();
  return [...items]
    .sort((a, b) => a.priority - b.priority)
    .find((item) => item.keywords.some((keyword) => hasLooseTerm(text, keyword))) || null;
}

export async function logChatInteraction({ user, message, result }) {
  if (!hasSupabaseConfig || !message || !result?.data) return;

  try {
    await supabase.from('chatbot_interactions').insert({
      firebase_uid: user?.localId || null,
      user_message: String(message).slice(0, 2000),
      assistant_reply: String(result.data.reply || '').slice(0, 4000),
      intent: result.data.intent || null,
      model: result.data.model || null,
      actions: result.data.actions || (result.data.action ? [result.data.action] : []),
    });
  } catch {
    // Chat logging should never block the patient-facing response.
  }
}
