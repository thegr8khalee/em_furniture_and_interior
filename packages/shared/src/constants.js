export const PRODUCT_CATEGORIES = [
  'Living Room',
  'Armchair',
  'Bedroom',
  'Dining Room',
  'Center Table',
  'Wardrobe',
  'TV Unit',
  'Carpet',
];

export const PRODUCT_STYLES = [
  'Modern',
  'Contemporary',
  'Antique/Royal',
  'Bespoke',
  'Minimalist',
  'Glam',
];

export const ORDER_STATUSES = [
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
];

export const ORDER_STATUS_COLORS = {
  pending: 'badge-warning',
  confirmed: 'badge-info',
  processing: 'badge-info',
  shipped: 'badge-primary',
  delivered: 'badge-success',
  cancelled: 'badge-error',
  refunded: 'badge-error',
};

export const PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'refunded'];

export const PAYMENT_STATUS_COLORS = {
  pending: 'badge-warning',
  paid: 'badge-success',
  failed: 'badge-error',
  refunded: 'badge-error',
};
