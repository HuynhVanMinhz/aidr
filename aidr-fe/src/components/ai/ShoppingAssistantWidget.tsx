import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useShoppingAssistant } from '../../hooks/useAi';
import { useToast } from '../../hooks/useToast';
import { selectCompareSelection } from '../../store/aiSlice';
import { useAppSelector } from '../../store/hooks';
import type { AiSuggestedProduct } from '../../types/ai';
import { formatChatTime, formatMessageTime } from '../../utils/chatUi';
import { formatMoney } from '../../utils/formatCatalog';
import '../../styles/chat.css';

const PLACEHOLDER = '/theme/images/product-image-1.png';
const OPEN_STORAGE_KEY = 'aidr.assistant.open';

const QUICK_PROMPTS = [
  'How do returns and refunds work?',
  'Recommend a phone under my budget',
  'What vouchers can I use at checkout?',
  'How does shipping and delivery work?',
];

function SuggestedProducts({
  products,
  onNavigate,
}: {
  products: AiSuggestedProduct[];
  onNavigate?: () => void;
}) {
  if (products.length === 0) return null;

  return (
    <div className="aidr-assistant__products">
      {products.map((p) => (
        <Link
          key={p.productId}
          to={`/products/${p.productId}`}
          className="aidr-assistant__product-card"
          onClick={onNavigate}
        >
          <img src={p.primaryImageUrl || PLACEHOLDER} alt="" />
          <div className="aidr-assistant__product-meta">
            <span className="aidr-assistant__product-name">{p.name}</span>
            <span className="aidr-assistant__product-price">
              {formatMoney(p.effectivePrice, p.currency)}
            </span>
            {p.reviewCount > 0 ? (
              <span className="aidr-assistant__product-rating text-muted">
                {p.avgRating.toFixed(1)} · {p.reviewCount} reviews
              </span>
            ) : null}
          </div>
        </Link>
      ))}
    </div>
  );
}

/** Floating shopping-assistant chatbot — available on all storefront pages. */
export function ShoppingAssistantWidget() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const { isAuthenticated } = useAuth();
  const compareCount = useAppSelector(selectCompareSelection).length;
  /** Quieter FAB on PDP so it does not compete with reviews / purchase CTAs. */
  const quietFab = /^\/products\/[^/]+\/?$/.test(location.pathname);

  const [open, setOpen] = useState(() => {
    try {
      return sessionStorage.getItem(OPEN_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [view, setView] = useState<'chat' | 'history'>('chat');
  const [draft, setDraft] = useState('');
  const [loadedOnce, setLoadedOnce] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const {
    conversations,
    conversationsLoading,
    conversationsError,
    activeConversationId,
    activeTitle,
    messages,
    messagesLoading,
    messagesError,
    sending,
    chatError,
    lastSource,
    maxLength,
    loadConversations,
    openConversation,
    startNew,
    send,
    getErrorMessage,
  } = useShoppingAssistant();

  function persistOpen(next: boolean) {
    setOpen(next);
    try {
      sessionStorage.setItem(OPEN_STORAGE_KEY, next ? '1' : '0');
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    if (!open || !isAuthenticated || loadedOnce) return;
    void (async () => {
      try {
        await loadConversations();
      } catch (err) {
        toast.error(getErrorMessage(err, 'Unable to load conversations.'));
      } finally {
        setLoadedOnce(true);
      }
    })();
  }, [getErrorMessage, isAuthenticated, loadConversations, loadedOnce, open, toast]);

  useEffect(() => {
    if (!open || view !== 'chat') return;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open, view, activeConversationId]);

  useEffect(() => {
    if (open && view === 'chat' && isAuthenticated) {
      inputRef.current?.focus();
    }
  }, [open, view, isAuthenticated]);

  function handleToggle() {
    if (!open && !isAuthenticated) {
      navigate(`/login?returnUrl=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }
    persistOpen(!open);
    if (!open) setView('chat');
  }

  function handleClose() {
    persistOpen(false);
  }

  function handleNewChat() {
    startNew();
    setDraft('');
    setView('chat');
  }

  async function handleSelect(conversationId: string) {
    try {
      await openConversation(conversationId);
      setView('chat');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to open conversation.'));
    }
  }

  async function submitMessage(text: string) {
    const content = text.trim();
    if (!content || sending) return;
    if (content.length > maxLength) {
      toast.error(`Message must be at most ${maxLength} characters.`);
      return;
    }

    try {
      await send(content);
      setDraft('');
      setView('chat');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to send message to the shopping assistant.'));
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await submitMessage(draft);
  }

  const headerTitle = activeTitle?.trim() || 'Shopping Assistant';
  const rootClass = [
    'aidr-assistant-widget',
    open ? 'is-open' : '',
    compareCount > 0 ? 'is-lifted' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={rootClass}>
      {open && isAuthenticated ? (
        <div
          className="aidr-assistant-widget__panel"
          role="dialog"
          aria-label="Shopping Assistant"
          aria-modal="false"
        >
          <div className="aidr-assistant-widget__header">
            <div className="aidr-assistant-widget__title-block">
              <span className="aidr-assistant-widget__badge" aria-hidden>
                AI
              </span>
              <div>
                <h2 className="aidr-assistant-widget__title">
                  {view === 'history' ? 'Conversations' : headerTitle}
                </h2>
                <p className="aidr-assistant-widget__subtitle">
                  {view === 'history'
                    ? 'Pick a previous chat'
                    : `Ask about products & shopping${lastSource ? ` · ${lastSource}` : ''}`}
                </p>
              </div>
            </div>
            <div className="aidr-assistant-widget__header-actions">
              {view === 'chat' ? (
                <>
                  <button
                    type="button"
                    className="aidr-assistant-widget__icon-btn"
                    onClick={handleNewChat}
                    aria-label="New chat"
                    title="New chat"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    className="aidr-assistant-widget__icon-btn"
                    onClick={() => setView('history')}
                    aria-label="Chat history"
                    title="History"
                  >
                    ☰
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="aidr-assistant-widget__icon-btn"
                  onClick={() => setView('chat')}
                  aria-label="Back to chat"
                  title="Back"
                >
                  ←
                </button>
              )}
              <button
                type="button"
                className="aidr-assistant-widget__icon-btn"
                onClick={handleClose}
                aria-label="Close assistant"
                title="Close"
              >
                ×
              </button>
            </div>
          </div>

          {view === 'history' ? (
            <div className="aidr-assistant-widget__history">
              {conversationsLoading && conversations.length === 0 ? (
                <p className="text-muted mb-0 px-3 py-3">Loading…</p>
              ) : null}
              {conversationsError ? (
                <p className="text-danger mb-0 px-3 py-3">{conversationsError}</p>
              ) : null}
              {!conversationsLoading && conversations.length === 0 ? (
                <p className="text-muted mb-0 px-3 py-3">No previous chats yet.</p>
              ) : null}
              <ul className="list-unstyled mb-0">
                {conversations.map((c) => (
                  <li key={c.conversationId}>
                    <button
                      type="button"
                      className={`aidr-assistant-widget__history-item${
                        c.conversationId === activeConversationId ? ' is-active' : ''
                      }`}
                      onClick={() => void handleSelect(c.conversationId)}
                    >
                      <span className="aidr-assistant-widget__history-title">
                        {c.title?.trim() || 'Shopping chat'}
                      </span>
                      <span className="aidr-assistant-widget__history-meta">
                        {formatChatTime(c.updatedAt)}
                      </span>
                      <span className="aidr-assistant-widget__history-preview">
                        {c.lastMessagePreview || 'No messages yet'}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <>
              <div className="aidr-assistant-widget__messages">
                {messagesLoading ? <p className="text-muted mb-2">Loading messages…</p> : null}
                {messagesError ? <p className="text-danger mb-2">{messagesError}</p> : null}

                {!messagesLoading && messages.length === 0 ? (
                  <div className="aidr-assistant__empty aidr-assistant__empty--widget">
                    <p className="mb-2">
                      Hi! I can help with product picks and shopping FAQs.
                    </p>
                    <div className="aidr-assistant__prompts">
                      {QUICK_PROMPTS.map((prompt) => (
                        <button
                          key={prompt}
                          type="button"
                          className="btn btn-sm btn-outline-secondary"
                          disabled={sending}
                          onClick={() => void submitMessage(prompt)}
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                <ul className="list-unstyled mb-0">
                  {messages.map((m) => {
                    const isUser = m.role === 'user';
                    return (
                      <li
                        key={m.aiMessageId}
                        className={`aidr-assistant__bubble-row${isUser ? ' is-user' : ' is-assistant'}`}
                      >
                        <div className={`aidr-assistant__bubble${isUser ? ' is-user' : ''}`}>
                          <div className="aidr-assistant__bubble-text">{m.content}</div>
                          {!isUser && m.suggestedProducts && m.suggestedProducts.length > 0 ? (
                            <SuggestedProducts
                              products={m.suggestedProducts}
                              onNavigate={handleClose}
                            />
                          ) : null}
                          <div className="aidr-assistant__bubble-time text-muted">
                            {formatMessageTime(m.createdAt)}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <div ref={messagesEndRef} />
              </div>

              {chatError ? (
                <div className="aidr-assistant-widget__error" role="alert">
                  {chatError}
                </div>
              ) : null}

              <form className="aidr-assistant-widget__composer" onSubmit={(e) => void handleSubmit(e)}>
                <textarea
                  ref={inputRef}
                  className="form-control"
                  rows={2}
                  placeholder="Ask about a product or shopping question…"
                  value={draft}
                  maxLength={maxLength}
                  disabled={sending}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void submitMessage(draft);
                    }
                  }}
                  aria-label="Message to shopping assistant"
                />
                <div className="aidr-assistant-widget__composer-bar">
                  <span className="text-muted fs-13">
                    {draft.trim().length}/{maxLength}
                  </span>
                  <button
                    type="submit"
                    className="btn btn-default btn-sm"
                    disabled={sending || !draft.trim()}
                  >
                    {sending ? 'Sending…' : 'Send'}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      ) : null}

      <button
        type="button"
        className={`aidr-assistant-widget__fab${open ? ' is-open' : ''}${quietFab && !open ? ' is-quiet' : ''}`}
        onClick={handleToggle}
        aria-expanded={open}
        aria-label={open ? 'Close shopping assistant' : 'Ask AI — shopping assistant'}
      >
        {open ? '×' : quietFab ? '✨' : '✨ Ask AI'}
      </button>
    </div>
  );
}
