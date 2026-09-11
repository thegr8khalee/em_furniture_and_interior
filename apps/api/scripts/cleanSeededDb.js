// scripts/cleanSeededDb.js
import dotenv from 'dotenv';
import { QueryTypes } from 'sequelize';
import { getSequelize, closeSequelize } from '../src/db/sequelize.js';

dotenv.config({ path: './apps/api/.env' });

const PRESERVED_ADMIN_EMAIL = 'kaliibro777@gmail.com';

export const cleanSeededDatabase = async () => {
  const db = getSequelize();

  console.log('Starting cleanup of seeded data...');

  // 1. Verify the preserved admin account exists before doing anything
  const [admin] = await db.query(
    'SELECT id, username, email, role FROM staff WHERE email = :email',
    {
      replacements: { email: PRESERVED_ADMIN_EMAIL },
      type: QueryTypes.SELECT,
    }
  );

  if (!admin) {
    throw new Error(
      `Safety abort: Preserved admin account with email "${PRESERVED_ADMIN_EMAIL}" was not found in the database!`
    );
  }

  console.log(`Verified preserved admin: ${admin.username} (${admin.email}, ${admin.role})`);

  // 2. Truncate application operational and transactional tables with RESTART IDENTITY.
  // Note: Foundational tables preserved:
  // - schema_migrations
  // - accounting_periods
  // - accounts
  // - stock_locations
  // - staff (filtered deletion below)
  await db.query(`
    TRUNCATE
      bank_reconciliations,
      bank_statement_lines,
      depreciation_charges,
      fixed_assets,
      payslips,
      pay_runs,
      employees,
      stock_take_lines,
      stock_takes,
      order_refunds,
      journal_lines,
      journal_entries,
      stock_movements,
      stock_reservations,
      product_stock,
      activity_logs,
      audit_logs,
      notifications,
      loyalty_transactions,
      payment_transactions,
      order_items,
      order_status_events,
      orders,
      reviews,
      cart_items,
      carts,
      wishlist_items,
      flash_sale_items,
      flash_sales,
      promo_banners,
      collection_products,
      sellable_images,
      products,
      collections,
      sellable_items,
      coupons,
      consultation_room_photos,
      consultation_requests,
      designers,
      project_images,
      projects,
      blog_posts,
      faqs,
      purchase_order_items,
      purchase_orders,
      expenses,
      vendors,
      guest_sessions,
      counters,
      custom_documents,
      customers
    RESTART IDENTITY
  `);

  console.log('All operational and seed tables truncated.');

  // 3. Remove all staff accounts except the target admin
  await db.query(
    'DELETE FROM staff WHERE email != :email',
    {
      replacements: { email: PRESERVED_ADMIN_EMAIL },
    }
  );
  console.log(`Deleted seeded staff accounts, leaving only ${PRESERVED_ADMIN_EMAIL}.`);

  // 4. Verify remaining staff count
  const remainingStaff = await db.query(
    'SELECT id, username, email, role, is_active FROM staff',
    { type: QueryTypes.SELECT }
  );

  console.log('Remaining staff accounts in database:');
  console.log(JSON.stringify(remainingStaff, null, 2));

  console.log('Database cleanup completed successfully.');
};

if (process.argv[1] && process.argv[1].endsWith('cleanSeededDb.js')) {
  cleanSeededDatabase()
    .then(async () => {
      await closeSequelize();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('Cleanup failed:', err);
      await closeSequelize();
      process.exit(1);
    });
}
