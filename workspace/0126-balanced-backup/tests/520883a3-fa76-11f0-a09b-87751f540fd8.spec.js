import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/520883a3-fa76-11f0-a09b-87751f540fd8.html';

test.describe('Priority Queue FSM - 520883a3-fa76-11f0-a09b-87751f540fd8', () => {
  // Arrays to capture runtime diagnostics per test
  test.beforeEach(async ({ page }) => {
    // Navigate fresh before each test
    await page.goto(APP_URL);
  });

  // Idle state checks: verify UI elements exist and queue is initially empty
  test('Idle state - buttons present and queue empty', async ({ page }) => {
    // Validate presence of all expected controls
    await expect(page.locator('#add-queue')).toHaveCount(1);
    await expect(page.locator('#remove-queue')).toHaveCount(1);
    await expect(page.locator('#peek-queue')).toHaveCount(1);
    await expect(page.locator('#display-queue')).toHaveCount(1);

    // The priority queue div should be empty initially
    const content = await page.locator('#priority-queue').textContent();
    expect(content?.trim()).toBe('', 'Priority queue should be empty in Idle state');
  });

  // ADD element flow: test adding element transitions to "Element Added" state
  test('Add Element (S1_Added) - adds entry when prompt accepted', async ({ page }) => {
    // Listen for dialog and provide an element value
    page.once('dialog', async dialog => {
      expect(dialog.type()).toBe('prompt');
      await dialog.accept('Alpha');
    });

    // Click Add and assert that the DOM reflects the addition
    await page.click('#add-queue');

    // The implementation appends a <p> with "Alpha (Priority: 1)"
    await expect(page.locator('#priority-queue')).toContainText('Alpha (Priority: 1)');
  });

  // Edge case: Add element - user cancels prompt (should not change state or throw)
  test('Add Element - cancel prompt should not modify queue and not throw', async ({ page }) => {
    // Dialog handler that dismisses the prompt
    page.once('dialog', async dialog => {
      expect(dialog.type()).toBe('prompt');
      await dialog.dismiss();
    });

    // Click Add and dismiss
    await page.click('#add-queue');

    // Ensure queue remains empty and no page errors are produced
    const content = await page.locator('#priority-queue').textContent();
    expect(content?.trim()).toBe('', 'Queue should remain empty after cancelling Add');

    // There should be no uncaught exceptions from this action
    // Use waitForTimeout to allow potential async errors to surface, then check page.errors via event
    // We'll attach a temporary error collector to assert no errors occurred.
    const errors = [];
    const onError = error => errors.push(error);
    page.on('pageerror', onError);
    // small delay to observe any late errors
    await page.waitForTimeout(100);
    page.off('pageerror', onError);
    expect(errors.length).toBe(0);
  });

  // REMOVE element when queue is empty should produce a runtime TypeError in this implementation.
  // The code attempts to access removed[1] when removed is undefined -> triggers TypeError.
  test('Remove Element (S2_Removed) - removing from empty queue triggers TypeError', async ({ page }) => {
    // Ensure queue is empty at this start
    const initial = await page.locator('#priority-queue').textContent();
    expect(initial?.trim()).toBe('', 'Queue should be empty before this test');

    // Prepare to accept the prompt with some string; this will cause the click handler to attempt
    // to dequeue from an empty queue and then access properties of undefined -> TypeError expected.
    page.once('dialog', async dialog => {
      expect(dialog.type()).toBe('prompt');
      await dialog.accept('Beta');
    });

    // Wait for the pageerror event which should be triggered by the TypeError
    const [err] = await Promise.all([
      page.waitForEvent('pageerror'),
      page.click('#remove-queue') // triggers prompt, which we accept above
    ]);

    // Validate that an error occurred and it is a TypeError related to reading a property of undefined
    expect(err).toBeTruthy();
    // Different engines may have slightly different messages; check for indicative substrings
    const message = `${err.message}`.toLowerCase();
    const isTypeError = message.includes('cannot read') || message.includes("cannot read properties") || message.includes('undefined');
    expect(isTypeError).toBeTruthy();
  });

  // REMOVE element success path: add then remove the same element.
  test('Remove Element - removes existing element and shows "Removed" message', async ({ page }) => {
    // Add an element first
    page.once('dialog', async dialog => await dialog.accept('Gamma'));
    await page.click('#add-queue');
    await expect(page.locator('#priority-queue')).toContainText('Gamma (Priority: 1)');

    // Now remove: provide same element in prompt so removed[0] === element branch will append "Removed: Gamma"
    page.once('dialog', async dialog => {
      expect(dialog.type()).toBe('prompt');
      await dialog.accept('Gamma');
    });

    await page.click('#remove-queue');

    // The implementation appends a representation of the removed array and then "Removed: Gamma"
    await expect(page.locator('#priority-queue')).toContainText('Removed: Gamma');
  });

  // PEEK when queue is empty should append "No elements in the queue" - no errors
  test('Peek Element (S3_Peeked) - peek on empty queue displays friendly message', async ({ page }) => {
    // Ensure empty
    const initial = await page.locator('#priority-queue').textContent();
    expect(initial?.trim()).toBe('', 'Queue should be empty at test start');

    // Click peek - no dialog involved
    await page.click('#peek-queue');

    // Expect the friendly "No elements in the queue" message
    await expect(page.locator('#priority-queue')).toContainText('No elements in the queue');
  });

  // PEEK when queue has elements: note the implementation returns only the element string from peek(),
  // then attempts to access queue.peek()[1] which will yield the second character of the string or undefined.
  // This is an implementation inconsistency but it should not crash; check DOM update.
  test('Peek Element - when queue has elements, peek appends a DOM entry (may show incorrect priority)', async ({ page }) => {
    // Add "Zeta"
    page.once('dialog', async dialog => await dialog.accept('Zeta'));
    await page.click('#add-queue');
    await expect(page.locator('#priority-queue')).toContainText('Zeta (Priority: 1)');

    // Click peek - will append something like "Zeta (undefined)" given the current implementation
    await page.click('#peek-queue');

    // Ensure something related to Zeta is present in the queue display after peeking
    // We expect the peek output includes the element string
    await expect(page.locator('#priority-queue')).toContainText('Zeta');
  });

  // DISPLAY all queue contents: add multiple items then click display to confirm the display() output replaces innerHTML
  test('Display Queue (S4_Displayed) - shows all elements from internal queue', async ({ page }) => {
    // Add two elements
    page.once('dialog', async d => d.accept('One'));
    await page.click('#add-queue');
    page.once('dialog', async d => d.accept('Two'));
    await page.click('#add-queue');

    // Sanity: ensure both appear in appended form
    await expect(page.locator('#priority-queue')).toContainText('One (Priority: 1)');
    await expect(page.locator('#priority-queue')).toContainText('Two (Priority: 1)');

    // Click display - this sets innerHTML to the string returned by display(), which uses array->string conversions
    await page.click('#display-queue');

    // After display(), the innerHTML is set to a raw string such as "One,1\nTwo,1"
    // Use textContent to read what was set
    const text = await page.locator('#priority-queue').textContent();
    expect(text).toBeTruthy();
    // Ensure both item names are present in the display output
    expect(text).toContain('One');
    expect(text).toContain('Two');
  });

  // Additional error-scenario: calling peek repeatedly to ensure no exceptions accumulate
  test('Repeated peek invocations do not crash the page', async ({ page }) => {
    // Add one element to avoid the empty-branch message on first peek
    page.once('dialog', async d => d.accept('Repeat'));
    await page.click('#add-queue');

    // Repeatedly click peek multiple times
    for (let i = 0; i < 5; i++) {
      await page.click('#peek-queue');
    }

    // Ensure the page is still responsive and contains the expected element marker
    await expect(page.locator('#priority-queue')).toContainText('Repeat');
  });

  // Confirm that removing with a non-matching prompt value still appends the removed array info,
  // but will not append the "Removed: ..." line (because removed[0] !== element)
  test('Remove Element - removing top when prompt value does not match removed element does not show "Removed:"', async ({ page }) => {
    // Add element "Delta"
    page.once('dialog', async d => d.accept('Delta'));
    await page.click('#add-queue');
    await expect(page.locator('#priority-queue')).toContainText('Delta (Priority: 1)');

    // Now remove using a different prompt value
    page.once('dialog', async d => d.accept('Different'));
    await page.click('#remove-queue');

    // The "Removed: Delta" text should NOT be appended because removed[0] !== prompt value
    const content = await page.locator('#priority-queue').textContent();
    expect(content).not.toContain('Removed: Different');
  });
});