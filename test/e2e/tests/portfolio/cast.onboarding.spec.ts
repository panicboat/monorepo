import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Cast Onboarding Flow', () => {
  // Helper: Register a new cast and navigate to onboarding step 1
  async function registerNewCastAndStartOnboarding(page: any) {
    const randomSuffix = Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
    const phoneNumber = `080${randomSuffix}`;
    const password = 'password123';

    await page.goto('/cast/login');
    await page.getByRole('button', { name: 'Create New Account' }).click();
    await page.getByPlaceholder('09012345678').fill(phoneNumber);
    await page.getByRole('button', { name: 'Send Verification Code' }).click();
    await page.getByPlaceholder('0000').fill('0000');
    await page.getByRole('button', { name: 'Verify Code' }).click();
    await page.getByPlaceholder('Min 8 characters').fill(password);
    await page.getByRole('button', { name: 'Create Account' }).click();

    // Should redirect to onboarding welcome page
    await expect(page).toHaveURL(/\/cast\/onboarding/);

    // Wait for welcome page to load and click "Create Profile" button
    await expect(page.getByRole('heading', { name: 'Welcome to Nyx' })).toBeVisible({ timeout: 10000 });
    await page.getByRole('link', { name: /プロフィールを作成する/ }).click();

    // Should be on step-1
    await expect(page).toHaveURL(/\/cast\/onboarding\/step-1/);

    return { phoneNumber, password };
  }

  test('Full Onboarding Flow (Happy Path)', async ({ page }) => {
    await registerNewCastAndStartOnboarding(page);

    // Wait for Step 1 page to fully load
    await expect(page.locator('h1').getByText('Basic Identity')).toBeVisible();

    // ========== STEP 1: Basic Identity ==========
    // Service Category - click "Standard"
    await page.getByRole('button', { name: /Standard/i }).first().click();

    // Location Type - click "Dispatch"
    await page.getByRole('button', { name: /Dispatch/i }).first().click();

    // Fill profile inputs
    await page.getByPlaceholder('例: ユナ').fill('テストキャスト');
    await page.getByPlaceholder('例: 六本木, 西麻布').fill('渋谷');
    await page.getByPlaceholder('例: 癒やしの時間をお届けします✨').fill('テスト用キャッチコピー');
    await page.getByPlaceholder('得意なこと、性格、趣味などを詳しく書いてみましょう...').fill('自己紹介テキストです。');

    // Click next button
    await page.getByRole('button', { name: 'Next Step: Photos' }).click();

    // ========== STEP 2: Photos ==========
    await expect(page).toHaveURL(/\/cast\/onboarding\/step-2/);
    await expect(page.getByRole('heading', { name: 'Photos' })).toBeVisible();

    // Upload 3 test images
    const fixturesPath = path.join(__dirname, '../../fixtures');
    const fileInput = page.locator('input[type="file"]');

    // Upload images one by one
    await fileInput.setInputFiles([
      path.join(fixturesPath, 'test-image-1.png'),
      path.join(fixturesPath, 'test-image-2.png'),
      path.join(fixturesPath, 'test-image-3.png'),
    ]);

    // Wait for upload to complete - images should appear in grid
    await expect(page.locator('img[alt="Uploaded 1"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('img[alt="Uploaded 2"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('img[alt="Uploaded 3"]')).toBeVisible({ timeout: 10000 });

    // Click next button
    await page.getByRole('button', { name: 'Next Step: Service Plans' }).click();

    // ========== STEP 3: Service Plans (Optional) ==========
    await expect(page).toHaveURL(/\/cast\/onboarding\/step-3/);
    await expect(page.getByRole('heading', { name: /Service Plans/i })).toBeVisible();

    // Add a plan
    await page.getByRole('button', { name: 'Add New Plan' }).click();

    // Fill plan details
    await page.getByPlaceholder('e.g. Standard Course').fill('スタンダードコース');
    await page.locator('input[type="number"]').first().fill('60'); // Duration
    await page.locator('input[type="number"]').last().fill('10000'); // Price

    // Click next button
    await page.getByRole('button', { name: 'Next Step: Initial Schedule' }).click();

    // ========== STEP 4: Initial Schedule ==========
    await expect(page).toHaveURL(/\/cast\/onboarding\/step-4/);
    await expect(page.getByRole('heading', { name: 'Initial Schedule' })).toBeVisible();

    // Add a schedule for today or tomorrow (first available "Add Schedule" button)
    await page.getByRole('button', { name: 'Add Schedule' }).first().click();

    // Schedule should be added with default times
    await expect(page.locator('input[type="time"]').first()).toBeVisible();

    // Click next button
    await page.getByRole('button', { name: 'Next Step: Review' }).click();

    // ========== STEP 5: Review & Publish ==========
    await expect(page).toHaveURL(/\/cast\/onboarding\/step-5/);
    await expect(page.getByRole('heading', { name: 'Review & Publish' })).toBeVisible();

    // Verify data is displayed correctly
    await expect(page.getByText('テストキャスト')).toBeVisible();
    await expect(page.getByText('standard')).toBeVisible();
    await expect(page.getByText('dispatch')).toBeVisible();
    await expect(page.getByText('渋谷')).toBeVisible();
    await expect(page.getByText('テスト用キャッチコピー')).toBeVisible();
    await expect(page.getByText('スタンダードコース')).toBeVisible();
    await expect(page.getByText('60 mins')).toBeVisible();
    await expect(page.getByText('¥10,000')).toBeVisible();

    // Publish profile
    await page.getByRole('button', { name: 'Publish & Start' }).click();

    // Should redirect to /cast/home after publish
    await expect(page).toHaveURL(/\/cast\/home/, { timeout: 15000 });
  });

  test('Back Navigation - Data Persistence from Step 4 to Step 3', async ({ page }) => {
    await registerNewCastAndStartOnboarding(page);

    // ========== STEP 1 ==========
    await page.getByRole('button', { name: /Standard/i }).first().click();
    await page.getByRole('button', { name: /Dispatch/i }).first().click();
    await page.getByPlaceholder('例: ユナ').fill('ナビテスト');
    await page.getByPlaceholder('例: 六本木, 西麻布').fill('新宿');
    await page.getByPlaceholder('例: 癒やしの時間をお届けします✨').fill('ナビテスト用');
    await page.getByPlaceholder('得意なこと、性格、趣味などを詳しく書いてみましょう...').fill('ナビテスト用自己紹介');
    await page.getByRole('button', { name: 'Next Step: Photos' }).click();

    // ========== STEP 2 ==========
    await expect(page).toHaveURL(/\/cast\/onboarding\/step-2/);
    await expect(page.getByRole('heading', { name: 'Photos' })).toBeVisible();

    const fixturesPath = path.join(__dirname, '../../fixtures');
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles([
      path.join(fixturesPath, 'test-image-1.png'),
      path.join(fixturesPath, 'test-image-2.png'),
      path.join(fixturesPath, 'test-image-3.png'),
    ]);
    await expect(page.locator('img[alt="Uploaded 1"]')).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: 'Next Step: Service Plans' }).click();

    // ========== STEP 3 ==========
    await expect(page).toHaveURL(/\/cast\/onboarding\/step-3/);

    // Add a plan and proceed to step 4 (this saves to context)
    await page.getByRole('button', { name: 'Add New Plan' }).click();
    await page.getByPlaceholder('e.g. Standard Course').fill('テストプラン');
    await page.locator('input[type="number"]').first().fill('90');
    await page.locator('input[type="number"]').last().fill('15000');
    await page.getByRole('button', { name: 'Next Step: Initial Schedule' }).click();

    // ========== STEP 4 ==========
    await expect(page).toHaveURL(/\/cast\/onboarding\/step-4/);

    // Navigate back to Step 3 using browser back
    await page.goBack();

    // ========== Back to STEP 3 ==========
    await expect(page).toHaveURL(/\/cast\/onboarding\/step-3/);

    // Verify plan data is preserved (loaded from context)
    await expect(page.getByPlaceholder('e.g. Standard Course')).toHaveValue('テストプラン');
    await expect(page.locator('input[type="number"]').first()).toHaveValue('90');
    await expect(page.locator('input[type="number"]').last()).toHaveValue('15000');

    // Navigate forward to Step 4
    await page.goForward();

    // ========== Back to STEP 4 ==========
    await expect(page).toHaveURL(/\/cast\/onboarding\/step-4/);
  });

  test('Back Navigation - Data Persistence from Step 2 to Step 1', async ({ page }) => {
    await registerNewCastAndStartOnboarding(page);

    // ========== STEP 1 ==========
    const nickname = 'バックナビテスト';
    const area = '池袋';
    const tagline = 'テスト用タグライン';
    const bio = '詳細な自己紹介文です。';

    await page.getByRole('button', { name: /Advanced/i }).first().click();
    await page.getByRole('button', { name: /Store/i }).first().click();
    await page.getByPlaceholder('例: ユナ').fill(nickname);
    await page.getByPlaceholder('例: 六本木, 西麻布').fill(area);
    await page.getByPlaceholder('例: 癒やしの時間をお届けします✨').fill(tagline);
    await page.getByPlaceholder('得意なこと、性格、趣味などを詳しく書いてみましょう...').fill(bio);

    await page.getByRole('button', { name: 'Next Step: Photos' }).click();

    // ========== STEP 2 ==========
    await expect(page).toHaveURL(/\/cast\/onboarding\/step-2/);
    await expect(page.getByRole('heading', { name: 'Photos' })).toBeVisible();

    const fixturesPath = path.join(__dirname, '../../fixtures');
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles([
      path.join(fixturesPath, 'test-image-1.png'),
    ]);
    await expect(page.locator('img[alt="Uploaded 1"]')).toBeVisible({ timeout: 10000 });

    // Navigate back to Step 1
    await page.goBack();

    // ========== Back to STEP 1 ==========
    await expect(page).toHaveURL(/\/cast\/onboarding\/step-1|\/cast\/onboarding$/);

    // Verify form data is preserved
    await expect(page.getByPlaceholder('例: ユナ')).toHaveValue(nickname);
    await expect(page.getByPlaceholder('例: 六本木, 西麻布')).toHaveValue(area);
    await expect(page.getByPlaceholder('例: 癒やしの時間をお届けします✨')).toHaveValue(tagline);
    await expect(page.getByPlaceholder('得意なこと、性格、趣味などを詳しく書いてみましょう...')).toHaveValue(bio);

    // Verify service category and location type are preserved (Advanced and Store should be selected)
    // The selected buttons have specific styling with pink background
    const advancedBtn = page.getByRole('button', { name: /Advanced/i }).first();
    await expect(advancedBtn).toHaveClass(/bg-pink-50/);

    const storeBtn = page.getByRole('button', { name: /Store/i }).first();
    await expect(storeBtn).toHaveClass(/bg-pink-50/);
  });

  test('Edit from Review Page - Navigate to Step 1 and Back', async ({ page }) => {
    await registerNewCastAndStartOnboarding(page);

    // Quick path through all steps
    // Step 1
    await page.getByRole('button', { name: /Standard/i }).first().click();
    await page.getByRole('button', { name: /Dispatch/i }).first().click();
    await page.getByPlaceholder('例: ユナ').fill('編集テスト');
    await page.getByPlaceholder('例: 六本木, 西麻布').fill('原宿');
    await page.getByPlaceholder('例: 癒やしの時間をお届けします✨').fill('編集テスト用');
    await page.getByPlaceholder('得意なこと、性格、趣味などを詳しく書いてみましょう...').fill('編集テスト用自己紹介');
    await page.getByRole('button', { name: 'Next Step: Photos' }).click();

    // Step 2
    await expect(page.getByRole('heading', { name: 'Photos' })).toBeVisible();
    const fixturesPath = path.join(__dirname, '../../fixtures');
    await page.locator('input[type="file"]').setInputFiles([
      path.join(fixturesPath, 'test-image-1.png'),
      path.join(fixturesPath, 'test-image-2.png'),
      path.join(fixturesPath, 'test-image-3.png'),
    ]);
    await expect(page.locator('img[alt="Uploaded 1"]')).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: 'Next Step: Service Plans' }).click();

    // Step 3 - skip (no plans)
    await page.getByRole('button', { name: 'Next Step: Initial Schedule' }).click();

    // Step 4
    await page.getByRole('button', { name: 'Add Schedule' }).first().click();
    await page.getByRole('button', { name: 'Next Step: Review' }).click();

    // ========== STEP 5: Review ==========
    await expect(page).toHaveURL(/\/cast\/onboarding\/step-5/);
    await expect(page.getByText('編集テスト', { exact: true })).toBeVisible();

    // Click Edit link for Basic Identity (Step 1)
    const editButtons = page.getByRole('button', { name: 'Edit' });
    await editButtons.first().click();

    // ========== Back to STEP 1 ==========
    await expect(page).toHaveURL(/\/cast\/onboarding\/step-1/);

    // Verify data is preserved
    await expect(page.getByPlaceholder('例: ユナ')).toHaveValue('編集テスト');
    await expect(page.getByPlaceholder('例: 六本木, 西麻布')).toHaveValue('原宿');

    // Modify the data
    await page.getByPlaceholder('例: ユナ').fill('編集後テスト');

    // Go back through steps to review
    await page.getByRole('button', { name: 'Next Step: Photos' }).click();
    await page.getByRole('button', { name: 'Next Step: Service Plans' }).click();
    await page.getByRole('button', { name: 'Next Step: Initial Schedule' }).click();
    await page.getByRole('button', { name: 'Next Step: Review' }).click();

    // Verify updated data on review page
    await expect(page).toHaveURL(/\/cast\/onboarding\/step-5/);
    await expect(page.getByText('編集後テスト')).toBeVisible();
  });

  test('Onboarding with Multiple Plans and Schedules', async ({ page }) => {
    await registerNewCastAndStartOnboarding(page);

    // Step 1
    await page.getByRole('button', { name: /Standard/i }).first().click();
    await page.getByRole('button', { name: /Dispatch/i }).first().click();
    await page.getByPlaceholder('例: ユナ').fill('複数プランテスト');
    await page.getByPlaceholder('例: 六本木, 西麻布').fill('銀座');
    await page.getByPlaceholder('例: 癒やしの時間をお届けします✨').fill('複数プラン対応');
    await page.getByPlaceholder('得意なこと、性格、趣味などを詳しく書いてみましょう...').fill('複数プラン対応自己紹介');
    await page.getByRole('button', { name: 'Next Step: Photos' }).click();

    // Step 2
    await expect(page.getByRole('heading', { name: 'Photos' })).toBeVisible();
    const fixturesPath = path.join(__dirname, '../../fixtures');
    await page.locator('input[type="file"]').setInputFiles([
      path.join(fixturesPath, 'test-image-1.png'),
      path.join(fixturesPath, 'test-image-2.png'),
      path.join(fixturesPath, 'test-image-3.png'),
    ]);
    await expect(page.locator('img[alt="Uploaded 1"]')).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: 'Next Step: Service Plans' }).click();

    // Step 3 - Add multiple plans
    await expect(page).toHaveURL(/\/cast\/onboarding\/step-3/);

    // Plan 1
    await page.getByRole('button', { name: 'Add New Plan' }).click();
    await page.getByPlaceholder('e.g. Standard Course').first().fill('ショートコース');
    await page.locator('input[type="number"]').nth(0).fill('30');
    await page.locator('input[type="number"]').nth(1).fill('5000');

    // Plan 2
    await page.getByRole('button', { name: 'Add New Plan' }).click();
    await page.getByPlaceholder('e.g. Standard Course').last().fill('ロングコース');
    await page.locator('input[type="number"]').nth(2).fill('120');
    await page.locator('input[type="number"]').nth(3).fill('20000');

    await page.getByRole('button', { name: 'Next Step: Initial Schedule' }).click();

    // Step 4 - Add multiple schedules
    await expect(page).toHaveURL(/\/cast\/onboarding\/step-4/);

    // Add schedule on first available day
    await page.getByRole('button', { name: 'Add Schedule' }).first().click();

    // Add schedule on another day (if available)
    const addScheduleButtons = page.getByRole('button', { name: 'Add Schedule' });
    const buttonCount = await addScheduleButtons.count();
    if (buttonCount > 1) {
      await addScheduleButtons.nth(1).click();
    }

    await page.getByRole('button', { name: 'Next Step: Review' }).click();

    // Step 5 - Verify all data
    await expect(page).toHaveURL(/\/cast\/onboarding\/step-5/);
    await expect(page.getByText('複数プランテスト')).toBeVisible();
    await expect(page.getByText('ショートコース')).toBeVisible();
    await expect(page.getByText('ロングコース')).toBeVisible();
    await expect(page.getByText('30 mins')).toBeVisible();
    await expect(page.getByText('120 mins')).toBeVisible();

    // Publish
    await page.getByRole('button', { name: 'Publish & Start' }).click();
    await expect(page).toHaveURL(/\/cast\/home/, { timeout: 15000 });
  });

  test('Back Navigation - Data Persistence from Step 3 to Step 2 (Images)', async ({ page }) => {
    await registerNewCastAndStartOnboarding(page);

    // ========== STEP 1 ==========
    await page.getByRole('button', { name: /Standard/i }).first().click();
    await page.getByRole('button', { name: /Dispatch/i }).first().click();
    await page.getByPlaceholder('例: ユナ').fill('画像保持テスト');
    await page.getByPlaceholder('例: 六本木, 西麻布').fill('恵比寿');
    await page.getByPlaceholder('例: 癒やしの時間をお届けします✨').fill('画像保持テスト用');
    await page.getByPlaceholder('得意なこと、性格、趣味などを詳しく書いてみましょう...').fill('画像保持テスト用自己紹介');
    await page.getByRole('button', { name: 'Next Step: Photos' }).click();

    // ========== STEP 2 ==========
    await expect(page).toHaveURL(/\/cast\/onboarding\/step-2/);
    await expect(page.getByRole('heading', { name: 'Photos' })).toBeVisible();

    const fixturesPath = path.join(__dirname, '../../fixtures');
    await page.locator('input[type="file"]').setInputFiles([
      path.join(fixturesPath, 'test-image-1.png'),
      path.join(fixturesPath, 'test-image-2.png'),
      path.join(fixturesPath, 'test-image-3.png'),
    ]);
    await expect(page.locator('img[alt="Uploaded 1"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('img[alt="Uploaded 3"]')).toBeVisible({ timeout: 10000 });

    // Save images and go to Step 3
    await page.getByRole('button', { name: 'Next Step: Service Plans' }).click();

    // ========== STEP 3 ==========
    await expect(page).toHaveURL(/\/cast\/onboarding\/step-3/);

    // Navigate back to Step 2
    await page.goBack();

    // ========== Back to STEP 2 ==========
    await expect(page).toHaveURL(/\/cast\/onboarding\/step-2/);

    // Verify all 3 images are still displayed
    await expect(page.locator('img[alt="Uploaded 1"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('img[alt="Uploaded 2"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('img[alt="Uploaded 3"]')).toBeVisible({ timeout: 10000 });

    // Verify COVER badge is on first image
    await expect(page.getByText('COVER', { exact: true })).toBeVisible();
  });

  test('Back Navigation - Data Persistence from Step 5 to Step 4 (Schedules)', async ({ page }) => {
    await registerNewCastAndStartOnboarding(page);

    // Quick path through steps 1-3
    await page.getByRole('button', { name: /Standard/i }).first().click();
    await page.getByRole('button', { name: /Dispatch/i }).first().click();
    await page.getByPlaceholder('例: ユナ').fill('スケジュール保持テスト');
    await page.getByPlaceholder('例: 六本木, 西麻布').fill('品川');
    await page.getByPlaceholder('例: 癒やしの時間をお届けします✨').fill('スケジュールテスト用');
    await page.getByPlaceholder('得意なこと、性格、趣味などを詳しく書いてみましょう...').fill('スケジュールテスト用自己紹介');
    await page.getByRole('button', { name: 'Next Step: Photos' }).click();

    await expect(page.getByRole('heading', { name: 'Photos' })).toBeVisible();
    const fixturesPath = path.join(__dirname, '../../fixtures');
    await page.locator('input[type="file"]').setInputFiles([
      path.join(fixturesPath, 'test-image-1.png'),
      path.join(fixturesPath, 'test-image-2.png'),
      path.join(fixturesPath, 'test-image-3.png'),
    ]);
    await expect(page.locator('img[alt="Uploaded 1"]')).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: 'Next Step: Service Plans' }).click();
    await page.getByRole('button', { name: 'Next Step: Initial Schedule' }).click();

    // ========== STEP 4 ==========
    await expect(page).toHaveURL(/\/cast\/onboarding\/step-4/);

    // Add 2 schedules
    await page.getByRole('button', { name: 'Add Schedule' }).first().click();
    const addScheduleButtons = page.getByRole('button', { name: 'Add Schedule' });
    const buttonCount = await addScheduleButtons.count();
    if (buttonCount > 1) {
      await addScheduleButtons.nth(1).click();
    }

    // Count schedule items before navigating
    const scheduleCountBefore = await page.locator('input[type="time"]').count();
    expect(scheduleCountBefore).toBeGreaterThanOrEqual(2); // At least 2 time inputs (start) for 1 schedule

    // Save and go to Step 5
    await page.getByRole('button', { name: 'Next Step: Review' }).click();

    // ========== STEP 5 ==========
    await expect(page).toHaveURL(/\/cast\/onboarding\/step-5/);

    // Navigate back to Step 4
    await page.goBack();

    // ========== Back to STEP 4 ==========
    await expect(page).toHaveURL(/\/cast\/onboarding\/step-4/);

    // Verify schedules are preserved (same count of time inputs)
    const scheduleCountAfter = await page.locator('input[type="time"]').count();
    expect(scheduleCountAfter).toBe(scheduleCountBefore);
  });

  test('Edit from Review - Navigate to Step 2 (Photos) and Back', async ({ page }) => {
    await registerNewCastAndStartOnboarding(page);

    // Complete all steps
    await page.getByRole('button', { name: /Standard/i }).first().click();
    await page.getByRole('button', { name: /Dispatch/i }).first().click();
    await page.getByPlaceholder('例: ユナ').fill('写真編集テスト');
    await page.getByPlaceholder('例: 六本木, 西麻布').fill('目黒');
    await page.getByPlaceholder('例: 癒やしの時間をお届けします✨').fill('写真編集テスト用');
    await page.getByPlaceholder('得意なこと、性格、趣味などを詳しく書いてみましょう...').fill('写真編集テスト用自己紹介');
    await page.getByRole('button', { name: 'Next Step: Photos' }).click();

    await expect(page.getByRole('heading', { name: 'Photos' })).toBeVisible();
    const fixturesPath = path.join(__dirname, '../../fixtures');
    await page.locator('input[type="file"]').setInputFiles([
      path.join(fixturesPath, 'test-image-1.png'),
      path.join(fixturesPath, 'test-image-2.png'),
      path.join(fixturesPath, 'test-image-3.png'),
    ]);
    await expect(page.locator('img[alt="Uploaded 1"]')).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: 'Next Step: Service Plans' }).click();
    await page.getByRole('button', { name: 'Next Step: Initial Schedule' }).click();
    await page.getByRole('button', { name: 'Add Schedule' }).first().click();
    await page.getByRole('button', { name: 'Next Step: Review' }).click();

    // ========== STEP 5: Review ==========
    await expect(page).toHaveURL(/\/cast\/onboarding\/step-5/);

    // Click Edit link for Photos (Step 2) - second Edit button
    const editButtons = page.getByRole('button', { name: 'Edit' });
    await editButtons.nth(1).click();

    // ========== Back to STEP 2 ==========
    await expect(page).toHaveURL(/\/cast\/onboarding\/step-2/);

    // Verify images are preserved
    await expect(page.locator('img[alt="Uploaded 1"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('img[alt="Uploaded 2"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('img[alt="Uploaded 3"]')).toBeVisible({ timeout: 10000 });

    // Navigate back through to review
    await page.getByRole('button', { name: 'Next Step: Service Plans' }).click();
    await page.getByRole('button', { name: 'Next Step: Initial Schedule' }).click();
    await page.getByRole('button', { name: 'Next Step: Review' }).click();

    // Verify still on review page with correct data
    await expect(page).toHaveURL(/\/cast\/onboarding\/step-5/);
    await expect(page.getByText('写真編集テスト', { exact: true })).toBeVisible();
  });

  test('Edit from Review - Navigate to Step 3 (Plans) and Back', async ({ page }) => {
    await registerNewCastAndStartOnboarding(page);

    // Complete all steps with a plan
    await page.getByRole('button', { name: /Standard/i }).first().click();
    await page.getByRole('button', { name: /Dispatch/i }).first().click();
    await page.getByPlaceholder('例: ユナ').fill('プラン編集テスト');
    await page.getByPlaceholder('例: 六本木, 西麻布').fill('五反田');
    await page.getByPlaceholder('例: 癒やしの時間をお届けします✨').fill('プラン編集テスト用');
    await page.getByPlaceholder('得意なこと、性格、趣味などを詳しく書いてみましょう...').fill('プラン編集テスト用自己紹介');
    await page.getByRole('button', { name: 'Next Step: Photos' }).click();

    await expect(page.getByRole('heading', { name: 'Photos' })).toBeVisible();
    const fixturesPath = path.join(__dirname, '../../fixtures');
    await page.locator('input[type="file"]').setInputFiles([
      path.join(fixturesPath, 'test-image-1.png'),
      path.join(fixturesPath, 'test-image-2.png'),
      path.join(fixturesPath, 'test-image-3.png'),
    ]);
    await expect(page.locator('img[alt="Uploaded 1"]')).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: 'Next Step: Service Plans' }).click();

    // Add a plan
    await page.getByRole('button', { name: 'Add New Plan' }).click();
    await page.getByPlaceholder('e.g. Standard Course').fill('元のプラン');
    await page.locator('input[type="number"]').first().fill('60');
    await page.locator('input[type="number"]').last().fill('8000');

    await page.getByRole('button', { name: 'Next Step: Initial Schedule' }).click();
    await page.getByRole('button', { name: 'Add Schedule' }).first().click();
    await page.getByRole('button', { name: 'Next Step: Review' }).click();

    // ========== STEP 5: Review ==========
    await expect(page).toHaveURL(/\/cast\/onboarding\/step-5/);
    await expect(page.getByText('元のプラン')).toBeVisible();

    // Click Edit link for Plans (Step 3) - third Edit button
    const editButtons = page.getByRole('button', { name: 'Edit' });
    await editButtons.nth(2).click();

    // ========== Back to STEP 3 ==========
    await expect(page).toHaveURL(/\/cast\/onboarding\/step-3/);

    // Verify plan is preserved
    await expect(page.getByPlaceholder('e.g. Standard Course')).toHaveValue('元のプラン');

    // Edit the plan
    await page.getByPlaceholder('e.g. Standard Course').fill('編集後のプラン');

    // Navigate back through to review
    await page.getByRole('button', { name: 'Next Step: Initial Schedule' }).click();
    await page.getByRole('button', { name: 'Next Step: Review' }).click();

    // Verify updated plan on review page
    await expect(page).toHaveURL(/\/cast\/onboarding\/step-5/);
    await expect(page.getByText('編集後のプラン')).toBeVisible();
  });

  test('Edit from Review - Navigate to Step 4 (Schedule) and Back', async ({ page }) => {
    await registerNewCastAndStartOnboarding(page);

    // Complete all steps
    await page.getByRole('button', { name: /Standard/i }).first().click();
    await page.getByRole('button', { name: /Dispatch/i }).first().click();
    await page.getByPlaceholder('例: ユナ').fill('スケジュール編集テスト');
    await page.getByPlaceholder('例: 六本木, 西麻布').fill('大崎');
    await page.getByPlaceholder('例: 癒やしの時間をお届けします✨').fill('スケジュール編集テスト用');
    await page.getByPlaceholder('得意なこと、性格、趣味などを詳しく書いてみましょう...').fill('スケジュール編集テスト用自己紹介');
    await page.getByRole('button', { name: 'Next Step: Photos' }).click();

    await expect(page.getByRole('heading', { name: 'Photos' })).toBeVisible();
    const fixturesPath = path.join(__dirname, '../../fixtures');
    await page.locator('input[type="file"]').setInputFiles([
      path.join(fixturesPath, 'test-image-1.png'),
      path.join(fixturesPath, 'test-image-2.png'),
      path.join(fixturesPath, 'test-image-3.png'),
    ]);
    await expect(page.locator('img[alt="Uploaded 1"]')).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: 'Next Step: Service Plans' }).click();
    await page.getByRole('button', { name: 'Next Step: Initial Schedule' }).click();
    await page.getByRole('button', { name: 'Add Schedule' }).first().click();
    await page.getByRole('button', { name: 'Next Step: Review' }).click();

    // ========== STEP 5: Review ==========
    await expect(page).toHaveURL(/\/cast\/onboarding\/step-5/);

    // Count schedules on review page
    const initialScheduleCount = await page.locator('section:has-text("Initial Schedule") .divide-y > div').count();
    expect(initialScheduleCount).toBeGreaterThanOrEqual(1);

    // Click Edit link for Schedule (Step 4) - fourth Edit button
    const editButtons = page.getByRole('button', { name: 'Edit' });
    await editButtons.nth(3).click();

    // ========== Back to STEP 4 ==========
    await expect(page).toHaveURL(/\/cast\/onboarding\/step-4/);

    // Verify schedule is preserved (time inputs exist)
    await expect(page.locator('input[type="time"]').first()).toBeVisible();

    // Navigate back to review
    await page.getByRole('button', { name: 'Next Step: Review' }).click();

    // Verify still on review page with schedules
    await expect(page).toHaveURL(/\/cast\/onboarding\/step-5/);
    const finalScheduleCount = await page.locator('section:has-text("Initial Schedule") .divide-y > div').count();
    expect(finalScheduleCount).toBe(initialScheduleCount);
  });

  test('Skip Optional Plans', async ({ page }) => {
    await registerNewCastAndStartOnboarding(page);

    // Step 1
    await page.getByRole('button', { name: /Standard/i }).first().click();
    await page.getByRole('button', { name: /Dispatch/i }).first().click();
    await page.getByPlaceholder('例: ユナ').fill('プランスキップテスト');
    await page.getByPlaceholder('例: 六本木, 西麻布').fill('表参道');
    await page.getByPlaceholder('例: 癒やしの時間をお届けします✨').fill('プランなし');
    await page.getByPlaceholder('得意なこと、性格、趣味などを詳しく書いてみましょう...').fill('プランなし自己紹介');
    await page.getByRole('button', { name: 'Next Step: Photos' }).click();

    // Step 2
    await expect(page.getByRole('heading', { name: 'Photos' })).toBeVisible();
    const fixturesPath = path.join(__dirname, '../../fixtures');
    await page.locator('input[type="file"]').setInputFiles([
      path.join(fixturesPath, 'test-image-1.png'),
      path.join(fixturesPath, 'test-image-2.png'),
      path.join(fixturesPath, 'test-image-3.png'),
    ]);
    await expect(page.locator('img[alt="Uploaded 1"]')).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: 'Next Step: Service Plans' }).click();

    // Step 3 - Skip (don't add any plans)
    await expect(page).toHaveURL(/\/cast\/onboarding\/step-3/);
    await page.getByRole('button', { name: 'Next Step: Initial Schedule' }).click();

    // Step 4
    await expect(page).toHaveURL(/\/cast\/onboarding\/step-4/);
    await page.getByRole('button', { name: 'Add Schedule' }).first().click();
    await page.getByRole('button', { name: 'Next Step: Review' }).click();

    // Step 5
    await expect(page).toHaveURL(/\/cast\/onboarding\/step-5/);
    await expect(page.getByText('プランスキップテスト')).toBeVisible();
    await expect(page.getByText('No plans configured (Optional)')).toBeVisible();

    // Publish
    await page.getByRole('button', { name: 'Publish & Start' }).click();
    await expect(page).toHaveURL(/\/cast\/home/, { timeout: 15000 });
  });
});
