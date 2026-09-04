import { jest } from '@jest/globals';
import { QueryTypes } from 'sequelize';
import { setupDatabase, teardownDatabase, getDb, expectRejection } from '../helpers/database.js';
import { postEntry, reverseEntry, trialBalance, LedgerError } from '../../src/services/ledger.js';

// Everything the audit called "finance" was a SUM over the orders collection —
// a sales report that cannot express a cost, a liability or a bank balance.
// These tests are about the properties that make this a ledger instead: it
// balances, it cannot be edited, and a closed period stays closed.

jest.setTimeout(30000);

const PERIOD_START = '2026-09-01';
const IN_PERIOD = '2026-09-15';

beforeAll(async () => {
  await setupDatabase();
  await getDb().query(
    `INSERT INTO accounting_periods (name, starts_on, ends_on)
     VALUES ('2026-09', '${PERIOD_START}', '2026-09-30')`
  );
});

afterAll(async () => {
  await teardownDatabase();
});

const sale = (amount = 100000) => ({
  date: IN_PERIOD,
  description: 'Sofa sold',
  lines: [
    { account: '1110', debit: amount },
    { account: '4100', credit: amount },
  ],
});

describe('An entry must balance', () => {
  test('posts a balanced entry', async () => {
    const entry = await postEntry(getDb(), sale());
    expect(entry.entryNumber).toMatch(/^JE-\d{6}$/);
    expect(entry.amount).toBe(100000);
  });

  test('refuses an unbalanced entry before it reaches the database', async () => {
    await expect(
      postEntry(getDb(), {
        date: IN_PERIOD,
        description: 'Wrong',
        lines: [
          { account: '1110', debit: 100000 },
          { account: '4100', credit: 90000 },
        ],
      })
    ).rejects.toThrow(/does not balance.*out by 10000/);
  });

  test('the database refuses it too, at COMMIT, when the service is bypassed', async () => {
    // The service check is for a good error message. This is the one that
    // actually holds — lines are inserted one at a time, so the constraint is
    // deferred and only fires when the transaction commits. A test that never
    // commits would never reach it.
    const db = getDb();
    let error = null;
    try {
      await db.transaction(async (transaction) => {
        const [[entry]] = await db.query(
          `INSERT INTO journal_entries (entry_number, entry_date, description)
           VALUES ('JE-RAW-1', '${IN_PERIOD}', 'bypassing the service') RETURNING id`,
          { transaction }
        );
        const [[account]] = await db.query(
          `SELECT id FROM accounts WHERE code = '1110'`,
          { transaction }
        );
        await db.query(
          `INSERT INTO journal_lines (entry_id, account_id, debit)
           VALUES ('${entry.id}', '${account.id}', 5000)`,
          { transaction }
        );
      });
    } catch (err) {
      error = err;
    }

    expect(error).not.toBeNull();
    expect(`${error.message} ${error.parent?.message || ''}`).toMatch(/does not balance/);
  });

  test('refuses a line that is both a debit and a credit', async () => {
    await expect(
      postEntry(getDb(), {
        date: IN_PERIOD,
        description: 'Both sides',
        lines: [
          { account: '1110', debit: 100, credit: 100 },
          { account: '4100', credit: 100 },
        ],
      })
    ).rejects.toThrow(/exactly one of a debit or a credit, not both/);
  });

  test('refuses a line that is neither', async () => {
    await expect(
      postEntry(getDb(), {
        date: IN_PERIOD,
        description: 'Empty line',
        lines: [
          { account: '1110', debit: 0, credit: 0 },
          { account: '4100', credit: 100 },
        ],
      })
    ).rejects.toThrow(/not neither/);
  });

  test('refuses a negative amount rather than treating it as the other side', async () => {
    await expect(
      postEntry(getDb(), {
        date: IN_PERIOD,
        description: 'Negative',
        lines: [
          { account: '1110', debit: -100 },
          { account: '4100', credit: -100 },
        ],
      })
    ).rejects.toThrow(/negative debit is a credit/);
  });

  test('refuses a fractional amount instead of letting the database round it', async () => {
    await expect(
      postEntry(getDb(), {
        date: IN_PERIOD,
        description: 'Fractional',
        lines: [
          { account: '1110', debit: 100.5 },
          { account: '4100', credit: 100.5 },
        ],
      })
    ).rejects.toThrow(/whole number of minor units/);
  });

  test('refuses a single-sided entry', async () => {
    await expect(
      postEntry(getDb(), {
        date: IN_PERIOD,
        description: 'One line',
        lines: [{ account: '1110', debit: 100 }],
      })
    ).rejects.toThrow(/at least two lines/);
  });
});

describe('Accounts', () => {
  test('refuses to post to a summary account', async () => {
    // 1000 "Assets" exists to be summed, not posted to.
    await expect(
      postEntry(getDb(), {
        date: IN_PERIOD,
        description: 'To a parent',
        lines: [
          { account: '1000', debit: 100 },
          { account: '4100', credit: 100 },
        ],
      })
    ).rejects.toThrow(/Cannot post to summary account/);
  });

  test('the database refuses it too, through the composite foreign key', async () => {
    const db = getDb();
    const [[parent]] = await db.query(`SELECT id FROM accounts WHERE code = '1000'`);
    const [[entry]] = await db.query(
      `INSERT INTO journal_entries (entry_number, entry_date, description)
       VALUES ('JE-RAW-2', '${IN_PERIOD}', 'raw') RETURNING id`
    );

    await expectRejection(
      `INSERT INTO journal_lines (entry_id, account_id, debit)
       VALUES ('${entry.id}', '${parent.id}', 100)`,
      'journal_lines_account_id_is_postable_fkey'
    );
  });

  test('refuses an unknown account code', async () => {
    await expect(
      postEntry(getDb(), {
        date: IN_PERIOD,
        description: 'Nonexistent',
        lines: [
          { account: '9999', debit: 100 },
          { account: '4100', credit: 100 },
        ],
      })
    ).rejects.toThrow(/Unknown account code\(s\): 9999/);
  });

  test('rejects a normal balance that contradicts the account type', async () => {
    // Getting this backwards inverts every report built on the account, and
    // the error is invisible until somebody reconciles.
    await expectRejection(
      `INSERT INTO accounts (code, name, type, normal_balance)
       VALUES ('9001', 'Backwards', 'asset', 'credit')`,
      'accounts_normal_balance_matches_type'
    );
  });

  test('refuses to delete an account that has postings', async () => {
    const db = getDb();
    await postEntry(db, sale(5000));
    const [[account]] = await db.query(`SELECT id FROM accounts WHERE code = '1110'`);

    await expectRejection(
      `DELETE FROM accounts WHERE id = '${account.id}'`,
      'journal_lines_account_id_is_postable_fkey'
    );
  });
});

describe('Posted history is immutable', () => {
  test('refuses to edit an entry', async () => {
    const entry = await postEntry(getDb(), sale(1000));
    await expectRejection(
      `UPDATE journal_entries SET description = 'rewritten' WHERE id = '${entry.id}'`,
      'append-only'
    );
  });

  test('refuses to delete an entry', async () => {
    const entry = await postEntry(getDb(), sale(1000));
    await expectRejection(
      `DELETE FROM journal_entries WHERE id = '${entry.id}'`,
      'append-only'
    );
  });

  test('refuses to edit a line', async () => {
    const entry = await postEntry(getDb(), sale(1000));
    await expectRejection(
      `UPDATE journal_lines SET debit = 999999 WHERE entry_id = '${entry.id}'`,
      'append-only'
    );
  });

  test('a correction is a reversal, leaving both on the record', async () => {
    const db = getDb();
    const original = await postEntry(db, {
      date: IN_PERIOD,
      description: 'Sale posted twice by mistake',
      lines: [
        { account: '1110', debit: 75000 },
        { account: '4100', credit: 75000 },
      ],
    });

    const reversal = await reverseEntry(db, original.id, { date: IN_PERIOD });

    const lines = await db.query(
      `SELECT a.code, l.debit, l.credit FROM journal_lines l
       JOIN accounts a ON a.id = l.account_id
       WHERE l.entry_id = :id ORDER BY a.code`,
      { replacements: { id: reversal.id }, type: QueryTypes.SELECT }
    );

    // Mirrored: what was debited is credited.
    expect(lines).toEqual([
      expect.objectContaining({ code: '1110', debit: '0', credit: '75000' }),
      expect.objectContaining({ code: '4100', debit: '75000', credit: '0' }),
    ]);

    const [[link]] = await db.query(
      `SELECT reverses_id FROM journal_entries WHERE id = '${reversal.id}'`
    );
    expect(link.reverses_id).toBe(original.id);
  });

  test('refuses to reverse the same entry twice', async () => {
    const db = getDb();
    const original = await postEntry(db, sale(4200));
    await reverseEntry(db, original.id, { date: IN_PERIOD });

    await expect(reverseEntry(db, original.id, { date: IN_PERIOD })).rejects.toThrow(
      /already reversed by JE-/
    );
  });
});

describe('Accounting periods', () => {
  test('refuses a posting into a closed period', async () => {
    const db = getDb();
    await db.query(
      `INSERT INTO accounting_periods (name, starts_on, ends_on, status, closed_at)
       VALUES ('2026-08', '2026-08-01', '2026-08-31', 'closed', now())`
    );

    await expect(
      postEntry(db, {
        date: '2026-08-15',
        description: 'Backdated into a closed month',
        lines: [
          { account: '1110', debit: 100 },
          { account: '4100', credit: 100 },
        ],
      })
    ).rejects.toThrow(/accounting period 2026-08 is closed/);
  });

  test('refuses a posting with no period at all', async () => {
    // Better to refuse than to let a posting land nowhere and quietly miss
    // every report.
    await expect(
      postEntry(getDb(), {
        date: '2030-01-01',
        description: 'Far future',
        lines: [
          { account: '1110', debit: 100 },
          { account: '4100', credit: 100 },
        ],
      })
    ).rejects.toThrow(/no accounting period covers 2030-01-01/);
  });

  test('refuses overlapping periods', async () => {
    await expectRejection(
      `INSERT INTO accounting_periods (name, starts_on, ends_on)
       VALUES ('overlap', '2026-09-15', '2026-10-15')`,
      'periods_do_not_overlap'
    );
  });

  test('refuses a period that ends before it starts', async () => {
    await expectRejection(
      `INSERT INTO accounting_periods (name, starts_on, ends_on)
       VALUES ('backwards', '2026-12-31', '2026-12-01')`,
      'period_dates_ordered'
    );
  });

  test('refuses a close with no close date', async () => {
    await expectRejection(
      `UPDATE accounting_periods SET status = 'closed' WHERE name = '2026-09'`,
      'period_close_is_dated'
    );
  });
});

describe('Gapless numbering', () => {
  test('numbers run consecutively', async () => {
    const db = getDb();
    const a = await postEntry(db, sale(100));
    const b = await postEntry(db, sale(100));

    const na = Number(a.entryNumber.split('-')[1]);
    const nb = Number(b.entryNumber.split('-')[1]);
    expect(nb).toBe(na + 1);
  });

  test('a rolled-back transaction returns its number rather than burning it', async () => {
    // The reason next_number() takes a row lock instead of using a sequence.
    // A sequence would leave a hole here, and "why is there no JE-000042?" is
    // not a conversation worth having with an auditor.
    const db = getDb();
    const before = await db.query(`SELECT value FROM counters WHERE name = 'journal_entry'`, {
      type: QueryTypes.SELECT,
    });

    await expect(
      db.transaction(async (transaction) => {
        await postEntry(db, sale(100), { transaction });
        throw new Error('deliberate rollback');
      })
    ).rejects.toThrow('deliberate rollback');

    const after = await db.query(`SELECT value FROM counters WHERE name = 'journal_entry'`, {
      type: QueryTypes.SELECT,
    });
    expect(Number(after[0].value)).toBe(Number(before[0].value));

    // And the next real posting takes the number the rollback released.
    const next = await postEntry(db, sale(100));
    expect(Number(next.entryNumber.split('-')[1])).toBe(Number(before[0].value) + 1);
  });
});

describe('The books balance', () => {
  test('the trial balance comes out equal', async () => {
    const db = getDb();
    await postEntry(db, {
      date: IN_PERIOD,
      description: 'Sale with VAT and cost of sale',
      lines: [
        { account: '1110', debit: 107500, description: 'Cash received' },
        { account: '4100', credit: 100000, description: 'Revenue' },
        { account: '2200', credit: 7500, description: 'VAT collected' },
      ],
    });
    await postEntry(db, {
      date: IN_PERIOD,
      description: 'Cost of the goods sold',
      lines: [
        { account: '5100', debit: 60000 },
        { account: '1300', credit: 60000 },
      ],
    });

    const tb = await trialBalance(db);
    expect(tb.balanced).toBe(true);
    expect(tb.totalDebit).toBe(tb.totalCredit);
  });

  test('a debit-normal account reports a positive balance when debited', async () => {
    const tb = await trialBalance(getDb());
    const bank = tb.accounts.find((a) => a.code === '1110');
    const revenue = tb.accounts.find((a) => a.code === '4100');

    // Bank is an asset (debit-normal), revenue is credit-normal. Both should
    // read positive after ordinary trading — the sign convention is what makes
    // a report legible without mental arithmetic.
    expect(bank.balance).toBeGreaterThan(0);
    expect(revenue.balance).toBeGreaterThan(0);
  });

  test('a multi-line entry balances across more than two accounts', async () => {
    const db = getDb();
    const entry = await postEntry(db, {
      date: IN_PERIOD,
      description: 'Sale, discounted, with delivery',
      lines: [
        { account: '1110', debit: 95000 },
        { account: '4900', debit: 10000, description: 'Discount given' },
        { account: '4100', credit: 100000 },
        { account: '4300', credit: 5000, description: 'Delivery' },
      ],
    });

    expect(entry.amount).toBe(105000);
  });

  test('the ledger-wide imbalance view stays empty', async () => {
    // If this ever returns a row the ledger is broken, which should be
    // impossible while the balance trigger holds. It exists so the claim is
    // checkable rather than assumed.
    const [rows] = await getDb().query('SELECT * FROM ledger_imbalance');
    expect(rows).toEqual([]);
  });
});

describe('Posting as part of a larger unit of work', () => {
  test('a failure after posting rolls the posting back too', async () => {
    // Confirming a payment should record the payment and its posting together,
    // or neither. This is why postEntry accepts an outer transaction.
    const db = getDb();
    const before = await db.query('SELECT count(*)::int AS n FROM journal_entries', {
      type: QueryTypes.SELECT,
    });

    await expect(
      db.transaction(async (transaction) => {
        await postEntry(db, sale(31337), { transaction });
        throw new LedgerError('the payment write failed');
      })
    ).rejects.toThrow('the payment write failed');

    const after = await db.query('SELECT count(*)::int AS n FROM journal_entries', {
      type: QueryTypes.SELECT,
    });
    expect(after[0].n).toBe(before[0].n);
  });
});
