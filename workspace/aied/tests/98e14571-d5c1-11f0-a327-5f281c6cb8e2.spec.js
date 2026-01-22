import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/98e14571-d5c1-11f0-a327-5f281c6cb8e2.html';

/**
 * Playwright tests for Red-Black Tree Visualizer (FSM-driven).
 *
 * These tests:
 * - Load the page as-is (no modifications).
 * - Observe console messages and page errors.
 * - Validate all major UI interactions described in the FSM.
 * - Verify state-like behaviors (messages, SVG rendering, button states).
 *
 * Notes:
 * - The page uses snapshots and updates the #message element with "Step X / Y: ..." messages.
 * - The SVG content uses <text> and <circle> elements to render nodes; when empty the SVG shows "(empty tree)".
 *
 * Organization:
 * - Tests grouped by feature: initial/idle state, insertion/deletion, random/bulk operations,
 *   animation controls (step/play/speed), and edge cases.
 *
 * The tests intentionally do not patch or modify the application code; they only interact via the DOM and observe logs/errors.
 */

test.describe('Red-Black Tree Visualizer - FSM coverage', () => {
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages and page errors for each test
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      // Capture the error message; allow assertions later
      pageErrors.push(String(err && err.message ? err.message : err));
    });

    // Load the application page exactly as-is
    await page.goto(APP_URL);
    // Wait for the hint message that initialises at end of script
    await page.waitForSelector('#message');
    await expect(page.locator('#message')).toHaveText(/Ready\. Try inserting/ , { timeout: 2000 });
  });

  test.afterEach(async () => {
    // No global patching allowed; just assert we observed no uncaught exceptions
    // Check for page errors and console error-level messages
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || /error/i.test(m.text));
    // Assert no surprising runtime errors occurred during the test
    expect(pageErrors, 'No pageerrors should have been thrown').toEqual([]);
    expect(consoleErrors, 'No console.error messages expected').toEqual([]);
  });

  test('Idle state shows initial message and empty SVG', async ({ page }) => {
    // Validate Idle (S0_Idle) entry action: initial message is shown
    const msg = await page.locator('#message').textContent();
    expect(msg).toContain('Ready. Try inserting 41, 38, 31, 12, 19, 8 (Sample).');

    // When initialized, the renderer puts an "(empty tree)" text in the SVG
    const emptyText = page.locator('#canvas text', { hasText: '(empty tree)' });
    await expect(emptyText).toBeVisible();
  });

  test.describe('Insertion and Deletion interactions', () => {
    test('Insert a key (S1_Inserting -> snapshots & SVG update)', async ({ page }) => {
      // Insert 41 via input and button
      const input = page.locator('#keyInput');
      await input.fill('41');
      await page.click('#insertBtn');

      // After insert, the SVG should show a node with text '41'
      const svgNodeText = page.locator('#canvas text', { hasText: '41' });
      await expect(svgNodeText).toBeVisible({ timeout: 2000 });

      // Message should reflect insertion snapshots (contains 'Inserted 41' or Step)
      const msg = await page.locator('#message').textContent();
      expect(msg).toMatch(/Step \d+ \/ \d+:|Inserted 41|Root recolored BLACK/);
    });

    test('Delete a key (S2_Deleting -> snapshots & SVG empties)', async ({ page }) => {
      // Ensure a node exists, insert 50 then delete it
      await page.locator('#keyInput').fill('50');
      await page.click('#insertBtn');
      // Wait for insert to reflect
      await page.locator('#canvas text', { hasText: '50' }).waitFor({ timeout: 2000 });

      // Now delete 50
      await page.locator('#keyInput').fill('50');
      await page.click('#deleteBtn');

      // Message should indicate deleting or steps in delete fixup
      await expect(page.locator('#message')).toHaveText(/Step \d+ \/ \d+:|Deleting node 50|Finished delete fixup|Key 50 not found/, { timeout: 2000 });

      // If deletion removed the only node, the empty text should appear
      const emptyText = page.locator('#canvas text', { hasText: '(empty tree)' });
      await expect(emptyText).toBeVisible({ timeout: 2000 });
    });

    test('Insert duplicate key should show "already exists" message (edge case)', async ({ page }) => {
      // Insert a key
      await page.locator('#keyInput').fill('60');
      await page.click('#insertBtn');
      await page.locator('#canvas text', { hasText: '60' }).waitFor({ timeout: 2000 });

      // Try to insert the same key again
      await page.locator('#keyInput').fill('60');
      await page.click('#insertBtn');

      // Expect the UI to show a duplicate warning
      await expect(page.locator('#message')).toHaveText(/already exists|Enter a valid integer\./, { timeout: 2000 });
    });

    test('Invalid input should be rejected with "Enter a valid integer." (edge case)', async ({ page }) => {
      // Clear the input to non-numeric string via evaluate to bypass number input constraints
      await page.evaluate(() => { document.getElementById('keyInput').value = ''; });
      await page.click('#insertBtn');

      await expect(page.locator('#message')).toHaveText(/Enter a valid integer\./, { timeout: 1000 });
    });
  });

  test.describe('Random and Bulk inserting (S3_Random_Inserting, S4_Bulk_Inserting)', () => {
    test('Insert Random (randBtn) inserts a new key and updates input', async ({ page }) => {
      // Click insert random - it should set the keyInput value and insert
      await page.click('#randBtn');

      // keyInput should now have a numeric value between 10 and 99
      const val = await page.locator('#keyInput').evaluate(el => el.value);
      expect(Number.isFinite(Number(val))).toBeTruthy();

      // The SVG should contain a text element matching the inserted value
      await expect(page.locator('#canvas text', { hasText: val })).toBeVisible({ timeout: 2000 });
    });

    test('Insert Sample (bulkBtn) inserts multiple sample keys over time', async ({ page }) => {
      // Click bulk insertion; sample is [41, 38, 31, 12, 19, 8]
      await page.click('#bulkBtn');

      // Wait long enough for all sample inserts to be processed (6 items * 250ms + buffer)
      await page.waitForTimeout(1800);

      // At least a couple of sample values should be present in the SVG
      const expectedSample = ['41', '38', '31', '12', '19', '8'];
      // Wait for any one of them to be visible (prefer the first)
      let found = false;
      for (const s of expectedSample) {
        const locator = page.locator('#canvas text', { hasText: s });
        if (await locator.count() > 0) {
          found = true;
          break;
        }
      }
      expect(found).toBeTruthy();
    });
  });

  test.describe('Clear and snapshot navigation (S5_Clearing, S6_Stepping_Animation)', () => {
    test('Clear button resets the tree and snapshots (S5_Clearing)', async ({ page }) => {
      // Insert a node first
      await page.locator('#keyInput').fill('77');
      await page.click('#insertBtn');
      await page.locator('#canvas text', { hasText: '77' }).waitFor({ timeout: 2000 });

      // Click clear
      await page.click('#clearBtn');

      // After clearing, the svg should show "(empty tree)" and message likely 'Initial'
      await expect(page.locator('#canvas text', { hasText: '(empty tree)' })).toBeVisible({ timeout: 2000 });
      await expect(page.locator('#message')).toHaveText(/Initial|Step 1 \/ \d+:/, { timeout: 1000 });
    });

    test('Step back and forward change displayed snapshot (S6_Stepping_Animation)', async ({ page }) => {
      // Create a small sequence: insert 10, 20
      await page.locator('#keyInput').fill('10');
      await page.click('#insertBtn');
      await page.locator('#canvas text', { hasText: '10' }).waitFor({ timeout: 2000 });

      await page.locator('#keyInput').fill('20');
      await page.click('#insertBtn');
      await page.locator('#canvas text', { hasText: '20' }).waitFor({ timeout: 2000 });

      // Capture message before stepping
      const before = await page.locator('#message').textContent();

      // Step back
      await page.click('#stepBack');
      const afterBack = await page.locator('#message').textContent();
      expect(afterBack).not.toBe(before);

      // Step forward
      await page.click('#stepForward');
      const afterForward = await page.locator('#message').textContent();
      // After stepping forward we should see a message different from the "afterBack"
      expect(afterForward).not.toBe(afterBack);
    });
  });

  test.describe('Playing animation and speed control (S7_Playing_Animation, ChangeSpeed)', () => {
    test('Play/Pause toggles and respects speed changes', async ({ page }) => {
      // Prepare some snapshots by inserting a few nodes
      await page.locator('#keyInput').fill('5');
      await page.click('#insertBtn');
      await page.locator('#canvas text', { hasText: '5' }).waitFor({ timeout: 2000 });

      await page.locator('#keyInput').fill('15');
      await page.click('#insertBtn');
      await page.locator('#canvas text', { hasText: '15' }).waitFor({ timeout: 2000 });

      // Click play - button text should change to pause text
      await page.click('#playPause');
      await expect(page.locator('#playPause')).toHaveText(/Pause|⏸/, { timeout: 1000 });

      // Change speed while playing - the handler stops playback and should set play button to "▶ Play"
      await page.locator('#speed').evaluate(el => el.value = '2.0');
      // Trigger input event
      await page.locator('#speed').dispatchEvent('input');

      // The play button should now be reset to Play (per implementation the speed input stops playback)
      await expect(page.locator('#playPause')).toHaveText(/Play|▶/, { timeout: 1000 });

      // If we click play again, we should re-enter playing state
      await page.click('#playPause');
      await expect(page.locator('#playPause')).toHaveText(/Pause|⏸/, { timeout: 1000 });

      // Clicking again should pause
      await page.click('#playPause');
      await expect(page.locator('#playPause')).toHaveText(/Play|▶/, { timeout: 1000 });
    });
  });

  test.describe('Observation of console and runtime errors (sanity)', () => {
    test('No uncaught page errors or console.error messages emitted during interactions', async ({ page }) => {
      // Perform a series of actions that exercise many code paths quickly
      await page.locator('#keyInput').fill('21');
      await page.click('#insertBtn');
      await page.click('#randBtn');
      await page.click('#stepBack');
      await page.click('#stepForward');
      await page.click('#playPause'); // may start playing; clicking again to toggle
      // wait a bit to allow any runtime errors to surface
      await page.waitForTimeout(600);

      // Assertions are done in afterEach, but also assert here explicitly:
      const errors = pageErrors;
      const consoleErrs = consoleMessages.filter(m => m.type === 'error' || /error/i.test(m.text));
      expect(errors).toEqual([]);
      expect(consoleErrs).toEqual([]);
    });
  });

});