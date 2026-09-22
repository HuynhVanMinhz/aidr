# Manual test - Smart Multi-turn Dialogue

**Prereq:** Buyer logged in, catalog seed, API restarted after build.

## Phase 1 - Other options / cheaper

1. Ask for a product set (e.g. "Recommend gaming laptops under 30 million").
2. Note the 3 cards (`#1` `#2` `#3`) and chips: Cheaper / Other options / …
3. Tap **Other options** → cards must **not** repeat the previous three (if catalog has more).
4. Tap **Cheaper** → max price anchored under previous min; different cheaper set when available.
5. If pool exhausted → English copy explains no more under filters.

## Phase 2 - Ordinal / explain / compare

6. "Show me the second one" / "cái thứ 2" → focus on `#2`.
7. "Why best match?" chip or "why this?" → explain grounded facts, same product.
8. "Compare 1 and 2" or chip **Compare top 2** → compare summary.
9. "Is it in stock?" with 3 cards and no focus → clarify chips `#1` / `#2` / `#3`.

## Phase 3 - Topic / restart / orders

10. "Find headphones instead" → new shelf, not laptop shown ids.
11. "Start over" → empty slots, ask what you want.
12. "Where is my order?" → redirect copy + **View my orders** → `/account/orders`.

## Phase 4 - Bundle / compat

13. After focusing a product: "What should I buy with it?" → accessory cards or notes.
14. With two ids / free text: "Is this compatible with …?" → compatibility verdict.

## Regression

15. Mid-consult FAQ still resumes pending question.
16. `Groq:UseMock=true` → chips and exclude still work.
