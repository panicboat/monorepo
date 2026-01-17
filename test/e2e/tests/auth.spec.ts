import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('should show error message on invalid login', async ({ page }) => {
    // Go to home page
    await page.goto('/');

    // LoginGate should appear (assuming no session)
    // Click "Sign In with Phone"
    await page.getByRole('button', { name: 'Sign In with Phone' }).click();

    // Fill invalid credentials
    await page.getByPlaceholder('Phone Number').fill('09000000000');
    await page.getByPlaceholder('Password').fill('wrongpassword');

    // Click Sign In
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();

    // Check for error message
    // Note: We recently changed this to show the backend message or "Login failed."
    await expect(page.locator('.text-red-500')).toBeVisible();
    await expect(page.locator('.text-red-500')).toHaveText(/Invalid credentials|Login failed/);
  });

  test('Guest Login Flow (Success)', async ({ page }) => {
    // Generate random phone number to avoid conflict
    const randomSuffix = Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
    const phoneNumber = `090${randomSuffix}`;
    const password = 'password123';

    // 1. Sign Up (Guest)
    await page.goto('/');
    await page.getByRole('button', { name: 'Create New Account' }).click();

    // Step 1: Phone Input
    await page.getByRole('heading', { name: 'Create Account' }).isVisible();
    await page.getByPlaceholder('09012345678').fill(phoneNumber);
    await page.getByRole('button', { name: 'Send Verification Code' }).click();

    // Step 2: Verify SMS (Mock Code: 0000)
    // TODO: This relies on the backend's MOCK_SMS_CODE defaulting to "0000".
    // If real SMS or different mock strategy is implemented, this must be updated.
    await expect(page.getByRole('heading', { name: 'Verify Phone' })).toBeVisible();
    await page.getByPlaceholder('0000').fill('0000');
    await page.getByRole('button', { name: 'Verify Code' }).click();

    // Step 3: Set Password
    await expect(page.getByRole('heading', { name: 'Set Password' })).toBeVisible();
    await page.getByPlaceholder('Min 8 characters').fill(password);
    await page.getByRole('button', { name: 'Create Account' }).click();

    // Should be redirected to Guest Home
    // Use regex to verify it ends with / (so it respects BASE_URL and avoids hardcoding localhost)
    await expect(page).toHaveURL(/\/$/);

    // Verify Guest Dashboard elements (e.g., RankingWidget or Timeline)
    await expect(page.getByText('Ranking')).toBeVisible();
  });

  test('Simple Login Flow (Register -> Logout -> Login)', async ({ page }) => {
    // Generate random phone number to avoid conflict
    const randomSuffix = Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
    const phoneNumber = `090${randomSuffix}`;
    const password = 'password123';

    // 1. Initial Registration
    await page.goto('/');
    await page.getByRole('button', { name: 'Create New Account' }).click();
    await page.getByPlaceholder('09012345678').fill(phoneNumber);
    await page.getByRole('button', { name: 'Send Verification Code' }).click();
    await expect(page.getByRole('heading', { name: 'Verify Phone' })).toBeVisible();
    await page.getByPlaceholder('0000').fill('0000');
    await page.getByRole('button', { name: 'Verify Code' }).click();
    await page.getByPlaceholder('Min 8 characters').fill(password);
    await page.getByRole('button', { name: 'Create Account' }).click();
    await expect(page).toHaveURL(/\/$/);

    // 2. Logout
    // Go to MyPage
    await page.locator('a[href="/mypage"]').first().click();

    // Check for Sign Out button
    // The button text in GuestDashboard is "Sign Out"
    await expect(page.getByRole('button', { name: 'Sign Out' })).toBeVisible();

    // Click Sign Out/Logout button
    await page.getByRole('button', { name: 'Sign Out' }).click();

    // Verify redirected to Login Gate (or Home with unauthenticated state)
    // GuestTopNavBar for "/" shows "Nyx." and "Sign In with Phone" if unauthenticated?
    // Or LoginGate appears?
    // After logout, router.push('/') is called.
    // If unauthenticated, "/" usually shows LoginGate or Guest Landing with Sign In button.
    await expect(page.getByRole('button', { name: 'Sign In with Phone' })).toBeVisible();

    // 3. Re-Login
    await page.getByRole('button', { name: 'Sign In with Phone' }).click();
    await page.getByPlaceholder('Phone Number').fill(phoneNumber);
    await page.getByPlaceholder('Password').fill(password);
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();

    // Verify Login Success
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText('Ranking')).toBeVisible();
  });

  test('Cast Login Flow (Success)', async ({ page }) => {
    // Generate random phone number
    const randomSuffix = Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
    const phoneNumber = `080${randomSuffix}`;
    const password = 'password123';

    // 1. Go to Cast Portal
    await page.goto('/cast');

    // Check if it's Cast Portal login
    await expect(page.getByRole('heading', { name: 'Cast Portal' })).toBeVisible();

    // 2. Sign Up (Cast)
    await page.getByRole('button', { name: 'Create New Account' }).click();

    // Step 1: Phone Input
    await page.getByPlaceholder('09012345678').fill(phoneNumber);
    await page.getByRole('button', { name: 'Send Verification Code' }).click();

    // Step 2: Verify SMS
    // TODO: This relies on the backend's MOCK_SMS_CODE defaulting to "0000".
    // If real SMS or different mock strategy is implemented, this must be updated.
    await expect(page.getByRole('heading', { name: 'Verify Phone' })).toBeVisible();
    await page.getByPlaceholder('0000').fill('0000');
    await page.getByRole('button', { name: 'Verify Code' }).click();

    // Step 3: Set Password
    await expect(page.getByRole('heading', { name: 'Set Password' })).toBeVisible();
    await page.getByPlaceholder('Min 8 characters').fill(password);
    await page.getByRole('button', { name: 'Create Account' }).click();

    // 3. Should be redirected to Cast Onboarding (since it's a new cast)
    await expect(page).toHaveURL(/\/cast\/onboarding/);

    // Verify Onboarding Welcome Page
    await expect(page.getByRole('heading', { name: 'Welcome to Nyx' })).toBeVisible();
  });

  test('should navigate to signup from login gate', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Create New Account' }).click();

    await expect(page.getByRole('heading', { name: 'Create Account' })).toBeVisible();
    await expect(page.getByPlaceholder('09012345678')).toBeVisible();
  });
});
