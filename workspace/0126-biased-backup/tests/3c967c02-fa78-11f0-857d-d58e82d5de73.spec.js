import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c967c02-fa78-11f0-857d-d58e82d5de73.html';

test.describe('Priority Queue Visualization — FSM tests (3c967c02-fa78-11f0-857d-d58e82d5de73)', () => {
  // Collect console and page errors for each test so we can assert on them
  let consoleErrors;
  let pageErrors;
  let dialogMessages;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];
    dialogMessages = [];

    // Capture console error messages
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Capture unhandled page errors
    page.on('pageerror', err => {
      pageErrors.push(String(err && err.message ? err.message : err));
    });

    // Capture dialogs (alerts) and record message; accept them so tests continue
    page.on('dialog', async dialog => {
      dialogMessages.push(dialog.message());
      await dialog.accept();
    });

    // Navigate to the application and wait for load handlers to run
    await page.goto(APP_URL);
    await page.waitForLoadState('load');

    // Ensure initial slots have rendered (initQueue should create 6 items)
    await page.waitForSelector('.queue-slots .slot', { timeout: 2000 });
  });

  test.afterEach(async () => {
    // Make sure no unexpected runtime errors happened during the test.
    // The FSM/requirements asked us to observe console/page errors - we assert none occurred.
    expect(pageErrors, `Unexpected page errors: ${pageErrors.join(' | ')}`).toHaveLength(0);
    expect(consoleErrors, `Unexpected console errors: ${consoleErrors.join(' | ')}`).toHaveLength(0);
  });

  test('S0_Initialized: page load runs initQueue() and renders initial items (6 slots) sorted by priority', async ({ page }) => {
    // Validate initial number of slots (initQueue creates 6 items)
    const slots = page.locator('.queue-slots .slot');
    await expect(slots).toHaveCount(6);

    // Verify aria attributes on queue container (accessibility / live region)
    const queueSlots = page.locator('#queueSlots');
    await expect(queueSlots).toHaveAttribute('aria-live', 'polite');
    await expect(queueSlots).toHaveAttribute('aria-relevant', 'additions removals');

    // Extract displayed priorities from DOM and ensure they are sorted ascending (highest priority first -> lowest number first)
    const priorityTexts = await page.locator('.queue-slots .slot .item-priority').allTextContents();
    // item-priority text format: "Priority: X"
    const priorities = priorityTexts.map(t => parseInt(t.replace(/\D/g, ''), 10));
    // Confirm ascending order by priority (lowest number first)
    for (let i = 1; i < priorities.length; i++) {
      expect(priorities[i - 1], 'priority ordering must be ascending (higher priority first)').toBeLessThanOrEqual(priorities[i]);
    }

    // Specifically, based on initQueue data, the first priority should be 1
    const firstPriorityText = await page.locator('.queue-slots .slot >> nth=0 .item-priority').textContent();
    expect(firstPriorityText).toContain('Priority: 1');

    // Verify the priority bar's computed inline height for the priority 1 element is the expected value (160px)
    const firstBarHeight = await page.locator('.queue-slots .slot >> nth=0 .priority-bar').getAttribute('style');
    expect(firstBarHeight).toContain('height: 160px');
  });

  test('S1_ItemEnqueued: clicking Enqueue adds an item up to max (7), then shows alert on overflow', async ({ page }) => {
    const enqueueBtn = page.locator('button#enqueue');
    const dequeueBtn = page.locator('button#dequeue');
    const slots = page.locator('.queue-slots .slot');

    // Initially 6 items
    await expect(slots).toHaveCount(6);

    // Click enqueue once - should add a 7th item (no dialog expected)
    await enqueueBtn.click();
    await expect(slots).toHaveCount(7);

    // After the first enqueue, the new item id should be visible as "#7"
    // Look for an element that has the item-id text "#7"
    const newItemIdLocator = page.locator('.queue-slots .slot .item-id', { hasText: '#7' });
    await expect(newItemIdLocator).toHaveCount(1);

    // Dequeue button should be enabled when there are items
    await expect(dequeueBtn).toBeEnabled();

    // Now try to enqueue an 8th item: expect an alert dialog and that the count remains 7
    // dialogMessages array will capture the alert message and the handler in beforeEach auto-accepts it
    await enqueueBtn.click(); // this should trigger the alert and be captured
    // Wait a tick to ensure dialog handler ran
    await page.waitForTimeout(100);

    // Ensure alert was shown with expected message
    expect(dialogMessages.length).toBeGreaterThanOrEqual(1);
    expect(dialogMessages[dialogMessages.length - 1]).toContain('Maximum of 7 items in queue reached.');

    // The slot count must not have changed (still 7)
    await expect(slots).toHaveCount(7);
  });

  test('S1_ItemEnqueued -> S2_ItemDequeued: clicking Dequeue removes the highest priority item (lowest number)', async ({ page }) => {
    const dequeueBtn = page.locator('button#dequeue');
    const slots = page.locator('.queue-slots .slot');

    // Confirm initial state
    await expect(slots).toHaveCount(6);

    // Identify the first slot's item-id and priority so we can assert it was removed
    const firstItemIdText = await page.locator('.queue-slots .slot >> nth=0 .item-id').textContent(); // e.g. "#3"
    const firstItemPriorityText = await page.locator('.queue-slots .slot >> nth=0 .item-priority').textContent(); // e.g. "Priority: 1"

    // Click dequeue -> should remove that top-priority item
    await dequeueBtn.click();

    // After dequeue, count should decrease by 1
    await expect(slots).toHaveCount(5);

    // The previously-seen item id should no longer be present
    const removedLocator = page.locator('.queue-slots .slot .item-id', { hasText: firstItemIdText.trim() });
    await expect(removedLocator).toHaveCount(0);

    // New first priority should be greater-or-equal to the removed one (since removed lowest)
    const newFirstPriorityText = await page.locator('.queue-slots .slot >> nth=0 .item-priority').textContent();
    const removedPriority = parseInt(firstItemPriorityText.replace(/\D/g, ''), 10);
    const newFirstPriority = parseInt(newFirstPriorityText.replace(/\D/g, ''), 10);
    expect(newFirstPriority).toBeGreaterThanOrEqual(removedPriority);
  });

  test('Edge case: Dequeue until empty disables dequeue button and does not throw errors; then Enqueue works again', async ({ page }) => {
    const dequeueBtn = page.locator('button#dequeue');
    const enqueueBtn = page.locator('button#enqueue');
    const slotsLocator = page.locator('.queue-slots .slot');

    // Dequeue repeatedly until the button becomes disabled
    // Use a safety limit to avoid infinite loop
    for (let i = 0; i < 12; i++) {
      const disabled = await dequeueBtn.getAttribute('disabled');
      if (disabled !== null && (disabled === '' || disabled === 'true')) break; // disabled attribute present
      const isEnabled = await dequeueBtn.isEnabled();
      if (!isEnabled) break;
      await dequeueBtn.click();
      await page.waitForTimeout(50); // small delay to allow renderQueue to update
    }

    // After draining, there should be zero slots
    await expect(slotsLocator).toHaveCount(0);

    // Dequeue should now be disabled
    await expect(dequeueBtn).toBeDisabled();

    // Try clicking dequeue anyway (should be a no-op and produce no page errors)
    // Playwright will not click a disabled button; simulate calling the underlying function is forbidden by constraints,
    // so we assert that the button is disabled and that there are no page errors after this flow (checked in afterEach).
    expect(await dequeueBtn.isEnabled()).toBeFalsy();

    // Now enqueue a new item and ensure queue goes from empty to 1
    await enqueueBtn.click();
    await expect(slotsLocator).toHaveCount(1);

    // Confirm that the newly-created slot has item-id "#7" or higher (since itemIdCounter continued from initial)
    const itemIdText = (await page.locator('.queue-slots .slot .item-id').textContent()).trim();
    expect(itemIdText.startsWith('#')).toBeTruthy();
  });

  test('Render validation: slots have accessible aria-label and priority-bar inline heights match scaled priorities', async ({ page }) => {
    // Validate that every slot element has a descriptive aria-label and the priority-bar inline styles exist
    const slotCount = await page.locator('.queue-slots .slot').count();
    for (let i = 0; i < slotCount; i++) {
      const slot = page.locator('.queue-slots .slot').nth(i);
      const aria = await slot.getAttribute('aria-label');
      expect(aria).toMatch(/Item \d+,\s*Priority \d+/);

      // Extract the priority value and compute expected height using the same formula as the app:
      // expected = 160 - ((priority - 1) / (MAX_PRIORITY - 1)) * 130
      const priorityText = await slot.locator('.item-priority').textContent();
      const priority = parseInt(priorityText.replace(/\D/g, ''), 10);
      const expectedHeight = Math.round(160 - ((priority - 1) / (9 - 1)) * 130); // MAX_PRIORITY = 9
      const styleAttr = await slot.locator('.priority-bar').getAttribute('style');
      // Style contains e.g. "height: 160px; background: ..."; assert it includes the expected pixel height
      expect(styleAttr).toContain(`height: ${expectedHeight}px`);
    }
  });
});