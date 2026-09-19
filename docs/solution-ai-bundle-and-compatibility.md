# AIDR - Solution: Smart Bundle & Compatibility Check

**Status:** Implemented  
**Module:** 29 AI + Discovery + Cart  
**Use case:** UC-83 (View Smart Accessory Bundle), UC-84 (Check Product Compatibility)  
**Liên quan:** UC-56 (assistant), UC-28 (compare), UC-30 (add cart), UC-54 (similar)  
**Phạm vi:** PDP + AI assistant gợi ý phụ kiện/combo; modal kiểm tra tương thích spec giữa 2 SP (hoặc SP + thiết bị user mô tả).

---

## 1. Yêu cầu

### 1.1 Smart Accessory Bundle (UC-83)

Khi buyer xem SP chính (phone, laptop, console…):

- Hiển thị **Frequently bought together** / **Complete your setup**: 2–4 SP phụ kiện cùng shop hoặc sàn (ưu tiên cùng shop để giảm split order phức tạp v1).  
- Nguồn gợi ý **hybrid**:
  1. Rule map category → accessory categories (config JSON).  
  2. Co-purchase từ order history (nếu đủ data).  
  3. LLM rerank + lý do ngắn 1 dòng (optional).  
- CTA: **Add all to cart** (từng dòng + main product) - reuse cart API.

### 1.2 Compatibility Check (UC-84)

- Input: `primaryProductId` + `secondaryProductId` **hoặc** `primaryProductId` + free-text device model/spec.  
- Output: `compatible | incompatible | unknown` + `reasons[]` (English) + `matchedSpecs[]`.  
- Engine: **rule-first** parse `SpecsJson` (RAM type, socket, wattage, connector…) → LLM chỉ diễn đạt / xử lý edge khi rule `unknown`.  
- Không trả lời chắc chắn khi thiếu spec - ưu tiên `unknown` + gợi ý hỏi seller qua chat.

### 1.3 Nguyên tắc

1. **Chỉ SP Approved, còn tồn.**  
2. **Grounded specs** - cite key spec pairs trong response.  
3. **Mock path** - rule-only khi Groq mock.  
4. **Không thêm agent loop** - 1 request = 1 response.  
5. **English UI/errors.**

---

## 2. Hiện trạng

| Đang có | Thiếu |
|---------|-------|
| `SpecsJson`, category tree | Không map phụ kiện theo ngành hàng |
| `IRecommendationService`, similar products | Không bundle / co-buy |
| `AiCompareService` parse specs | Không compatibility verdict |
| Cart multi-add | Không batch endpoint (v1 loop add OK) |
| AI assistant page context | Không action "check compatibility" |

---

## 3. Category → accessory rules (config)

File: `aidr-be/AIDR.Modules/AI/Data/accessory-rules.json` (hoặc embedded resource).

```json
{
  "smartphone": {
    "accessoryCategories": ["phone-cases", "chargers-cables", "screen-protectors", "earbuds"],
    "maxItems": 3
  },
  "laptop": {
    "accessoryCategories": ["laptop-bags", "mice", "usb-hubs", "ram-so-dimm"],
    "maxItems": 4
  }
}
```

Slug map → `CategoryId` lúc startup hoặc lazy lookup.

---

## 4. Bundle retrieval pipeline

```
GetBundle(productId):
  1. Resolve product category slug
  2. Load accessory category ids from rules
  3. Query Discovery: Approved, in stock, same shop first (ORDER BY sameShop DESC, rating DESC, price ASC)
  4. Exclude main product id
  5. Take top 4 per category diversity
  6. If <2 items: fallback UC-54 similar in accessory cats
  7. Optional LLM: pick 3 + short reason from candidate list (ids must ⊆ candidates)
  8. Return BundleDto
```

**Co-purchase boost (Phase B):**

```sql
-- OrderItems self-join same OrderId, count pairs in 90 days
-- boost score if accessory frequently bought with primary
```

---

## 5. Compatibility engine

### 5.1 Spec keys chuẩn hóa

Reuse normalize keys từ `AiCompareService.PreferredSpecKeys` + thêm:

| Domain | Keys | Rule ví dụ |
|--------|------|------------|
| RAM | `ram_type`, `ram_speed`, `max_ram` | DDR4 ≠ DDR5 → incompatible |
| Laptop RAM | `ram_type`, `form_factor` | SO-DIMM vs DIMM |
| Charger | `max_watt`, `connector` | 65W vs 100W → unknown/warning |
| Phone case | `model`, `compatible_models[]` | string contains |

### 5.2 Flow

```
CheckCompatibility(primaryId, secondaryId?, freeText?):
  1. Load primary SpecsJson
  2. If secondaryId: load secondary SpecsJson
     Else: parse freeText via NL → extract model keywords → search catalog top 1 match (optional) OR rule-only on text
  3. Run rule matrix → Verdict + reasons
  4. If verdict=Unknown AND Groq enabled: single LLM call with BOTH spec packs + "do not invent"
  5. Return CompatibilityResultDto
```

Verdict enum: `Compatible`, `Incompatible`, `Unknown`, `Warning` (works but not optimal).

---

## 6. API

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/products/{id}/bundle` | Guest |
| POST | `/api/ai/compatibility` | Guest/Buyer |

### POST `/api/ai/compatibility`

```json
{
  "primaryProductId": "guid",
  "secondaryProductId": "guid|null",
  "freeTextDevice": "string|null"
}
```

Response:

```json
{
  "verdict": "Incompatible",
  "headline": "These products are likely not compatible.",
  "reasons": [
    "Primary supports DDR4; selected RAM is DDR5.",
    "Form factor SO-DIMM required for laptops."
  ],
  "matchedSpecs": [
    { "label": "RAM type", "primary": "DDR4", "secondary": "DDR5" }
  ],
  "source": "Rule"
}
```

Rate limit: 20 req / user / hour (guest by IP).

---

## 7. AI Assistant integration

Trong `AiShoppingAssistantService`, intent mới `CompatibilityCheck`:

- User trên PDP: *"Does this RAM work with this laptop?"* + `pageContext.productId`  
- Parse secondary product from compare tray hoặc mention in message → gọi compatibility service  
- Reply + chip link secondary product

Sau guided consult **presented** stage → append bundle cards trong `MetaJson.actions` (reuse product card renderer).

---

## 8. Frontend

| Vị trí | UI |
|--------|-----|
| `ProductDetailPage` | Section **Complete your setup** - horizontal cards + **Add bundle to cart** |
| PDP / compare | Button **Check compatibility** → modal chọn SP #2 hoặc paste model |
| AI widget | Render compatibility result block |

Theme storefront; bundle cards giống similar products section.

---

## 9. Schema

**v1 không bắt buộc migration** - co-purchase cache có thể Redis:

`bundle:cobuy:{productId}` TTL 24h.

Phase B (optional): `ProductBundleStats (PrimaryProductId, AccessoryProductId, PurchaseCount)` nightly job.

---

## 10. Seed & dev

- `scripts/seed-accessory-bundle.sql` - phone + 3 case/charger approved cùng shop.  
- `scripts/seed-compatibility-demo.sql` - laptop DDR4 + RAM DDR5 incompatible pair.  
- `POST /api/dev/seed-bundle-demo`

---

## 11. Phases

| Phase | Nội dung |
|-------|----------|
| **A** | accessory-rules.json + GET bundle (rule-only) + PDP section |
| **B** | POST compatibility (rule engine) + modal |
| **C** | LLM rerank/reason + assistant intent |
| **D** | Co-purchase stats job |

---

## 12. Không làm (v1)

- Bundle giảm giá combo price (chỉ add cart từng SP).  
- Cross-shop single shipment optimization.  
- Compatibility cho phần mềm / license.  
- Image-based compatibility.

---

## 13. Acceptance criteria

- [ ] Phone PDP → ≥2 accessory suggestions, add bundle adds N+1 cart lines.  
- [ ] DDR4 laptop + DDR5 RAM → `Incompatible` với reason rõ.  
- [ ] Thiếu spec → `Unknown`, không fake Compatible.  
- [ ] Groq mock → rule path vẫn trả verdict.  
- [ ] English copy throughout.
