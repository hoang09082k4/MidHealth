import { useEffect, useMemo, useRef, useState } from 'react';
import { sendChatbotMessage } from '../../lib/chatbot';

const DEFAULT_QUICK_PROMPTS = [
  'Tôi nên đặt khám chuyên khoa nào?',
  'Hướng dẫn đặt lịch khám',
  'Gợi ý bác sĩ phù hợp',
  'Khi nào cần đi cấp cứu?',
];

const ATTENTION_MESSAGES = [
  'Bạn cần tôi hỗ trợ đặt lịch khám không?',
  'Chưa biết nên chọn bác sĩ hay chuyên khoa nào?',
  'Bạn muốn tìm nơi khám phù hợp với nhu cầu của mình?',
  'Tôi có thể giúp bạn xem hướng đặt khám nhanh hơn.',
  'Bạn đang phân vân nên khám ở đâu?',
  'Cần kiểm tra lại phiếu khám điện tử của bạn?',
  'Mô tả triệu chứng, tôi sẽ gợi ý hướng khám phù hợp.',
  'Bạn muốn đặt lịch khám cho hôm nay hoặc ngày mai?',
];

const INTENT_QUICK_PROMPTS = {
  navigation_specialty_choice: [
    'Tôi bị đau bụng nên khám khoa nào?',
    'Tôi bị ho kéo dài nên khám khoa nào?',
    'Gợi ý bác sĩ phù hợp',
    'Khi nào cần đi cấp cứu?',
  ],
  navigation_booking_guide: [
    'Tôi nên đặt khám chuyên khoa nào?',
    'Gợi ý bác sĩ có thể khám ngày mai',
    'Xem phiếu khám điện tử',
    'Tôi cần đăng nhập không?',
  ],
  book_doctor: [
    'Gợi ý thêm bác sĩ khác',
    'Có bác sĩ khám ngày mai không?',
    'Tôi nên chọn chuyên khoa nào?',
    'Xem phiếu khám điện tử',
  ],
  book_hospital: [
    'Gợi ý phòng khám phù hợp',
    'Gợi ý bác sĩ ở cơ sở này',
    'Hướng dẫn đặt lịch khám',
    'Khi nào cần đi cấp cứu?',
  ],
  book_clinic: [
    'Gợi ý bác sĩ phù hợp',
    'Tôi nên chọn chuyên khoa nào?',
    'Hướng dẫn đặt lịch khám',
    'Xem Tin Y tế',
  ],
  emergency_guidance: [
    'Tôi muốn đặt lịch khám',
    'Tôi nên khám chuyên khoa nào?',
    'Gợi ý bác sĩ phù hợp',
    'Xem Tin Y tế',
  ],
  ai_unavailable: [
    'Hướng dẫn đặt lịch khám',
    'Tôi nên đặt khám chuyên khoa nào?',
    'Gợi ý bác sĩ phù hợp',
    'Xem Tin Y tế',
  ],
};

function uniquePrompts(prompts = []) {
  const seen = new Set();
  return prompts
    .map((prompt) => String(prompt || '').trim())
    .filter((prompt) => {
      if (!prompt || seen.has(prompt)) return false;
      seen.add(prompt);
      return true;
    })
    .slice(0, 5);
}

function renderMessageContent(content = '') {
  const displayContent = String(content)
    .replace(/mở ứng dụng MidHealth/gi, 'mở website MidHealth')
    .replace(/ứng dụng MidHealth/gi, 'website MidHealth')
    .replace(/trên ứng dụng/gi, 'trên website')
    .replace(/mở ứng dụng/gi, 'mở website')
    .replace(/\bapp MidHealth\b/gi, 'website MidHealth')
    .replace(/\bapp\b/gi, 'website')
    .replace(/^\s*\*\s+/gm, '• ');
  const parts = displayContent.split(/(\*\*[^*]+\*\*)/g);

  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>;
    }

    return <span key={`${part}-${index}`}>{part}</span>;
  });
}

function ChatbotAI({ user }) {
  const [isOpen, setIsOpen] = useState(false);
  const [attentionIndex, setAttentionIndex] = useState(0);
  const [attentionVisible, setAttentionVisible] = useState(true);
  const [isLauncherHovered, setIsLauncherHovered] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Xin chào, tôi là trợ lý AI MidHealth. Tôi có thể hỗ trợ đặt lịch khám, gợi ý hướng khám phù hợp và giải thích thông tin y tế tổng quát.',
      intent: 'welcome',
    },
  ]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const inputRef = useRef(null);

  const visibleHistory = useMemo(
    () => messages.map((message) => ({ role: message.role, content: message.content })),
    [messages],
  );

  const quickPrompts = useMemo(() => {
    const lastAssistant = [...messages].reverse().find((message) => message.role === 'assistant');
    if (!lastAssistant || lastAssistant.intent === 'welcome') {
      return DEFAULT_QUICK_PROMPTS;
    }

    return uniquePrompts(lastAssistant?.suggestedPrompts || []);
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      setAttentionVisible(false);
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setAttentionVisible((current) => {
        if (!current) {
          setAttentionIndex((index) => (index + 1) % ATTENTION_MESSAGES.length);
        }

        return !current;
      });
    }, attentionVisible ? 20000 : 60000);

    return () => window.clearTimeout(timer);
  }, [attentionVisible, isOpen]);

  const openChat = () => {
    setIsOpen(true);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  };

  const showAttentionOnHover = () => {
    setAttentionIndex((index) => (index + 1) % ATTENTION_MESSAGES.length);
    setIsLauncherHovered(true);
  };

  const sendMessage = async (messageText = input) => {
    const text = messageText.trim();
    if (!text || isSending) return;

    const userMessage = { role: 'user', content: text };
    setMessages((current) => [...current, userMessage]);
    setInput('');
    setIsSending(true);

    try {
      const token = user ? await user.getIdToken() : '';
      const result = await sendChatbotMessage({
        message: text,
        history: visibleHistory,
        token,
      });
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: result.reply,
          intent: result.intent,
          suggestedPrompts: result.suggestedPrompts,
          actions: result.actions?.length ? result.actions : result.action ? [result.action] : [],
        },
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          intent: 'ai_unavailable',
          content: error.message || 'Trợ lý AI đang tạm thời chưa sẵn sàng. Bạn vẫn có thể đặt lịch khám hoặc xem Tin Y tế trên MidHealth.',
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const openAction = (url) => {
    if (!url || !url.startsWith('/')) return;
    window.history.pushState({}, '', url);
    window.dispatchEvent(new PopStateEvent('popstate'));
    setIsOpen(false);
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
  };

  return (
    <div className="chatbot-ai">
      {isOpen ? (
        <section className="chatbot-panel" aria-label="Trợ lý AI MidHealth">
          <header className="chatbot-header">
            <div>
              <strong>Trợ lý AI</strong>
              <span>MidHealth</span>
            </div>
            <button type="button" onClick={() => setIsOpen(false)} aria-label="Đóng trợ lý AI">×</button>
          </header>

          <div className="chatbot-messages" aria-live="polite">
            {messages.map((message, index) => (
              <div className={`chatbot-message ${message.role === 'user' ? 'user' : 'assistant'}`} key={`${message.role}-${index}`}>
                {renderMessageContent(message.content)}
                {message.actions?.length ? (
                  <div className="chatbot-actions">
                    {message.actions.map((action) => (
                      <button className="chatbot-action" type="button" key={`${action.label}-${action.url}`} onClick={() => openAction(action.url)}>
                        {action.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
            {isSending ? <div className="chatbot-message assistant">Đang phản hồi</div> : null}
          </div>

          {quickPrompts.length ? (
            <div className="chatbot-quick-prompts">
              {quickPrompts.map((prompt) => (
                <button type="button" key={prompt} onClick={() => sendMessage(prompt)} disabled={isSending}>
                  {prompt}
                </button>
              ))}
            </div>
          ) : null}

          <form
            className="chatbot-form"
            onSubmit={(event) => {
              event.preventDefault();
              sendMessage();
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Nhập câu hỏi"
              maxLength={500}
            />
            <button type="submit" disabled={isSending || !input.trim()}>Gửi</button>
          </form>
        </section>
      ) : (
        <div
          className="chatbot-launcher-wrap"
          onMouseEnter={showAttentionOnHover}
          onMouseLeave={() => setIsLauncherHovered(false)}
          onFocus={showAttentionOnHover}
          onBlur={() => setIsLauncherHovered(false)}
        >
          {attentionVisible || isLauncherHovered ? (
            <button className="chatbot-attention" type="button" onClick={openChat}>
              {ATTENTION_MESSAGES[attentionIndex]}
            </button>
          ) : null}
          <button className="chatbot-launcher" type="button" onClick={openChat} aria-label="Mở trợ lý MidHealth">
            M
          </button>
        </div>
      )}
    </div>
  );
}

export default ChatbotAI;
