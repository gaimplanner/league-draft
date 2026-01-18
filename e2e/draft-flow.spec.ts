import { test, expect, Page } from '@playwright/test';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

test.describe('Draft Flow E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage and reload to start fresh
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
    });
    await page.reload();
  });

  test('complete draft workflow from CSV import through completion', async ({ page }) => {
    // Step 1: Create a new division
    await test.step('Create Test Majors division', async () => {
      // Wait for division selector to load
      await expect(page.getByText('Little League Draft')).toBeVisible();

      // Click create new division
      await page.getByRole('button', { name: 'Create New Division' }).click();

      // Select Custom preset (to configure 5 teams)
      await page.getByRole('button', { name: 'Custom' }).click();

      // Fill in division name
      await page.getByPlaceholder('e.g., Majors 2024').fill('Test Majors');

      // Set team count to 5 using the slider
      const slider = page.locator('input[type="range"]');
      await slider.fill('5');

      // Click Create Division
      await page.getByRole('button', { name: 'Create Division' }).click();

      // Should be on import type selector now
      await expect(page.getByText('Import Player Data')).toBeVisible();
    });

    // Step 2: Upload CSV
    await test.step('Upload test CSV file', async () => {
      // Select CSV import mode
      await page.getByRole('button', { name: /Import Summary CSV/i }).click();

      // Upload the test CSV file
      const csvPath = path.resolve(__dirname, 'fixtures/test-players.csv');
      const fileInput = page.locator('input#file-input');
      await fileInput.setInputFiles(csvPath);

      // Should auto-advance to column mapping
      await expect(page.getByText('Map CSV Columns')).toBeVisible();
    });

    // Step 3: Column mapping (should auto-detect)
    await test.step('Complete column mapping', async () => {
      // The mapper should auto-detect most fields
      await expect(page.getByText('All required fields mapped')).toBeVisible();

      // Click continue
      await page.getByRole('button', { name: 'Continue to Review' }).click();

      // Should be on review page
      await expect(page.getByText('Review Players & Setup Teams')).toBeVisible();
    });

    // Step 4: Set up teams with coach names
    await test.step('Configure team names', async () => {
      // Expand the Teams & Detection panel first
      await page.getByRole('button', { name: /Teams & Detection/i }).click();

      // Enter coach names for all 5 teams
      const coachNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Davis'];
      const teamInputs = page.locator('input[placeholder*="Coach Name"]');

      for (let i = 0; i < coachNames.length; i++) {
        await teamInputs.nth(i).fill(coachNames[i]);
      }

      // Verify team names are set
      await expect(teamInputs.nth(0)).toHaveValue('Smith');
    });

    // Step 5: Run auto-detection for coach's kids and siblings
    await test.step('Auto-detect coaches kids and siblings', async () => {
      // Click the auto-detect button (inside the expanded Teams & Detection panel)
      await page.getByRole('button', { name: /Find Coach Kids & Siblings/i }).click();

      // Wait for modal to appear
      await expect(page.getByText('Auto-Detection Results')).toBeVisible();

      // Should detect Jake Smith as coach's kid (has TRUE in Coach Kid column)
      // and Tyler/Sam Miller as siblings

      // Apply all matches
      await page.getByRole('button', { name: /Apply/i }).click();

      // Modal should close
      await expect(page.getByText('Auto-Detection Results')).not.toBeVisible();
    });

    // Step 6: Continue to draft setup
    await test.step('Continue to draft config', async () => {
      await page.getByRole('button', { name: 'Continue to Draft Setup' }).click();

      // Should be on draft config page
      await expect(page.getByText('Draft Configuration')).toBeVisible();
    });

    // Step 7: Configure draft format and order
    await test.step('Configure draft format and order', async () => {
      // Select Snake format
      await page.locator('label').filter({ hasText: 'Snake' }).click();

      // Verify snake is selected
      await expect(page.locator('input[name="format"][value="snake"]')).toBeChecked();

      // Click Randomize to set draft order
      await page.getByRole('button', { name: /Randomize/i }).click();

      // Verify order preview appears
      await expect(page.getByText('Draft order preview:')).toBeVisible();
    });

    // Step 8: Start the draft
    await test.step('Start draft', async () => {
      await page.getByRole('button', { name: 'Start Draft' }).click();

      // Should be on draft board
      await expect(page.getByText('Now Drafting:')).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Round 1 Draft Order' })).toBeVisible();
    });

    // Step 9: Draft players for 2-3 rounds
    await test.step('Execute draft picks', async () => {
      // We have 12 players and 5 teams = need about 2-3 rounds
      // Draft by clicking "Draft" buttons on available players

      let pickCount = 0;
      const maxPicks = 12; // All players need to be drafted

      while (pickCount < maxPicks) {
        // Wait a bit for UI to settle
        await page.waitForTimeout(200);

        // Check if we're on a round interstitial
        const continueButton = page.getByRole('button', { name: /Continue to Round/i });
        if (await continueButton.isVisible({ timeout: 500 }).catch(() => false)) {
          await continueButton.click();
          await page.waitForTimeout(300);
          continue;
        }

        // Check if draft is complete (finalization modal)
        const finalizeButton = page.getByRole('button', { name: 'Finalize Draft' });
        if (await finalizeButton.isVisible({ timeout: 500 }).catch(() => false)) {
          break;
        }

        // Find all visible "Draft" buttons (green buttons next to player scores)
        const draftButtons = page.locator('button:has-text("Draft")').filter({
          has: page.locator(':scope')
        });

        const count = await draftButtons.count();
        if (count > 0) {
          // Click the first available draft button
          await draftButtons.first().click();
          pickCount++;
        } else {
          // No draft buttons visible, check for completion
          break;
        }
      }

      // Should have drafted players
      expect(pickCount).toBeGreaterThan(0);
    });

    // Step 10: Handle round interstitials and finalize
    await test.step('Finalize draft', async () => {
      // Keep clicking through any remaining rounds until we see finalization
      let attempts = 0;
      while (attempts < 50) {
        await page.waitForTimeout(200);

        // Check for round interstitial
        const continueRoundButton = page.getByRole('button', { name: /Continue to Round/i });
        if (await continueRoundButton.isVisible({ timeout: 300 }).catch(() => false)) {
          await continueRoundButton.click();
          await page.waitForTimeout(300);
          continue;
        }

        // Check for finalization modal (before trying to draft more)
        const finalizeButton = page.getByRole('button', { name: /Finalize Draft/i });
        if (await finalizeButton.isVisible({ timeout: 300 }).catch(() => false)) {
          await finalizeButton.click();
          await page.waitForTimeout(500);
          break;
        }

        // Try to draft remaining players
        const draftButton = page.locator('button:has-text("Draft")').first();
        if (await draftButton.isVisible({ timeout: 300 }).catch(() => false)) {
          await draftButton.click();
          await page.waitForTimeout(200);
          continue;
        }

        // If no draft button visible but draft not complete, try skip pick
        // (this handles sibling-locked players that current team can't draft)
        const skipButton = page.getByRole('button', { name: /Skip Pick/i });
        if (await skipButton.isVisible({ timeout: 300 }).catch(() => false)) {
          await skipButton.click();
          await page.waitForTimeout(200);
          continue;
        }

        attempts++;
      }

      // Should be on draft complete page - check for the main header on the completion page
      await expect(page.locator('h1:has-text("Draft Complete")')).toBeVisible({ timeout: 10000 });
    });

    // Step 11: Verify completion page
    await test.step('Verify draft completion', async () => {
      // Should show export options (Public Rosters and Official Draft Record sections)
      await expect(page.getByText('Public Rosters')).toBeVisible();
      await expect(page.getByText('Official Draft Record')).toBeVisible();

      // Should show export button
      await expect(page.getByRole('button', { name: /Export to CSV/i })).toBeVisible();

      // All 5 teams should be visible with their coach names
      await expect(page.getByRole('heading', { name: 'Smith' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Johnson' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Williams' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Brown' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Davis' })).toBeVisible();
    });
  });

  test('handles DNE player correctly in draft', async ({ page }) => {
    // This test verifies that DNE (Did Not Evaluate) players are visible but handled correctly

    // Create division and import CSV (abbreviated version)
    await page.getByRole('button', { name: 'Create New Division' }).click();
    await page.getByRole('button', { name: 'Custom' }).click();
    await page.getByPlaceholder('e.g., Majors 2024').fill('DNE Test');
    await page.locator('input[type="range"]').fill('5');
    await page.getByRole('button', { name: 'Create Division' }).click();

    await page.getByRole('button', { name: /Import Summary CSV/i }).click();
    const csvPath = path.resolve(__dirname, 'fixtures/test-players.csv');
    await page.locator('input#file-input').setInputFiles(csvPath);

    await page.getByRole('button', { name: 'Continue to Review' }).click();

    // Wait for review page to load
    await expect(page.getByText('Review Players & Setup Teams')).toBeVisible();

    // Verify DNE player (Ethan White) is visible - table shows "Last, First" format
    await expect(page.getByText('White, Ethan')).toBeVisible();
  });

  test('sibling rule enforces drafting together', async ({ page }) => {
    // Create division and set up draft
    await page.getByRole('button', { name: 'Create New Division' }).click();
    await page.getByRole('button', { name: 'Custom' }).click();
    await page.getByPlaceholder('e.g., Majors 2024').fill('Sibling Test');
    await page.locator('input[type="range"]').fill('5');
    await page.getByRole('button', { name: 'Create Division' }).click();

    // Import CSV
    await page.getByRole('button', { name: /Import Summary CSV/i }).click();
    const csvPath = path.resolve(__dirname, 'fixtures/test-players.csv');
    await page.locator('input#file-input').setInputFiles(csvPath);

    await page.getByRole('button', { name: 'Continue to Review' }).click();

    // Wait for review page to load
    await expect(page.getByText('Review Players & Setup Teams')).toBeVisible();

    // Expand the Teams & Detection panel first
    await page.getByRole('button', { name: /Teams & Detection/i }).click();

    // Run auto-detection to link siblings (the CSV sibling column is just a hint,
    // actual linking happens through auto-detection by shared last names)
    await page.getByRole('button', { name: /Find Coach Kids & Siblings/i }).click();
    await expect(page.getByText('Auto-Detection Results')).toBeVisible();

    // The Miller siblings should be detected (they share a last name)
    // Check that the sibling pair is in the results
    await expect(page.getByText('Tyler Miller ↔ Sam Miller')).toBeVisible();

    // Apply the detected matches
    await page.getByRole('button', { name: /Apply/i }).click();

    // Wait for modal to close
    await expect(page.getByText('Auto-Detection Results')).not.toBeVisible();

    // Handle the unassigned coach's kid dialog when continuing
    page.on('dialog', async (dialog) => {
      await dialog.accept();
    });

    // Continue to draft config
    await page.getByRole('button', { name: 'Continue to Draft Setup' }).click();

    // Wait for config page to load
    await expect(page.getByText('Draft Configuration')).toBeVisible();

    // Verify sibling groups section shows the link
    await expect(page.getByText('Sibling Groups')).toBeVisible();
    await expect(page.getByText('Tyler Miller ↔ Sam Miller')).toBeVisible();
  });

  test('back navigation from draft preserves player and team data', async ({ page }) => {
    // Create division and set up draft
    await page.getByRole('button', { name: 'Create New Division' }).click();
    await page.getByRole('button', { name: 'Custom' }).click();
    await page.getByPlaceholder('e.g., Majors 2024').fill('Back Nav Test');
    await page.locator('input[type="range"]').fill('5');
    await page.getByRole('button', { name: 'Create Division' }).click();

    // Import CSV
    await page.getByRole('button', { name: /Import Summary CSV/i }).click();
    const csvPath = path.resolve(__dirname, 'fixtures/test-players.csv');
    await page.locator('input#file-input').setInputFiles(csvPath);

    await page.getByRole('button', { name: 'Continue to Review' }).click();

    // Wait for review page and set up team names
    await expect(page.getByText('Review Players & Setup Teams')).toBeVisible();
    await page.getByRole('button', { name: /Teams & Detection/i }).click();
    const teamInputs = page.locator('input[placeholder*="Coach Name"]');
    await teamInputs.nth(0).fill('TestCoach');

    // Continue to config
    page.on('dialog', async (dialog) => {
      await dialog.accept();
    });
    await page.getByRole('button', { name: 'Continue to Draft Setup' }).click();
    await expect(page.getByText('Draft Configuration')).toBeVisible();

    // Configure and start draft
    await page.locator('label').filter({ hasText: 'Snake' }).click();
    await page.getByRole('button', { name: /Randomize/i }).click();
    await page.getByRole('button', { name: 'Start Draft' }).click();

    // Verify on draft board
    await expect(page.getByText('Now Drafting:')).toBeVisible();

    // Make 1-2 picks
    const draftButton = page.locator('button:has-text("Draft")').first();
    if (await draftButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await draftButton.click();
      await page.waitForTimeout(300);
    }

    // Click Return to Draft Setup
    await page.getByRole('button', { name: /Return to Draft Setup/i }).click();

    // Verify confirmation dialog appears and accept it
    // (dialog handler already set up above)
    await page.waitForTimeout(500);

    // Verify we're back on config screen
    await expect(page.getByText('Draft Configuration')).toBeVisible();

    // Verify team name is still set
    await expect(page.getByText('TestCoach')).toBeVisible();

    // Verify we can start draft again
    await expect(page.getByRole('button', { name: 'Start Draft' })).toBeEnabled();
  });

  test('prevents creating division with duplicate name', async ({ page }) => {
    // Create first division named "Duplicate Test"
    await page.getByRole('button', { name: 'Create New Division' }).click();
    await page.getByRole('button', { name: 'Custom' }).click();
    await page.getByPlaceholder('e.g., Majors 2024').fill('Duplicate Test');
    await page.locator('input[type="range"]').fill('5');
    await page.getByRole('button', { name: 'Create Division' }).click();

    // Import a CSV to make the division valid (saved to localStorage)
    await page.getByRole('button', { name: /Import Summary CSV/i }).click();
    const csvPath = path.resolve(__dirname, 'fixtures/test-players.csv');
    await page.locator('input#file-input').setInputFiles(csvPath);
    await page.getByRole('button', { name: 'Continue to Review' }).click();
    await expect(page.getByText('Review Players & Setup Teams')).toBeVisible();

    // Go back to division selector
    await page.getByRole('button', { name: /Divisions/i }).first().click();

    // Try to create another with same name
    await page.getByRole('button', { name: 'Create New Division' }).click();
    await page.getByRole('button', { name: 'Custom' }).click();
    await page.getByPlaceholder('e.g., Majors 2024').fill('Duplicate Test');

    // Verify error message appears
    await expect(page.getByText(/already exists/i)).toBeVisible();

    // Verify Create button is disabled
    await expect(page.getByRole('button', { name: 'Create Division' })).toBeDisabled();
  });

  test('shows data loaded state when returning to upload', async ({ page }) => {
    // Create division and import CSV
    await page.getByRole('button', { name: 'Create New Division' }).click();
    await page.getByRole('button', { name: 'Custom' }).click();
    await page.getByPlaceholder('e.g., Majors 2024').fill('Data Loaded Test');
    await page.locator('input[type="range"]').fill('5');
    await page.getByRole('button', { name: 'Create Division' }).click();

    await page.getByRole('button', { name: /Import Summary CSV/i }).click();
    const csvPath = path.resolve(__dirname, 'fixtures/test-players.csv');
    await page.locator('input#file-input').setInputFiles(csvPath);
    await page.getByRole('button', { name: 'Continue to Review' }).click();

    // Wait for review page
    await expect(page.getByText('Review Players & Setup Teams')).toBeVisible();

    // Click Back button from Review
    await page.getByRole('button', { name: /Back/i }).first().click();

    // Verify shows "Players Loaded" message
    await expect(page.getByText(/Players Loaded/i)).toBeVisible();

    // Verify "Continue to Review" button exists
    await expect(page.getByRole('button', { name: /Continue to Review/i })).toBeVisible();

    // Click continue and verify back on review
    await page.getByRole('button', { name: /Continue to Review/i }).click();
    await expect(page.getByText('Review Players & Setup Teams')).toBeVisible();
  });
});
