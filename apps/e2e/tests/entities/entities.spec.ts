import { Page, expect, test } from '@playwright/test';

import { AuthPageObject } from '../authentication/auth.po';

async function createOrganization(page: Page, name: string) {
  await page.goto('/home/dashboard');
  await page.click('[data-test="organization-switcher-trigger"]');
  await page.click('[data-test="create-organization-trigger"]');

  await page.fill('input[name="name"]', name);
  await page.click('button[type="submit"]');
}

test.describe('Entities (providers, facilities, patients)', () => {
  test('an org member can add a provider and a facility', async ({ page }) => {
    const auth = new AuthPageObject(page);
    await auth.signUpFlow('/home');
    await createOrganization(page, `SIM Entities Org ${Date.now()}`);

    await page.goto('/home/providers');

    await page.click('[data-test="add-provider-trigger"]');
    await page.fill('input[name="npi"]', '1234567893');
    await page.fill('input[name="firstName"]', 'Simone');
    await page.fill('input[name="lastName"]', 'Fictional');
    await page.click('button[type="submit"]');

    await expect(page.locator('[data-test="providers-table"]')).toContainText(
      'Simone Fictional',
    );

    await page.click('[role="tab"]:has-text("Facilities")');
    await page.click('[data-test="add-facility-trigger"]');
    await page.fill('input[name="name"]', 'SIM Fictional Clinic');
    await page.click('button[type="submit"]');

    await expect(page.locator('[data-test="facilities-table"]')).toContainText(
      'SIM Fictional Clinic',
    );
  });

  test('an org member can add a patient', async ({ page }) => {
    const auth = new AuthPageObject(page);
    await auth.signUpFlow('/home');
    await createOrganization(page, `SIM Entities Org ${Date.now()}`);

    await page.goto('/home/patients');

    await page.click('[data-test="add-patient-trigger"]');
    await page.fill('input[name="firstName"]', 'Patty');
    await page.fill('input[name="lastName"]', 'Testperson');
    await page.fill('input[name="dateOfBirth"]', '1990-01-01');
    await page.click('button[type="submit"]');

    await expect(page.locator('[data-test="patients-table"]')).toContainText(
      'Patty Testperson',
    );
  });

  test('a second org cannot see the first org providers or patients', async ({
    page,
  }) => {
    const auth = new AuthPageObject(page);
    await auth.signUpFlow('/home');
    await createOrganization(page, `SIM Isolated Org ${Date.now()}`);

    await page.goto('/home/providers');
    await expect(page.locator('[data-test="providers-table"]')).not.toContainText(
      'Simone Fictional',
    );

    await page.goto('/home/patients');
    await expect(page.locator('[data-test="patients-table"]')).not.toContainText(
      'Patty Testperson',
    );
  });
});
