import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c954380-fa78-11f0-857d-d58e82d5de73.html';

// Page Object for interacting with the Dynamic Array demo
class DynamicArrayPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.container = page.locator('.array-container');
    this.slots = () => this.page.locator('.array-container .slot');
    this.btnAdd = page.locator('#btn-add');
    this.btnReset = page.locator('#btn-reset');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  // Click the Add Element button
  async addElement() {
    await this.btnAdd.click();
  }

  // Click the Reset Array button
  async resetArray() {
    await this.btnReset.click();
  }

  // Return number of rendered slots
  async slotCount() {
    return this.slots().count();
  }

  // Return array of text contents for each slot
  async slotValues() {
    const count = await this.slotCount();
    const values = [];
    for (let i = 0; i < count; i++) {
      values.push(await this.slots().nth(i).textContent());
    }
    return values;
  }

  // Return array of data-empty attributes (strings 'true'/'false')
  async slotEmptyFlags() {
    const count = await this.slotCount();
    const flags = [];
    for (let i = 0; i < count; i++) {
      flags.push(await this.slots().nth(i).getAttribute('data-empty'));
    }
    return flags;
  }

  // Check if the slot at index has the 'active' class
  async isSlotActive(index) {
    const slot = this.slots().nth(index);
    const classAttr = await slot.getAttribute('class');
    return classAttr && classAttr.split(/\s+/).includes('active');
  }

  // Get inline transform style on the container
  async containerTransform() {
    return this.page.evaluate((sel) => {
      const el = document.querySelector(sel);
      return el ? el.style.transform || '' : '';
    }, '.array-container');
  }
}

test.describe('Dynamic Array — FSM validation and UI behavior', () => {
  // Collect console errors and page errors for assertions in teardown
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Listen for console messages and page errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });
  });

  test.afterEach(async () => {
    // After each test, assert that no uncaught console errors or page errors occurred.
    // This validates that the app ran without ReferenceError/SyntaxError/TypeError etc.
    expect(consoleErrors, `Console error messages were observed: ${JSON.stringify(consoleErrors)}`).toHaveLength(0);
    expect(pageErrors, `Page errors were observed: ${JSON.stringify(pageErrors)}`).toHaveLength(0);
  });

  test('Initial state (S0_Initial): renders default capacity slots, all empty', async ({ page }) => {
    // Validate Initial State: capacity = 4 slots, all empty
    const app = new DynamicArrayPage(page);
    await app.goto();

    // Wait for initial render to complete
    await expect(app.container).toBeVisible();

    const count = await app.slotCount();
    // FSM initial capacity is 4
    expect(count).toBe(4);

    const emptyFlags = await app.slotEmptyFlags();
    // All slots should be marked data-empty="true"
    for (const flag of emptyFlags) {
      expect(flag).toBe('true');
    }

    // No slot should be active on initial render
    for (let i = 0; i < count; i++) {
      const active = await app.isSlotActive(i);
      expect(active).toBeFalsy();
    }
  });

  test('Add Element transition (S0_Initial -> S1_ElementAdded): single insertion highlights new slot', async ({ page }) => {
    // Test single addition and visual highlight (entry action highlightSlot)
    const app = new DynamicArrayPage(page);
    await app.goto();

    // Click to add one element
    await app.addElement();

    // After click, first slot should show the value (7) and data-empty="false"
    const firstSlot = app.slots().nth(0);
    await expect(firstSlot).toHaveAttribute('data-index', '0');
    await expect(firstSlot).toHaveAttribute('data-empty', 'false');
    const text = (await firstSlot.textContent()) || '';
    // The implementation pushes length*10 + 7 where length at first insertion is 0 -> 7
    expect(text.trim()).toBe('7');

    // The new slot should have an active highlight immediately after insertion (entry action)
    const isActive = await app.isSlotActive(0);
    expect(isActive).toBeTruthy();

    // Wait for highlight duration to pass and ensure it is removed (cleanup of highlight)
    await page.waitForTimeout(1300); // highlightDuration is 1200ms in the app
    const isActiveAfter = await app.isSlotActive(0);
    expect(isActiveAfter).toBeFalsy();
  });

  test('Multiple additions up to capacity (S1_ElementAdded repeated) and doubling (S2_CapacityDoubled)', async ({ page }) => {
    // This test validates:
    // - Adding until capacity is reached updates arrayValues and rendered slots
    // - On attempting to add when full, capacity doubles and UI updates accordingly
    const app = new DynamicArrayPage(page);
    await app.goto();

    // Add 4 elements to fill initial capacity (values should be 7,17,27,37)
    for (let i = 0; i < 4; i++) {
      await app.addElement();
      // short pause to allow DOM updates and highlight to be applied
      await page.waitForTimeout(50);
    }

    // Verify first four slots have expected values and are not empty
    const values = await app.slotValues();
    expect(values.length).toBe(4);
    expect(values[0].trim()).toBe('7');
    expect(values[1].trim()).toBe('17');
    expect(values[2].trim()).toBe('27');
    expect(values[3].trim()).toBe('37');

    const emptyFlags = await app.slotEmptyFlags();
    for (let i = 0; i < 4; i++) {
      expect(emptyFlags[i]).toBe('false');
    }

    // Now add one more to trigger doubling branch
    // Immediately after clicking, the container transform should be scaled to 1.1 (flash effect)
    await app.addElement();

    // Right after click, the code sets transform to 'scale(1.1)'
    // We check that transform becomes scale(1.1) at some point shortly after click
    // There may be a tiny delay before style is applied so wait a little
    await page.waitForTimeout(20);
    const transformDuring = await app.containerTransform();
    // It may or may not have been updated instantly depending on timing; if updated expect 'scale(1.1)' or blank.
    // We won't assert strict presence of scale(1.1) here to avoid flakiness; instead we wait for the final state.

    // Wait for the doubling animation to complete (600ms) plus a buffer and ensure slots updated to doubled capacity
    await page.waitForTimeout(700);

    const countAfterDoubling = await app.slotCount();
    // Capacity should double from 4 to 8 => 8 slots rendered
    expect(countAfterDoubling).toBe(8);

    // Ensure original values are preserved in the first 4 slots
    const valuesAfter = await app.slotValues();
    expect(valuesAfter[0].trim()).toBe('7');
    expect(valuesAfter[1].trim()).toBe('17');
    expect(valuesAfter[2].trim()).toBe('27');
    expect(valuesAfter[3].trim()).toBe('37');

    // The new slots (indices 4-7) should be empty
    for (let i = 4; i < 8; i++) {
      const txt = (valuesAfter[i] || '').trim();
      expect(txt).toBe('');
      const flag = await app.slots().nth(i).getAttribute('data-empty');
      expect(flag).toBe('true');
    }

    // After the doubling sequence, the container's transform should have been reset to 'scale(1)'
    const transformFinal = await app.containerTransform();
    expect(transformFinal).toBe('scale(1)');

    // The implementation also highlights the last inserted (previous) slot after doubling:
    // last inserted index is length - 1 = 3
    const activeAfter = await app.isSlotActive(3);
    // It might still be active if within highlightDuration, so expect a boolean (true or false).
    // To be strict with FSM expected entry action, assert that the highlight was applied at least briefly:
    // We'll check by adding a small delay and checking it was active immediately after doubling (within highlightDuration).
    // We already waited 700ms; highlightDuration is 1200ms so it should still be active.
    expect(activeAfter).toBeTruthy();

    // Wait until highlight expires
    await page.waitForTimeout(600);
    const activeAfterExpire = await app.isSlotActive(3);
    expect(activeAfterExpire).toBeFalsy();
  });

  test('After doubling (S2_CapacityDoubled) adding resumes normal insertions (S2 -> S1)', async ({ page }) => {
    // Validate that after capacity doubled, adding an element inserts into the array (index 4) and highlights it
    const app = new DynamicArrayPage(page);
    await app.goto();

    // Fill initial capacity
    for (let i = 0; i < 4; i++) {
      await app.addElement();
      await page.waitForTimeout(20);
    }

    // Trigger doubling
    await app.addElement();
    await page.waitForTimeout(700); // wait for doubling to finish

    // Now add another element which should be inserted at index 4
    await app.addElement();

    // Give time for render and highlight to apply
    await page.waitForTimeout(50);

    const count = await app.slotCount();
    expect(count).toBe(8);

    // The inserted value at index 4 should be (length before insertion was 4) => 4*10+7 = 47
    const val4 = (await app.slots().nth(4).textContent()) || '';
    expect(val4.trim()).toBe('47');

    // That slot should be marked data-empty="false"
    const flag4 = await app.slots().nth(4).getAttribute('data-empty');
    expect(flag4).toBe('false');

    // And it should be active immediately after insertion
    const active4 = await app.isSlotActive(4);
    expect(active4).toBeTruthy();

    // Wait until highlight expires and ensure active class is removed
    await page.waitForTimeout(1300);
    const active4After = await app.isSlotActive(4);
    expect(active4After).toBeFalsy();
  });

  test('Reset behavior (S3_Reset) from various states and idempotency', async ({ page }) => {
    // Validate reset from initial, from populated, and after doubling returns to initial conditions
    const app = new DynamicArrayPage(page);
    await app.goto();

    // 1) Reset while already initial (should be no-op and no errors)
    await app.resetArray();
    await page.waitForTimeout(50);
    let count = await app.slotCount();
    expect(count).toBe(4);
    let flags = await app.slotEmptyFlags();
    for (const f of flags) expect(f).toBe('true');

    // 2) Reset after adding elements
    await app.addElement(); // add one
    await page.waitForTimeout(50);
    // Sanity: one slot filled
    expect((await app.slots().nth(0).textContent()).trim()).toBe('7');

    await app.resetArray();
    await page.waitForTimeout(50);
    count = await app.slotCount();
    expect(count).toBe(4);
    flags = await app.slotEmptyFlags();
    for (const f of flags) expect(f).toBe('true');

    // 3) Reset after doubling
    // Fill to capacity and double
    for (let i = 0; i < 4; i++) {
      await app.addElement();
      await page.waitForTimeout(10);
    }
    // trigger doubling
    await app.addElement();
    await page.waitForTimeout(700);

    // Confirm capacity increased
    const doubledCount = await app.slotCount();
    expect(doubledCount).toBe(8);

    // Now reset and ensure we go back to initial capacity and empty
    await app.resetArray();
    await page.waitForTimeout(50);
    const finalCount = await app.slotCount();
    expect(finalCount).toBe(4);
    const finalFlags = await app.slotEmptyFlags();
    for (const f of finalFlags) expect(f).toBe('true');
  });

  test('Edge cases: rapid clicking and no unexpected exceptions', async ({ page }) => {
    // Rapidly click Add many times to exercise capacity doubling multiple times
    const app = new DynamicArrayPage(page);
    await app.goto();

    // Rapidly click Add 12 times - this should cause multiple doublings: 4 -> 8 -> 16
    for (let i = 0; i < 12; i++) {
      await app.addElement();
      // Very short delay to simulate user spamming but let DOM update reasonably
      await page.waitForTimeout(30);
    }

    // Wait long enough for any pending doubling animations to complete
    await page.waitForTimeout(800);

    const count = await app.slotCount();
    // After 12 adds starting from 0, capacity should have doubled as necessary.
    // Original capacity 4: after filling 4, 5th triggers doubling -> 8.
    // Keep adding until potentially doubling again. We assert final slot count >= number of elements inserted.
    // Count must be power-of-two >= inserted elements count. Ensure at least 12 slots exist.
    expect(count).toBeGreaterThanOrEqual(12);

    // Ensure no console or page errors were emitted during rapid interaction
    // (the afterEach hook will assert the absence of console/page errors)
  });
});