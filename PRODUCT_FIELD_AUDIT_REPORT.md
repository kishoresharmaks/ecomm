# Product Field Audit Report - Mobile Seller App

## Executive Summary

The mobile seller app is missing critical product fields compared to the backend API. The current implementation only supports basic fields (category, name, description, price, stock, dimensions, images) while the backend supports marketplace essential fields, variant attributes, HSN/GST compliance data, and SEO metadata.

**Coverage:** 28% (8/29 fields implemented)

---

## Backend API Supported Fields

### Product Level Fields (CreateSellerProductDto)

| Backend Field | Data Type | Required | Validation | Description |
|---------------|-----------|----------|------------|-------------|
| categoryId | String (UUID) | **Yes** | UUID | Product category |
| name | String | **Yes** | 2-180 chars | Product name |
| description | String | **Yes** | 10-5000 chars | Product description |
| attributes | Object (JSON) | No | Schema validation | Marketplace essentials & custom attributes |
| images | Array[ProductImageDto] | No | Max 10 images | Product images |
| variants | Array[ProductVariantDto] | **Yes** | Min 1, Max 20 | Product variants |

### Product Variant Fields (ProductVariantDto)

| Backend Field | Data Type | Required | Validation | Description |
|---------------|-----------|----------|------------|-------------|
| id | String (UUID) | No | UUID | Variant ID (update only) |
| sku | String | No | Max 80 chars | Stock keeping unit |
| variantName | String | No | Max 100 chars | Variant display name |
| pricePaise | Integer | **Yes** | Min 0 | Selling price in paise |
| mrpPaise | Integer | No | Min 0 | MRP in paise |
| stockQuantity | Integer | No | Min 0 | Available stock |
| packageWeightGrams | Integer | No | Min 1 | Package weight for shipping |
| packageLengthCm | Integer | No | Min 1 | Package length for shipping |
| packageBreadthCm | Integer | No | Min 1 | Package breadth for shipping |
| packageHeightCm | Integer | No | Min 1 | Package height for shipping |
| status | Enum | No | ACTIVE/INACTIVE | Variant status |
| attributes | Object (JSON) | No | Schema validation | Variant-specific attributes |

### Product Image Fields (ProductImageDto)

| Backend Field | Data Type | Required | Validation | Description |
|---------------|-----------|----------|------------|-------------|
| url | String | **Yes** | 1-500 chars | Image storage URL |
| altText | String | No | Max 160 chars | Alt text for accessibility |
| sortOrder | Integer | No | Min 0 | Display order |
| isPrimary | Boolean | No | - | Primary image flag |

### Marketplace Essential Fields (attributes object)

| Field | Required | Type | Options | Group |
|-------|----------|------|---------|-------|
| brand | **Yes** | SELECT | - | ESSENTIALS |
| condition | **Yes** | SELECT | New, Refurbished, Used | ESSENTIALS |
| unitOfMeasure | **Yes** | SELECT | Piece, Pack, Box, Set, Pair, Kg, Gram, Litre, Millilitre, Meter | ESSENTIALS |
| gstRatePercent | **Yes** | NUMBER | 0, 5, 12, 18, 28 | COMPLIANCE |
| hsnCode | **Yes** | TEXT | 4-8 digit HSN | COMPLIANCE |
| returnEligibility | **Yes** | SELECT | Returnable, Replacement only, Non-returnable, Service/warranty only | FULFILMENT |
| packageWeightGrams | **Yes** | NUMBER | - | FULFILMENT |
| highlights | No | MULTI_TEXT | - | DISCOVERY |
| searchTags | No | MULTI_TEXT | - | DISCOVERY |
| countryOfOrigin | No | TEXT | - | COMPLIANCE |
| manufacturerName | No | TEXT | - | COMPLIANCE |
| manufacturerAddress | No | TEXTAREA | - | COMPLIANCE |
| packerName | No | TEXT | - | COMPLIANCE |
| importerName | No | TEXT | - | COMPLIANCE |
| warranty | No | TEXT | - | FULFILMENT |
| packageLengthCm | No | NUMBER | - | FULFILMENT |
| packageWidthCm | No | NUMBER | - | FULFILMENT |
| packageHeightCm | No | NUMBER | - | FULFILMENT |
| gtin | No | TEXT | - | DISCOVERY |
| seoTitle | No | TEXT | - | DISCOVERY |
| seoDescription | No | TEXTAREA | - | DISCOVERY |

---

## Current Mobile App Implementation

### Mobile App Fields (SellerProductPayload)

| Mobile Field | Backend Field | Data Type | Required | Implemented |
|--------------|---------------|-----------|----------|-------------|
| categoryId | categoryId | String | **Yes** | ✅ Yes |
| name | name | String | **Yes** | ✅ Yes |
| description | description | String | **Yes** | ✅ Yes |
| images | images | Array | No | ✅ Yes |
| variants | variants | Array | **Yes** | ✅ Yes |
| - sku | sku | String | No | ✅ Yes |
| - variantName | variantName | String | No | ✅ Yes |
| - pricePaise | pricePaise | Integer | **Yes** | ✅ Yes |
| - mrpPaise | mrpPaise | Integer | No | ✅ Yes |
| - stockQuantity | stockQuantity | Integer | No | ✅ Yes |
| - packageWeightGrams | packageWeightGrams | Integer | No | ✅ Yes |
| - packageLengthCm | packageLengthCm | Integer | No | ✅ Yes |
| - packageBreadthCm | packageBreadthCm | Integer | No | ✅ Yes |
| - packageHeightCm | packageHeightCm | Integer | No | ✅ Yes |
| - status | status | Enum | No | ✅ Yes |
| attributes | attributes | Object | No | ❌ **MISSING** |
| - brand | brand | String | **Yes** | ❌ **MISSING** |
| - condition | condition | String | **Yes** | ❌ **MISSING** |
| - unitOfMeasure | unitOfMeasure | String | **Yes** | ❌ **MISSING** |
| - gstRatePercent | gstRatePercent | Number | **Yes** | ❌ **MISSING** |
| - hsnCode | hsnCode | String | **Yes** | ❌ **MISSING** |
| - returnEligibility | returnEligibility | String | **Yes** | ❌ **MISSING** |
| - packageWeightGrams | packageWeightGrams | Number | **Yes** | ❌ **MISSING** |
| - highlights | highlights | Array | No | ❌ **MISSING** |
| - searchTags | searchTags | Array | No | ❌ **MISSING** |
| - countryOfOrigin | countryOfOrigin | String | No | ❌ **MISSING** |
| - manufacturerName | manufacturerName | String | No | ❌ **MISSING** |
| - manufacturerAddress | manufacturerAddress | String | No | ❌ **MISSING** |
| - packerName | packerName | String | No | ❌ **MISSING** |
| - importerName | importerName | String | No | ❌ **MISSING** |
| - warranty | warranty | String | No | ❌ **MISSING** |
| - packageLengthCm | packageLengthCm | Number | No | ⚠️ Variant only |
| - packageWidthCm | packageWidthCm | Number | No | ❌ **MISSING** |
| - packageHeightCm | packageHeightCm | Number | ⚠️ Variant only |
| - gtin | gtin | String | No | ❌ **MISSING** |
| - seoTitle | seoTitle | String | No | ❌ **MISSING** |
| - seoDescription | seoDescription | String | No | ❌ **MISSING** |

### Mobile App Image Fields

| Mobile Field | Backend Field | Data Type | Required | Implemented |
|--------------|---------------|-----------|----------|-------------|
| url | url | String | **Yes** | ✅ Yes |
| altText | altText | String | No | ✅ Yes |
| sortOrder | sortOrder | Integer | No | ✅ Yes (hardcoded to 0) |
| isPrimary | isPrimary | Boolean | No | ✅ Yes (hardcoded to true) |

### Missing Features

1. **Category Selector** - Currently requires manual Category ID input
2. **Attributes Object** - Completely missing marketplace essential fields
3. **HSN Code Search** - No autocomplete/search functionality
4. **Category Defaults** - No auto-fill of default HSN/GST from category
5. **Multi-Image Support** - Only supports single image
6. **Variant Attributes** - No support for variant-specific attributes (size, color, etc.)
7. **Image Sort Order** - Hardcoded to 0
8. **Primary Image Selection** - Hardcoded to true
9. **Validation Feedback** - No field-level error messages
10. **Required Field Indicators** - No visual indicators for required fields

---

## Implementation Plan

### Phase 1: API Layer Updates

1. Add category list API function
2. Add HSN search API function
3. Update SellerProductPayload type to include attributes
4. Add category/HSN type definitions

### Phase 2: UI Components

1. Create CollapsibleSection component for field groups
2. Create SelectField component for dropdowns
3. Create MultiLineField component for multi-line text
4. Create TagInput component for tag arrays
5. Add validation error display components

### Phase 3: Add Product Page Redesign

**Sections:**

1. **Basic Information**
   - Category (dropdown with search)
   - Product name
   - Description

2. **Marketplace Essentials (Required)**
   - Brand / local label
   - Condition (dropdown)
   - Unit of sale (dropdown)

3. **Tax & Compliance (Required)**
   - HSN code (with search autocomplete)
   - GST rate % (auto-filled from category)
   - Country of origin (optional)
   - Manufacturer name (optional)
   - Manufacturer address (optional)
   - Packer name (optional)
   - Importer name (optional)

4. **Delivery & After-Sales (Required)**
   - Return policy (dropdown)
   - Package weight grams
   - Package dimensions (length, width, height)
   - Warranty (optional)

5. **Discovery & SEO (Optional)**
   - Key highlights (multi-line)
   - Search tags (comma-separated)
   - Manufacturer GTIN/barcode
   - SEO title
   - SEO description

6. **Pricing & Variants**
   - Variant SKU
   - Variant name
   - Selling price
   - MRP
   - Stock quantity
   - Variant-specific attributes (optional)

7. **Images & Media**
   - Multiple image upload
   - Image sort order
   - Primary image selection
   - Alt text for each image

### Phase 4: Edit Product Page

Mirror the Add Product page structure with pre-filled values from existing product data.

---

## Validation Rules

### Required Fields

- categoryId: Must be valid UUID
- name: 2-180 characters
- description: 10-5000 characters
- attributes.brand: Required
- attributes.condition: Required (New, Refurbished, Used)
- attributes.unitOfMeasure: Required (Piece, Pack, Box, Set, Pair, Kg, Gram, Litre, Millilitre, Meter)
- attributes.gstRatePercent: Required (0, 5, 12, 18, 28)
- attributes.hsnCode: Required (4-8 digit HSN)
- attributes.returnEligibility: Required (Returnable, Replacement only, Non-returnable, Service/warranty only)
- attributes.packageWeightGrams: Required (min 1)
- variants[0].pricePaise: Required (min 0)

### Optional Fields with Validation

- sku: Max 80 characters
- variantName: Max 100 characters
- mrpPaise: Min 0
- stockQuantity: Min 0
- package dimensions: Min 1
- altText: Max 160 characters
- gtin: Format validation
- highlights: Array of strings
- searchTags: Array of strings

### HSN Code Validation

- 4-8 digit numeric format
- Auto-fill GST rate from HSN master when selected
- Show matching HSN suggestions with description

---

## Error Handling

1. **API Errors**
   - Show user-friendly error messages
   - Highlight invalid fields
   - Preserve form data on error

2. **Validation Errors**
   - Real-time validation feedback
   - Field-specific error messages
   - Disable submit until valid

3. **Network Errors**
   - Retry mechanism for uploads
   - Offline data preservation
   - Loading states for all async operations

---

## Report Summary

### Statistics

- **Total Backend Fields:** 29
- **Implemented Fields:** 8
- **Missing Fields:** 21
- **Coverage Percentage:** 28%
- **Required Missing Fields:** 7
- **Optional Missing Fields:** 14

### Critical Missing Fields

1. attributes.brand (Required)
2. attributes.condition (Required)
3. attributes.unitOfMeasure (Required)
4. attributes.gstRatePercent (Required)
5. attributes.hsnCode (Required)
6. attributes.returnEligibility (Required)
7. attributes.packageWeightGrams (Required)

### Impact

**Auto-Approval Failure:** Products created from mobile app will fail auto-approval validation because required marketplace essential fields are missing. This will force manual admin approval for all mobile-created products.

**Compliance Issues:** Missing GST/HSN data prevents proper invoice generation and tax reporting.

**Discovery Issues:** Missing SEO and discovery fields reduces product visibility in search.

---

## Next Steps

1. ✅ Complete field audit
2. ⏳ Add category API to mobile app
3. ⏳ Update TypeScript types
4. ⏳ Redesign Add Product page
5. ⏳ Redesign Edit Product page
6. ⏳ Add validation and error handling
7. ⏳ Test with all fields
8. ⏳ Verify API payload matches backend expectations

---

**Generated:** 2026-06-17
**Scope:** Mobile Seller App Product Add/Edit
**Backend Version:** Current
**Mobile App Version:** Current
