import { NextRequest } from 'next/server';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const getUserMock = vi.fn();
const getSupabaseApiClientMock = vi.fn();
const requireUserMock = vi.fn();
const getSupabaseServerClientMock = vi.fn();

vi.mock('@kit/supabase/api-client', () => ({
  getSupabaseApiClient: (...args: unknown[]) => getSupabaseApiClientMock(...args),
}));

vi.mock('@kit/supabase/require-user', () => ({
  requireUser: (...args: unknown[]) => requireUserMock(...args),
}));

vi.mock('@kit/supabase/server-client', () => ({
  getSupabaseServerClient: (...args: unknown[]) => getSupabaseServerClientMock(...args),
}));

// requireApiUser is imported after the mocks above are registered, so the
// module under test picks up the mocked dependencies.
const { requireApiUser } = await import('./api-response');

function requestWith(headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost/api/v1/claims', { headers });
}

describe('requireApiUser -- bearer-token path', () => {
  beforeEach(() => {
    getUserMock.mockReset();
    getSupabaseApiClientMock.mockReset();
    requireUserMock.mockReset();
    getSupabaseServerClientMock.mockReset();

    getSupabaseApiClientMock.mockReturnValue({
      auth: { getUser: getUserMock },
    });
  });

  it('verifies a valid bearer token against Supabase and returns the user, never touching the cookie path', async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });

    const request = requestWith({ authorization: 'Bearer a-valid-token' });
    const result = await requireApiUser(request, 'corr-1');

    expect(result.errorResponse).toBeNull();
    expect(result.user).toEqual({ id: 'user-123' });
    expect(getSupabaseApiClientMock).toHaveBeenCalledWith('a-valid-token');
    expect(getUserMock).toHaveBeenCalledWith('a-valid-token');
    expect(requireUserMock).not.toHaveBeenCalled();
    expect(getSupabaseServerClientMock).not.toHaveBeenCalled();
  });

  it('rejects an invalid/expired bearer token with 401 and does not fall back to the cookie path', async () => {
    getUserMock.mockResolvedValue({
      data: { user: null },
      error: new Error('invalid JWT'),
    });

    const request = requestWith({ authorization: 'Bearer an-expired-token' });
    const result = await requireApiUser(request, 'corr-2');

    expect(result.user).toBeNull();
    expect(result.errorResponse).not.toBeNull();
    expect(result.errorResponse?.status).toBe(401);
    expect(requireUserMock).not.toHaveBeenCalled();
    expect(getSupabaseServerClientMock).not.toHaveBeenCalled();
  });

  it('is case-insensitive on the "Bearer" scheme prefix', async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: 'user-456' } },
      error: null,
    });

    const request = requestWith({ authorization: 'bearer a-valid-token' });
    const result = await requireApiUser(request, 'corr-3');

    expect(result.errorResponse).toBeNull();
    expect(result.user).toEqual({ id: 'user-456' });
  });

  it('falls back to the cookie/SSR session path when no Authorization header is present', async () => {
    getSupabaseServerClientMock.mockReturnValue({ marker: 'cookie-client' });
    requireUserMock.mockResolvedValue({
      error: null,
      data: { id: 'user-789', sub: 'user-789' },
    });

    const request = requestWith();
    const result = await requireApiUser(request, 'corr-4');

    expect(result.errorResponse).toBeNull();
    expect(result.user).toEqual({ id: 'user-789', sub: 'user-789' });
    expect(getSupabaseApiClientMock).not.toHaveBeenCalled();
    expect(requireUserMock).toHaveBeenCalledWith({ marker: 'cookie-client' });
  });

  it('returns 401 when the cookie/SSR path has no session', async () => {
    getSupabaseServerClientMock.mockReturnValue({ marker: 'cookie-client' });
    requireUserMock.mockResolvedValue({
      error: new Error('no session'),
      data: null,
    });

    const request = requestWith();
    const result = await requireApiUser(request, 'corr-5');

    expect(result.user).toBeNull();
    expect(result.errorResponse?.status).toBe(401);
  });
});
