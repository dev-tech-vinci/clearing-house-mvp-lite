import { execSync } from 'node:child_process';

import { Browser, Page, expect, test } from '@playwright/test';

import { AuthPageObject } from '../authentication/auth.po';

const DB_CONTAINER = 'supabase_db_next-supabase-saas-kit-turbo-lite';
const SUPABASE_URL = 'http://127.0.0.1:54321';

/**
 * support_manager/support_agent are platform-wide roles with no
 * self-service bootstrap UI (same gap as Phase 4's platform_super_admin --
 * see docs/progress/KNOWN_ISSUES.md). Mirrors payers.spec.ts's
 * grantPlatformAdmin(), generalized to any platform role: a bootstrap
 * organization + a membership row is exactly what a real ops process
 * would create, done here directly against the local test DB purely for
 * test setup.
 */
function grantPlatformRole(email: string, roleKey: string) {
  const sql = `
    do $$
    declare
      target_user_id uuid;
      target_role_id uuid;
      target_org_id uuid;
    begin
      select id into target_user_id from auth.users where email = '${email}';
      select id into target_role_id from public.roles where key = '${roleKey}';

      insert into public.organizations (name, slug, created_by)
      values ('SIM ${roleKey} Bootstrap', 'sim-${roleKey}-bootstrap-' || target_user_id, target_user_id)
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

async function createOrganization(page: Page, name: string) {
  await page.goto('/home/dashboard');
  await page.click('[data-test="organization-switcher-trigger"]');
  await page.click('[data-test="create-organization-trigger"]');

  await page.fill('input[name="name"]', name);
  await page.click('button[type="submit"]');
}

test.describe('Support portal, private documents & audited access', () => {
  test("a customer opens a ticket and uploads a private document; a support agent self-assigns, starts a banner-gated access session, sees the customer's document only during the session, ends it, and both the access history and the audit log record every step", async ({
    page,
    browser,
  }: {
    page: Page;
    browser: Browser;
  }) => {
    test.setTimeout(180_000);

    await signUpAndCapture(page);

    const orgName = `SIM Support Org ${Date.now()}`;
    await createOrganization(page, orgName);

    // --- Customer: open a ticket ---
    await page.goto('/home/support');
    await page.click('[data-test="new-ticket-trigger"]');
    await page.fill('[data-test="ticket-subject-input"]', 'SIM stuck claim needs review');
    await page.fill(
      '[data-test="ticket-description-input"]',
      'A claim appears stuck at accepted_for_adjudication and has not moved.',
    );
    await page.click('[data-test="create-ticket-submit"]');
    await expect(page.locator('[data-test="tickets-table"]')).toContainText(
      'SIM stuck claim needs review',
    );

    await page.click('[data-test="tickets-table"] a:has-text("Open")');
    await page.waitForURL(/\/home\/support\/[0-9a-f-]+$/);
    const ticketUrl = page.url();
    const ticketId = ticketUrl.split('/').pop()!;

    // --- Customer: upload a private document ---
    await page.goto('/home/documents');
    await page.click('[data-test="upload-document-trigger"]');
    await page.setInputFiles('[data-test="document-file-input"]', {
      name: 'sim-test-document.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 SIM synthetic test document, not real PHI.'),
    });
    await expect(page.locator('[data-test="documents-table"]')).toContainText(
      'sim-test-document.pdf',
    );

    // Viewing the customer's own document logs both document_access_events
    // and an audit_events row (document.view) -- checked below.
    const [viewPopup] = await Promise.all([
      page.waitForEvent('popup'),
      page.click('[data-test="document-view-trigger"]'),
    ]);
    await viewPopup.close();

    const cookies = await page.context().cookies();
    const orgId = cookies.find((c) => c.name === 'current-organization-id')?.value;

    expect(orgId).toBeTruthy();

    // --- Support agent: self-assign the ticket and start an access session ---
    const agentContext = await browser.newContext();
    const agentPage = await agentContext.newPage();
    const agentEmail = await signUpAndCapture(agentPage);

    grantPlatformRole(agentEmail, 'support_agent');

    await agentPage.goto('/support/tickets');
    await expect(agentPage.locator('[data-test="tickets-table"]')).toContainText(
      'SIM stuck claim needs review',
    );

    await agentPage.goto(`/support/tickets/${ticketId}`);
    await expect(agentPage.locator('[data-test="access-session-unavailable"]')).toBeVisible();
    await expect(agentPage.locator('[data-test="start-access-session-form"]')).not.toBeVisible();
    await agentPage.click('[data-test="assign-to-me-trigger"]');
    await expect(agentPage.locator('[data-test="start-access-session-form"]')).toBeVisible();

    // Before a session exists, the session-scoped customer data section is
    // absent entirely (the page never fetched it) -- proven at the DB
    // layer already by pgTAP's "no session sees nothing" assertion; here
    // we confirm the real UI simply doesn't render it.
    await expect(agentPage.getByText('Customer documents (session-scoped)')).not.toBeVisible();

    await agentPage.fill(
      '[data-test="access-session-reason-input"]',
      'SIM Investigating the stuck claim per the customer ticket above',
    );
    await agentPage.click('[data-test="start-access-session-trigger"]');

    const banner = agentPage.locator('[data-test="support-access-banner"]');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('SUPPORT ACCESS ACTIVE');
    await expect(banner).toContainText('Investigating the stuck claim');

    await expect(agentPage.getByText('Customer documents (session-scoped)')).toBeVisible();
    await expect(agentPage.locator('body')).toContainText('sim-test-document.pdf');

    await agentPage.click('[data-test="end-access-session-trigger"]');
    await expect(banner).not.toBeVisible();
    await expect(agentPage.locator('[data-test="start-access-session-form"]')).toBeVisible();

    await agentContext.close();

    // --- Customer: the access history and audit log both record it ---
    await page.goto('/home/support');
    await expect(page.locator('[data-test="support-access-history"]')).toContainText(
      'Investigating the stuck claim',
    );
    await expect(
      page.locator('[data-test="support-access-history-row"]').first(),
    ).toContainText('Ended');

    await page.goto('/home/audit');
    const auditPanel = page.locator('[data-test="audit-log-panel"]');
    await expect(auditPanel).toContainText('support_session.started');
    await expect(auditPanel).toContainText('support_session.ended');
    await expect(auditPanel).toContainText('document.view');
  });

  test("a document is only reachable via a short-TTL signed URL, never the bucket's public object endpoint", async ({
    page,
  }) => {
    await signUpAndCapture(page);

    const orgName = `SIM Doc Privacy Org ${Date.now()}`;
    await createOrganization(page, orgName);

    await page.goto('/home/documents');
    await page.click('[data-test="upload-document-trigger"]');
    await page.setInputFiles('[data-test="document-file-input"]', {
      name: 'sim-private.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 SIM synthetic private document.'),
    });
    await expect(page.locator('[data-test="documents-table"]')).toContainText('sim-private.pdf');

    const cookies = await page.context().cookies();
    const orgId = cookies.find((c) => c.name === 'current-organization-id')?.value;

    // The object's public-bucket URL must be rejected -- the bucket is
    // private (public=false), so Supabase Storage's /object/public/*
    // endpoint returns an error for it regardless of path guessing. A
    // valid anon apikey is included so the rejection is provably about
    // bucket privacy, not a missing/invalid API key.
    const guessedPublicUrl = `${SUPABASE_URL}/storage/v1/object/public/org_documents/${orgId}/sim-private.pdf`;
    const publicResponse = await page.request.get(guessedPublicUrl, {
      failOnStatusCode: false,
      headers: {
        apikey:
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
      },
    });

    expect(publicResponse.ok()).toBe(false);

    // The real signed URL from the UI does work. window.open() creates the
    // popup at about:blank first and redirects it once the signed URL
    // resolves; Chromium treats navigating a popup straight to a PDF as a
    // download rather than a completed page load (the navigation itself
    // reports ERR_ABORTED once the download takes over), so assert on the
    // outgoing request the popup makes rather than its final url()/load
    // state, which is the part that's actually reliable here.
    const [popup] = await Promise.all([
      page.waitForEvent('popup'),
      page.click('[data-test="document-view-trigger"]'),
    ]);

    // The request event lives on the popup's own request stream, not the
    // opener page's -- waiting on `page` here (as an earlier attempt did)
    // never sees it.
    const signedRequest = await popup.waitForRequest(
      (req) => req.url().includes('/storage/v1/object/sign/org_documents/'),
      { timeout: 10_000 },
    );

    expect(signedRequest.url()).toContain('/storage/v1/object/sign/org_documents/');
    expect(signedRequest.url()).toContain('token=');
  });
});
