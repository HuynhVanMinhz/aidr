import { useEffect, useLayoutEffect, useRef } from 'react';
import { ChatAvatar } from './ChatAvatar';
import { CheckIcon, DoubleCheckIcon, ImageIcon } from './ChatIcons';
import { ChatProductPreviewCard } from './ChatProductCard';
import { useProductPreviews } from '../../hooks/useProductPreviews';
import {
  attachmentFileName,
  extractProductIds,
  formatDayLabel,
  formatMessageTime,
  isImageAttachment,
  isSameDay,
  parseChatDate,
  splitMessageText,
  stripProductLinks,
} from '../../utils/chatUi';
import type { ChatMessage } from '../../types/chat';

/** Messages closer together than this from the same sender render as one visual group. */
const GROUP_WINDOW_MS = 5 * 60_000;
/** How far from the bottom still counts as "following the conversation". */
const STICK_TO_BOTTOM_PX = 120;

type ChatMessageListProps = {
  messages: ChatMessage[];
  activeThreadId: string | null;
  peerName: string;
  peerAvatar: string | null;
  loading: boolean;
  loadingOlder: boolean;
  hasOlder: boolean;
  peerIsTyping: boolean;
  onLoadOlder: () => void;
};

type Row = {
  message: ChatMessage;
  dayLabel: string | null;
  startsGroup: boolean;
  endsGroup: boolean;
};

function buildRows(messages: ChatMessage[]): Row[] {
  return messages.map((message, index) => {
    const prev = messages[index - 1];
    const next = messages[index + 1];
    // Same UTC normalisation as the timestamp labels, or grouping and day separators drift.
    const at = parseChatDate(message.createdAt) ?? new Date(0);

    const prevAt = prev ? parseChatDate(prev.createdAt) : null;
    const nextAt = next ? parseChatDate(next.createdAt) : null;

    const newDay = !prevAt || !isSameDay(at, prevAt);
    const startsGroup =
      newDay ||
      !prev ||
      prev.senderUserId !== message.senderUserId ||
      at.getTime() - prevAt!.getTime() > GROUP_WINDOW_MS;
    const endsGroup =
      !next ||
      next.senderUserId !== message.senderUserId ||
      !isSameDay(at, nextAt!) ||
      nextAt!.getTime() - at.getTime() > GROUP_WINDOW_MS;

    return {
      message,
      dayLabel: newDay ? formatDayLabel(message.createdAt) : null,
      startsGroup,
      endsGroup,
    };
  });
}

/** Renders message text with bare URLs turned into real links. */
function MessageText({ value }: { value: string }) {
  return (
    <p className="chat-msg__text">
      {splitMessageText(value).map((part, index) =>
        part.type === 'link' ? (
          <a
            key={index}
            className="chat-msg__link"
            href={part.value}
            target="_blank"
            rel="noreferrer noopener"
          >
            {part.value}
          </a>
        ) : (
          <span key={index}>{part.value}</span>
        ),
      )}
    </p>
  );
}

export function ChatMessageList({
  messages,
  activeThreadId,
  peerName,
  peerAvatar,
  loading,
  loadingOlder,
  hasOlder,
  peerIsTyping,
  onLoadOlder,
}: ChatMessageListProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);
  const prevCountRef = useRef(0);
  const prevFirstIdRef = useRef<string | null>(null);
  const prevHeightRef = useRef(0);

  // Reset the follow behaviour whenever a different conversation is opened.
  useEffect(() => {
    stickToBottomRef.current = true;
    prevCountRef.current = 0;
    prevFirstIdRef.current = null;
  }, [activeThreadId]);

  useLayoutEffect(() => {
    const node = scrollRef.current;
    if (!node) return;

    const firstId = messages[0]?.messageId ?? null;
    const prependedOlder =
      prevFirstIdRef.current != null &&
      firstId !== prevFirstIdRef.current &&
      messages.length > prevCountRef.current;

    if (prependedOlder) {
      // Keep the reader anchored on the message they were looking at.
      node.scrollTop += node.scrollHeight - prevHeightRef.current;
    } else if (stickToBottomRef.current || messages.length !== prevCountRef.current) {
      const appended = messages.length > prevCountRef.current;
      const mineIsLast = messages[messages.length - 1]?.isMine;
      if (stickToBottomRef.current || (appended && mineIsLast)) {
        node.scrollTop = node.scrollHeight;
      }
    }

    prevCountRef.current = messages.length;
    prevFirstIdRef.current = firstId;
    prevHeightRef.current = node.scrollHeight;
  }, [messages, activeThreadId]);

  useEffect(() => {
    if (!peerIsTyping || !stickToBottomRef.current) return;
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [peerIsTyping]);

  function handleScroll() {
    const node = scrollRef.current;
    if (!node) return;

    const distanceFromBottom = node.scrollHeight - node.scrollTop - node.clientHeight;
    stickToBottomRef.current = distanceFromBottom <= STICK_TO_BOTTOM_PX;

    if (node.scrollTop <= 48 && hasOlder && !loadingOlder) {
      prevHeightRef.current = node.scrollHeight;
      onLoadOlder();
    }
  }

  const rows = buildRows(messages);

  // One batched lookup for every product linked anywhere in the conversation.
  const productIds = [...new Set(messages.flatMap((m) => extractProductIds(m.content)))];
  const products = useProductPreviews(productIds);

  return (
    <div className="chat-thread" ref={scrollRef} onScroll={handleScroll}>
      <div className="chat-thread__inner">
        {hasOlder ? (
          <div className="chat-thread__older">
            <button
              type="button"
              className="chat-ghost-btn"
              onClick={onLoadOlder}
              disabled={loadingOlder}
            >
              {loadingOlder ? 'Loading…' : 'Load earlier messages'}
            </button>
          </div>
        ) : null}

        {loading && messages.length === 0 ? (
          <div className="chat-thread__state">
            <span className="chat-spinner" aria-hidden="true" />
            <p>Loading messages…</p>
          </div>
        ) : null}

        {!loading && messages.length === 0 ? (
          <div className="chat-thread__state">
            <p className="chat-thread__state-title">No messages yet</p>
            <p>Say hello - {peerName} will be notified right away.</p>
          </div>
        ) : null}

        {rows.map(({ message, dayLabel, startsGroup, endsGroup }) => (
          <div key={message.messageId}>
            {dayLabel ? (
              <div className="chat-day">
                <span>{dayLabel}</span>
              </div>
            ) : null}

            <div
              className={[
                'chat-msg',
                message.isMine ? 'chat-msg--mine' : 'chat-msg--peer',
                startsGroup ? 'chat-msg--group-start' : '',
                endsGroup ? 'chat-msg--group-end' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {!message.isMine ? (
                <span className="chat-msg__avatar">
                  {startsGroup ? (
                    <ChatAvatar
                      name={message.senderFullName || peerName}
                      src={message.senderAvatarUrl ?? peerAvatar}
                      size={28}
                    />
                  ) : null}
                </span>
              ) : null}

              <div className="chat-msg__body">
                <div className="chat-msg__bubble">
                  {(() => {
                    // Product URLs are rendered as cards, so drop them from the text itself.
                    const text = stripProductLinks(message.content);
                    return text ? <MessageText value={text} /> : null;
                  })()}

                  {extractProductIds(message.content).map((productId) => (
                    <ChatProductPreviewCard
                      key={productId}
                      productId={productId}
                      preview={products.get(productId) ?? { status: 'loading' }}
                    />
                  ))}

                  {message.attachmentUrl ? (
                    <a
                      className={`chat-msg__attachment${
                        isImageAttachment(message.attachmentUrl)
                          ? ' chat-msg__attachment--image'
                          : ''
                      }`}
                      href={message.attachmentUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {isImageAttachment(message.attachmentUrl) ? (
                        <img src={message.attachmentUrl} alt="Attachment" loading="lazy" />
                      ) : (
                        <>
                          <ImageIcon />
                          <span>{attachmentFileName(message.attachmentUrl)}</span>
                        </>
                      )}
                    </a>
                  ) : null}
                </div>

                {endsGroup ? (
                  <p className="chat-msg__meta">
                    <time dateTime={message.createdAt}>{formatMessageTime(message.createdAt)}</time>
                    {message.isMine ? (
                      <span
                        className={`chat-msg__ticks${message.isRead ? ' is-read' : ''}`}
                        title={message.isRead ? 'Read' : 'Sent'}
                      >
                        {message.isRead ? <DoubleCheckIcon /> : <CheckIcon />}
                      </span>
                    ) : null}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        ))}

        {peerIsTyping ? (
          <div className="chat-msg chat-msg--peer chat-msg--group-start chat-msg--group-end">
            <span className="chat-msg__avatar">
              <ChatAvatar name={peerName} src={peerAvatar} size={28} />
            </span>
            <div className="chat-msg__body">
              <div className="chat-msg__bubble chat-msg__bubble--typing" aria-label="typing">
                <span />
                <span />
                <span />
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
