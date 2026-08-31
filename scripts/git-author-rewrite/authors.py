"""Author identities and path-based module assignment for git history rewrite."""

from __future__ import annotations

import re
from dataclasses import dataclass
from fnmatch import fnmatch

# AtuDk3 / minhvanhuynh merge commits — never rewrite.
KEEP_AUTHOR_EMAILS = {
    "127426449+AtuDk3@users.noreply.github.com".lower(),
}

@dataclass(frozen=True)
class Author:
    key: str
    name: str
    email: str


AUTHORS: dict[str, Author] = {
    "thuandn03": Author("thuandn03", "thuandn03", "Vanthuan03042003@gmail.com"),
    "Ha20203": Author("Ha20203", "Ha20203", "tranthiphuongha20022003@gmail.com"),
    "manhisme10": Author("manhisme10", "manhisme10", "manhisme10@gmail.com"),
    "hoang2211": Author("hoang2211", "hoang2211", "Hoangnntde170445@fpt.edu.vn"),
    "minhvanhuynh": Author("minhvanhuynh", "minhvanhuynh", "huynhvanminh17082003@gmail.com"),
}

# (assignee_key, path_globs, message_regex_or_none, priority_higher_first)
# First matching rule with highest priority wins per file; scores summed across files.
RULES: list[tuple[str, list[str], str | None, int]] = [
    # --- minhvanhuynh: Engagement + AI (modules 19-21, 27-29) ---
    ("minhvanhuynh", ["**/AIDR.Modules/AI/**", "**/AI/**"], None, 100),
    ("minhvanhuynh", ["**/Engagement/**"], None, 95),
    ("minhvanhuynh", ["**/wishlist**", "**/Wishlist**", "**/follow**", "**/Follow**"], None, 90),
    ("minhvanhuynh", ["**/review**", "**/Review**", "**/rating**", "**/Rating**"], None, 90),
    ("minhvanhuynh", ["**/recommendation**", "**/Recommendation**", "**/compare**", "**/Compare**"], None, 88),
    ("minhvanhuynh", ["**/ai-assistant**", "**/AiConversation**", "**/AiMessage**", "**/Groq**"], None, 88),
    ("minhvanhuynh", ["aidr-fe/src/views/account/Wishlist*", "aidr-fe/src/**/Wishlist*"], None, 85),
    ("minhvanhuynh", ["aidr-fe/src/**/Compare*", "aidr-fe/src/**/Recommendation*"], None, 85),
    ("minhvanhuynh", [], r"(?i)(wishlist|follow|review|rating|recommend|similar|compare|shopping.?assistant|ai.?consult|groq|nl.?filter)", 50),

    # --- Ha20203: Admin (05,06,09,17,22,26) ---
    ("Ha20203", ["**/AIDR.Modules/Admin/**", "aidr-fe/src/views/admin/**", "aidr-fe/src/store/admin*"], None, 100),
    ("Ha20203", ["**/AdminCategories**", "**/AdminProductModeration**", "**/AdminReturn**", "**/AdminAccount**"], None, 95),
    ("Ha20203", ["**/AdminSystemVoucher**", "**/AdminCustomerInsight**", "**/AdminSellerRegistration**"], None, 95),
    ("Ha20203", ["**/AdminGovernance**", "**/AdminOrder**", "aidr-fe/src/**/Admin*"], None, 90),
    ("Ha20203", ["**/Kyc**", "**/seller-kyc**", "**/SellerRegistration**", "**/sellerRegistration**"], None, 92),
    ("Ha20203", ["theme-for-aidr-admin-fe/**"], None, 80),
    ("Ha20203", ["scripts/seed-seller-registrations.sql", "scripts/seed-pending-products.sql", "scripts/seed-governance-insights.sql"], None, 75),
    ("Ha20203", ["scripts/seed-returns.sql", "scripts/alter-return-requests-schema.sql"], None, 75),
    ("Ha20203", ["**/Settlement/**", "**/AdminSettlement**", "aidr-fe/src/**/settlement*"], None, 70),
    ("Ha20203", [], r"(?i)(admin.?categor|product.?moderation|seller.?registration|governance|system.?voucher|return.?refund|ekyc|kyc.?verif)", 45),

    # --- manhisme10: SellerCenter (07,08,10,15,18,25) ---
    ("manhisme10", ["**/AIDR.Modules/SellerCenter/**", "aidr-fe/src/views/seller/**", "aidr-fe/src/store/seller*"], None, 100),
    ("manhisme10", ["**/SellerProduct**", "**/SellerInventory**", "**/SellerOrder**", "**/SellerFinance**"], None, 95),
    ("manhisme10", ["**/SellerShop**", "**/SellerVoucher**", "**/SellerSettlement**"], None, 93),
    ("manhisme10", ["aidr-fe/src/views/catalog/Shop*", "aidr-fe/src/store/shopSlice*"], None, 88),
    ("manhisme10", ["scripts/seed-wallet.sql", "scripts/seed-settlement-backfill.sql", "scripts/settlement-schema.sql"], None, 75),
    ("manhisme10", ["**/Wallet**", "**/Wallets**"], None, 70),
    ("manhisme10", [], r"(?i)(seller.?center|seller.?product|seller.?inventory|seller.?finance|seller.?voucher|seller.?order|shop.?public|wallet.?ledger)", 45),

    # --- hoang2211: Order/Payment/Chat/Shipping (11-14,16,24) ---
    ("hoang2211", ["**/AIDR.Modules/Order/**", "**/AIDR.Modules/Payment/**", "**/AIDR.Modules/Shipping/**"], None, 100),
    ("hoang2211", ["aidr-fe/src/views/cart/**", "aidr-fe/src/store/cart*", "aidr-fe/src/store/checkout*"], None, 95),
    ("hoang2211", ["aidr-fe/src/views/account/Order*", "aidr-fe/src/**/order-received*"], None, 93),
    ("hoang2211", ["**/Cart**", "**/OrderRepository**", "**/Payment**", "**/PayOs**"], None, 90),
    ("hoang2211", ["**/Shipment**", "**/Shipping**", "**/Ghn**", "scripts/shipping-schema.sql", "scripts/seed-shipping.sql"], None, 88),
    ("hoang2211", ["**/Chat**", "**/chatHub**", "aidr-fe/src/**/Chat*", "aidr-fe/src/realtime/chat*"], None, 88),
    ("hoang2211", ["aidr-fe/src/**/Voucher*", "aidr-fe/src/views/account/BuyerVoucher*"], None, 75),
    ("hoang2211", [], r"(?i)(cart|checkout|payos|payment|order.?received|buyer.?order|shipment|ghn|shipping|chat.?hub|chat.?thread)", 45),

    # --- thuandn03: Foundation, Auth, Profile, Discovery, Notifications (01-04,23,30) ---
    ("thuandn03", ["**/AIDR.Modules/Auth/**", "aidr-fe/src/views/auth/**", "infra/keycloak/**"], None, 100),
    ("thuandn03", ["**/AIDR.Modules/Profile/**", "aidr-fe/src/views/account/Profile*", "aidr-fe/src/views/account/Addresses*", "aidr-fe/src/views/account/ChangePassword*"], None, 98),
    ("thuandn03", ["**/AIDR.Modules/Discovery/**", "aidr-fe/src/views/catalog/**", "aidr-fe/src/hooks/useCatalog*"], None, 95),
    ("thuandn03", ["**/Notification**", "aidr-fe/src/**/Notification*", "aidr-fe/src/store/notification*"], None, 93),
    ("thuandn03", ["docker-compose.yml", "database.sql", "infra/**", ".env.example", "README.md"], None, 90),
    ("thuandn03", ["aidr-be/AIDR.Api/Program.cs", "aidr-be/AIDR.Infrastructure/Persistence/**"], None, 85),
    ("thuandn03", ["theme-for-aidr-fe/**", "aidr-fe/public/theme/**"], None, 80),
    ("thuandn03", ["scripts/seed-demo*", "scripts/seed-catalog*", "scripts/seed-data-*", "scripts/seed-inventory*", "scripts/seed-table-coverage*"], None, 78),
    ("thuandn03", ["**/Seeding/**", "**/DevController.cs"], None, 76),
    ("thuandn03", ["docs/**", ".cursor/**"], None, 70),
    ("thuandn03", ["aidr-fe/src/app/**", "aidr-fe/src/components/layout/Store*", "aidr-fe/package.json"], None, 65),
    ("thuandn03", [], r"(?i)(foundation|scaffold|auth|login|register|profile|discovery|catalog|notification|health.?check|seed.?all|dev.?seed)", 40),
]

DEFAULT_ASSIGNEE = "thuandn03"


def should_keep_author(email: str) -> bool:
    return email.strip().lower() in KEEP_AUTHOR_EMAILS


def _normalize_path(path: str) -> str:
    return path.replace("\\", "/")


def score_file(path: str) -> dict[str, int]:
    path = _normalize_path(path)
    scores: dict[str, int] = {k: 0 for k in AUTHORS}
    for assignee, globs, _msg_re, priority in RULES:
        if globs and any(fnmatch(path, g) for g in globs):
            scores[assignee] += priority
    return scores


def classify_files(files: list[str], message: str = "") -> tuple[str, dict[str, int]]:
    totals: dict[str, int] = {k: 0 for k in AUTHORS}

    for path in files:
        if not path or path == "/dev/null":
            continue
        for assignee, scores in score_file(path).items():
            totals[assignee] += scores

    # Message keyword rules
    if message:
        for assignee, _globs, msg_re, priority in RULES:
            if msg_re and re.search(msg_re, message):
                totals[assignee] += priority

    best = max(totals.values()) if totals else 0
    if best <= 0:
        return DEFAULT_ASSIGNEE, totals

    # Tie-break: higher score, then lower module order preference
    order = ["thuandn03", "Ha20203", "manhisme10", "hoang2211", "minhvanhuynh"]
    candidates = [k for k, v in totals.items() if v == best]
    for key in order:
        if key in candidates:
            return key, totals
    return candidates[0], totals
