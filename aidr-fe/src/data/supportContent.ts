export type FaqCategory = 'orders' | 'returns' | 'payment' | 'seller' | 'account';

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
  category: FaqCategory;
  popular?: boolean;
}

export const FAQ_CATEGORIES: { id: FaqCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'orders', label: 'Orders' },
  { id: 'returns', label: 'Returns' },
  { id: 'payment', label: 'Payment' },
  { id: 'seller', label: 'Seller' },
  { id: 'account', label: 'Account' },
];

export const FAQ_ITEMS: FaqItem[] = [
  {
    id: 'track-order',
    question: 'How do I track my order?',
    answer:
      'Sign in and open Account → Orders. Select an order to view its current status, items, and shipping details.',
    category: 'orders',
    popular: true,
  },
  {
    id: 'order-status',
    question: 'What do the order statuses mean?',
    answer:
      'Pending payment means checkout is not complete. Paid and processing indicate the seller is preparing your shipment. Shipped and delivered reflect carrier updates. Cancelled or refunded orders show the final outcome.',
    category: 'orders',
  },
  {
    id: 'change-order',
    question: 'Can I change or cancel an order after checkout?',
    answer:
      'Contact the seller through order messaging as soon as possible. Changes are only possible before the order is shipped and depend on seller policy.',
    category: 'orders',
  },
  {
    id: 'request-return',
    question: 'How do I request a return?',
    answer:
      'From a completed or delivered order detail page, submit a return request with the required reason and evidence links. Track progress under Account → Returns.',
    category: 'returns',
    popular: true,
  },
  {
    id: 'return-evidence',
    question: 'What evidence is required for a return?',
    answer:
      'Upload clear photos or videos showing the issue, packaging, and product labels. Include links to any supporting files requested on the return form.',
    category: 'returns',
  },
  {
    id: 'refund-timing',
    question: 'When will I receive my refund?',
    answer:
      'After your return is approved, refunds are processed to the original payment method. Timing depends on your bank or payment provider.',
    category: 'returns',
  },
  {
    id: 'payment-methods',
    question: 'Which payment methods are supported?',
    answer:
      'AIDR supports secure online checkout with the payment options shown at checkout. Available methods may vary by order total and region.',
    category: 'payment',
    popular: true,
  },
  {
    id: 'vouchers',
    question: 'How do vouchers work?',
    answer:
      'Vouchers may apply at checkout when your cart meets minimum order and eligibility rules. View available offers under Account → Vouchers.',
    category: 'payment',
    popular: true,
  },
  {
    id: 'payment-failed',
    question: 'My payment failed — what should I do?',
    answer:
      'Verify your card or wallet details, ensure sufficient funds, and try again. If the issue persists, contact support with your order reference.',
    category: 'payment',
  },
  {
    id: 'become-seller',
    question: 'How can I become a seller?',
    answer:
      'Submit a seller registration with your proposed shop name and supporting documents. Once approved, you will receive access to Seller Center.',
    category: 'seller',
    popular: true,
  },
  {
    id: 'seller-approval',
    question: 'How long does seller approval take?',
    answer:
      'Our team reviews applications within a few business days. You will receive an email when your shop is approved or if more information is needed.',
    category: 'seller',
  },
  {
    id: 'change-password',
    question: 'How do I change my password?',
    answer:
      'Go to Account → Security and follow the link to change or set your password. Use a strong, unique password for your account.',
    category: 'account',
    popular: true,
  },
  {
    id: 'account-security',
    question: 'How do I secure my account?',
    answer:
      'Use a unique password, keep your email up to date, and review active sessions under Account → Security. Sign out on shared devices.',
    category: 'account',
  },
];

export interface HelpTopic {
  id: string;
  title: string;
  description: string;
  icon: string;
  to: string;
  keywords: string[];
}

export const HELP_TOPICS: HelpTopic[] = [
  {
    id: 'shopping',
    title: 'Shopping & orders',
    description: 'Browse products, checkout, and track deliveries from your account.',
    icon: '/theme/images/icon-order-primary.svg',
    to: '/account/orders',
    keywords: ['shop', 'cart', 'checkout', 'track', 'order', 'shipping', 'delivery'],
  },
  {
    id: 'returns',
    title: 'Returns & refunds',
    description: 'Request returns, upload evidence, and follow refund status.',
    icon: '/theme/images/icon-product-shipping-2.svg',
    to: '/account/returns',
    keywords: ['return', 'refund', 'exchange', 'evidence'],
  },
  {
    id: 'payment',
    title: 'Payments & vouchers',
    description: 'Payment methods, vouchers, and checkout troubleshooting.',
    icon: '/theme/images/icon-payment-option-1.svg',
    to: '/account/vouchers',
    keywords: ['payment', 'pay', 'voucher', 'coupon', 'checkout'],
  },
  {
    id: 'seller',
    title: 'Become a seller',
    description: 'Apply to open a shop and manage listings in Seller Center.',
    icon: '/theme/images/icon-dashboard-primary.svg',
    to: '/account/become-seller',
    keywords: ['seller', 'shop', 'register', 'sell'],
  },
  {
    id: 'account',
    title: 'Account & security',
    description: 'Password, profile settings, and keeping your account safe.',
    icon: '/theme/images/icon-security-primary.svg',
    to: '/account/security',
    keywords: ['account', 'password', 'security', 'login', 'profile'],
  },
  {
    id: 'faq',
    title: 'Frequently asked questions',
    description: 'Quick answers to the most common questions from buyers and sellers.',
    icon: '/theme/images/icon-preview-primary.svg',
    to: '/faq',
    keywords: ['faq', 'question', 'answer', 'help'],
  },
];

export function filterFaqItems(
  items: FaqItem[],
  query: string,
  category: FaqCategory | 'all',
): FaqItem[] {
  const term = query.trim().toLowerCase();
  return items.filter((item) => {
    const matchesCategory = category === 'all' || item.category === category;
    if (!matchesCategory) return false;
    if (!term) return true;
    return (
      item.question.toLowerCase().includes(term) || item.answer.toLowerCase().includes(term)
    );
  });
}

export function filterHelpTopics(topics: HelpTopic[], query: string): HelpTopic[] {
  const term = query.trim().toLowerCase();
  if (!term) return topics;
  return topics.filter(
    (topic) =>
      topic.title.toLowerCase().includes(term) ||
      topic.description.toLowerCase().includes(term) ||
      topic.keywords.some((k) => k.includes(term)),
  );
}
