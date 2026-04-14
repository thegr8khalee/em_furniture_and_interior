export const PERMISSIONS = {
  ADMIN_DASHBOARD_VIEW: 'admin.dashboard.view',
  PRODUCTS_MANAGE: 'products.manage',
  COLLECTIONS_MANAGE: 'collections.manage',
  PROJECTS_MANAGE: 'projects.manage',
  BLOG_MANAGE: 'blog.manage',
  FAQ_MANAGE: 'faq.manage',
  MARKETING_MANAGE: 'marketing.manage',
  ORDERS_VIEW: 'orders.view',
  ORDERS_MANAGE: 'orders.manage',
  REVIEWS_MANAGE: 'reviews.manage',
  CONSULTATIONS_MANAGE: 'consultations.manage',
  DESIGNERS_MANAGE: 'designers.manage',
  INVENTORY_MANAGE: 'inventory.manage',
  FINANCE_VIEW: 'finance.view',
};

export const ROLE_PERMISSIONS = {
  super_admin: Object.values(PERMISSIONS),
  admin: [
    PERMISSIONS.ADMIN_DASHBOARD_VIEW,
    PERMISSIONS.PRODUCTS_MANAGE,
    PERMISSIONS.COLLECTIONS_MANAGE,
    PERMISSIONS.PROJECTS_MANAGE,
    PERMISSIONS.BLOG_MANAGE,
    PERMISSIONS.FAQ_MANAGE,
    PERMISSIONS.MARKETING_MANAGE,
    PERMISSIONS.ORDERS_VIEW,
    PERMISSIONS.ORDERS_MANAGE,
    PERMISSIONS.REVIEWS_MANAGE,
    PERMISSIONS.CONSULTATIONS_MANAGE,
    PERMISSIONS.DESIGNERS_MANAGE,
    PERMISSIONS.INVENTORY_MANAGE,
    PERMISSIONS.FINANCE_VIEW,
  ],
  editor: [PERMISSIONS.BLOG_MANAGE, PERMISSIONS.FAQ_MANAGE],
  support: [PERMISSIONS.ADMIN_DASHBOARD_VIEW],
  social_media_manager: [PERMISSIONS.BLOG_MANAGE],
};

export const resolvePermissions = (role, explicitPermissions = []) => {
  if (role === 'super_admin') {
    return Object.values(PERMISSIONS);
  }

  if (explicitPermissions.length > 0) {
    return explicitPermissions;
  }

  return ROLE_PERMISSIONS[role] || [];
};
