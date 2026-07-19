import { Page, expect, test } from '@playwright/test';

import { AuthPageObject } from '../authentication/auth.po';

const TODAY = new Date().toISOString().slice(0, 10);

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

async function buildValidatedApprovedProfessionalClaim(
  page: Page,
  opts: { patientLastName: string; providerLastName: string },
) {
  await page.goto('/home/claims');
  await page.click('[data-test="new-professional-claim-trigger"]');
  await selectOption(page, '[data-test="claim-subscriber-select"]', new RegExp(opts.patientLastName));
  await page.locator('[data-test="claim-coverage-select"]').click();
  await page.getByRole('option').first().click();
  await selectOption(page, '[data-test="claim-billing-provider-select"]', new RegExp(opts.providerLastName));
  await selectOption(page, '[data-test="claim-rendering-provider-select"]', new RegExp(opts.providerLastName));
  await page.click('[data-test="create-professional-claim-submit"]');
  await page.waitForURL(/\/home\/claims\/[0-9a-f-]+$/);

  await page.click('[data-test="add-diagnosis-trigger"]');
  await selectOption(page, '[data-test="claim-diagnosis-code-select"]', /F32\.9/);
  await page.click('[data-test="add-claim-diagnosis-submit"]');

  await page.click('[data-test="add-claim-line-trigger"]');
  await page.fill('input[name="serviceDate"]', TODAY);
  await selectOption(page, '[data-test="claim-line-code-select"]', /90834/);
  await page.fill('input[name="chargeAmount"]', '150');
  await page.click('[data-test="add-claim-line-submit"]');

  await page.click('[data-test="validate-claim-trigger"]');
  await expect(page.locator('[data-test="validation-results-panel"]')).toContainText(
    'No validation errors',
  );

  await page.click('[data-test="approve-claim-trigger"]');
  await expect(page.locator('[data-test="claim-status-badge"]')).toContainText('approved');

  return page.url();
}

test.describe('EDI processor & trace graph', () => {
  test('submitting an approved claim generates control numbers and a full TA1/999/277CA trace, and is idempotent on resubmission', async ({
    page,
  }) => {
    test.setTimeout(120_000);

    const auth = new AuthPageObject(page);
    await auth.signUpFlow('/home');

    await createOrganization(page, `SIM EDI Org ${Date.now()}`);

    await addProvider(page, '1234567893', 'Eddie', 'Ediprovider');
    await addPayerEnrollment(page, /SIM Commercial PPO Network/);
    await addPatient(page, 'Pam', 'Ediclaimant', '1990-01-01');
    await addSubscriber(page, 'Ediclaimant', 'Pam', 'Ediclaimant');
    await addCoverage(page, 'Ediclaimant', /SIM Commercial PPO Network/);

    const claimUrl = await buildValidatedApprovedProfessionalClaim(page, {
      patientLastName: 'Ediclaimant',
      providerLastName: 'Ediprovider',
    });

    await page.click('[data-test="submit-claim-trigger"]');
    await expect(page.locator('[data-test="claim-status-badge"]')).toContainText(
      'accepted for adjudication',
    );

    const trace = page.locator('[data-test="transaction-trace-panel"]');
    await expect(trace).toContainText('claim_submitted');
    await expect(trace).toContainText('edi_generated');
    await expect(trace).toContainText('ta1_received');
    await expect(trace).toContainText('999_received');
    await expect(trace).toContainText('277ca_received');
    await expect(trace).toContainText('accepted_for_adjudication');
    await expect(trace).toContainText('ISA13');
    await expect(trace).toContainText('Correlation ID');

    const eventCountAfterFirstSubmit = await page
      .locator('[data-test="transaction-trace-event"]')
      .count();

    expect(eventCountAfterFirstSubmit).toBe(6);

    // Duplicate submit: the Submit button only renders when status is
    // "approved" (it's now accepted_for_adjudication), so drive the
    // duplicate through the REST endpoint directly, as the same
    // authenticated session, exercising the real idempotency guarantee.
    const response = await page.request.post(
      `/api/v1/claims/${claimUrl.split('/').pop()}/submit`,
    );

    expect(response.status()).toBe(409);

    await page.reload();

    const eventCountAfterDuplicateSubmit = await page
      .locator('[data-test="transaction-trace-event"]')
      .count();

    expect(eventCountAfterDuplicateSubmit).toBe(eventCountAfterFirstSubmit);
  });

  test('a not-yet-approved claim cannot be submitted', async ({ page }) => {
    const auth = new AuthPageObject(page);
    await auth.signUpFlow('/home');

    await createOrganization(page, `SIM EDI Reject Org ${Date.now()}`);

    await addProvider(page, '1234567893', 'Rex', 'Rejectprovider');
    await addPatient(page, 'Rae', 'Rejectclaimant', '1990-01-01');
    await addSubscriber(page, 'Rejectclaimant', 'Rae', 'Rejectclaimant');
    await addCoverage(page, 'Rejectclaimant', /SIM Medicare FFS National/);

    await page.goto('/home/claims');
    await page.click('[data-test="new-professional-claim-trigger"]');
    await selectOption(page, '[data-test="claim-subscriber-select"]', /Rejectclaimant/);
    await page.locator('[data-test="claim-coverage-select"]').click();
    await page.getByRole('option').first().click();
    await selectOption(page, '[data-test="claim-billing-provider-select"]', /Rejectprovider/);
    await selectOption(page, '[data-test="claim-rendering-provider-select"]', /Rejectprovider/);
    await page.click('[data-test="create-professional-claim-submit"]');
    await page.waitForURL(/\/home\/claims\/[0-9a-f-]+$/);

    // Still in "draft" -- never validated or approved. No Submit button.
    await expect(page.locator('[data-test="submit-claim-trigger"]')).not.toBeVisible();

    const claimId = page.url().split('/').pop();
    const response = await page.request.post(`/api/v1/claims/${claimId}/submit`);

    expect(response.status()).toBe(409);
    const body = await response.json();
    expect(body.error.message).toContain('validate and approve');
  });
});
