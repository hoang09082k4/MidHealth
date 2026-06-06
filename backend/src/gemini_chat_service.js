import { config } from './config.js';
import { getCatalog } from './catalog_service.js';
import { findOwnerProfile } from './appointment_service.js';
import { listClinicSlots, listDoctorSlots, listHospitalSlots } from './appointment_service.js';
import { findKnowledgeAnswer, findSymptomRule, logChatInteraction } from './chat_data_service.js';

export const hasGeminiConfig = Boolean(config.geminiApiKey);
let catalogContextCache = {
  value: '',
  catalog: null,
  expiresAt: 0,
};

const SYSTEM_PROMPT = `
Bạn là trợ lý AI của MidHealth, một website đặt lịch khám trực tuyến và đọc tin y tế.
Trả lời bằng tiếng Việt có dấu, ngắn gọn, dễ hiểu, thận trọng.
Không chẩn đoán bệnh, không kê đơn thuốc, không thay thế bác sĩ.
Không dùng markdown, không dùng ký tự nhấn mạnh như **, __, ###, không dùng dấu ba chấm.
Không gọi MidHealth là ứng dụng hoặc app. Luôn gọi là website MidHealth, trang MidHealth hoặc hệ thống đặt khám trực tuyến MidHealth.
Nếu cần liệt kê, hãy dùng câu văn ngắn hoặc gạch đầu dòng đơn giản bằng dấu "-".
Nếu người dùng có dấu hiệu nguy cấp như khó thở, đau ngực, ngất, đột quỵ, có ý định tự hại, chảy máu nhiều, sốt cao kéo dài hoặc đau dữ dội, hãy khuyên họ liên hệ cấp cứu 115 hoặc đến cơ sở y tế gần nhất.
Nếu câu hỏi liên quan đến đặt lịch, ưu tiên gợi ý chuyên khoa, bác sĩ, bệnh viện hoặc phòng khám có trong dữ liệu MidHealth.
Không nói rằng bạn không thể gợi ý bác sĩ, bệnh viện, phòng khám hoặc lịch khám nếu dữ liệu MidHealth đã được cung cấp trong prompt.
Chỉ trả về JSON hợp lệ, không markdown, theo dạng:
{"reply":"nội dung trả lời","intent":"general|book_specialty|book_doctor|book_hospital|book_clinic|emergency","action":{"label":"nhãn nút hoặc rỗng","url":"đường dẫn bắt đầu bằng / hoặc rỗng"},"actions":[{"label":"nhãn nút","url":"/duong-dan"}],"suggestedPrompts":["câu hỏi gợi ý tiếp theo"]}
Nếu không có action phù hợp, đặt action là null và actions là [].
suggestedPrompts có tối đa 4 câu, ngắn gọn, đúng ngữ cảnh câu hỏi hiện tại.
`.trim();

function slugify(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0111/g, 'd')
    .replace(/\u0110/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'dat-kham';
}

function bookingUrl(kind, item) {
  const kindPaths = {
    doctor: 'bac-si',
    hospital: 'benh-vien',
    clinic: 'phong-kham',
    specialty: 'chuyen-khoa',
  };
  const slug = item?.slug || item?.id || slugify(item?.name || item?.specialty || item?.title || '');
  return `/dat-kham/${kindPaths[kind]}/${encodeURIComponent(slug)}`;
}

function compactList(items = [], mapper, limit = 10) {
  return items.slice(0, limit).map(mapper).filter(Boolean).join('\n');
}

async function getCatalogSnapshot() {
  const now = Date.now();
  if (catalogContextCache.catalog && now < catalogContextCache.expiresAt) {
    return {
      ok: true,
      data: catalogContextCache.catalog,
    };
  }

  const result = await getCatalog();
  if (!result.ok) return result;

  catalogContextCache.catalog = result.data;
  catalogContextCache.expiresAt = now + 5 * 60 * 1000;
  return result;
}

async function buildCatalogContext() {
  const now = Date.now();
  if (catalogContextCache.value && now < catalogContextCache.expiresAt) {
    return catalogContextCache.value;
  }

  const result = await getCatalogSnapshot();
  if (!result.ok) {
    return 'Dữ liệu MidHealth hiện chưa sẵn sàng. Nếu cần đặt lịch, hướng dẫn người dùng chọn chuyên khoa trên giao diện.';
  }

  const { doctors = [], hospitals = [], clinics = [], specialties = [] } = result.data || {};
  const specialtyLines = compactList(
    specialties,
    (item) => `- ${item.name} | ${bookingUrl('specialty', item)}`,
    16,
  );
  const doctorLines = compactList(
    doctors,
    (item) => `- ${item.name} | ${item.specialty || 'Chưa rõ chuyên khoa'} | ${item.workplace || item.address || 'MidHealth'} | ${bookingUrl('doctor', item)}`,
    12,
  );
  const hospitalLines = compactList(
    hospitals,
    (item) => `- ${item.name} | ${item.address || 'Chưa có địa chỉ'} | ${bookingUrl('hospital', item)}`,
    8,
  );
  const clinicLines = compactList(
    clinics,
    (item) => `- ${item.name} | ${(item.specialties || []).slice(0, 3).join(', ') || 'Đa khoa'} | ${bookingUrl('clinic', item)}`,
    8,
  );

  const context = `
Dữ liệu MidHealth để gợi ý đặt lịch:
Chuyên khoa:
${specialtyLines || '- Chưa có dữ liệu'}
Bác sĩ:
${doctorLines || '- Chưa có dữ liệu'}
Bệnh viện:
${hospitalLines || '- Chưa có dữ liệu'}
Phòng khám:
${clinicLines || '- Chưa có dữ liệu'}
`.trim();

  catalogContextCache = {
    ...catalogContextCache,
    value: context,
    expiresAt: now + 5 * 60 * 1000,
  };

  return context;
}

function normalizeSearchText(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase();
}

function todayValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function addDaysValue(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function parseRequestedSchedule(message = '') {
  const text = normalizeSearchText(message);
  const timeMatch = text.match(/(?:luc\s*)?(\d{1,2})(?:h|:)(\d{1,2})?|(\d{1,2})\s*gio/);
  const hour = Number(timeMatch?.[1] || timeMatch?.[3] || '');
  const minute = Number(timeMatch?.[2] || 0);
  const hasExplicitTime = Boolean(timeMatch && (timeMatch[0].includes('h') || timeMatch[0].includes(':') || timeMatch[0].includes('gio') || timeMatch[0].includes('luc')));
  const hasValidTime = hasExplicitTime && Number.isInteger(hour) && hour >= 0 && hour <= 23;

  let date = '';
  if (text.includes('ngay mai') || text.includes('mai')) {
    date = addDaysValue(1);
  } else if (text.includes('hom nay')) {
    date = todayValue();
  }

  return {
    date,
    time: hasValidTime ? `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}` : '',
  };
}

function inferSpecialtyKeywords(message = '') {
  const text = normalizeSearchText(message);
  const rules = [
    { match: ['dau bung', 'tieu chay', 'tao bon', 'day hoi', 'non', 'buon non', 'da day'], keywords: ['tieu hoa', 'noi tong quat'] },
    { match: ['ho', 'kho tho', 'viem hong', 'hen'], keywords: ['ho hap', 'tai mui hong', 'noi tong quat'] },
    { match: ['dau dau', 'mat ngu', 'chong mat'], keywords: ['noi than kinh', 'noi tong quat'] },
    { match: ['da', 'mun', 'ngua', 'di ung', 'phat ban'], keywords: ['da lieu'] },
    { match: ['tim', 'huyet ap', 'dau nguc'], keywords: ['tim mach', 'noi tong quat'] },
    { match: ['tre em', 'be', 'nhi'], keywords: ['nhi khoa'] },
    { match: ['thai', 'phu khoa', 'kinh nguyet'], keywords: ['san phu khoa'] },
  ];

  const hasTerm = (term) => new RegExp(`(^|\\s)${term.replace(/\s+/g, '\\s+')}(\\s|$)`).test(text);
  const matched = rules.find((rule) => rule.match.some((item) => hasTerm(item)));
  return matched?.keywords || [];
}

async function inferSymptomRule(message = '') {
  const dataRule = await findSymptomRule(message);
  if (dataRule) return dataRule;

  const specialtyKeywords = inferSpecialtyKeywords(message);
  if (!specialtyKeywords.length) return null;

  return {
    specialtyKeywords,
    severity: 'normal',
    adviceText: '',
  };
}

function displaySpecialtyKeyword(keyword) {
  const labels = {
    'tieu hoa': 'Tiêu hóa',
    'noi tong quat': 'Nội tổng quát',
    'ho hap': 'Hô hấp',
    'tai mui hong': 'Tai mũi họng',
    'noi than kinh': 'Nội thần kinh',
    'da lieu': 'Da liễu',
    'tim mach': 'Tim mạch',
    'nhi khoa': 'Nhi khoa',
    'san phu khoa': 'Sản phụ khoa',
  };
  return labels[keyword] || keyword;
}

function displayDate(value = '') {
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

function requestedEntityType(message = '') {
  const text = normalizeSearchText(message);
  if (text.includes('benh vien')) return 'hospital';
  if (text.includes('phong kham')) return 'clinic';
  if (text.includes('bac si') || text.includes('bác sĩ')) return 'doctor';
  return text.includes('goi y') || text.includes('dat kham') || text.includes('kham') ? 'doctor' : '';
}

function includesAny(text, terms = []) {
  return terms.some((term) => text.includes(term));
}

function routeAction(label, url) {
  return { label, url };
}

function shouldOfferFollowupSuggestions(message = '') {
  const text = normalizeSearchText(message);
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

async function buildBookingStartResponse(message) {
  const catalogResult = await getCatalogSnapshot();
  const specialties = catalogResult.ok ? catalogResult.data?.specialties || [] : [];
  const preferredSpecialties = ['noi tong quat', 'tieu hoa', 'nhi khoa', 'tai mui hong', 'da lieu', 'san phu khoa'];
  const orderedSpecialties = [
    ...preferredSpecialties
      .map((keyword) => specialties.find((item) => normalizeSearchText(item.name).includes(keyword)))
      .filter(Boolean),
    ...specialties,
  ].filter((item, index, list) => item?.id && list.findIndex((candidate) => candidate.id === item.id) === index);
  const actions = orderedSpecialties.slice(0, 4).map((item) => routeAction(`Đặt khám ${item.name}`, bookingUrl('specialty', item)));

  return {
    ok: true,
    status: 200,
    data: {
      reply: cleanAssistantText([
        'Bạn có thể bắt đầu đặt khám trên MidHealth theo 3 cách. Nếu chưa biết nên chọn chuyên khoa nào, hãy mô tả triệu chứng chính để tôi gợi ý sát hơn.',
        '1. Chọn chuyên khoa nếu bạn biết nhóm bệnh cần khám.',
        '2. Chọn bác sĩ nếu bạn đã có bác sĩ mong muốn.',
        '3. Chọn bệnh viện hoặc phòng khám nếu bạn muốn khám theo cơ sở.',
        'Sau khi chọn nơi khám, MidHealth sẽ hiển thị lịch trống để bạn chọn ngày giờ và hoàn tất phiếu đặt khám.',
      ].join('\n')),
      intent: 'navigation_booking',
      action: actions[0] || routeAction('Về trang đặt khám', '/dat-kham/bac-si'),
      actions: actions.length ? actions : [routeAction('Về trang đặt khám', '/dat-kham/bac-si')],
      model: 'midhealth-navigation',
    },
  };
}

async function buildSpecialtyChoiceResponse(message) {
  const catalogResult = await getCatalogSnapshot();
  const specialties = catalogResult.ok ? catalogResult.data?.specialties || [] : [];
  const preferredSpecialties = ['noi tong quat', 'tieu hoa', 'nhi khoa', 'tai mui hong', 'da lieu', 'san phu khoa'];
  const orderedSpecialties = [
    ...preferredSpecialties
      .map((keyword) => specialties.find((item) => normalizeSearchText(item.name).includes(keyword)))
      .filter(Boolean),
    ...specialties,
  ].filter((item, index, list) => item?.id && list.findIndex((candidate) => candidate.id === item.id) === index);
  const actions = orderedSpecialties.slice(0, 4).map((item) => routeAction(`Đặt khám ${item.name}`, bookingUrl('specialty', item)));

  return {
    ok: true,
    status: 200,
    data: {
      reply: cleanAssistantText([
        'Nếu bạn chưa chắc nên đặt khám chuyên khoa nào, hãy bắt đầu từ triệu chứng chính. Bạn có thể nhắn ngắn gọn như "đau bụng", "đau đầu", "ho kéo dài", "ngứa da" hoặc "bé bị sốt" để tôi gợi ý sát hơn.',
        'Một vài hướng tham khảo nhanh:',
        '1. Đau bụng, đầy hơi, tiêu chảy hoặc buồn nôn: ưu tiên Tiêu hóa hoặc Nội tổng quát.',
        '2. Ho, đau họng, nghẹt mũi hoặc khó thở nhẹ: có thể xem Hô hấp hoặc Tai mũi họng.',
        '3. Mụn, ngứa, phát ban hoặc dị ứng da: có thể xem Da liễu.',
        '4. Trẻ em bị sốt, ho, rối loạn tiêu hóa: nên xem Nhi khoa.',
        'Nếu triệu chứng nặng, đau dữ dội, khó thở, ngất hoặc diễn tiến nhanh, bạn nên đi cấp cứu hoặc gọi 115.',
      ].join('\n')),
      intent: 'navigation_specialty_choice',
      action: actions[0] || routeAction('Về trang đặt khám', '/dat-kham/bac-si'),
      actions: actions.length ? actions : [routeAction('Về trang đặt khám', '/dat-kham/bac-si')],
      suggestedPrompts: shouldOfferFollowupSuggestions(message) ? [
        'Tôi bị đau bụng nên khám khoa nào?',
        'Tôi bị ho kéo dài nên khám khoa nào?',
        'Gợi ý bác sĩ phù hợp',
        'Khi nào cần đi cấp cứu?',
      ] : [],
      model: 'midhealth-navigation',
    },
  };
}

async function buildBookingGuideResponse(message) {
  const catalogResult = await getCatalogSnapshot();
  const specialties = catalogResult.ok ? catalogResult.data?.specialties || [] : [];
  const preferredSpecialties = ['noi tong quat', 'tieu hoa', 'nhi khoa', 'da lieu'];
  const specialtyActions = preferredSpecialties
    .map((keyword) => specialties.find((item) => normalizeSearchText(item.name).includes(keyword)))
    .filter(Boolean)
    .slice(0, 3)
    .map((item) => routeAction(`Đặt khám ${item.name}`, bookingUrl('specialty', item)));
  const actions = [
    routeAction('Về trang đặt khám', '/dat-kham/bac-si'),
    ...specialtyActions,
    routeAction('Xem phiếu khám điện tử', '/phieu-kham-dien-tu'),
  ].slice(0, 4);

  return {
    ok: true,
    status: 200,
    data: {
      reply: cleanAssistantText([
        'Bạn có thể đặt lịch khám trên website MidHealth theo quy trình ngắn sau:',
        '1. Chọn hướng đặt khám: theo chuyên khoa, bác sĩ, bệnh viện hoặc phòng khám.',
        '2. Xem thông tin nơi khám và chọn khung giờ còn trống.',
        '3. Chọn hoặc nhập hồ sơ bệnh nhân để MidHealth ghi nhận đúng người đi khám.',
        '4. Kiểm tra lại thông tin, xác nhận lịch hẹn và theo dõi trạng thái trong phiếu khám điện tử.',
        'Nếu bạn chưa biết nên bắt đầu từ đâu, hãy chọn chuyên khoa trước hoặc mô tả triệu chứng để tôi gợi ý hướng khám phù hợp hơn.',
      ].join('\n')),
      intent: 'navigation_booking_guide',
      action: actions[0] || routeAction('Về trang đặt khám', '/dat-kham/bac-si'),
      actions: actions.length ? actions : [routeAction('Về trang đặt khám', '/dat-kham/bac-si')],
      suggestedPrompts: shouldOfferFollowupSuggestions(message) ? [
        'Tôi nên đặt khám chuyên khoa nào?',
        'Gợi ý bác sĩ có thể khám ngày mai',
        'Xem phiếu khám điện tử',
        'Tôi cần đăng nhập không?',
      ] : [],
      model: 'midhealth-navigation',
    },
  };
}

async function buildNavigationResponse(message, user) {
  const text = normalizeSearchText(message);
  const asksGuide = includesAny(text, ['huong dan', 'cach dat', 'lam sao', 'bat dau']);

  if (/^(alo|hello|hi|chao|xin chao)(\s|$)/.test(text) || includesAny(text, ['co ai online', 'co ai onl', 'ai ho tro'])) {
    return {
      ok: true,
      status: 200,
      data: {
        reply: 'Tôi đang hỗ trợ bạn trên website MidHealth. Bạn cần tôi hỗ trợ nội dung nào?',
        intent: 'small_talk',
        action: null,
        actions: [],
        model: 'midhealth-navigation',
      },
    };
  }

  if (includesAny(text, ['cap cuu', 'khi nao can di cap cuu', 'nguy hiem', '115'])) {
    return {
      ok: true,
      status: 200,
      data: {
        reply: [
          'Bạn nên đi cấp cứu ngay hoặc gọi 115 nếu có một trong các dấu hiệu sau:',
          '1. Khó thở, tím tái, đau ngực hoặc ngất.',
          '2. Dấu hiệu đột quỵ như méo miệng, yếu liệt tay chân, nói khó.',
          '3. Đau dữ dội, chảy máu nhiều, co giật hoặc mất ý thức.',
          '4. Sốt cao kéo dài, nôn liên tục, đi ngoài ra máu hoặc tình trạng xấu đi nhanh.',
          'Nếu không có dấu hiệu nguy cấp, bạn có thể đặt lịch khám trên MidHealth để được bác sĩ thăm khám phù hợp.',
        ].join('\n'),
        intent: 'emergency_guidance',
        action: routeAction('Về trang đặt khám', '/dat-kham/bac-si'),
        actions: [
          routeAction('Về trang đặt khám', '/dat-kham/bac-si'),
          routeAction('Mở Tin Y tế', '/tin-tuc'),
        ],
        model: 'midhealth-navigation',
      },
    };
  }

  if (includesAny(text, ['dang nhap', 'login', 'tai khoan'])) {
    return {
      ok: true,
      status: 200,
      data: {
        reply: user
          ? 'Bạn đang đăng nhập MidHealth. Bạn có thể xem phiếu khám điện tử, quản lý hồ sơ bệnh nhân hoặc tiếp tục đặt lịch khám.'
          : 'Bạn cần đăng nhập để lưu hồ sơ bệnh nhân, xem lịch khám đã đặt và sử dụng phiếu khám điện tử trên MidHealth.',
        intent: 'navigation_auth',
        action: user ? routeAction('Xem phiếu khám điện tử', '/phieu-kham-dien-tu') : routeAction('Đăng nhập', '/dang-nhap'),
        actions: user
          ? [routeAction('Xem phiếu khám điện tử', '/phieu-kham-dien-tu'), routeAction('Về trang chủ', '/')]
          : [routeAction('Đăng nhập', '/dang-nhap'), routeAction('Đăng ký tài khoản', '/dang-ky')],
        model: 'midhealth-navigation',
      },
    };
  }

  if (includesAny(text, ['dang ky', 'tao tai khoan', 'mo tai khoan'])) {
    return {
      ok: true,
      status: 200,
      data: {
        reply: 'Bạn có thể đăng ký tài khoản MidHealth để lưu hồ sơ bệnh nhân, đặt lịch nhanh hơn và theo dõi phiếu khám điện tử.',
        intent: 'navigation_signup',
        action: routeAction('Đăng ký tài khoản', '/dang-ky'),
        actions: [routeAction('Đăng ký tài khoản', '/dang-ky'), routeAction('Đăng nhập', '/dang-nhap')],
        model: 'midhealth-navigation',
      },
    };
  }

  const asksDefinition = includesAny(text, ['la gi', 'la nhu the nao', 'giai thich']);
  if (!asksDefinition && includesAny(text, ['phieu kham', 'lich kham cua toi', 'lich hen', 'ho so kham', 'ho so benh nhan'])) {
    return {
      ok: true,
      status: 200,
      data: {
        reply: user
          ? 'Bạn có thể vào phiếu khám điện tử để xem lịch khám, thông tin người khám và trạng thái lịch hẹn đã đặt trên MidHealth.'
          : 'Phiếu khám điện tử cần tài khoản để bảo vệ thông tin bệnh nhân. Bạn hãy đăng nhập trước, sau đó MidHealth sẽ mở khu vực phiếu khám và hồ sơ bệnh nhân.',
        intent: 'navigation_ticket',
        action: user ? routeAction('Mở phiếu khám điện tử', '/phieu-kham-dien-tu') : routeAction('Đăng nhập để xem phiếu khám', '/dang-nhap'),
        actions: user
          ? [routeAction('Mở phiếu khám điện tử', '/phieu-kham-dien-tu'), routeAction('Đặt lịch khám mới', '/')]
          : [routeAction('Đăng nhập', '/dang-nhap'), routeAction('Đăng ký tài khoản', '/dang-ky')],
        model: 'midhealth-navigation',
      },
    };
  }

  if (includesAny(text, ['tin y te', 'bai viet', 'doc tin', 'kien thuc suc khoe', 'suc khoe'])) {
    return {
      ok: true,
      status: 200,
      data: {
        reply: 'Bạn có thể đọc Tin Y tế trên MidHealth để tham khảo kiến thức sức khỏe, dấu hiệu cần đi khám và các lưu ý trước khi đặt lịch. Nội dung chỉ dùng để tham khảo, không thay thế chẩn đoán của bác sĩ.',
        intent: 'navigation_health_news',
        action: routeAction('Mở Tin Y tế', '/tin-tuc'),
        actions: [routeAction('Mở Tin Y tế', '/tin-tuc'), routeAction('Về trang chủ', '/')],
        model: 'midhealth-navigation',
      },
    };
  }

  if (includesAny(text, ['chuyen khoa nao', 'dat kham chuyen khoa', 'chon chuyen khoa', 'nen dat kham'])) {
    return buildSpecialtyChoiceResponse(message);
  }

  if (asksGuide && includesAny(text, ['dat lich', 'dat kham', 'kham benh'])) {
    return buildBookingGuideResponse(message);
  }

  return null;
}

async function buildSymptomGuidanceResponse(message) {
  const symptomRule = await inferSymptomRule(message);
  const keywords = symptomRule?.specialtyKeywords || [];
  if (!keywords.length) return null;
  const canSuggest = shouldOfferFollowupSuggestions(message);

  const catalogResult = await getCatalogSnapshot();
  const specialties = catalogResult.ok ? catalogResult.data?.specialties || [] : [];
  const actions = keywords
    .map((keyword) => specialties.find((item) => normalizeSearchText(item.name).includes(keyword)))
    .filter(Boolean)
    .map((item) => routeAction(`Đặt khám ${item.name}`, bookingUrl('specialty', item)));

  if (!actions.length) {
    actions.push(routeAction('Về trang đặt khám', '/dat-kham/bac-si'));
  }
  actions.push(routeAction('Xem Tin Y tế', '/tin-tuc'));

  return {
    ok: true,
    status: 200,
    data: {
      reply: cleanAssistantText([
        `Với triệu chứng bạn mô tả, bạn có thể tham khảo nhóm chuyên khoa ${keywords.map(displaySpecialtyKeyword).join(', ')} trên MidHealth.`,
        'Nếu triệu chứng nhẹ, bạn có thể chọn chuyên khoa phù hợp để xem bác sĩ, cơ sở khám và lịch trống.',
        symptomRule?.adviceText || emergencyNoteFor(message),
        'Bạn có thể dùng các nút bên dưới để chuyển nhanh đến chuyên khoa hoặc đọc thêm Tin Y tế.',
      ].join('\n')),
      intent: 'symptom_guidance',
      action: canSuggest ? actions[0] || routeAction('Xem Tin Y tế', '/tin-tuc') : null,
      actions: canSuggest ? uniqueActions(actions) : [],
      suggestedPrompts: canSuggest ? [
        'Gợi ý bác sĩ phù hợp',
        'Có bác sĩ khám ngày mai không?',
        'Hướng dẫn đặt lịch khám',
        'Khi nào cần đi cấp cứu?',
      ] : [],
      model: 'midhealth-navigation',
    },
  };
}

async function buildKnowledgeResponse(message) {
  const item = await findKnowledgeAnswer(message);
  if (!item?.reply) return null;

  const actions = uniqueActions(item.actions || []);
  return {
    ok: true,
    status: 200,
    data: {
      reply: cleanAssistantText(item.reply),
      intent: item.intent || 'knowledge',
      action: actions[0] || null,
      actions,
      suggestedPrompts: shouldOfferFollowupSuggestions(message) ? (item.suggestedPrompts || []).slice(0, 4) : [],
      model: 'midhealth-knowledge',
    },
  };
}

function matchSpecialty(item, keywords = []) {
  if (!keywords.length) return true;
  const value = normalizeSearchText([
    item.name,
    item.specialty,
    item.subtitle,
    item.intro,
    ...(item.specialties || []),
    ...(item.services || []).map((service) => service.name),
  ].filter(Boolean).join(' '));
  return keywords.some((keyword) => value.includes(keyword));
}

function specialtyScore(item, keywords = []) {
  if (!keywords.length) return 0;
  const value = normalizeSearchText([
    item.name,
    item.specialty,
    item.subtitle,
    item.intro,
    ...(item.specialties || []),
    ...(item.services || []).map((service) => service.name),
  ].filter(Boolean).join(' '));
  return keywords.reduce((score, keyword) => score + (value.includes(keyword) ? 4 : 0), 0);
}

function matchProfileArea(item, ownerProfile) {
  if (!ownerProfile?.province && !ownerProfile?.district) return 0;
  const value = normalizeSearchText([item.address, item.province, item.district].filter(Boolean).join(' '));
  let score = 0;
  if (ownerProfile.province && value.includes(normalizeSearchText(ownerProfile.province))) score += 2;
  if (ownerProfile.district && value.includes(normalizeSearchText(ownerProfile.district))) score += 3;
  return score;
}

function nearestSlot(slots = [], requestedTime = '') {
  const available = slots.filter((slot) => slot.status !== 'full');
  if (!available.length) return null;
  if (!requestedTime) return available[0];

  const requestedMinutes = Number(requestedTime.slice(0, 2)) * 60 + Number(requestedTime.slice(3, 5));
  return [...available].sort((a, b) => {
    const aMinutes = Number(a.startTime.slice(0, 2)) * 60 + Number(a.startTime.slice(3, 5));
    const bMinutes = Number(b.startTime.slice(0, 2)) * 60 + Number(b.startTime.slice(3, 5));
    return Math.abs(aMinutes - requestedMinutes) - Math.abs(bMinutes - requestedMinutes);
  })[0];
}

async function attachSlots(type, item, schedule) {
  if (!schedule.date) return { ...item, suggestedSlot: null };

  const options = { fromDate: schedule.date, days: 1 };
  const result = type === 'doctor'
    ? await listDoctorSlots(item.id, options)
    : type === 'hospital'
      ? await listHospitalSlots(item.id, options)
      : await listClinicSlots(item.id, options);

  const slot = result.ok ? nearestSlot(result.data || [], schedule.time) : null;
  return { ...item, suggestedSlot: slot };
}

function lineForRecommendation(type, item, index) {
  const slotText = item.suggestedSlot
    ? ` - lịch trống gần nhất: ${item.suggestedSlot.startTime}, ${displayDate(item.suggestedSlot.date)}`
    : '';
  if (type === 'doctor') {
    return `${index + 1}. ${item.name} - ${item.specialty || 'chuyên khoa phù hợp'} tại ${item.workplace || item.address || 'MidHealth'}${slotText}.`;
  }
  return `${index + 1}. ${item.name} - ${item.address || item.subtitle || 'cơ sở MidHealth'}${slotText}.`;
}

function emergencyNoteFor(message = '') {
  const text = normalizeSearchText(message);
  if (text.includes('dau bung')) {
    return 'Nếu đau bụng dữ dội, sốt cao, nôn liên tục, đi ngoài ra máu hoặc ngất, bạn nên đi cấp cứu ngay.';
  }
  return 'Nếu có triệu chứng nặng, đau dữ dội, khó thở, ngất hoặc tình trạng xấu đi nhanh, bạn nên đi cấp cứu ngay.';
}

async function buildRecommendationResponse(message, user) {
  const text = normalizeSearchText(message);
  if (includesAny(text, ['huong dan', 'cach dat', 'lam sao', 'bat dau'])) return null;
  if (includesAny(text, ['khoa nao', 'chuyen khoa nao', 'chon chuyen khoa', 'nen kham khoa', 'nen dat kham khoa'])) return null;

  const type = requestedEntityType(message);
  if (!type) return null;

  const catalogResult = await getCatalogSnapshot();
  if (!catalogResult.ok) return null;

  const schedule = parseRequestedSchedule(message);
  const symptomRule = await inferSymptomRule(message);
  const keywords = symptomRule?.specialtyKeywords || [];
  if (type === 'doctor' && !keywords.length && !schedule.date && !includesAny(text, ['bac si', 'goi y'])) {
    return null;
  }

  const ownerProfile = user ? await findOwnerProfile(user).catch(() => null) : null;
  const data = catalogResult.data || {};
  const source = type === 'hospital' ? data.hospitals || [] : type === 'clinic' ? data.clinics || [] : data.doctors || [];
  const scored = source
    .map((item) => ({
      ...item,
      areaScore: matchProfileArea(item, ownerProfile),
      specialtyScore: specialtyScore(item, keywords),
    }))
    .sort((a, b) => b.specialtyScore - a.specialtyScore || b.areaScore - a.areaScore);
  const matched = (scored.some((item) => item.specialtyScore > 0) ? scored.filter((item) => matchSpecialty(item, keywords)) : scored)
    .slice(0, 8);

  const withSlots = [];
  for (const item of matched) {
    withSlots.push(await attachSlots(type, item, schedule));
  }

  const recommendations = withSlots
    .sort((a, b) => Number(Boolean(b.suggestedSlot)) - Number(Boolean(a.suggestedSlot)) || b.areaScore - a.areaScore)
    .slice(0, 4);

  if (!recommendations.length) return null;

  const specialtyText = keywords.length ? ` phù hợp với ${keywords.map(displaySpecialtyKeyword).join(', ')}` : '';
  const exactMatchText = !keywords.length || recommendations.some((item) => item.specialtyScore > 0)
    ? ''
    : ' Hiện chưa có kết quả khớp chính xác chuyên khoa suy luận, nên tôi ưu tiên hiển thị các lựa chọn đang có lịch để bạn xem nhanh.';
  const scheduleText = schedule.date
    ? ` Tôi đã kiểm tra lịch trống ngày ${displayDate(schedule.date)}${schedule.time ? ` và ưu tiên khung giờ gần ${schedule.time}` : ''}.`
    : '';
  const profileText = ownerProfile?.district || ownerProfile?.province
    ? ` Các cơ sở gần khu vực trong hồ sơ của bạn được ưu tiên hiển thị trước.`
    : '';
  const typeLabel = type === 'doctor' ? 'bác sĩ' : type === 'hospital' ? 'bệnh viện' : 'phòng khám';
  const actionHint = type === 'doctor'
    ? 'Bạn có thể chọn nút đặt lịch bên dưới để xem chi tiết bác sĩ và hoàn tất lịch khám.'
    : 'Bạn có thể chọn nút bên dưới để xem chi tiết cơ sở và đặt lịch khám.';

  const reply = [
    `Dựa trên dữ liệu đặt khám trực tuyến của MidHealth, tôi gợi ý ${recommendations.length} ${typeLabel}${specialtyText}.${scheduleText}${profileText}${exactMatchText}`,
    ...recommendations.map((item, index) => lineForRecommendation(type, item, index)),
    actionHint,
    symptomRule?.adviceText || emergencyNoteFor(message),
  ].join('\n');

  const first = recommendations[0];
  return {
    ok: true,
    status: 200,
    data: {
      reply: cleanAssistantText(reply),
      intent: type === 'doctor' ? 'book_doctor' : type === 'hospital' ? 'book_hospital' : 'book_clinic',
      action: first ? {
        label: type === 'doctor' ? `Đặt lịch ${first.name}` : `Xem ${first.name}`,
        url: bookingUrl(type, first),
      } : null,
      actions: recommendations.map((item) => ({
        label: type === 'doctor' ? `Đặt lịch ${item.name}` : `Xem ${item.name}`,
        url: bookingUrl(type, item),
      })),
      suggestedPrompts: shouldOfferFollowupSuggestions(message)
        ? type === 'doctor'
          ? [
            'Gợi ý thêm bác sĩ khác',
            'Có bác sĩ khám ngày mai không?',
            'Hướng dẫn đặt lịch khám',
            'Xem phiếu khám điện tử',
          ]
          : [
            'Gợi ý bác sĩ phù hợp',
            'Gợi ý cơ sở gần tôi',
            'Hướng dẫn đặt lịch khám',
            'Khi nào cần đi cấp cứu?',
          ]
        : [],
      model: 'midhealth-rules',
    },
  };
}

function normalizeMessage(item) {
  const role = item?.role === 'assistant' || item?.role === 'model' ? 'model' : 'user';
  const text = String(item?.content || item?.text || '').trim();
  if (!text) return null;

  return {
    role,
    parts: [{ text: text.slice(0, 2000) }],
  };
}

function extractText(data) {
  return data?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || '')
    .join('')
    .trim();
}

function normalizeAiPayload(text) {
  try {
    const parsed = JSON.parse(text);
    const reply = cleanAssistantText(parsed.reply || '');
    const action = parsed.action && typeof parsed.action === 'object'
      ? {
          label: cleanAssistantText(parsed.action.label || ''),
          url: String(parsed.action.url || '').trim(),
        }
      : null;
    const actions = Array.isArray(parsed.actions)
      ? parsed.actions
        .map((item) => ({
          label: cleanAssistantText(item?.label || ''),
          url: String(item?.url || '').trim(),
        }))
        .filter((item) => item.label && item.url.startsWith('/'))
      : [];
    const suggestedPrompts = Array.isArray(parsed.suggestedPrompts)
      ? parsed.suggestedPrompts
        .map((item) => cleanAssistantText(item || ''))
        .filter(Boolean)
        .slice(0, 5)
      : [];

    return {
      reply,
      intent: String(parsed.intent || 'general').trim() || 'general',
      action: action?.label && action?.url.startsWith('/') ? action : null,
      actions,
      suggestedPrompts,
    };
  } catch {
    return {
      reply: text,
      intent: 'general',
      action: null,
      actions: [],
      suggestedPrompts: [],
    };
  }
}

function uniqueActions(actions = []) {
  const seen = new Set();
  return actions.filter((action) => {
    if (!action?.label || !action?.url?.startsWith('/')) return false;
    const key = `${action.label}|${action.url}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 4);
}

async function buildContextualActions(message, aiPayload = {}, user) {
  const text = normalizeSearchText(`${message} ${aiPayload.reply || ''}`);
  const actions = [
    ...(aiPayload.actions || []),
    ...(aiPayload.action ? [aiPayload.action] : []),
  ];

  if (includesAny(text, ['dang nhap', 'tai khoan'])) {
    actions.push(user ? routeAction('Xem phiếu khám điện tử', '/phieu-kham-dien-tu') : routeAction('Đăng nhập', '/dang-nhap'));
  }

  if (includesAny(text, ['dang ky', 'tao tai khoan'])) {
    actions.push(routeAction('Đăng ký tài khoản', '/dang-ky'));
  }

  if (includesAny(text, ['phieu kham', 'lich kham cua toi', 'ho so benh nhan'])) {
    actions.push(user ? routeAction('Mở phiếu khám điện tử', '/phieu-kham-dien-tu') : routeAction('Đăng nhập để xem phiếu khám', '/dang-nhap'));
  }

  if (includesAny(text, ['tin y te', 'bai viet', 'kien thuc suc khoe'])) {
    actions.push(routeAction('Mở Tin Y tế', '/tin-tuc'));
  }

  const symptomRule = await inferSymptomRule(message);
  const keywords = symptomRule?.specialtyKeywords || [];
  if (shouldOfferFollowupSuggestions(message) && (keywords.length || includesAny(text, ['trieu chung', 'dau', 'benh', 'nen kham', 'kham chuyen khoa']))) {
    const catalogResult = await getCatalogSnapshot();
    const specialties = catalogResult.ok ? catalogResult.data?.specialties || [] : [];
    const preferred = keywords.length ? keywords : ['noi tong quat'];
    preferred.forEach((keyword) => {
      const specialty = specialties.find((item) => normalizeSearchText(item.name).includes(keyword));
      if (specialty) actions.push(routeAction(`Đặt khám ${specialty.name}`, bookingUrl('specialty', specialty)));
    });
    actions.push(routeAction('Xem Tin Y tế', '/tin-tuc'));
  }

  if (includesAny(text, ['dat lich', 'dat kham', 'kham benh']) && !actions.length) {
    actions.push(routeAction('Về trang đặt khám', '/dat-kham/bac-si'));
  }

  return uniqueActions(actions);
}

function cleanAssistantText(value = '') {
  return String(value)
    .replace(/mở ứng dụng MidHealth/gi, 'mở website MidHealth')
    .replace(/ứng dụng MidHealth/gi, 'website MidHealth')
    .replace(/trên ứng dụng/gi, 'trên website')
    .replace(/mở ứng dụng/gi, 'mở website')
    .replace(/\bapp MidHealth\b/gi, 'website MidHealth')
    .replace(/\bapp\b/gi, 'website')
    .replace(/```(?:json)?/gi, '')
    .replace(/\*\*/g, '')
    .replace(/__/g, '')
    .replace(/#{1,6}\s*/g, '')
    .replace(/\.{3,}/g, '.')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function buildGeminiUnavailableResponse(message, user, reason = 'unavailable') {
  const actions = await buildContextualActions(message, {
    reply: 'đặt khám chuyên khoa tin y tế phiếu khám',
  }, user);

  const quotaText = reason === 'quota'
    ? 'Hiện phần AI tạo câu trả lời tự do đã tạm hết hạn mức sử dụng.'
    : 'Hiện phần AI tạo câu trả lời tự do đang tạm thời chưa sẵn sàng.';

  return {
    ok: true,
    status: 200,
    data: {
      reply: [
        `${quotaText} Bạn vẫn có thể dùng các chức năng đặt khám của MidHealth ngay bên dưới.`,
        'Nếu bạn muốn đặt lịch, hãy chọn chuyên khoa, bác sĩ, bệnh viện hoặc phòng khám phù hợp.',
        'Nếu có triệu chứng nặng như khó thở, đau ngực, ngất, đau dữ dội hoặc tình trạng xấu đi nhanh, bạn nên đi cấp cứu ngay.',
      ].join('\n'),
      intent: 'ai_unavailable',
      action: actions[0] || routeAction('Về trang đặt khám', '/dat-kham/bac-si'),
      actions: actions.length ? actions : [
        routeAction('Về trang đặt khám', '/dat-kham/bac-si'),
        routeAction('Mở Tin Y tế', '/tin-tuc'),
      ],
      suggestedPrompts: [
        'Hướng dẫn đặt lịch khám',
        'Tôi nên đặt khám chuyên khoa nào?',
        'Gợi ý bác sĩ phù hợp',
        'Xem phiếu khám điện tử',
      ],
      model: 'midhealth-fallback',
    },
  };
}

function buildContextualSuggestedPrompts(message = '') {
  if (!shouldOfferFollowupSuggestions(message)) return [];

  const text = normalizeSearchText(message);

  if (includesAny(text, ['dang nhap', 'tai khoan'])) {
    return ['Đăng nhập để đặt khám', 'Tôi cần đăng ký tài khoản không?'];
  }

  if (includesAny(text, ['dang ky', 'tao tai khoan'])) {
    return ['Tôi cần đăng nhập không?', 'Hướng dẫn đặt lịch khám'];
  }

  if (includesAny(text, ['phieu kham', 'lich kham cua toi', 'lich hen', 'ho so kham', 'ho so benh nhan'])) {
    return ['Xem phiếu khám điện tử', 'Tôi muốn đặt lịch khám mới'];
  }

  if (includesAny(text, ['tin y te', 'bai viet', 'doc tin', 'kien thuc suc khoe'])) {
    return ['Xem Tin Y tế', 'Khi nào cần đi cấp cứu?'];
  }

  if (includesAny(text, ['cap cuu', 'nguy hiem', '115'])) {
    return ['Tôi muốn đặt lịch khám', 'Tôi nên khám chuyên khoa nào?'];
  }

  if (includesAny(text, ['trieu chung', 'dau', 'benh', 'nen kham', 'khoa nao', 'chuyen khoa nao'])) {
    return ['Gợi ý bác sĩ phù hợp', 'Hướng dẫn đặt lịch khám', 'Khi nào cần đi cấp cứu?'];
  }

  if (includesAny(text, ['dat lich', 'dat kham', 'kham benh', 'bac si', 'benh vien', 'phong kham'])) {
    return ['Tôi nên đặt khám chuyên khoa nào?', 'Gợi ý bác sĩ phù hợp', 'Xem phiếu khám điện tử'];
  }

  return [];
}

async function buildRelevantGeminiUnavailableResponse(message, user, reason = 'unavailable') {
  const actions = await buildContextualActions(message, { reply: '' }, user);
  const suggestedPrompts = buildContextualSuggestedPrompts(message);
  const normalizedMessage = normalizeSearchText(message);
  const quotaText = reason === 'quota'
    ? 'Hiện phần AI tạo câu trả lời tự do đã tạm hết hạn mức sử dụng.'
    : 'Hiện phần AI tạo câu trả lời tự do đang tạm thời chưa sẵn sàng.';
  const replyLines = [`${quotaText} Bạn có thể thử lại sau ít phút.`];

  if (actions.length) {
    replyLines.push('Tôi đã gửi kèm các nút phù hợp với nội dung bạn vừa hỏi.');
  }

  if (includesAny(normalizedMessage, ['trieu chung', 'dau', 'benh', 'cap cuu', 'nguy hiem'])) {
    replyLines.push('Nếu có triệu chứng nặng như khó thở, đau ngực, ngất, đau dữ dội hoặc tình trạng xấu đi nhanh, bạn nên đi cấp cứu ngay.');
  }

  return {
    ok: true,
    status: 200,
    data: {
      reply: replyLines.join('\n'),
      intent: 'ai_unavailable',
      action: actions[0] || null,
      actions,
      suggestedPrompts,
      model: 'midhealth-fallback',
    },
  };
}

export async function askGeminiChat({ message, history = [] }, { user } = {}) {
  const userMessage = String(message || '').trim();
  if (!userMessage) {
    return {
      ok: false,
      status: 400,
      data: { message: 'Vui lòng nhập câu hỏi cho trợ lý AI.' },
    };
  }

  const finish = async (result) => {
    await logChatInteraction({ user, message: userMessage, result });
    return result;
  };

  const recommendation = await buildRecommendationResponse(userMessage, user);
  if (recommendation) return finish(recommendation);

  const navigation = await buildNavigationResponse(userMessage, user);
  if (navigation) return finish(navigation);

  const symptomGuidance = await buildSymptomGuidanceResponse(userMessage);
  if (symptomGuidance) return finish(symptomGuidance);

  const knowledge = await buildKnowledgeResponse(userMessage);
  if (knowledge) return finish(knowledge);

  if (!hasGeminiConfig) {
    return finish(await buildRelevantGeminiUnavailableResponse(userMessage, user, 'unavailable'));
  }

  const contents = [
    ...history.slice(-8).map(normalizeMessage).filter(Boolean),
    { role: 'user', parts: [{ text: userMessage.slice(0, 2000) }] },
  ];
  const catalogContext = await buildCatalogContext();

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.geminiModel)}:generateContent`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': config.geminiApiKey,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: `${SYSTEM_PROMPT}\n\n${catalogContext}` }],
        },
        contents,
        generationConfig: {
          temperature: 0.35,
          topP: 0.9,
          maxOutputTokens: 700,
          responseMimeType: 'application/json',
        },
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const errorMessage = String(data?.error?.message || '').toLowerCase();
      const reason = response.status === 429 || errorMessage.includes('quota') || errorMessage.includes('rate')
        ? 'quota'
        : 'unavailable';
      return finish(await buildRelevantGeminiUnavailableResponse(userMessage, user, reason));
    }

    const aiPayload = normalizeAiPayload(extractText(data));
    const contextualActions = await buildContextualActions(userMessage, aiPayload, user);
    return finish({
      ok: true,
      status: 200,
      data: {
        reply: aiPayload.reply || 'Tôi chưa tạo được câu trả lời phù hợp. Bạn hãy thử hỏi lại ngắn gọn hơn.',
        intent: aiPayload.intent,
        action: contextualActions[0] || aiPayload.action,
        actions: contextualActions,
        suggestedPrompts: aiPayload.suggestedPrompts,
        model: config.geminiModel,
      },
    });
  } catch {
    return finish(await buildRelevantGeminiUnavailableResponse(userMessage, user, 'unavailable'));
  }
}
