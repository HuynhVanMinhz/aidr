import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useCompare, useShoppingAssistant } from '../../hooks/useAi';
import { useToast } from '../../hooks/useToast';
import { selectCompareSelection } from '../../store/aiSlice';
import { useAppSelector } from '../../store/hooks';
import type {
  AiChatAction,
  AiChatContext,
  AiConsultState,
  AiQuickReply,
  AiSuggestedProduct,
} from '../../types/ai';
import { AI_SKIP_QUESTIONS_VALUE } from '../../types/ai';
import {
  catalogFiltersToSearchParams,
  formatSlotChips,
  slotsOrNlToCatalogFilters,
  stripRatingFromReason,
} from '../../utils/aiChatUi';
import { formatChatTime, formatMessageTime } from '../../utils/chatUi';
import { formatMoney } from '../../utils/formatCatalog';
import '../../styles/chat.css';

const PLACEHOLDER = '/theme/images/product-image-1.png';
const OPEN_STORAGE_KEY = 'aidr.assistant.open';

const DEFAULT_PROMPTS = [
  'Help me choose a laptop',
  'I need a phone with a good camera',
  'How do returns and refunds work?',
  'What vouchers can I use at checkout?',
];

const PDP_PROMPTS = [
  'How long is the warranty on this item?',
  'Suggest similar alternatives',
  'Compare this with similar products',
];

const CART_PROMPTS = [
  'What vouchers can I use at checkout?',
  'How does shipping and delivery work?',
  'How do returns and refunds work?',
];

function SuggestedProducts({
  products,
  onNavigate,
  onAddCompare,
  isInCompare,
}: {
  products: AiSuggestedProduct[];
  onNavigate?: () => void;
  onAddCompare?: (product: AiSuggestedProduct) => void;
  isInCompare?: (productId: string) => boolean;
}) {
  if (products.length === 0) return null;

  return (
    <div className="aidr-assistant__products">
      {products.map((p) => {
        const showsRating = p.reviewCount > 0;
        // Keep the rating on its own line only; drop it from the reason so it is not repeated.
        const reason = showsRating ? stripRatingFromReason(p.reason) : (p.reason ?? '');
        return (
          <div key={p.productId} className="aidr-assistant__product-row">
            <Link
              to={`/products/${p.productId}`}
              className="aidr-assistant__product-card"
              onClick={onNavigate}
            >
              <img src={p.primaryImageUrl || PLACEHOLDER} alt="" />
              <div className="aidr-assistant__product-meta">
                <span className="aidr-assistant__product-name">{p.name}</span>
                {p.badge ? (
                  <span className="aidr-assistant__product-badge">{p.badge}</span>
                ) : null}
                <span className="aidr-assistant__product-price">
                  {formatMoney(p.effectivePrice, p.currency)}
                </span>
                {reason ? (
                  <span className="aidr-assistant__product-reason text-muted">{reason}</span>
                ) : null}
                {showsRating ? (
                  <span className="aidr-assistant__product-rating text-muted">
                    {p.avgRating.toFixed(1)} · {p.reviewCount} reviews
                  </span>
                ) : null}
              </div>
            </Link>
            {onAddCompare ? (
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary aidr-assistant__product-compare"
                disabled={isInCompare?.(p.productId)}
                onClick={() => onAddCompare(p)}
              >
                {isInCompare?.(p.productId) ? 'In compare' : 'Compare'}
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/** Tap-to-answer chips for the current consultation question. */
function QuickReplies({
  replies,
  consult,
  disabled,
  onPick,
  onSkip,
}: {
  replies: AiQuickReply[];
  consult: AiConsultState | null;
  disabled?: boolean;
  onPick: (reply: AiQuickReply) => void;
  onSkip: () => void;
}) {
  if (replies.length === 0) return null;

  const asked = consult?.askedCount ?? 0;
  const max = consult?.maxQuestions ?? 0;
  const showProgress = consult?.stage === 'collecting' && asked > 0 && max > 0;

  return (
    <div className="aidr-assistant__quick">
      {showProgress ? (
        <span className="aidr-assistant__quick-progress text-muted">
          Question {asked}/{max}
        </span>
      ) : null}
      <div className="aidr-assistant__quick-chips">
        {replies.map((reply) => (
          <button
            key={`${reply.key}-${reply.value}`}
            type="button"
            className="aidr-assistant__quick-chip"
            disabled={disabled}
            onClick={() => onPick(reply)}
          >
            {reply.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="aidr-assistant__quick-skip"
        disabled={disabled}
        onClick={onSkip}
      >
        Skip questions &amp; show options
      </button>
    </div>
  );
}

function ActionButtons({
  actions,
  onAction,
  disabled,
}: {
  actions: AiChatAction[];
  onAction: (action: AiChatAction) => void;
  disabled?: boolean;
}) {
  const usable = actions.filter((a) => a.type && a.type !== 'none');
  if (usable.length === 0) return null;

  return (
    <div className="aidr-assistant__actions">
      {usable.map((action, index) => (
        <button
          key={`${action.type}-${index}`}
          type="button"
          className="btn btn-sm btn-outline-secondary"
          disabled={disabled}
          onClick={() => onAction(action)}
        >
          {action.label?.trim() || action.type}
        </button>
      ))}
    </div>
  );
}

/** Floating shopping-assistant chatbot — available on all storefront pages. */
export function ShoppingAssistantWidget() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams<{ id?: string }>();
  const toast = useToast();
  const { isAuthenticated } = useAuth();
  const compareSelection = useAppSelector(selectCompareSelection);
  const compareCount = compareSelection.length;
  const { toggle: toggleCompare, isSelected, compare } = useCompare();
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
    lastSlots,
    lastActions,
    lastQuickReplies,
    lastConsult,
    maxLength,
    loadConversations,
    openConversation,
    startNew,
    clearSlots,
    send,
    getErrorMessage,
  } = useShoppingAssistant();

  const pageContext = useMemo((): AiChatContext => {
    const productMatch = location.pathname.match(/^\/products\/([^/]+)\/?$/);
    const productId = productMatch?.[1] && productMatch[1] !== 'compare' ? productMatch[1] : params.id;
    return {
      path: location.pathname + location.search,
      productId: productId || null,
      compareProductIds: compareSelection.map((x) => x.productId),
    };
  }, [compareSelection, location.pathname, location.search, params.id]);

  const quickPrompts = useMemo(() => {
    if (quietFab) return PDP_PROMPTS;
    if (location.pathname.startsWith('/cart') || location.pathname.startsWith('/checkout')) {
      return CART_PROMPTS;
    }
    return DEFAULT_PROMPTS;
  }, [location.pathname, quietFab]);

  const slotChips = useMemo(() => formatSlotChips(lastSlots), [lastSlots]);

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

  async function submitMessage(text: string, quickReplyValue?: string) {
    const content = text.trim();
    if (!content || sending) return;
    if (content.length > maxLength) {
      toast.error(`Message must be at most ${maxLength} characters.`);
      return;
    }

    try {
      await send(content, undefined, pageContext, quickReplyValue ?? null);
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

  function handleAddCompare(product: AiSuggestedProduct) {
    const wasSelected = isSelected(product.productId);
    const result = toggleCompare({
      productId: product.productId,
      name: product.name,
      primaryImageUrl: product.primaryImageUrl,
      effectivePrice: product.effectivePrice,
      currency: product.currency,
    });
    if (!result.ok) {
      toast.error('Compare list is full (max 5).');
      return;
    }
    toast.success(wasSelected ? 'Removed from compare.' : 'Added to compare.');
  }

  async function handleAction(action: AiChatAction) {
    const type = (action.type || '').toLowerCase();
    if (type === 'open_catalog') {
      const filters = slotsOrNlToCatalogFilters(lastSlots);
      navigate(catalogFiltersToSearchParams(filters));
      handleClose();
      return;
    }
    if (type === 'open_product') {
      const id = action.productIds?.[0];
      if (id) {
        navigate(`/products/${id}`);
        handleClose();
      }
      return;
    }
    if (type === 'open_compare') {
      const ids = (action.productIds ?? []).filter(Boolean);
      if (ids.length >= 2) {
        try {
          await compare(ids);
          navigate('/compare');
          handleClose();
        } catch (err) {
          toast.error(getErrorMessage(err, 'Unable to compare products.'));
        }
        return;
      }
      if (compareCount >= 2) {
        navigate('/compare');
        handleClose();
      } else {
        toast.error('Add at least 2 products to compare.');
      }
    }
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
              {slotChips.length > 0 ? (
                <div className="aidr-assistant__slots" aria-label="Active preferences">
                  {slotChips.map((chip) => (
                    <span key={chip} className="aidr-assistant__slot-chip">
                      {chip}
                    </span>
                  ))}
                  <button
                    type="button"
                    className="aidr-assistant__slot-clear"
                    onClick={() => {
                      clearSlots();
                      handleNewChat();
                    }}
                    title="Clear preferences and start a new chat"
                  >
                    Clear
                  </button>
                </div>
              ) : null}

              <div className="aidr-assistant-widget__messages">
                {messagesLoading ? <p className="text-muted mb-2">Loading messages…</p> : null}
                {messagesError ? <p className="text-danger mb-2">{messagesError}</p> : null}

                {!messagesLoading && messages.length === 0 ? (
                  <div className="aidr-assistant__empty aidr-assistant__empty--widget">
                    <p className="mb-2">
                      Hi! I can help with product picks and shopping FAQs.
                    </p>
                    <div className="aidr-assistant__prompts">
                      {quickPrompts.map((prompt) => (
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
                  {messages.map((m, index) => {
                    const isUser = m.role === 'user';
                    const isLastAssistant =
                      !isUser && index === messages.length - 1 && m.role === 'assistant';
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
                              onAddCompare={handleAddCompare}
                              isInCompare={isSelected}
                            />
                          ) : null}
                          {isLastAssistant ? (
                            <ActionButtons
                              actions={lastActions}
                              onAction={(a) => void handleAction(a)}
                              disabled={sending}
                            />
                          ) : null}
                          {isLastAssistant ? (
                            <QuickReplies
                              replies={lastQuickReplies}
                              consult={lastConsult}
                              disabled={sending}
                              onPick={(reply) => void submitMessage(reply.label, reply.value)}
                              onSkip={() =>
                                void submitMessage('Show me options', AI_SKIP_QUESTIONS_VALUE)
                              }
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
        {open ? '×' : quietFab ? '✨' : '✨'}
      </button>
    </div>
  );
}
