import { Page, expect, test } from '@playwright/test';

import { AuthPageObject } from '../authentication/auth.po';

const customerRoutes = [
  '/home/dashboard',
  '/home/claims',
  '/home/claim-batches',
  '/home/remittances',
  '/home/payers',
  '/home/documents',
  '/home/support',
  '/home/users',
  '/home/audit',
];

const portalRoutes = ['/support', '/admin'];

test.describe('Clearinghouse route skeletons', () => {
  test.describe('Unauthenticated visitors', () => {
    for (const path of [...customerRoutes, ...portalRoutes]) {
      test(`redirects ${path} to sign-in`, async ({ page }) => {
        await page.goto(path);

        expect(page.url()).toContain(`/auth/sign-in?next=${path}`);
      });
    }
  });

  test.describe('Authenticated users', () => {
    let page: Page;
    let auth: AuthPageObject;

    test.beforeAll(async ({ browser }) => {
      page = await browser.newPage();
      auth = new AuthPageObject(page);

      await auth.signUpFlow('/home');
    });

    for (const path of [...customerRoutes, ...portalRoutes]) {
      test(`authenticated user can reach ${path}`, async () => {
        await page.goto(path);

        expect(page.url()).toContain(path);
      });
    }
  });
});
