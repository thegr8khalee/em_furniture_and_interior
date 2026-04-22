export const SITE_URL = 'https://emfurnitureandinterior.com';
export const SITE_NAME = 'EM Furniture & Interior';
export const SITE_LEGAL_NAME = 'EM Group Limited';
export const DEFAULT_OG_IMAGE = `${SITE_URL}/em_logo.png`;
export const DEFAULT_DESCRIPTION =
  'Shop luxury furniture and bespoke interior design from EM Furniture & Interior in Kaduna, Nigeria. Sofas, bedrooms, dining sets, wardrobes, and full-room makeovers crafted with timeless elegance.';

export const BUSINESS = {
  name: SITE_NAME,
  legalName: SITE_LEGAL_NAME,
  email: 'emfurnitureandinterior@gmail.com',
  phone: '+234-903-769-1860',
  phoneTel: '+2349037691860',
  address: {
    streetAddress: 'C16 Bamaiyi Road',
    addressLocality: 'Kaduna',
    addressCountry: 'NG',
  },
  sameAs: [
    'https://www.instagram.com/em_furniture_and_interior',
    'https://www.tiktok.com/@em_furniture_nd_interior',
    'https://x.com/___Emine_',
    'https://wa.me/2349037691860',
  ],
};

export const absoluteUrl = (path = '/') => {
  if (!path) return SITE_URL;
  if (/^https?:\/\//i.test(path)) return path;
  return `${SITE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
};

export const stripHtml = (html = '') =>
  String(html)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const truncate = (text = '', max = 160) => {
  const clean = stripHtml(text);
  if (clean.length <= max) return clean;
  return clean.slice(0, max - 1).trimEnd() + '…';
};

export const organizationJsonLd = () => ({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: BUSINESS.name,
  legalName: BUSINESS.legalName,
  url: SITE_URL,
  logo: DEFAULT_OG_IMAGE,
  image: DEFAULT_OG_IMAGE,
  email: BUSINESS.email,
  telephone: BUSINESS.phone,
  address: { '@type': 'PostalAddress', ...BUSINESS.address },
  sameAs: BUSINESS.sameAs,
});

export const localBusinessJsonLd = () => ({
  '@context': 'https://schema.org',
  '@type': 'FurnitureStore',
  '@id': `${SITE_URL}/#localbusiness`,
  name: BUSINESS.name,
  image: DEFAULT_OG_IMAGE,
  url: SITE_URL,
  telephone: BUSINESS.phone,
  email: BUSINESS.email,
  priceRange: '₦₦',
  address: { '@type': 'PostalAddress', ...BUSINESS.address },
  openingHoursSpecification: [
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: [
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
        'Sunday',
      ],
      opens: '00:00',
      closes: '23:59',
    },
  ],
  sameAs: BUSINESS.sameAs,
});

export const websiteJsonLd = () => ({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: SITE_NAME,
  url: SITE_URL,
  potentialAction: {
    '@type': 'SearchAction',
    target: `${SITE_URL}/shop?search={search_term_string}`,
    'query-input': 'required name=search_term_string',
  },
});

export const breadcrumbJsonLd = (items = []) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map((item, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: item.name,
    item: absoluteUrl(item.path),
  })),
});

export const productJsonLd = (product) => {
  if (!product) return null;
  const priceValue = product.isPromo && product.discountedPrice
    ? product.discountedPrice
    : product.price;
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: stripHtml(product.description || ''),
    image: (product.images || []).map((i) => i.url).filter(Boolean),
    sku: product.sku || product._id,
    mpn: product._id,
    brand: { '@type': 'Brand', name: SITE_NAME },
    category: product.category,
    offers: {
      '@type': 'Offer',
      url: absoluteUrl(`/product/${product._id}`),
      priceCurrency: 'NGN',
      price: priceValue,
      availability:
        (product.stockQuantity ?? 0) > 0
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
      seller: { '@type': 'Organization', name: SITE_NAME },
    },
  };
  const approvedReviews = (product.reviews || []).filter((r) => r.isApproved);
  if (product.averageRating > 0 && approvedReviews.length > 0) {
    data.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: Number(product.averageRating).toFixed(1),
      reviewCount: approvedReviews.length,
    };
  }
  return data;
};

export const articleJsonLd = (post) => {
  if (!post) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: stripHtml(post.excerpt || post.content || '').slice(0, 300),
    image: post.coverImage?.url ? [post.coverImage.url] : [DEFAULT_OG_IMAGE],
    datePublished: post.publishedAt || post.createdAt,
    dateModified: post.updatedAt || post.publishedAt || post.createdAt,
    author: { '@type': 'Organization', name: SITE_NAME },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      logo: { '@type': 'ImageObject', url: DEFAULT_OG_IMAGE },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': absoluteUrl(`/blog/${post.slug}`),
    },
  };
};

export const faqJsonLd = (faqs = []) => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map((f) => ({
    '@type': 'Question',
    name: f.question,
    acceptedAnswer: { '@type': 'Answer', text: f.answer },
  })),
});

export const collectionJsonLd = (collection) => {
  if (!collection) return null;
  const priceValue =
    collection.isPromo && collection.discountedPrice
      ? collection.discountedPrice
      : collection.price;
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: collection.name,
    description: stripHtml(collection.description || ''),
    image: collection.coverImage?.url ? [collection.coverImage.url] : [],
    brand: { '@type': 'Brand', name: SITE_NAME },
    category: collection.style,
    offers: {
      '@type': 'Offer',
      url: absoluteUrl(`/collection/${collection._id}`),
      priceCurrency: 'NGN',
      price: priceValue,
      availability: 'https://schema.org/InStock',
      itemCondition: 'https://schema.org/NewCondition',
      seller: { '@type': 'Organization', name: SITE_NAME },
    },
  };
};
