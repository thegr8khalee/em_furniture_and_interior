import { describe, it, expect } from 'vitest';
import {
  SITE_URL,
  absoluteUrl,
  stripHtml,
  truncate,
  productJsonLd,
  breadcrumbJsonLd,
} from '../lib/seo';

// This module emits the structured data Google reads. A wrong price or
// availability here is a real-world problem — a rich result advertising a price
// the storefront does not charge — so it is worth pinning.

describe('absoluteUrl', () => {
  it('makes a site-relative path absolute', () => {
    expect(absoluteUrl('/shop')).toBe(`${SITE_URL}/shop`);
  });

  it('adds the missing leading slash', () => {
    expect(absoluteUrl('shop')).toBe(`${SITE_URL}/shop`);
  });

  it('leaves an already-absolute URL alone', () => {
    expect(absoluteUrl('https://cdn.example.com/a.png')).toBe('https://cdn.example.com/a.png');
    expect(absoluteUrl('http://example.com')).toBe('http://example.com');
  });

  it('falls back to the site root for an empty path', () => {
    expect(absoluteUrl('')).toBe(SITE_URL);
    expect(absoluteUrl()).toBe(`${SITE_URL}/`);
  });
});

describe('stripHtml', () => {
  it('removes tags and collapses the whitespace they leave behind', () => {
    expect(stripHtml('<p>Hello <strong>world</strong></p>')).toBe('Hello world');
  });

  it('handles a non-string input without throwing', () => {
    expect(stripHtml(null)).toBe('');
    expect(stripHtml(undefined)).toBe('');
    expect(stripHtml(42)).toBe('42');
  });
});

describe('truncate', () => {
  it('leaves text within the limit untouched', () => {
    expect(truncate('Short description', 160)).toBe('Short description');
  });

  it('never exceeds the limit', () => {
    // Meta descriptions are cut off by search engines past ~160 characters.
    const long = 'a'.repeat(500);
    expect(truncate(long, 160).length).toBeLessThanOrEqual(160);
  });

  it('marks a truncation with an ellipsis', () => {
    expect(truncate('a'.repeat(500), 20).endsWith('…')).toBe(true);
  });

  it('strips markup before measuring, not after', () => {
    const html = `<p>${'a'.repeat(50)}</p>`;
    expect(truncate(html, 160)).toBe('a'.repeat(50));
  });
});

describe('productJsonLd', () => {
  const product = {
    _id: 'p1',
    name: 'Milano Sofa',
    description: '<p>A <em>very</em> comfortable sofa.</p>',
    price: 450000,
    category: 'Sofas',
    images: [{ url: 'https://cdn.example.com/1.png' }, { url: null }],
    stockQuantity: 3,
    reviews: [],
    averageRating: 0,
  };

  it('returns null when there is no product', () => {
    expect(productJsonLd(null)).toBeNull();
    expect(productJsonLd(undefined)).toBeNull();
  });

  it('advertises the list price when nothing is on promotion', () => {
    expect(productJsonLd(product).offers.price).toBe(450000);
  });

  it('advertises the discounted price for a promoted product', () => {
    const promo = { ...product, isPromo: true, discountedPrice: 399000 };
    expect(productJsonLd(promo).offers.price).toBe(399000);
  });

  it('ignores a discounted price when the promotion is off', () => {
    const stale = { ...product, isPromo: false, discountedPrice: 1 };
    expect(productJsonLd(stale).offers.price).toBe(450000);
  });

  it('reports availability from stock on hand', () => {
    expect(productJsonLd(product).offers.availability).toBe('https://schema.org/InStock');
    expect(productJsonLd({ ...product, stockQuantity: 0 }).offers.availability).toBe(
      'https://schema.org/OutOfStock'
    );
    expect(productJsonLd({ ...product, stockQuantity: undefined }).offers.availability).toBe(
      'https://schema.org/OutOfStock'
    );
  });

  it('drops image entries with no URL', () => {
    expect(productJsonLd(product).image).toEqual(['https://cdn.example.com/1.png']);
  });

  it('strips markup out of the description', () => {
    expect(productJsonLd(product).description).toBe('A very comfortable sofa.');
  });

  it('omits a rating when no review has been approved', () => {
    const unmoderated = {
      ...product,
      averageRating: 5,
      reviews: [{ rating: 5, isApproved: false }],
    };
    // Publishing an aggregate rating built from unmoderated reviews would let
    // anyone who can post a review influence the search result.
    expect(productJsonLd(unmoderated).aggregateRating).toBeUndefined();
  });

  it('counts only approved reviews in the rating', () => {
    const mixed = {
      ...product,
      averageRating: 4.5,
      reviews: [
        { rating: 5, isApproved: true },
        { rating: 4, isApproved: true },
        { rating: 1, isApproved: false },
      ],
    };
    expect(productJsonLd(mixed).aggregateRating).toEqual({
      '@type': 'AggregateRating',
      ratingValue: '4.5',
      reviewCount: 2,
    });
  });

  it('falls back to the id when a product has no SKU', () => {
    expect(productJsonLd(product).sku).toBe('p1');
    expect(productJsonLd({ ...product, sku: 'MIL-001' }).sku).toBe('MIL-001');
  });
});

describe('breadcrumbJsonLd', () => {
  it('numbers positions from one and makes each item absolute', () => {
    expect(breadcrumbJsonLd([{ name: 'Shop', path: '/shop' }, { name: 'Sofas', path: '/shop?c=sofas' }]))
      .toMatchObject({
        itemListElement: [
          { position: 1, name: 'Shop', item: `${SITE_URL}/shop` },
          { position: 2, name: 'Sofas', item: `${SITE_URL}/shop?c=sofas` },
        ],
      });
  });

  it('handles an empty trail', () => {
    expect(breadcrumbJsonLd().itemListElement).toEqual([]);
  });
});
