import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useChat } from '../../hooks/useChat';
import { useChatHub } from '../../hooks/useChatHub';
import { useToast } from '../../hooks/useToast';
import {
  avatarInitial,
  formatChatTime,
  formatMessageTime,
  threadPeerAvatar,
  threadPeerName,
} from '../../utils/chatUi';
import '../../styles/chat.css';

type ChatWorkspaceProps = {
  variant?: 'store' | 'admin';
};

export function ChatWorkspace({ variant = 'admin' }: ChatWorkspaceProps) {
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [showAttachment, setShowAttachment] = useState(false);
  const [bootstrapped, setBootstrapped] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const openKeyRef = useRef<string | null>(null);

  const {
    threads,
    messages,
    activeThreadId,
    activeThread,
    loadingThreads,
    loadingMessages,
    sending,
    opening,
    error,
    selectThread,
    openThread,
    send,
    getErrorMessage,
  } = useChat({ autoLoadThreads: true });

  useChatHub(activeThreadId);

  const filteredThreads = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter((thread) => {
      const name = threadPeerName(thread).toLowerCase();
      const preview = (thread.lastMessagePreview ?? '').toLowerCase();
      const product = (thread.productName ?? '').toLowerCase();
      return name.includes(q) || preview.includes(q) || product.includes(q);
    });
  }, [search, threads]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeThreadId]);

  useEffect(() => {
    if (bootstrapped || loadingThreads) return;

    const threadId = searchParams.get('threadId');
    const shopId = searchParams.get('shopId');
    const productId = searchParams.get('productId');

    void (async () => {
      let resolvedThreadId: string | null = threadId;
      try {
        if (threadId) {
          openKeyRef.current = `thread:${threadId}`;
          await selectThread(threadId);
        } else if (shopId) {
          const key = `shop:${shopId}:${productId ?? ''}`;
          if (openKeyRef.current !== key) {
            openKeyRef.current = key;
            const thread = await openThread({
              shopId,
              productId: productId || null,
            });
            resolvedThreadId = thread.threadId;
          }
        } else if (threads[0]) {
          resolvedThreadId = threads[0].threadId;
          await selectThread(threads[0].threadId);
        }
      } catch (err) {
        toast.error(getErrorMessage(err, 'Unable to open chat.'));
      } finally {
        setBootstrapped(true);
        if (shopId || productId || (resolvedThreadId && searchParams.get('threadId') !== resolvedThreadId)) {
          const next = new URLSearchParams();
          if (resolvedThreadId) next.set('threadId', resolvedThreadId);
          setSearchParams(next, { replace: true });
        }
      }
    })();
  }, [
    bootstrapped,
    getErrorMessage,
    loadingThreads,
    openThread,
    searchParams,
    selectThread,
    setSearchParams,
    threads,
    toast,
  ]);

  useEffect(() => {
    if (!bootstrapped || !activeThreadId) return;
    if (searchParams.get('threadId') === activeThreadId) return;
    const next = new URLSearchParams();
    next.set('threadId', activeThreadId);
    setSearchParams(next, { replace: true });
  }, [activeThreadId, bootstrapped, searchParams, setSearchParams]);

  async function handleSelectThread(threadId: string) {
    try {
      await selectThread(threadId);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to open conversation.'));
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!activeThreadId) return;

    const content = draft.trim();
    const attachment = attachmentUrl.trim();
    if (!content && !attachment) return;

    try {
      await send(activeThreadId, {
        content: content || null,
        attachmentUrl: attachment || null,
      });
      setDraft('');
      setAttachmentUrl('');
      setShowAttachment(false);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to send message.'));
    }
  }

  const peerName = activeThread ? threadPeerName(activeThread) : null;
  const peerAvatar = activeThread ? threadPeerAvatar(activeThread) : null;
  const rootClass = variant === 'store' ? 'aidr-chat aidr-chat--store' : 'aidr-chat aidr-chat--admin';

  return (
    <div className={rootClass}>
      <div className="row g-1">
        <div className="col-xxl-3 col-lg-4">
          <div className="card position-relative overflow-hidden h-100">
            <div className="card-header border-0 d-flex justify-content-between align-items-center">
              <h4 className="card-title mb-0">Chat</h4>
              {(opening || loadingThreads) && (
                <span className="text-muted fs-13">Loading…</span>
              )}
            </div>

            <form
              className="chat-search px-3"
              onSubmit={(e) => {
                e.preventDefault();
              }}
            >
              <div className="chat-search-box">
                <input
                  className="form-control"
                  type="search"
                  name="search"
                  placeholder="Search…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label="Search conversations"
                />
                <span className="btn btn-sm btn-link search-icon p-0" aria-hidden>
                  <i className="bx bx-search-alt" />
                </span>
              </div>
            </form>

            <div className="px-3 mb-3 chat-setting-height aidr-chat__thread-list">
              {loadingThreads && threads.length === 0 ? (
                <p className="text-muted py-3 mb-0">Loading conversations…</p>
              ) : null}

              {!loadingThreads && filteredThreads.length === 0 ? (
                <p className="text-muted py-3 mb-0">
                  {search.trim()
                    ? 'No conversations match your search.'
                    : 'No conversations yet. Message a shop from a product or shop page.'}
                </p>
              ) : null}

              {filteredThreads.map((thread) => {
                const name = threadPeerName(thread);
                const avatar = threadPeerAvatar(thread);
                const active = thread.threadId === activeThreadId;
                return (
                  <button
                    key={thread.threadId}
                    type="button"
                    className="text-body aidr-chat__thread-btn"
                    onClick={() => void handleSelectThread(thread.threadId)}
                  >
                    <div
                      className={`d-flex align-items-center p-2 rounded-1${
                        active ? ' bg-light bg-opacity-50' : ''
                      }`}
                    >
                      <div className="flex-shrink-0 position-relative">
                        {avatar ? (
                          <img
                            src={avatar}
                            className="me-2 rounded-circle"
                            height={36}
                            width={36}
                            alt=""
                          />
                        ) : (
                          <span className="aidr-chat__avatar-fallback me-2">{avatarInitial(name)}</span>
                        )}
                      </div>
                      <div className="flex-grow-1 overflow-hidden text-start">
                        <h5 className="my-0 fs-14">
                          <span className="float-end text-muted fs-13 fw-normal">
                            {formatChatTime(thread.lastMessageAt ?? thread.createdAt)}
                          </span>
                          {name}
                        </h5>
                        <p className="mt-1 mb-0 fs-13 text-muted d-flex align-items-end justify-content-between gap-2">
                          <span className="w-75 text-truncate">
                            {thread.lastMessagePreview ||
                              (thread.productName
                                ? `About: ${thread.productName}`
                                : 'No messages yet')}
                          </span>
                          {thread.unreadCount > 0 ? (
                            <span className="badge bg-danger rounded-pill">{thread.unreadCount}</span>
                          ) : null}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="col-xxl-9 col-lg-8">
          <div className="card position-relative overflow-hidden h-100">
            {!activeThread ? (
              <div className="aidr-chat__empty d-flex align-items-center justify-content-center p-4">
                <p className="text-muted mb-0">Select a conversation to start messaging.</p>
              </div>
            ) : (
              <>
                <div className="card-header d-flex align-items-center mh-100">
                  <div className="d-flex align-items-center">
                    {peerAvatar ? (
                      <img
                        src={peerAvatar}
                        className="me-2 rounded"
                        height={36}
                        width={36}
                        alt=""
                      />
                    ) : (
                      <span className="aidr-chat__avatar-fallback me-2">
                        {avatarInitial(peerName ?? '')}
                      </span>
                    )}
                    <div className="d-flex flex-column">
                      <h5 className="my-0 fs-16 fw-semibold text-dark">{peerName}</h5>
                      {activeThread.productName ? (
                        <p className="mb-0 text-muted fs-13">
                          Product: {activeThread.productName}
                        </p>
                      ) : (
                        <p className="mb-0 text-muted fs-13">
                          {activeThread.myRole === 'Seller' ? 'Buyer chat' : 'Shop chat'}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="chat-box">
                  <ul className="chat-conversation-list p-3 chatbox-height aidr-chat__messages">
                    {loadingMessages && messages.length === 0 ? (
                      <li className="clearfix">
                        <p className="text-muted mb-0">Loading messages…</p>
                      </li>
                    ) : null}

                    {!loadingMessages && messages.length === 0 ? (
                      <li className="clearfix">
                        <p className="text-muted mb-0">No messages yet. Say hello!</p>
                      </li>
                    ) : null}

                    {messages.map((message) => (
                      <li
                        key={message.messageId}
                        className={`clearfix${message.isMine ? ' odd' : ''}`}
                      >
                        <div className={`chat-conversation-text${message.isMine ? ' ms-0' : ''}`}>
                          <div className={`d-flex${message.isMine ? ' justify-content-end' : ''}`}>
                            <div className="chat-ctext-wrap">
                              {message.content?.trim() ? <p>{message.content}</p> : null}
                              {message.attachmentUrl ? (
                                <a
                                  href={message.attachmentUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="aidr-chat__attachment"
                                >
                                  {/\.(png|jpe?g|gif|webp)(\?|$)/i.test(message.attachmentUrl) ? (
                                    <img
                                      src={message.attachmentUrl}
                                      alt="Attachment"
                                      className="img-thumbnail"
                                      style={{ maxHeight: 120 }}
                                    />
                                  ) : (
                                    <span>View attachment</span>
                                  )}
                                </a>
                              ) : null}
                            </div>
                          </div>
                          <p
                            className={`text-muted fs-12 mb-0 mt-1${
                              message.isMine ? '' : ' ms-2'
                            }`}
                          >
                            {formatMessageTime(message.createdAt)}
                            {message.isMine ? (
                              <i
                                className={`bx bx-check-double ms-1${
                                  message.isRead ? ' text-primary' : ''
                                }`}
                              />
                            ) : null}
                          </p>
                        </div>
                      </li>
                    ))}
                    <div ref={messagesEndRef} />
                  </ul>

                  <div className="bg-light bg-opacity-50 p-2">
                    {showAttachment ? (
                      <div className="mb-2 px-1">
                        <input
                          type="url"
                          className="form-control form-control-sm"
                          placeholder="Attachment URL (optional)"
                          value={attachmentUrl}
                          onChange={(e) => setAttachmentUrl(e.target.value)}
                          maxLength={512}
                        />
                      </div>
                    ) : null}
                    <form className="needs-validation" onSubmit={(e) => void handleSubmit(e)}>
                      <div className="row align-items-center">
                        <div className="col mb-2 mb-sm-0 d-flex">
                          <div className="input-group">
                            <input
                              type="text"
                              className="form-control border-0"
                              placeholder="Enter your message"
                              value={draft}
                              onChange={(e) => setDraft(e.target.value)}
                              maxLength={2000}
                              disabled={sending}
                              aria-label="Message"
                            />
                          </div>
                        </div>
                        <div className="col-sm-auto">
                          <div className="btn-group btn-toolbar">
                            <button
                              type="button"
                              className="btn btn-sm btn-light"
                              title="Add attachment URL"
                              onClick={() => setShowAttachment((v) => !v)}
                            >
                              <i className="bx bx-paperclip fs-18" />
                            </button>
                            <button
                              type="submit"
                              className="btn btn-sm btn-primary chat-send"
                              disabled={
                                sending || (!draft.trim() && !attachmentUrl.trim())
                              }
                              aria-label="Send message"
                            >
                              <i className="bx bx-send fs-18" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </form>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {error ? (
        <p className="text-danger mt-2 mb-0" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
