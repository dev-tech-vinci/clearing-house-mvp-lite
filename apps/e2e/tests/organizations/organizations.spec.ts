import { Page, expect, test } from '@playwright/test';

import { AuthPageObject } from '../authentication/auth.po';

async function createOrganization(page: Page, name: string) {
  await page.goto('/home/dashboard');
  await page.click('[data-test="organization-switcher-trigger"]');
  await page.click('[data-test="create-organization-trigger"]');

  await page.fill('input[name="name"]', name);
  await page.click('button[type="submit"]');
}

test.describe('Organizations', () => {
  test('a new user can create an organization and see it in the switcher', async ({
    page,
  }) => {
    const auth = new AuthPageObject(page);
    await auth.signUpFlow('/home');

    const orgName = `SIM E2E Org ${Date.now()}`;
    await createOrganization(page, orgName);

    await page.click('[data-test="organization-switcher-trigger"]');
    await expect(page.locator('[data-test="organization-switcher-item"]')).toContainText(
      orgName,
    );
  });

  test('org owner sees themselves as a member and can invite someone', async ({
    page,
  }) => {
    const auth = new AuthPageObject(page);
    await auth.signUpFlow('/home');

    const orgName = `SIM E2E Org ${Date.now()}`;
    await createOrganization(page, orgName);

    await page.goto('/home/users');

    await expect(page.locator('[data-test="organization-members-table"]')).toContainText(
      'Org Owner',
    );

    await page.click('[data-test="invite-member-trigger"]');
    await page.fill('input[name="email"]', 'sim-invitee@example.test');
    await page.click('button[type="submit"]');

    await expect(
      page.locator('[data-test="organization-invitations-table"]'),
    ).toContainText('sim-invitee@example.test');
  });

  test('accept-invitation page surfaces an error for an invalid token without crashing', async ({
    page,
  }) => {
    const auth = new AuthPageObject(page);
    await auth.signUpFlow('/home');

    await page.goto('/home/invitations/accept?token=not-a-real-token-000000');
    await page.click('[data-test="accept-invitation-button"]');

    await expect(page.locator('[data-test="accept-invitation-error"]')).toBeVisible();
  });
});
