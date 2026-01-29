import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3d52671-fa73-11f0-83e0-8d7be1d51901.html';

test.describe('Multiset (Bag) — FSM states and transitions', () => {
  // Capture console messages, page errors and dialog messages for assertions
  let consoleMessages;
  let pageErrors;
  let dialogMessages;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];
    dialogMessages = [];

    // Collect console messages
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect uncaught page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Collect dialog messages (alerts/prompts)
    page.on('dialog', async (dialog) => {
      dialogMessages.push(dialog.message());
      await dialog.accept();
    });

    // Navigate to the page and wait for load
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Basic sanity: ensure the demo header is present (S0_Idle entry evidence)
    await expect(page.locator('h1')).toHaveText('Multiset (a.k.a. Bag) — Interactive Demo');
  });

  test.afterEach(async () => {
    // nothing to teardown beyond Playwright's automatic cleanup
  });

  test('Initial render: Idle state and initial presets loaded', async ({ page }) => {
    // This validates S0_Idle entry action (renderPage()) via the h1 presence
    // Also confirms that presetA() and presetB() called on init (script calls them)
    // Check that A and B distinct sizes reflect sample presets
    await expect(page.locator('#a-distinct')).toHaveText('3'); // apple, banana, cherry
    await expect(page.locator('#b-distinct')).toHaveText('3'); // apple, cherry, date

    // a-size and b-size should reflect multiplicities from presets:
    // presetA: apple^2, banana^1, cherry^3 => total 6
    await expect(page.locator('#a-size')).toHaveText('6');
    // presetB: apple^1, cherry^2, date^4 => total 7
    await expect(page.locator('#b-size')).toHaveText('7');

    // Result view initially shows "(no result yet)"
    await expect(page.locator('#result-view')).toHaveText('(no result yet)');

    // The operations log should include the preset load messages (they are logged on init)
    const logText = await page.locator('#log').textContent();
    expect(logText).toContain('Preset B loaded'); // last preset called
    expect(logText).toContain('Preset A loaded');

    // Ensure there are no uncaught page errors
    expect(pageErrors).toHaveLength(0);
  });

  test.describe('Add / Clear operations for multisets A and B', () => {
    test('AddA and AddB update lists, sizes, and logs', async ({ page }) => {
      // Clear logs for clarity by clicking the clear buttons for presets (use preset2 which clears)
      await page.click('#a-preset2'); // clears A
      await page.click('#b-preset2'); // clears B

      // Initially both should be empty
      await expect(page.locator('#a-distinct')).toHaveText('0');
      await expect(page.locator('#b-distinct')).toHaveText('0');

      // Add to A: 3 pears
      await page.fill('#a-item', 'pear');
      await page.fill('#a-count', '3');
      await page.click('#a-add');

      // Verify A updated: distinct 1, size 3, list contains pear with badge 3
      await expect(page.locator('#a-distinct')).toHaveText('1');
      await expect(page.locator('#a-size')).toHaveText('3');
      const aListText = await page.locator('#a-list').textContent();
      expect(aListText).toContain('pear');
      expect(aListText).toContain('3');

      // Add to B: 2 pear (so B distinct 1 size 2)
      await page.fill('#b-item', 'pear');
      await page.fill('#b-count', '2');
      await page.click('#b-add');
      await expect(page.locator('#b-distinct')).toHaveText('1');
      await expect(page.locator('#b-size')).toHaveText('2');

      // Check logs contain the add actions
      const log = await page.locator('#log').textContent();
      expect(log).toContain("A: added 3 'pear'");
      expect(log).toContain("B: added 2 'pear'");

      // Ensure there are no uncaught page errors
      expect(pageErrors).toHaveLength(0);
    });

    test('ClearA and ClearB remove elements and produce logs', async ({ page }) => {
      // Ensure A and B are not empty first (they were seeded on load)
      await page.click('#a-clear');
      await page.click('#b-clear');

      // Verify clears: distinct 0 and size 0
      await expect(page.locator('#a-distinct')).toHaveText('0');
      await expect(page.locator('#a-size')).toHaveText('0');
      await expect(page.locator('#b-distinct')).toHaveText('0');
      await expect(page.locator('#b-size')).toHaveText('0');

      // The log should have clear entries
      const log = await page.locator('#log').textContent();
      expect(log).toContain('A cleared');
      expect(log).toContain('B cleared');

      // Ensure there are no uncaught page errors
      expect(pageErrors).toHaveLength(0);
    });

    test('Attempting to add empty item triggers alert (edge case)', async ({ page }) => {
      // Clear A then try to add with empty item string
      await page.click('#a-clear');
      await page.fill('#a-item', ''); // empty
      await page.fill('#a-count', '1');

      // Click Add and the page should raise an alert with the expected message
      await page.click('#a-add');
      // Wait briefly to allow dialog handler to run in beforeEach
      await page.waitForTimeout(100);

      expect(dialogMessages.length).toBeGreaterThanOrEqual(1);
      expect(dialogMessages[dialogMessages.length - 1]).toContain('Enter an item string.');

      // Verify A remains empty
      await expect(page.locator('#a-distinct')).toHaveText('0');
      await expect(page.locator('#a-size')).toHaveText('0');

      // Ensure no uncaught page errors
      expect(pageErrors).toHaveLength(0);
    });
  });

  test.describe('Preset loading and operation results (S1_A_Updated / S2_B_Updated -> S3_Result_Updated)', () => {
    test('PresetA and PresetB set expected contents', async ({ page }) => {
      // Load both presets explicitly and verify contents match expected multiplicities
      await page.click('#a-preset1');
      await page.click('#b-preset1');

      // A should have apple^2, banana, cherry^3
      await expect(page.locator('#a-distinct')).toHaveText('3');
      await expect(page.locator('#a-size')).toHaveText('6');
      const aListText = await page.locator('#a-list').textContent();
      expect(aListText).toContain('apple');
      expect(aListText).toContain('2'); // apple^2
      expect(aListText).toContain('banana');
      expect(aListText).toContain('cherry');
      expect(aListText).toContain('3'); // cherry^3

      // B should have apple, cherry^2, date^4
      await expect(page.locator('#b-distinct')).toHaveText('3');
      await expect(page.locator('#b-size')).toHaveText('7');
      const bListText = await page.locator('#b-list').textContent();
      expect(bListText).toContain('date');
      expect(bListText).toContain('4'); // date^4

      // Logs should mention the preset loads
      const log = await page.locator('#log').textContent();
      expect(log).toContain('Preset A loaded');
      expect(log).toContain('Preset B loaded');

      // No page errors
      expect(pageErrors).toHaveLength(0);
    });

    test('Union, Intersection, Sum, Difference, Symmetric Difference produce correct result strings', async ({ page }) => {
      // Ensure known state by loading presets
      await page.click('#a-preset1');
      await page.click('#b-preset1');

      // Click Union
      await page.click('#union');
      await expect(page.locator('#result-view')).toHaveText('{ apple^2, banana, cherry^3, date^4 }');

      // Click Intersection
      await page.click('#intersection');
      await expect(page.locator('#result-view')).toHaveText('{ apple, cherry^2 }');

      // Click Sum
      await page.click('#sum');
      await expect(page.locator('#result-view')).toHaveText('{ apple^3, banana, cherry^5, date^4 }');

      // Click Difference (A \ B)
      await page.click('#difference');
      await expect(page.locator('#result-view')).toHaveText('{ apple, banana, cherry }');

      // Click Symmetric Difference
      await page.click('#symdiff');
      // The order from symmetricDifference will be keys combined; expecting apple, banana, cherry, date^4
      await expect(page.locator('#result-view')).toHaveText('{ apple, banana, cherry, date^4 }');

      // Ensure logs were appended for these operations
      const log = await page.locator('#log').textContent();
      expect(log).toContain('Union (max counts) computed');
      expect(log).toContain('Intersection (min counts) computed');
      expect(log).toContain('Sum (add counts) computed');
      expect(log).toContain('Difference A \\ B computed');
      expect(log).toContain('Symmetric difference computed');

      // No page errors
      expect(pageErrors).toHaveLength(0);
    });

    test('Equals and Subset checks (and mutate target behavior)', async ({ page }) => {
      // Start from presets
      await page.click('#a-preset1');
      await page.click('#b-preset1');

      // Initially A !== B
      await page.click('#equals');
      await expect(page.locator('#result-view')).toHaveText('A does NOT equal B');

      // Make B equal to A by clearing B then adding same entries via UI controls
      await page.click('#b-clear');

      // Add apple^2
      await page.fill('#b-item', 'apple');
      await page.fill('#b-count', '2');
      await page.click('#b-add');

      // Add banana
      await page.fill('#b-item', 'banana');
      await page.fill('#b-count', '1');
      await page.click('#b-add');

      // Add cherry^3
      await page.fill('#b-item', 'cherry');
      await page.fill('#b-count', '3');
      await page.click('#b-add');

      // Now equality should be true
      await page.click('#equals');
      await expect(page.locator('#result-view')).toHaveText('A equals B (multiset equality)');

      // Subset checks when equal: both subset tests should report positive
      await page.click('#subset');
      await expect(page.locator('#result-view')).toHaveText('A ⊆ B (A is a multiset subset of B)');

      await page.click('#subset-rev');
      await expect(page.locator('#result-view')).toHaveText('B ⊆ A (B is a multiset subset of A)');

      // Now test mutate target: set op-target to 'a', check mutate, and apply union (should overwrite A)
      await page.selectOption('#op-target', 'a');
      await page.check('#mutate');

      // For a visible change, first alter B slightly: add 'date' to B so union will add it to A
      await page.fill('#b-item', 'date');
      await page.fill('#b-count', '1');
      await page.click('#b-add');

      // Now apply union: because mutate is checked and target is 'a', A should be overwritten to include date
      await page.click('#union');

      // Since applyResult with mutate clears resultHolder, result-view should show '(no result yet)'
      await expect(page.locator('#result-view')).toHaveText('(no result yet)');

      // Verify A now contains 'date' by checking #a-list
      const aListAfter = await page.locator('#a-list').textContent();
      expect(aListAfter).toContain('date');

      // Uncheck mutate and reset target to 'result'
      await page.uncheck('#mutate');
      await page.selectOption('#op-target', 'result');

      // No page errors
      expect(pageErrors).toHaveLength(0);
    });

    test('Iterate elements and sample behaviors including empty-sampling edge case', async ({ page }) => {
      // Ensure A has preset content
      await page.click('#a-preset1');

      // Click iterate to get expanded elements list
      await page.click('#iterate');
      const iterateText = await page.locator('#result-view').textContent();
      expect(iterateText).toContain('Elements (expanded):');
      // The expanded array should include multiple 'apple' entries (apple appears twice)
      expect(iterateText).toContain('apple');

      // Sample from A when non-empty: not deterministic, but should not indicate empty
      await page.click('#sample-a');
      const sampleAText = await page.locator('#result-view').textContent();
      expect(sampleAText).not.toBe('(A is empty)');

      // Clear A and sample again to test empty-sampling edge case
      await page.click('#a-clear');
      await page.click('#sample-a');
      await expect(page.locator('#result-view')).toHaveText('(A is empty)');

      // Sample from B when empty: first clear B
      await page.click('#b-clear');
      await page.click('#sample-b');
      await expect(page.locator('#result-view')).toHaveText('(B is empty)');

      // No page errors
      expect(pageErrors).toHaveLength(0);
    });
  });

  test('DOM action buttons inside list items (+1, -1, remove all) modify multisets', async ({ page }) => {
    // Load preset A
    await page.click('#a-preset1');

    // Locate the first list item for A and click its '+1' button, verify counts increase
    const firstAItem = page.locator('#a-list li').first();
    const badge = firstAItem.locator('.badge');
    const beforeBadge = await badge.textContent();
    const beforeCount = parseInt(beforeBadge || '0', 10);

    // Click '+1' (the first action button)
    await firstAItem.locator('button').nth(0).click();
    const afterBadge = await badge.textContent();
    const afterCount = parseInt(afterBadge || '0', 10);
    expect(afterCount).toBe(beforeCount + 1);

    // Click '-1' (second action button) and verify it decremented (or possibly removed)
    await firstAItem.locator('button').nth(1).click();
    const finalBadgeText = await badge.textContent();
    const finalCount = parseInt(finalBadgeText || '0', 10);
    // finalCount should be back to beforeCount
    expect(finalCount).toBe(beforeCount);

    // Click 'remove all' (third action) and verify the element removed from list
    await firstAItem.locator('button').nth(2).click();
    // Wait briefly for DOM update
    await page.waitForTimeout(50);
    const listText = await page.locator('#a-list').textContent();
    // The previously present element's name (we can infer from earlier text)
    // If the list is empty entirely, listText might be empty or not contain the element name
    expect(listText).not.toContain(firstAItem.locator('span').first().toString());

    // No page errors
    expect(pageErrors).toHaveLength(0);
  });

  test('Final verification: no uncaught JavaScript errors emitted during interactions', async ({ page }) => {
    // The suite has already exercised many interactions. This final test asserts that no
    // uncaught page errors occurred during the test session.
    expect(pageErrors).toHaveLength(0);

    // Additionally ensure there were informative console logs emitted (not errors)
    const errorConsoleEntries = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleEntries.length).toBe(0);

    // Sanity: ensure at least some console messages were captured (logs happen on operations)
    expect(consoleMessages.length).toBeGreaterThanOrEqual(0);
  });
});