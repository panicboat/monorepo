import { test, expect } from '@playwright/test';

test.describe('Guest Authentication Flow', () => {

  test('Guest Sign Up (Success)', async ({ page }) => {
    const randomSuffix = Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
    const phoneNumber = `090${randomSuffix}`;
    const password = 'password123';

    await page.goto('/');
    await page.getByRole('button', { name: 'Create New Account' }).click();

    // Phone Input
    await page.getByRole('heading', { name: 'Create Account' }).isVisible();
    await page.getByPlaceholder('09012345678').fill(phoneNumber);
    await page.getByRole('button', { name: 'Send Verification Code' }).click();

    // Verify SMS
    await expect(page.getByRole('heading', { name: 'Verify Phone' })).toBeVisible({ timeout: 15000 });
    await page.getByPlaceholder('0000').fill('0000');
    await page.getByRole('button', { name: 'Verify Code' }).click();

    // Set Password
    await expect(page.getByRole('heading', { name: 'Set Password' })).toBeVisible();
    await page.getByPlaceholder('Min 8 characters').fill(password);
    await page.getByRole('button', { name: 'Create Account' }).click();

    await expect(page.locator('.text-red-500')).toBeHidden();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText('Ranking')).toBeVisible();
  });

  test('Guest Login (Success & Logout)', async ({ page }) => {
    const randomSuffix = Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
    const phoneNumber = `090${randomSuffix}`;
    const password = 'password123';

    // Register first
    await page.goto('/');
    await page.getByRole('button', { name: 'Create New Account' }).click();
    await page.getByPlaceholder('09012345678').fill(phoneNumber);
    await page.getByRole('button', { name: 'Send Verification Code' }).click();
    await page.getByPlaceholder('0000').fill('0000');
    await page.getByRole('button', { name: 'Verify Code' }).click();
    await page.getByPlaceholder('Min 8 characters').fill(password);
    await page.getByRole('button', { name: 'Create Account' }).click();

    // Logout
    await page.locator('a[href="/mypage"]').first().click();
    await page.getByRole('button', { name: 'Sign Out' }).click();
    await expect(page.getByRole('button', { name: 'Sign In with Phone' })).toBeVisible();

    // Login
    await page.getByRole('button', { name: 'Sign In with Phone' }).click();
    await page.getByPlaceholder('Phone Number').fill(phoneNumber);
    await page.getByPlaceholder('Password').fill(password);
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();

    await expect(page).toHaveURL(/\/$/);
  });

  test('Guest Login (Failure - Invalid Credentials)', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Sign In with Phone' }).click();
    await page.getByPlaceholder('Phone Number').fill('09000000000');
    await page.getByPlaceholder('Password').fill('wrongpassword');
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    await expect(page.locator('.text-red-500')).toHaveText(/Invalid credentials|Login failed/);
  });

  // Skip on webkit-based browsers due to route interception timing differences
  test('Refresh Token - Automatic Retry on 401', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'Route interception behaves differently on WebKit');

    // 1. Establish Session (Guest Login)
    const randomSuffix = Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
    const phoneNumber = `090${randomSuffix}`;
    const password = 'password123';

    await page.goto('/');
    await page.getByRole('button', { name: 'Create New Account' }).click();
    await page.getByPlaceholder('09012345678').fill(phoneNumber);
    await page.getByRole('button', { name: 'Send Verification Code' }).click();
    await page.getByPlaceholder('0000').fill('0000');
    await page.getByRole('button', { name: 'Verify Code' }).click();
    await page.getByPlaceholder('Min 8 characters').fill(password);
    await page.getByRole('button', { name: 'Create Account' }).click();
    await expect(page).toHaveURL(/\/$/);

    // Verify tokens are stored
    const tokensBefore = await page.evaluate(() => ({
      access: localStorage.getItem('nyx_guest_access_token'),
      refresh: localStorage.getItem('nyx_guest_refresh_token'),
    }));
    expect(tokensBefore.access).toBeTruthy();
    expect(tokensBefore.refresh).toBeTruthy();

    // 2. Set up intercepts before reload
    let meCallCount = 0;
    let refreshTokenCalled = false;

    // Intercept /api/identity/me - return 401 on first call, success on second
    await page.route('**/api/identity/me', async route => {
      meCallCount++;
      if (meCallCount === 1) {
        // First call: return 401 to trigger refresh
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Token expired' })
        });
      } else {
        // Second call (after refresh): return success with mock user data
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'test-user-id',
            phoneNumber: phoneNumber,
            role: 1, // ROLE_GUEST
          })
        });
      }
    });

    // Intercept refresh-token - return new tokens
    await page.route('**/api/identity/refresh-token', async route => {
      refreshTokenCalled = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          accessToken: 'new-mock-access-token',
          refreshToken: 'new-mock-refresh-token',
        })
      });
    });

    // 3. Trigger the request by reloading
    await page.reload();

    // 4. Verify: Page should still be on home page (not redirected to login)
    await expect(page).toHaveURL(/\/$/);

    // 5. Verify the flow happened correctly
    expect(refreshTokenCalled).toBe(true);
    expect(meCallCount).toBe(2); // First 401, then success after refresh

    // 6. Verify tokens were updated
    const tokensAfter = await page.evaluate(() => ({
      access: localStorage.getItem('nyx_guest_access_token'),
      refresh: localStorage.getItem('nyx_guest_refresh_token'),
    }));
    expect(tokensAfter.access).toBe('new-mock-access-token');
    expect(tokensAfter.refresh).toBe('new-mock-refresh-token');
  });

  // Skip on webkit-based browsers due to route interception timing differences
  test('Refresh Token - Clear Tokens on Refresh Failure', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'Route interception behaves differently on WebKit');

    // 1. Establish Session (Guest Login)
    const randomSuffix = Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
    const phoneNumber = `090${randomSuffix}`;
    const password = 'password123';

    await page.goto('/');
    await page.getByRole('button', { name: 'Create New Account' }).click();
    await page.getByPlaceholder('09012345678').fill(phoneNumber);
    await page.getByRole('button', { name: 'Send Verification Code' }).click();
    await page.getByPlaceholder('0000').fill('0000');
    await page.getByRole('button', { name: 'Verify Code' }).click();
    await page.getByPlaceholder('Min 8 characters').fill(password);
    await page.getByRole('button', { name: 'Create Account' }).click();
    await expect(page).toHaveURL(/\/$/);

    // Verify tokens are stored
    const tokensBefore = await page.evaluate(() => ({
      access: localStorage.getItem('nyx_guest_access_token'),
      refresh: localStorage.getItem('nyx_guest_refresh_token'),
    }));
    expect(tokensBefore.access).toBeTruthy();
    expect(tokensBefore.refresh).toBeTruthy();

    // 2. Intercept /api/identity/me to always return 401
    await page.route('**/api/identity/me', async route => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Token expired' })
      });
    });

    // 3. Intercept refresh-token to also fail
    await page.route('**/api/identity/refresh-token', async route => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Refresh token expired' })
      });
    });

    // 4. Trigger the request by reloading
    await page.reload();

    // 5. Wait for auth flow to complete and verify tokens are cleared
    // Use waitForFunction to poll until tokens are cleared (more reliable than fixed timeout)
    await page.waitForFunction(
      () => {
        const access = localStorage.getItem('nyx_guest_access_token');
        const refresh = localStorage.getItem('nyx_guest_refresh_token');
        return access === null && refresh === null;
      },
      { timeout: 10000 }
    );

    const tokensAfter = await page.evaluate(() => ({
      access: localStorage.getItem('nyx_guest_access_token'),
      refresh: localStorage.getItem('nyx_guest_refresh_token'),
    }));

    // Tokens should be cleared after refresh failure
    expect(tokensAfter.access).toBeNull();
    expect(tokensAfter.refresh).toBeNull();
  });
});
