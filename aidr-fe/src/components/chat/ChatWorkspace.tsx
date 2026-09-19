import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChatAvatar } from './ChatAvatar';
import { ChatComposer, type ChatComposerHandle } from './ChatComposer';
import {
  BackIcon,
  ChatBubbleIcon,
  CloseIcon,
  ImageIcon,
  RefreshIcon,
  SearchIcon,
  TagIcon,
} from './ChatIcons';
import { ChatMessageList } from './ChatMessageList';
import { useChat } from '../../hooks/useChat';
import { useChatHub } from '../../hooks/useChatHub';
import { useChatLiveSync } from '../../hooks/useChatSync';
import { useToast } from '../../hooks/useToast';
import {
  formatChatTime,
  formatRelativeActivity,
  threadPeerAvatar,
  threadPeerName,
  threadPreviewText,
} from '../../utils/chatUi';
import '../../styles/chat.css';

type ChatWorkspaceProps = {
  variant?: 'store' | 'admin';
};

export function ChatWorkspace({ variant = 'admin' }: ChatWorkspaceProps) {
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [bootstrapped, setBootstrapped] = useState(false);
  /** On narrow screens the two panes share the viewport, one at a time. */
  const [threadPaneOpen, setThreadPaneOpen] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const openKeyRef = useRef<string | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const composerRef = useRef<ChatComposerHandle | null>(null);
  const dragDepthRef = useRef(0);

  const {
    threads,
    messages,
    activeThreadId,
    activeThread,
    loadingThreads,
    loadingMessages,
    loadingOlderMessages,
    hasOlderMessages,
    peerIsTyping,
    typingByThread,
    currentUserId,
    sending,
    opening,
    error,
    totalUnread,
    markRead,
    refreshThreads,
    selectThread,
    openThread,
    loadOlderMessages,
    syncActiveThread,
    send,
    notifyTyping,
    getErrorMessage,
  } = useChat({ autoLoadThreads: true });

  useChatHub();
  useChatLiveSync({ activeThreadId, refreshThreads, syncActiveThread });

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
          setThreadPaneOpen(true);
        } else if (shopId) {
          const key = `shop:${shopId}:${productId ?? ''}`;
          if (openKeyRef.current !== key) {
            openKeyRef.current = key;
            const thread = await openThread({ shopId, productId: productId || null });
            resolvedThreadId = thread.threadId;
            setThreadPaneOpen(true);
          }
        } else if (threads[0]) {
          // Desktop opens the newest conversation; mobile still lands on the list.
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

  // Anything that lands in the conversation already on screen counts as read.
  const lastMessage = messages[messages.length - 1];
  useEffect(() => {
    if (!activeThreadId || !lastMessage || lastMessage.isMine || lastMessage.isRead) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    void markRead(activeThreadId).catch(() => {
      // Read receipts are best-effort.
    });
  }, [activeThreadId, lastMessage, markRead]);

  const handleSelectThread = useCallback(
    async (threadId: string) => {
      setThreadPaneOpen(true);
      if (threadId === activeThreadId) return;
      try {
        await selectThread(threadId);
      } catch (err) {
        toast.error(getErrorMessage(err, 'Unable to open conversation.'));
      }
    },
    [activeThreadId, getErrorMessage, selectThread, toast],
  );

  const handleSend = useCallback(
    async (payload: { content: string | null; attachmentUrl: string | null }) => {
      if (!activeThreadId) return;
      try {
        await send(activeThreadId, payload);
      } catch (err) {
        toast.error(getErrorMessage(err, 'Unable to send message.'));
        throw err;
      }
    },
    [activeThreadId, getErrorMessage, send, toast],
  );

  const handleTyping = useCallback(
    (isTyping: boolean) => {
      if (activeThreadId) notifyTyping(activeThreadId, isTyping);
    },
    [activeThreadId, notifyTyping],
  );

  const handleRefresh = useCallback(async () => {
    try {
      await refreshThreads();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to refresh conversations.'));
    }
  }, [getErrorMessage, refreshThreads, toast]);

  const handleLoadOlder = useCallback(() => {
    void loadOlderMessages().catch((err) => {
      toast.error(getErrorMessage(err, 'Unable to load older messages.'));
    });
  }, [getErrorMessage, loadOlderMessages, toast]);

  // Dragenter/leave fire for every child, so track depth instead of toggling on each event.
  function handleDragEnter(event: React.DragEvent) {
    if (!event.dataTransfer?.types?.includes('Files')) return;
    dragDepthRef.current += 1;
    setDragActive(true);
  }

  function handleDragLeave() {
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setDragActive(false);
  }

  function handleDrop(event: React.DragEvent) {
    if (!event.dataTransfer?.files?.length) return;
    event.preventDefault();
    dragDepthRef.current = 0;
    setDragActive(false);
    composerRef.current?.attachFiles(event.dataTransfer.files);
  }

  const peerName = activeThread ? threadPeerName(activeThread) : '';
  const peerAvatar = activeThread ? threadPeerAvatar(activeThread) : null;
  const showSkeletons = loadingThreads && threads.length === 0;

  return (
    <div
      className={`chat-workspace chat-workspace--${variant}${
        threadPaneOpen ? ' is-thread-open' : ''
      }`}
    >
      <aside className="chat-sidebar">
        <header className="chat-sidebar__head">
          <h2 className="chat-sidebar__title">
            Chat
            {totalUnread > 0 ? <span className="chat-count">{totalUnread}</span> : null}
          </h2>
          <button
            type="button"
            className="chat-icon-btn"
            onClick={() => void handleRefresh()}
            disabled={loadingThreads || opening}
            title="Refresh conversations"
            aria-label="Refresh conversations"
          >
            <RefreshIcon className={loadingThreads ? 'is-spinning' : undefined} />
          </button>
        </header>

        <div className="chat-finder">
          <SearchIcon className="chat-finder__icon" />
          <input
            ref={searchRef}
            type="text"
            className="chat-finder__input"
            placeholder="Search conversations"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setSearch('')}
            aria-label="Search conversations"
          />
          {search ? (
            <button
              type="button"
              className="chat-finder__clear"
              onClick={() => {
                setSearch('');
                searchRef.current?.focus();
              }}
              aria-label="Clear search"
            >
              <CloseIcon />
            </button>
          ) : null}
        </div>

        <div className="chat-list" role="list">
          {showSkeletons
            ? Array.from({ length: 5 }, (_, i) => (
                <div className="chat-list__skeleton" key={i} aria-hidden="true">
                  <span className="chat-skeleton chat-skeleton--avatar" />
                  <span className="chat-skeleton chat-skeleton--line" />
                  <span className="chat-skeleton chat-skeleton--line chat-skeleton--short" />
                </div>
              ))
            : null}

          {!showSkeletons && filteredThreads.length === 0 ? (
            <div className="chat-list__empty">
              <ChatBubbleIcon />
              <p className="chat-list__empty-title">
                {search.trim() ? 'No matches' : 'No conversations yet'}
              </p>
              <p>
                {search.trim()
                  ? 'Try a different name, product or keyword.'
                  : 'Message a shop from any product or shop page to start one.'}
              </p>
            </div>
          ) : null}

          {filteredThreads.map((thread) => {
            const name = threadPeerName(thread);
            const active = thread.threadId === activeThreadId;
            const typingUserId = typingByThread[thread.threadId];
            const typing = Boolean(typingUserId && typingUserId !== currentUserId);
            return (
              <button
                key={thread.threadId}
                type="button"
                role="listitem"
                className={`chat-list__item${active ? ' is-active' : ''}${
                  thread.unreadCount > 0 ? ' is-unread' : ''
                }`}
                onClick={() => void handleSelectThread(thread.threadId)}
                aria-current={active}
              >
                <ChatAvatar name={name} src={threadPeerAvatar(thread)} size={44} />
                <span className="chat-list__body">
                  <span className="chat-list__top">
                    <span className="chat-list__name">{name}</span>
                    <time className="chat-list__time">
                      {formatChatTime(thread.lastMessageAt ?? thread.createdAt)}
                    </time>
                  </span>
                  <span className="chat-list__bottom">
                    <span className="chat-list__preview">
                      {typing ? (
                        <em className="chat-list__typing">typing…</em>
                      ) : (
                        threadPreviewText(thread)
                      )}
                    </span>
                    {thread.unreadCount > 0 ? (
                      <span className="chat-badge">
                        {thread.unreadCount > 99 ? '99+' : thread.unreadCount}
                      </span>
                    ) : null}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </aside>

      <section
        className={`chat-main${dragActive ? ' is-drop-target' : ''}`}
        onDragEnter={handleDragEnter}
        onDragOver={(e) => {
          if (e.dataTransfer?.types?.includes('Files')) e.preventDefault();
        }}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {!activeThread ? (
          <div className="chat-empty">
            <span className="chat-empty__art">
              <ChatBubbleIcon />
            </span>
            <h3>Select a conversation</h3>
            <p>
              Pick someone from the list to read the history and reply. New messages arrive live -
              no refresh needed.
            </p>
          </div>
        ) : (
          <>
            <header className="chat-main__head">
              <button
                type="button"
                className="chat-icon-btn chat-main__back"
                onClick={() => setThreadPaneOpen(false)}
                aria-label="Back to conversations"
              >
                <BackIcon />
              </button>

              <ChatAvatar name={peerName} src={peerAvatar} size={40} badge="online" />

              <div className="chat-main__identity">
                <h3 className="chat-main__name">{peerName}</h3>
                <p className="chat-main__status">
                  {peerIsTyping
                    ? 'typing…'
                    : formatRelativeActivity(activeThread.lastMessageAt) ||
                      (activeThread.myRole === 'Seller' ? 'Buyer conversation' : 'Shop conversation')}
                </p>
              </div>

              {activeThread.productName ? (
                <span className="chat-main__context" title={activeThread.productName}>
                  <TagIcon />
                  <span>{activeThread.productName}</span>
                </span>
              ) : null}
            </header>

            <ChatMessageList
              messages={messages}
              activeThreadId={activeThreadId}
              peerName={peerName}
              peerAvatar={peerAvatar}
              loading={loadingMessages}
              loadingOlder={loadingOlderMessages}
              hasOlder={hasOlderMessages}
              peerIsTyping={peerIsTyping}
              onLoadOlder={handleLoadOlder}
            />

            <ChatComposer
              ref={composerRef}
              threadId={activeThreadId}
              peerName={peerName}
              shopId={activeThread.shopId}
              shopName={activeThread.shopName}
              sending={sending}
              onSend={handleSend}
              onTyping={handleTyping}
            />

            {dragActive ? (
              <div className="chat-drop" aria-hidden="true">
                <ImageIcon />
                <p>Drop an image to send it</p>
              </div>
            ) : null}
          </>
        )}
      </section>

      {error ? (
        <p className="chat-workspace__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
