import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import {
  answerProductQuestion,
  askProductQuestion,
  listProductQuestions,
  requireProductQuestionList,
} from '../../services/productQaApi';
import type { ProductQuestion } from '../../types/v2Features';
import { formatDateVi } from '../../utils/formatCatalog';
import { tryValidateField, visibleFieldErrors } from '../../utils/formValidation';

const PAGE_SIZE = 10;
const MIN_CONTENT = 5;
const MAX_QUESTION = 1000;
const MAX_ANSWER = 2000;

type Props = {
  productId: string;
  active?: boolean;
};

function validateQuestionContent(value: string) {
  const trimmed = value.trim();
  if (trimmed.length < MIN_CONTENT) {
    throw new Error(`Question must be at least ${MIN_CONTENT} characters.`);
  }
  if (trimmed.length > MAX_QUESTION) {
    throw new Error(`Question must not exceed ${MAX_QUESTION} characters.`);
  }
}

function validateAnswerContent(value: string) {
  const trimmed = value.trim();
  if (trimmed.length < MIN_CONTENT) {
    throw new Error(`Answer must be at least ${MIN_CONTENT} characters.`);
  }
  if (trimmed.length > MAX_ANSWER) {
    throw new Error(`Answer must not exceed ${MAX_ANSWER} characters.`);
  }
}

function QuestionItem({
  question,
  onAnswered,
}: {
  question: ProductQuestion;
  onAnswered: () => void;
}) {
  const toast = useToast();
  const [showAnswerForm, setShowAnswerForm] = useState(false);
  const [content, setContent] = useState('');
  const [dirty, setDirty] = useState(false);
  const [touched, setTouched] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const error = useMemo(
    () => tryValidateField(() => validateAnswerContent(content)),
    [content],
  );
  const visibleError = visibleFieldErrors({ content: error }, { content: touched }, submitted).content;
  const canSubmit = dirty && !error;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    setTouched(true);
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      const result = await answerProductQuestion(question.questionId, {
        content: content.trim(),
      });
      if (!result.success) {
        throw new Error(result.message ?? 'Unable to post answer.');
      }
      toast.success('Answer posted.');
      setContent('');
      setDirty(false);
      setShowAnswerForm(false);
      setSubmitted(false);
      setTouched(false);
      onAnswered();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to post answer.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <article className="catalog-qa-item">
      <header className="catalog-qa-item__head">
        <div className="catalog-qa-item__avatar">
          {question.userAvatarUrl ? (
            <img src={question.userAvatarUrl} alt="" />
          ) : (
            <span>{question.userName.charAt(0).toUpperCase()}</span>
          )}
        </div>
        <div>
          <p className="catalog-qa-item__author">{question.userName}</p>
          <time className="catalog-qa-item__date" dateTime={question.createdAt}>
            {formatDateVi(question.createdAt)}
          </time>
        </div>
      </header>

      <p className="catalog-qa-item__question">{question.content}</p>

      {question.answers.length > 0 ? (
        <ul className="catalog-qa-answers">
          {question.answers.map((answer) => (
            <li key={answer.answerId} className="catalog-qa-answer">
              <div className="catalog-qa-answer__head">
                <span className="catalog-qa-answer__author">{answer.userName}</span>
                {answer.isOfficial ? (
                  <span className="catalog-qa-answer__badge">Official</span>
                ) : null}
                <time dateTime={answer.createdAt}>{formatDateVi(answer.createdAt)}</time>
              </div>
              <p>{answer.content}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="catalog-muted">No answers yet.</p>
      )}

      {!showAnswerForm ? (
        <button
          type="button"
          className="btn-default btn-accent btn-border catalog-qa-item__reply-btn"
          onClick={() => setShowAnswerForm(true)}
        >
          Answer this question
        </button>
      ) : (
        <form className="catalog-qa-form" onSubmit={(event) => void handleSubmit(event)}>
          <label htmlFor={`answer-${question.questionId}`}>Your answer</label>
          <textarea
            id={`answer-${question.questionId}`}
            className="form-control"
            rows={3}
            maxLength={MAX_ANSWER}
            value={content}
            onChange={(event) => {
              setContent(event.target.value);
              setDirty(true);
            }}
            onBlur={() => setTouched(true)}
            placeholder="Share what you know about this product"
          />
          {visibleError ? <p className="form-field-error">{visibleError}</p> : null}
          <div className="catalog-qa-form__actions">
            <button type="submit" className="btn-default btn-accent" disabled={!canSubmit || submitting}>
              {submitting ? 'Posting…' : 'Post answer'}
            </button>
            <button
              type="button"
              className="btn-default btn-accent btn-border"
              disabled={submitting}
              onClick={() => {
                setShowAnswerForm(false);
                setContent('');
                setDirty(false);
                setTouched(false);
                setSubmitted(false);
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </article>
  );
}

export function ProductQaPanel({ productId, active = true }: Props) {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<ProductQuestion[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [question, setQuestion] = useState('');
  const [questionDirty, setQuestionDirty] = useState(false);
  const [questionTouched, setQuestionTouched] = useState(false);
  const [questionSubmitted, setQuestionSubmitted] = useState(false);
  const [asking, setAsking] = useState(false);

  const questionError = useMemo(
    () => tryValidateField(() => validateQuestionContent(question)),
    [question],
  );
  const visibleQuestionError = visibleFieldErrors(
    { question: questionError },
    { question: questionTouched },
    questionSubmitted,
  ).question;
  const canAsk = questionDirty && !questionError;

  async function loadQuestions(nextPage = page) {
    setLoading(true);
    try {
      const result = await listProductQuestions(productId, nextPage, PAGE_SIZE);
      const list = requireProductQuestionList(result);
      setItems(list.items);
      setTotalPages(list.totalPages);
      setTotalCount(list.totalCount);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to load questions.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!active) return;
    void loadQuestions(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, page, active]);

  async function handleAsk(event: FormEvent) {
    event.preventDefault();
    setQuestionSubmitted(true);
    setQuestionTouched(true);
    if (!canAsk) return;

    if (!isAuthenticated) {
      const returnUrl = encodeURIComponent(location.pathname + location.search);
      navigate(`/login?returnUrl=${returnUrl}`);
      return;
    }

    setAsking(true);
    try {
      const result = await askProductQuestion(productId, { content: question.trim() });
      if (!result.success) {
        throw new Error(result.message ?? 'Unable to post question.');
      }
      toast.success('Question posted.');
      setQuestion('');
      setQuestionDirty(false);
      setQuestionSubmitted(false);
      setQuestionTouched(false);
      setPage(1);
      await loadQuestions(1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to post question.');
    } finally {
      setAsking(false);
    }
  }

  return (
    <div className="catalog-qa-panel">
      <div className="catalog-qa-panel__intro">
        <h3>Questions &amp; Answers</h3>
        <p className="catalog-muted">
          Ask about compatibility, warranty, or shipping. Sellers and verified buyers can reply.
        </p>
      </div>

      <form className="catalog-qa-form catalog-qa-form--ask" onSubmit={(event) => void handleAsk(event)}>
        <label htmlFor="product-question">Ask a question</label>
        <textarea
          id="product-question"
          className="form-control"
          rows={3}
          maxLength={MAX_QUESTION}
          value={question}
          onChange={(event) => {
            setQuestion(event.target.value);
            setQuestionDirty(true);
          }}
          onBlur={() => setQuestionTouched(true)}
          placeholder="What would you like to know about this product?"
        />
        {visibleQuestionError ? <p className="form-field-error">{visibleQuestionError}</p> : null}
        <button type="submit" className="btn-default btn-accent" disabled={!canAsk || asking}>
          {asking ? 'Posting…' : isAuthenticated ? 'Post question' : 'Sign in to ask'}
        </button>
        {!isAuthenticated ? (
          <p className="catalog-muted">
            <Link to={`/login?returnUrl=${encodeURIComponent(location.pathname)}`}>Sign in</Link> to
            ask a question.
          </p>
        ) : null}
      </form>

      {loading && items.length === 0 ? (
        <p className="catalog-muted">Loading questions…</p>
      ) : null}

      {!loading && items.length === 0 ? (
        <p className="catalog-qa-empty">No questions yet. Be the first to ask.</p>
      ) : null}

      <div className="catalog-qa-list">
        {items.map((item) => (
          <QuestionItem key={item.questionId} question={item} onAnswered={() => void loadQuestions(page)} />
        ))}
      </div>

      {totalCount > 0 ? (
        <p className="catalog-muted catalog-qa-count">
          {totalCount} question{totalCount === 1 ? '' : 's'}
        </p>
      ) : null}

      {totalPages > 1 ? (
        <div className="buyer-orders-pagination">
          <button
            type="button"
            className="btn-default btn-accent btn-border"
            disabled={page <= 1 || loading}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            Previous
          </button>
          <span>
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            className="btn-default btn-accent btn-border"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((current) => current + 1)}
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
}
