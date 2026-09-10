import { execSync } from 'node:child_process';

import { Browser, Page, expect, test } from '@playwright/test';

import { AuthPageObject } from '../authentication/auth.po';

const DB_CONTAINER = 'supabase_db_next-supabase-saas-kit-turbo-lite';
const TODAY = new Date().toISOString().slice(0, 10);

/**
 * Grants an existing user a specific role in an existing organization,
 * reaching around the UI directly into the local test DB. Mirrors
 * apps/e2e/tests/payers/payers.spec.ts's grantPlatformAdmin() -- there is
 * a real invite+accept UI path for this (Phase 2), but reproducing it here
 * (a second signup, Mailpit round-trip, accept) would test the invite flow
 * a second time rather than claims RBAC; this is purely test setup.
 */
function grantOrgRole(orgName: string, email: string, roleKey: string) {
  const sql = `
    do $$
    declare
      target_user_id uuid;
      target_org_id uuid;
      target_role_id uuid;
    begin
      select id into target_user_id from auth.users where email = '${email}';
      select id into target_org_id from public.organizations where name = '${orgName}';
      select id into target_role_id from public.roles where key = '${roleKey}';

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

async function createOrganization(page: Page, name: string) {
  await page.goto('/home/dashboard');
  await page.click('[data-test="organization-switcher-trigger"]');
  await page.click('[data-test="create-organization-trigger"]');

  await page.fill('input[name="name"]', name);
  await page.click('button[type="submit"]');
}

async function selectOption(
  page: Page,
  trigger: string,
  optionMatcher: string | RegExp,
) {
  await page.locator(trigger).click();
  await page.getByRole('option', { name: optionMatcher }).click();
}

async function addProvider(page: Page, npi: string, firstName: string, lastName: string) {
  await page.goto('/home/providers');
  await page.click('[data-test="add-provider-trigger"]');
  await page.fill('input[name="npi"]', npi);
  await page.fill('input[name="firstName"]', firstName);
  await page.fill('input[name="lastName"]', lastName);
  await page.click('button[type="submit"]');
  await expect(page.locator('[data-test="providers-table"]')).toContainText(lastName);
}

async function addFacility(page: Page, name: string) {
  await page.click('[role="tab"]:has-text("Facilities")');
  await page.click('[data-test="add-facility-trigger"]');
  await page.fill('input[name="name"]', name);
  await page.click('button[type="submit"]');
  await expect(page.locator('[data-test="facilities-table"]')).toContainText(name);
}

async function addPayerEnrollment(page: Page, payerNamePattern: RegExp) {
  await page.click('[role="tab"]:has-text("Payer Enrollments")');
  await page.click('[data-test="add-enrollment-trigger"]');
  await selectOption(page, 'button[role="combobox"]:has-text("Select a payer")', payerNamePattern);
  await selectOption(page, 'button[role="combobox"]:has-text("Pending")', /^Active$/);
  await page.click('button[type="submit"]');
  await expect(page.locator('[data-test="enrollments-table"]')).toContainText('active');
}

async function addPatient(page: Page, firstName: string, lastName: string, dob: string) {
  await page.goto('/home/patients');
  await page.click('[data-test="add-patient-trigger"]');
  await page.fill('input[name="firstName"]', firstName);
  await page.fill('input[name="lastName"]', lastName);
  await page.fill('input[name="dateOfBirth"]', dob);
  await page.click('button[type="submit"]');
  await expect(page.locator('[data-test="patients-table"]')).toContainText(lastName);
}

async function addSubscriber(page: Page, patientLastName: string, firstName: string, lastName: string) {
  await page.click('[role="tab"]:has-text("Subscribers")');
  await page.click('[data-test="add-subscriber-trigger"]');
  await selectOption(
    page,
    'button[role="combobox"]:has-text("Select a patient")',
    new RegExp(patientLastName),
  );
  await page.fill('input[name="firstName"]', firstName);
  await page.fill('input[name="lastName"]', lastName);
  await page.click('button[type="submit"]');
  await expect(page.locator('[data-test="subscribers-table"]')).toContainText(lastName);
}

async function addCoverage(page: Page, subscriberLastName: string, payerNamePattern: RegExp) {
  await page.click('[role="tab"]:has-text("Coverages")');
  await page.click('[data-test="add-coverage-trigger"]');
  await selectOption(
    page,
    'button[role="combobox"]:has-text("Select a subscriber")',
    new RegExp(subscriberLastName),
  );
  await selectOption(page, 'button[role="combobox"]:has-text("Select a payer")', payerNamePattern);
  await page.click('button[type="submit"]');
}

test.describe('Claims (837P / 837I builders)', () => {
  test('an org member can build, validate, and approve a professional and an institutional claim through the real UI', async ({
    page,
  }) => {
    test.setTimeout(120_000);

    const auth = new AuthPageObject(page);
    await auth.signUpFlow('/home');

    const orgName = `SIM Claims Org ${Date.now()}`;
    await createOrganization(page, orgName);

    await addProvider(page, '1234567893', 'Billy', 'Claimsprovider');
    await addFacility(page, 'SIM Claims Clinic');
    await addPayerEnrollment(page, /SIM Commercial PPO Network/);

    await addPatient(page, 'Patty', 'Firstorgclaimant', '1990-01-01');
    await addSubscriber(page, 'Firstorgclaimant', 'Patty', 'Firstorgclaimant');
    await addCoverage(page, 'Firstorgclaimant', /SIM Commercial PPO Network/);

    // -- Professional claim --
    await page.goto('/home/claims');
    await page.click('[data-test="new-professional-claim-trigger"]');
    await selectOption(page, '[data-test="claim-subscriber-select"]', /Firstorgclaimant/);
    await page.locator('[data-test="claim-coverage-select"]').click();
    await page.getByRole('option').first().click();
    await selectOption(page, '[data-test="claim-billing-provider-select"]', /Claimsprovider/);
    await selectOption(page, '[data-test="claim-rendering-provider-select"]', /Claimsprovider/);
    await page.click('[data-test="create-professional-claim-submit"]');
    await page.waitForURL(/\/home\/claims\/[0-9a-f-]+$/);

    await page.click('[data-test="add-diagnosis-trigger"]');
    await selectOption(page, '[data-test="claim-diagnosis-code-select"]', /F32\.9/);
    await page.click('[data-test="add-claim-diagnosis-submit"]');
    await expect(page.locator('[data-test="claim-diagnoses-list"]')).toContainText('F32.9');

    await page.click('[data-test="add-claim-line-trigger"]');
    await page.fill('input[name="serviceDate"]', TODAY);
    await selectOption(page, '[data-test="claim-line-code-select"]', /90834/);
    await page.fill('input[name="chargeAmount"]', '150');
    await page.click('[data-test="add-claim-line-submit"]');
    await expect(page.locator('[data-test="claim-lines-list"]')).toContainText('90834');

    await page.click('[data-test="validate-claim-trigger"]');
    await expect(page.locator('[data-test="validation-results-panel"]')).toContainText(
      'No validation errors',
    );

    await page.click('[data-test="approve-claim-trigger"]');
    await expect(page.locator('[data-test="claim-status-badge"]')).toContainText('approved');

    // -- Institutional claim --
    await page.goto('/home/claims');
    await page.click('[data-test="new-institutional-claim-trigger"]');
    await selectOption(page, '[data-test="claim-subscriber-select"]', /Firstorgclaimant/);
    await page.locator('[data-test="claim-coverage-select"]').click();
    await page.getByRole('option').first().click();
    await selectOption(page, '[data-test="claim-billing-provider-select"]', /Claimsprovider/);
    await selectOption(page, '[data-test="claim-facility-select"]', /SIM Claims Clinic/);
    await selectOption(page, '[data-test="claim-type-of-bill-select"]', /0761/);
    await page.click('[data-test="create-institutional-claim-submit"]');
    await page.waitForURL(/\/home\/claims\/[0-9a-f-]+$/);

    await page.click('[data-test="add-diagnosis-trigger"]');
    await selectOption(page, '[data-test="claim-diagnosis-code-select"]', /F32\.9/);
    await page.click('[data-test="add-claim-diagnosis-submit"]');

    await page.click('[data-test="add-claim-line-trigger"]');
    await page.fill('input[name="serviceDate"]', TODAY);
    await selectOption(page, '[data-test="claim-line-code-select"]', /0914/);
    await page.fill('input[name="chargeAmount"]', '200');
    await page.click('[data-test="add-claim-line-submit"]');

    await page.click('[data-test="validate-claim-trigger"]');
    await expect(page.locator('[data-test="validation-results-panel"]')).toContainText(
      'No validation errors',
    );

    await page.click('[data-test="approve-claim-trigger"]');
    await expect(page.locator('[data-test="claim-status-badge"]')).toContainText('approved');
  });

  test('validation surfaces the DB-sourced explanation when a required diagnosis is missing', async ({
    page,
  }) => {
    const auth = new AuthPageObject(page);
    await auth.signUpFlow('/home');

    const orgName = `SIM Claims Validation Org ${Date.now()}`;
    await createOrganization(page, orgName);

    await addProvider(page, '1234567893', 'Vera', 'Validationprovider');
    await addPatient(page, 'Val', 'Validationpatient', '1990-01-01');
    await addSubscriber(page, 'Validationpatient', 'Val', 'Validationpatient');
    await addCoverage(page, 'Validationpatient', /SIM Medicare FFS National/);

    await page.goto('/home/claims');
    await page.click('[data-test="new-professional-claim-trigger"]');
    await selectOption(page, '[data-test="claim-subscriber-select"]', /Validationpatient/);
    await page.locator('[data-test="claim-coverage-select"]').click();
    await page.getByRole('option').first().click();
    await selectOption(page, '[data-test="claim-billing-provider-select"]', /Validationprovider/);
    await selectOption(page, '[data-test="claim-rendering-provider-select"]', /Validationprovider/);
    await page.click('[data-test="create-professional-claim-submit"]');
    await page.waitForURL(/\/home\/claims\/[0-9a-f-]+$/);

    // No diagnosis added -- validate immediately.
    await page.click('[data-test="validate-claim-trigger"]');

    await expect(page.locator('[data-test="validation-results-panel"]')).toContainText(
      'Every claim requires at least one diagnosis code.',
    );
    await expect(page.locator('[data-test="claim-status-badge"]')).toContainText(
      'validation failed',
    );
  });

  test('a claims_specialist cannot approve a claim, and the REST API rejects an unsupported loop', async ({
    page,
    browser,
  }: {
    page: Page;
    browser: Browser;
  }) => {
    await signUpAndCapture(page);

    const orgName = `SIM Claims RBAC Org ${Date.now()}`;
    await createOrganization(page, orgName);

    await addProvider(page, '1234567893', 'Rex', 'Rbacprovider');
    await addPatient(page, 'Rae', 'Rbacpatient', '1990-01-01');
    await addSubscriber(page, 'Rbacpatient', 'Rae', 'Rbacpatient');
    await addCoverage(page, 'Rbacpatient', /SIM Medicaid FFS State Program/);

    await page.goto('/home/claims');
    await page.click('[data-test="new-professional-claim-trigger"]');
    await selectOption(page, '[data-test="claim-subscriber-select"]', /Rbacpatient/);
    await page.locator('[data-test="claim-coverage-select"]').click();
    await page.getByRole('option').first().click();
    await selectOption(page, '[data-test="claim-billing-provider-select"]', /Rbacprovider/);
    await selectOption(page, '[data-test="claim-rendering-provider-select"]', /Rbacprovider/);
    await page.click('[data-test="create-professional-claim-submit"]');
    await page.waitForURL(/\/home\/claims\/[0-9a-f-]+$/);

    const claimUrl = page.url();

    // Unsupported loop: REST negative, still as the owner (who has
    // claims.create_edit -- the 422 fires before any permission check).
    const cookies = await page.context().cookies();
    const orgId = cookies.find((c) => c.name === 'current-organization-id')?.value;

    const response = await page.request.post('/api/v1/claims', {
      data: {
        claimType: 'professional',
        organizationId: orgId,
        secondaryPayerId: 'SIM-NOT-SUPPORTED',
      },
    });

    expect(response.status()).toBe(422);
    const body = await response.json();
    expect(body.error.code).toBe('unsupported_loop');
    expect(body.error.message).toContain('Coordination of benefits');

    // RBAC: a second user, granted claims_specialist in the SAME org via
    // direct DB grant (see grantOrgRole -- no UI bootstrap needed since
    // claims_specialist already has a real invite path from Phase 2; this
    // is purely test setup, not a claim about missing UI).
    const specialistContext = await browser.newContext();
    const specialistPage = await specialistContext.newPage();
    const specialistEmail = await signUpAndCapture(specialistPage);

    grantOrgRole(orgName, specialistEmail, 'claims_specialist');

    await specialistPage.goto(claimUrl);
    await expect(
      specialistPage.locator('[data-test="claim-status-badge"]'),
    ).toBeVisible();
    await expect(
      specialistPage.locator('[data-test="approve-claim-trigger"]'),
    ).not.toBeVisible();

    await specialistContext.close();
  });

  test("a second organization cannot see the first organization's claims", async ({
    page,
  }) => {
    const auth = new AuthPageObject(page);
    await auth.signUpFlow('/home');

    await createOrganization(page, `SIM Claims Isolated Org ${Date.now()}`);

    await page.goto('/home/claims');
    await expect(page.locator('[data-test="claims-table"]')).not.toContainText(
      'Firstorgclaimant',
    );
  });
});
