import { execSync } from 'node:child_process';

import { Page, expect, test } from '@playwright/test';

import { AuthPageObject } from '../authentication/auth.po';

const DB_CONTAINER = 'supabase_db_next-supabase-saas-kit-turbo-lite';

/**
 * There is no UI path (yet) to grant platform_super_admin -- Phase 4 does
 * not build a bootstrap flow for the very first platform admin, only the
 * payer/rule admin surfaces that role can use once granted. This helper
 * reaches around the UI directly into the local test DB to simulate what
 * a real ops/bootstrap process would do, purely for test setup. See
 * docs/progress/KNOWN_ISSUES.md.
 */
function grantPlatformAdmin(email: string) {
  const sql = `
    do $$
    declare
      target_user_id uuid;
      target_role_id uuid;
      target_org_id uuid;
    begin
      select id into target_user_id from auth.users where email = '${email}';
      select id into target_role_id from public.roles where key = 'platform_super_admin';

      insert into public.organizations (name, slug, created_by)
      values ('SIM Platform Admin Bootstrap', 'sim-platform-admin-bootstrap-' || target_user_id, target_user_id)
      returning id into target_org_id;

      insert into public.organization_memberships (organization_id, user_id, role_id)
      values (target_org_id, target_user_id, target_role_id);
    end $$;
  `;

  execSync(`docker exec -i ${DB_CONTAINER} psql -U postgres -d postgres`, {
    input: sql,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

async function signUpAndCapture(page: Page): Promise<string> {
  const auth = new AuthPageObject(page);
  const email = auth.createRandomEmail();

  await page.goto('/auth/sign-up?next=/home');
  await auth.signUp({ email, password: 'password', repeatPassword: 'password' });
  await auth.visitConfirmEmailLink(email);

  return email;
}

test.describe('Payers (global directory)', () => {
  test('the read-only directory lists all ten seeded SIM- payers and supports search', async ({
    page,
  }) => {
    await signUpAndCapture(page);

    await page.goto('/home/payers');

    const table = page.locator('[data-test="payers-directory-table"]');
    await expect(table).toContainText('SIM Medicare FFS National');
    await expect(table).toContainText('SIM Regional Behavioral Health Network');

    await page.fill('[data-test="payers-directory-search"]', 'TRICARE');
    await expect(table).toContainText('SIM TRICARE-Style Plan');
    await expect(table).not.toContainText('SIM Medicare FFS National');
  });

  test('a non-admin sees access-denied on the admin payer/rule pages', async ({ page }) => {
    await signUpAndCapture(page);

    await page.goto('/admin/payers');
    await expect(page.getByText('Access restricted')).toBeVisible();

    await page.goto('/admin/payer-rules');
    await expect(page.getByText('Access restricted')).toBeVisible();
  });

  test('a platform admin can add a payer and add a rule through the real UI', async ({
    page,
  }) => {
    const email = await signUpAndCapture(page);
    grantPlatformAdmin(email);

    await page.goto('/admin/payers');
    await page.reload();

    await expect(page.locator('[data-test="payers-admin-table"]')).toBeVisible();

    await page.click('[data-test="add-payer-trigger"]');
    await page.fill('input[name="simPayerId"]', 'SIM-E2ETEST-001');
    await page.fill('input[name="displayName"]', 'SIM E2E Test Payer');
    await page.click('button[type="submit"]');

    await expect(page.locator('[data-test="payers-admin-table"]')).toContainText(
      'SIM E2E Test Payer',
    );

    await page.goto('/admin/payer-rules');
    await page.click('[data-test="add-rule-trigger"]');
    await page.fill('input[name="ruleCode"]', 'SIM-RULE-E2ETEST-001');
    await page.fill('input[name="condition"]', 'e2e test condition');
    await page.fill('textarea[name="explanation"]', 'e2e test explanation');
    await page.click('button[type="submit"]');

    await expect(page.locator('[data-test="payer-rules-admin-table"]')).toContainText(
      'SIM-RULE-E2ETEST-001',
    );

    // CSV import: upsert a payer by sim_payer_id
    await page.goto('/admin/payers');
    await page.click('button:has-text("Import CSV")');

    const csv =
      'sim_payer_id,display_name,legal_name,category,scope,state,network_name,enrollment_required,test_production,is_active\n' +
      'SIM-CSVTEST-001,SIM CSV Imported Payer,,commercial_ppo,national,,,false,test,true\n';

    await page.setInputFiles('[data-test="payer-csv-file-input"]', {
      name: 'payers.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csv),
    });

    await expect(page.locator('[data-test="payer-csv-import-submit"]')).toBeEnabled();
    await page.click('[data-test="payer-csv-import-submit"]');

    await expect(page.locator('[data-test="payers-admin-table"]')).toContainText(
      'SIM CSV Imported Payer',
    );
  });
});
