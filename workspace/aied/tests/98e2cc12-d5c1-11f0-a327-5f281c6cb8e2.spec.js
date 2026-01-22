import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/98e2cc12-d5c1-11f0-a327-5f281c6cb8e2.html';

test.describe('Two Pointers — Interactive Demos (FSM validation)', () => {
  // We'll collect console messages and page errors for each test to assert no unexpected errors occur.
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect page-level errors (runtime exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    // Load the page exactly as-is
    await page.goto(APP_URL, { waitUntil: 'networkidle' });
    // Ensure initial UI has rendered
    await expect(page.locator('#status')).toBeVisible();
    await expect(page.locator('#arrayArea')).toBeVisible();
  });

  test.afterEach(async () => {
    // Assert that there were no uncaught page errors during the test
    // (we observe console errors too and fail if any console.error messages were emitted)
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(pageErrors, 'No uncaught page errors should have occurred').toEqual([]);
    expect(consoleErrors, `No console.error or console.warning messages expected. Found: ${consoleErrors.map(c=>c.text).join(' | ')}`).toEqual([]);
  });

  test.describe('Initial load and Idle->TwoSum entry', () => {
    test('on initial load the demo is loaded (loadDemo invoked) and status reflects TwoSum ready', async ({ page }) => {
      // The script calls loadDemo() on initial load. Expect TwoSum ready status.
      const status = page.locator('#status');
      await expect(status).toHaveText(/Ready\. Two pointers at both ends\. Left=0, Right=\d+/);

      // Array area should contain cells equal to default input array (8 elements)
      const cells = page.locator('#arrayArea .cell');
      await expect(cells).toHaveCount(8);
      // Check first and last cell values (should be 1 and 8 by default input)
      await expect(cells.nth(0).locator('.val')).toHaveText('1');
      await expect(cells.nth(7).locator('.val')).toHaveText('8');
      // Left and right pointers should be visible on first and last cell
      await expect(cells.nth(0).locator('.pointer.l')).toBeVisible();
      await expect(cells.nth(7).locator('.pointer.r')).toBeVisible();
    });
  });

  test.describe('TwoSum demo interactions', () => {
    test('Load two-sum demo, step once to find pair for target=9, verify found state and cell highlights', async ({ page }) => {
      // Ensure demo selected as twoSum
      await page.selectOption('#demoSelect', 'twoSum');
      // ensure target is 9 (default)
      await expect(page.locator('#targetInput')).toHaveValue('9');

      // Click Load
      await page.click('#loadBtn');

      // Status should indicate ready with correct indices
      await expect(page.locator('#status')).toHaveText(/Ready\. Two pointers at both ends\. Left=0, Right=\d+/);

      // Click Step once: with array 1..8 and target 9, first comparison (1 + 8) => Found
      await page.click('#stepBtn');

      // After step, status should indicate Found and Completed (or Found!)
      await expect(page.locator('#status')).toContainText('Found');

      // Two cells should have .found class (the matched pair)
      const foundCells = page.locator('#arrayArea .cell.found');
      await expect(foundCells).toHaveCount(2);

      // The found cells' values should add to target (1 and 8)
      const v0 = await page.locator('#arrayArea .cell.found').first().locator('.val').textContent();
      const v1 = await page.locator('#arrayArea .cell.found').nth(1).locator('.val').textContent();
      // Convert to numbers if possible and assert sum equals 9
      const n0 = Number(v0);
      const n1 = Number(v1);
      expect(n0 + n1 === 9, `Found pair should add to 9, got ${n0}+${n1}`).toBeTruthy();
    });

    test('Click Play toggles autoplay and updates button label', async ({ page }) => {
      // Ensure loaded model
      await page.selectOption('#demoSelect', 'twoSum');
      await page.click('#loadBtn');

      const playBtn = page.locator('#playBtn');
      // Click Play to start autoplay
      await playBtn.click();
      await expect(playBtn).toHaveText('Pause');

      // Click again to pause
      await playBtn.click();
      await expect(playBtn).toHaveText('Play');
    });
  });

  test.describe('Reverse demo interactions and keyboard step', () => {
    test('Load reverse demo, step with Space key and verify array reversal and final Completed state', async ({ page }) => {
      // Change demo to reverse; the change handler should also update the inputArray example
      await page.selectOption('#demoSelect', 'reverse');
      // Click Load
      await page.click('#loadBtn');

      // Status indicates ready for reverse
      await expect(page.locator('#status')).toHaveText('Ready. Two pointers at both ends to swap toward center.');

      // The array input should have been set to 'a,b,c,d,e' by the change handler
      await expect(page.locator('#inputArray')).toHaveValue('a,b,c,d,e');

      // Read initial sequence from cells
      const getSequence = async () => {
        const items = await page.locator('#arrayArea .cell .val').allTextContents();
        return items.map(s => s.trim());
      };
      const before = await getSequence();
      expect(before.join(',')).toBe('a,b,c,d,e');

      // Press Space to step once (swap first pair)
      await page.keyboard.press('Space');

      // Status should now indicate a swap happened (contains 'Swap')
      await expect(page.locator('#status')).toContainText('Swap');

      // Step through remaining steps using step button until completion
      // There are floor(n/2) = 2 swaps for 5 items; one step already done, do two more to ensure completion (extra step will return Completed)
      await page.click('#stepBtn');
      await page.click('#stepBtn');

      // Final status should indicate completion or reversal complete
      await expect(page.locator('#status')).toContainText(/reversal complete|Completed/);

      // Check that array is reversed compared to initial
      const after = await getSequence();
      expect(after.join(',')).toBe('e,d,c,b,a');
    });
  });

  test.describe('Remove duplicates demo interactions', () => {
    test('Load removeDup demo, step until completion and verify final unique array is reported', async ({ page }) => {
      // Select removeDup
      await page.selectOption('#demoSelect', 'removeDup');
      // Click Load
      await page.click('#loadBtn');

      // Status ready message for removeDup
      await expect(page.locator('#status')).toHaveText('Ready. Read and write pointers start at index 0.');

      // The input array should be the example set by demoSelect change handler
      await expect(page.locator('#inputArray')).toHaveValue('1,1,2,2,3,3,3,4');

      // Keep stepping until final message includes "Final array"
      const statusLocator = page.locator('#status');
      let attempts = 0;
      while (attempts < 20) {
        await page.click('#stepBtn');
        const txt = await statusLocator.textContent();
        if (txt && txt.includes('Final array')) break;
        attempts++;
      }
      expect(attempts < 20, 'RemoveDup should complete within a reasonable number of steps').toBeTruthy();

      // Status should include the final unique array listing
      const finalText = await statusLocator.textContent();
      expect(finalText).toContain('Final array');

      // Verify that the final array slice in status matches expected unique elements from example input
      // For input 1,1,2,2,3,3,3,4 => unique elements are 1,2,3,4 (length 4)
      expect(finalText).toMatch(/\[1,\s*2,\s*3,\s*4\]/);
      expect(finalText).toContain('first 4 elements unique');
    });
  });

  test.describe('Controls, randomization, reset and edge cases', () => {
    test('Random button updates input array and target when appropriate', async ({ page }) => {
      // Ensure twoSum demo selected to test both array and target update
      await page.selectOption('#demoSelect', 'twoSum');
      const beforeArr = await page.locator('#inputArray').inputValue();
      await page.click('#randomBtn');

      // After clicking Random, inputArray should change
      const afterArr = await page.locator('#inputArray').inputValue();
      expect(afterArr).not.toBe(beforeArr);

      // For twoSum demo, targetInput should be set to some numeric value (string form)
      const targetVal = await page.locator('#targetInput').inputValue();
      expect(targetVal).not.toBe('');
      expect(Number.isFinite(Number(targetVal))).toBeTruthy();
    });

    test('Reset clears model and UI and step/play actions show "Load a demo first."', async ({ page }) => {
      // Ensure model loaded initially (it is on page load). Now click Reset
      await page.click('#resetBtn');

      // Status should reflect reset message
      await expect(page.locator('#status')).toHaveText('Reset. Load a demo and press Play or Step to begin.');

      // Array area should be cleared
      await expect(page.locator('#arrayArea')).toBeEmpty();

      // Clicking Step when no model should lead to "Load a demo first."
      await page.click('#stepBtn');
      await expect(page.locator('#status')).toHaveText('Load a demo first.');

      // Clicking Play when no model should also show "Load a demo first."
      await page.click('#playBtn');
      await expect(page.locator('#status')).toHaveText('Load a demo first.');
    });

    test('Speed input change updates its value and affects autoplay interval toggle label', async ({ page }) => {
      // Set a low speed so autoplay runs faster (we won't rely on many intervals)
      await page.fill('#speed', '200');
      await expect(page.locator('#speed')).toHaveValue('200');

      // Load twoSum and click Play to toggle label
      await page.selectOption('#demoSelect', 'twoSum');
      await page.click('#loadBtn');
      await page.click('#playBtn');
      // Button should display Pause while autoplay running
      await expect(page.locator('#playBtn')).toHaveText('Pause');

      // Pause again
      await page.click('#playBtn');
      await expect(page.locator('#playBtn')).toHaveText('Play');
    });
  });

  test.describe('DemoSelect change handler side-effects', () => {
    test('Changing demo updates input examples and target visibility', async ({ page }) => {
      // Change to reverse -> inputArray becomes letters, target hidden
      await page.selectOption('#demoSelect', 'reverse');
      await expect(page.locator('#inputArray')).toHaveValue('a,b,c,d,e');
      await expect(page.locator('#targetDiv')).toBeHidden();

      // Change to removeDup -> inputArray becomes duplicate example, target hidden
      await page.selectOption('#demoSelect', 'removeDup');
      await expect(page.locator('#inputArray')).toHaveValue('1,1,2,2,3,3,3,4');
      await expect(page.locator('#targetDiv')).toBeHidden();

      // Change back to twoSum -> target shown and example restored
      await page.selectOption('#demoSelect', 'twoSum');
      await expect(page.locator('#inputArray')).toHaveValue('1,2,3,4,5,6,7,8');
      await expect(page.locator('#targetDiv')).toBeVisible();
    });
  });
});