# DealCard Component Usage Examples

The `DealCard` component is now reusable and can be used throughout the mobile-customer app homepage for displaying products with a consistent "deal" style.

## Basic Usage

```tsx
import { DealCard } from "../../src/components/deal-card";

<DealCard product={product} />
```

## Custom Badge and CTA Text

```tsx
// Custom badge text
<DealCard 
  product={product} 
  badgeText="Hot" 
  ctaText="Buy Now"
/>

// Hide badge completely
<DealCard 
  product={product} 
  showBadge={false}
  ctaText="Add to Cart"
/>
```

## Custom Price Formatting

```tsx
<DealCard 
  product={product} 
  formatPrice={(pricePaise) => `₹${pricePaise ? Math.round(pricePaise / 100) : 'N/A'}`}
/>
```

## Integration with Homepage Sections

### Flash Deals Section
```tsx
<ScrollView horizontal showsHorizontalScrollIndicator={false}>
  {flashDealProducts.map((product) => (
    <DealCard 
      key={product.id} 
      product={product}
      badgeText="Deal"
      ctaText="View deal"
      formatPrice={market.format}
    />
  ))}
</ScrollView>
```

### Featured Products Section
```tsx
<ScrollView horizontal showsHorizontalScrollIndicator={false}>
  {featuredProducts.map((product) => (
    <DealCard 
      key={product.id} 
      product={product}
      badgeText="Featured"
      ctaText="Shop Now"
      formatPrice={market.format}
    />
  ))}
</ScrollView>
```

### Recommended Products Section
```tsx
<ScrollView horizontal showsHorizontalScrollIndicator={false}>
  {recommendedProducts.map((product) => (
    <DealCard 
      key={product.id} 
      product={product}
      showBadge={false}
      ctaText="View Product"
      formatPrice={market.format}
    />
  ))}
</ScrollView>
```

## Component Features

- **Responsive Sizing**: Automatically calculates optimal card dimensions based on screen width
- **Deal Badge**: Shows discount percentage with customizable badge text
- **Heart Button**: Wishlist functionality with consistent styling
- **Image Dots**: Shows multiple image indicator when product has more than one image
- **Price Display**: Shows current price and MRP with discount calculation
- **Fallback Image**: Graceful fallback when product image is unavailable

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `product` | `MobileProduct` | required | Product data to display |
| `formatPrice` | `(pricePaise?: number \| null) => string` | `defaultFormatPrice` | Custom price formatting function |
| `badgeText` | `string` | `"Deal"` | Custom text for the deal badge |
| `ctaText` | `string` | `"View deal"` | Custom text for the CTA button |
| `showBadge` | `boolean` | `true` | Whether to show the deal badge |

## Styling

The component uses consistent styling matching the design system:
- Primary color: `#ED3500` (brand color)
- Background: `#F8FAFC` (light background for image area)
- Border radius: 8px (modern card corners)
- Shadow effects for depth
- Responsive dimensions for different screen sizes

## Usage in Current Homepage

The component is currently used in:
1. **Flash Deals Section** - Products with limited-time deals
2. **Admin Configured Sections** - When products are displayed from CMS sections

## Future Integration Opportunities

The DealCard can be integrated into:
- Category pages for featured products
- Search results for promoted items
- Store pages for seller highlights
- Wishlist page (with modified CTA)
- Related products section
- Cross-sell recommendations