/**
 * The single definition of what an operator is allowed to do.
 *
 * This previously existed twice — backend/src/lib/permissions.js and
 * frontend/src/lib/permissions.js — with no shared source, so the sidebar and
 * the API could drift into disagreeing about who may see what. Both now import
 * from here.
 */

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
  // Creating and changing operator accounts. Deliberately absent from every
  // role list below, so only super_admin holds it: POST /api/admin/signup used
  // to require only `admin.dashboard.view`, which `support` also has, so a
  // support account could mint itself a colleague with more access than itself.
  STAFF_MANAGE: 'staff.manage',
  // Closing and reopening an accounting period. Absent from every role list
  // below, so only super_admin holds it: closing the books fixes a month's
  // reported figures, and reopening one lets them move again. That is an
  // owner's decision, not a shop manager's.
  BOOKS_MANAGE: 'books.manage',
};

export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  EDITOR: 'editor',
  SUPPORT: 'support',
  SOCIAL_MEDIA_MANAGER: 'social_media_manager',
};

export const ROLE_PERMISSIONS = {
  [ROLES.SUPER_ADMIN]: Object.values(PERMISSIONS),
  [ROLES.ADMIN]: [
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
  [ROLES.EDITOR]: [PERMISSIONS.BLOG_MANAGE, PERMISSIONS.FAQ_MANAGE],
  [ROLES.SUPPORT]: [PERMISSIONS.ADMIN_DASHBOARD_VIEW],
  [ROLES.SOCIAL_MEDIA_MANAGER]: [PERMISSIONS.BLOG_MANAGE],
};

/**
 * Resolves the effective permission set for an operator.
 *
 * A super_admin always holds everything, so a permissions array that has gone
 * stale cannot lock the owner out of their own system. Otherwise an explicit
 * per-account grant wins over the role default, and an unknown role gets
 * nothing rather than a guess.
 */
export const resolvePermissions = (role, explicitPermissions = []) => {
  if (role === ROLES.SUPER_ADMIN) {
    return Object.values(PERMISSIONS);
  }

  if (explicitPermissions.length > 0) {
    return explicitPermissions;
  }

  return ROLE_PERMISSIONS[role] || [];
};
