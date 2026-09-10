import { Page, expect, test } from '@playwright/test';

import { AuthPageObject } from '../authentication/auth.po';

const TODAY = new Date().toISOString().slice(0, 10);

const ALL_PAYERS = [
  { pattern: /SIM Medicare FFS National/, outcome: 'paid' as const },
  { pattern: /SIM Medicare Advantage Plan/, outcome: 'paid' as const },
  { pattern: /SIM Medicaid FFS State Program/, outcome: 'paid' as const },
  { pattern: /SIM Medicaid Managed Care Plan/, outcome: 'denied' as const },
  { pattern: /SIM Commercial PPO Network/, outcome: 'paid' as const },
  { pattern: /SIM Commercial HMO Network/, outcome: 'paid' as const },
  { pattern: /SIM Blue-Style Plan/, outcome: 'paid' as const },
  { pattern: /SIM TRICARE-Style Plan/, outcome: 'paid' as const },
  { pattern: /SIM Marketplace Exchange Plan/, outcome: 'paid' as const },
  { pattern: /SIM Regional Behavioral Health Network/, outcome: 'denied' as const },
];

async function createOrganization(page: Page, name: string) {
  await page.goto('/home/dashboard');
  await page.click('[data-test="organization-switcher-trigger"]');
  await page.click('[data-test="create-organization-trigger"]');

  await page.fill('input[name="name"]', name);
  await page.click('button[type="submit"]');
}

async function selectOption(page: Page, trigger: string, optionMatcher: string | RegExp) {
  await page.locator(trigger).click();
  await page.getByRole('option', { name: optionMatcher }).click();
}

/**
 * The enrollment/coverage dialogs' Payer select has no data-test/label
 * association and the form retains its previously-submitted value across
 * opens (no reset-on-open), so matching the trigger by its current text
 * breaks after the first use. Index into the dialog's comboboxes by
 * position instead -- robust regardless of what's currently selected.
 */
async function selectDialogCombobox(page: Page, index: number, optionMatcher: string | RegExp) {
  await page.getByRole('dialog').locator('button[role="combobox"]').nth(index).click();
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
  await page.click('[data-test="add-enrollment-trigger"]');
  await selectDialogCombobox(page, 0, payerNamePattern);
  await selectDialogCombobox(page, 1, /^Active$/);
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
  await selectDialogCombobox(page, 0, new RegExp(subscriberLastName));
  await selectDialogCombobox(page, 1, payerNamePattern);
  await page.click('button[type="submit"]');
}

/**
 * Builds, validates, approves, submits, and adjudicates one professional
 * claim against a specific payer (selected by matching its coverage in
 * the dropdown -- coverages are added one per payer by the caller before
 * this runs). Returns the final claim status ('paid' or 'denied').
 */
async function processClaimForPayer(
  page: Page,
  opts: { patientLastName: string; providerLastName: string; payerPattern: RegExp },
): Promise<string> {
  await page.goto('/home/claims');
  await page.click('[data-test="new-professional-claim-trigger"]');
  await selectOption(page, '[data-test="claim-subscriber-select"]', new RegExp(opts.patientLastName));
  await selectOption(page, '[data-test="claim-coverage-select"]', opts.payerPattern);
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
  await page.fill('input[name="chargeAmount"]', '100');
  await page.click('[data-test="add-claim-line-submit"]');

  await page.click('[data-test="validate-claim-trigger"]');
  await expect(page.locator('[data-test="validation-results-panel"]')).toContainText(
    'No validation errors',
  );

  await page.click('[data-test="approve-claim-trigger"]');
  await expect(page.locator('[data-test="claim-status-badge"]')).toContainText('approved');

  await page.click('[data-test="submit-claim-trigger"]');
  await expect(page.locator('[data-test="claim-status-badge"]')).toContainText(
    'accepted for adjudication',
    { timeout: 30_000 },
  );

  await page.click('[data-test="adjudicate-claim-trigger"]');
  await page.waitForFunction(() => {
    const badge = document.querySelector('[data-test="claim-status-badge"]');

    return badge?.textContent === 'paid' || badge?.textContent === 'denied';
  });

  return (await page.locator('[data-test="claim-status-badge"]').textContent()) ?? '';
}

test.describe('Remittances & reconciliation', () => {
  test('a paid claim shows the correct contractual adjustment + EFT + reconciliation, a denied claim shows the triggering rule and no EFT', async ({
    page,
  }) => {
    test.setTimeout(180_000);

    const auth = new AuthPageObject(page);
    await auth.signUpFlow('/home');

    await createOrganization(page, `SIM Remit Org ${Date.now()}`);

    await addProvider(page, '1234567893', 'Remy', 'Remitprovider');
    await addPatient(page, 'Pat', 'Remitclaimant', '1990-01-01');
    await addSubscriber(page, 'Remitclaimant', 'Pat', 'Remitclaimant');

    await page.goto('/home/providers');
    await page.click('[role="tab"]:has-text("Payer Enrollments")');
    await addPayerEnrollment(page, /SIM Commercial PPO Network/);
    await addPayerEnrollment(page, /SIM Regional Behavioral Health Network/);

    await page.goto('/home/patients');
    await addCoverage(page, 'Remitclaimant', /SIM Commercial PPO Network/);
    await addCoverage(page, 'Remitclaimant', /SIM Regional Behavioral Health Network/);

    // -- Paid claim --
    const paidStatus = await processClaimForPayer(page, {
      patientLastName: 'Remitclaimant',
      providerLastName: 'Remitprovider',
      payerPattern: /SIM Commercial PPO Network/,
    });

    expect(paidStatus).toBe('paid');

    const paidPanel = page.locator('[data-test="remittance-detail-panel"]');
    await expect(paidPanel.locator('[data-test="remittance-outcome-badge"]')).toContainText(
      'paid',
    );
    // 20% simulated contractual allowance on a $100 charge -> $80 paid, $20 adjustment.
    await expect(paidPanel).toContainText('$80.00');
    await expect(paidPanel.locator('[data-test="claim-adjustment-row"]')).toContainText(
      'SIM-CARC-CO1',
    );
    await expect(paidPanel).toContainText('SIM-EFT-');

    await page.click('[data-test="match-eft-trigger"]');
    await expect(page.locator('[data-test="remittance-detail-panel"]')).toContainText('Matched');

    // -- Denied claim --
    const deniedStatus = await processClaimForPayer(page, {
      patientLastName: 'Remitclaimant',
      providerLastName: 'Remitprovider',
      payerPattern: /SIM Regional Behavioral Health Network/,
    });

    expect(deniedStatus).toBe('denied');

    const deniedPanel = page.locator('[data-test="remittance-detail-panel"]');
    await expect(deniedPanel.locator('[data-test="remittance-outcome-badge"]')).toContainText(
      'denied',
    );
    await expect(deniedPanel.locator('[data-test="claim-adjustment-row"]')).toContainText(
      'SIM-CARC-PA1',
    );
    await expect(deniedPanel.locator('[data-test="claim-adjustment-row"]')).toContainText(
      'prior authorization',
    );
    // No EFT trace, no Match EFT action, ever, for a denial.
    await expect(deniedPanel).not.toContainText('SIM-EFT-');
    await expect(page.locator('[data-test="match-eft-trigger"]')).not.toBeVisible();
  });

  test('exactly 8 paid and 2 denied across all ten seeded payers, reflected in the dashboard denial rate', async ({
    page,
  }) => {
    test.setTimeout(480_000);

    const auth = new AuthPageObject(page);
    await auth.signUpFlow('/home');

    await createOrganization(page, `SIM Remit Sweep Org ${Date.now()}`);

    await addProvider(page, '1234567893', 'Sam', 'Sweepprovider');
    await addPatient(page, 'Sue', 'Sweepclaimant', '1990-01-01');
    await addSubscriber(page, 'Sweepclaimant', 'Sue', 'Sweepclaimant');

    await page.goto('/home/providers');
    await page.click('[role="tab"]:has-text("Payer Enrollments")');

    for (const payer of ALL_PAYERS) {
      await addPayerEnrollment(page, payer.pattern);
    }

    await page.goto('/home/patients');

    for (const payer of ALL_PAYERS) {
      await addCoverage(page, 'Sweepclaimant', payer.pattern);
    }

    let paidCount = 0;
    let deniedCount = 0;

    for (const payer of ALL_PAYERS) {
      const status = await processClaimForPayer(page, {
        patientLastName: 'Sweepclaimant',
        providerLastName: 'Sweepprovider',
        payerPattern: payer.pattern,
      });

      expect(status).toBe(payer.outcome);

      if (status === 'paid') {
        paidCount += 1;
      } else if (status === 'denied') {
        deniedCount += 1;
      }
    }

    expect(paidCount).toBe(8);
    expect(deniedCount).toBe(2);

    await page.goto('/home/dashboard');
    await expect(page.locator('[data-test="denial-rate-value"]')).toContainText('20.0%');
    await expect(page.locator('[data-test="rejection-rate-value"]')).toContainText('0.0%');
  });
});
