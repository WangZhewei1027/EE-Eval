import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3d4b141-fa73-11f0-83e0-8d7be1d51901.html';

// Page object encapsulating interactions and queries for the Queue demo
class QueuePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.valueInput = page.locator('#valueInput');
    this.enqueueBtn = page.locator('#enqueueBtn');
    this.dequeueBtn = page.locator('#dequeueBtn');
    this.peekBtn = page.locator('#peekBtn');
    this.clearBtn = page.locator('#clearBtn');
    this.randomBtn = page.locator('#randomBtn');
    this.sizePill = page.locator('#sizePill');
    this.peekPill = page.locator('#peekPill');
    this.queueWrap = page.locator('#queueWrap');
    this.toast = page.locator('#toast');
  }

  // Enqueue via UI: fill input and click enqueue
  async enqueue(value) {
    await this.valueInput.fill(value);
    await this.enqueueBtn.click();
    // animation + toast: wait for the toast message to contain Enqueued
    await this.waitForToastContains('Enqueued:');
    // small stabilization wait for DOM changes
    await this.page.waitForTimeout(50);
  }

  // Enqueue by pressing Enter in the input
  async enqueueViaEnter(value) {
    await this.valueInput.fill(value);
    await this.valueInput.press('Enter');
    await this.waitForToastContains('Enqueued:');
    await this.page.waitForTimeout(50);
  }

  // Click Random
  async clickRandom() {
    await this.randomBtn.click();
    await this.waitForToastContains('Enqueued:');
    await this.page.waitForTimeout(50);
  }

  // Click Dequeue and wait for the 'Dequeued:' toast (animation uses ~320ms)
  async clickDequeue() {
    await this.dequeueBtn.click();
    await this.waitForToastContains('Dequeued:');
    await this.page.waitForTimeout(50);
  }

  // Click Peek, returns toast content (either 'Queue is empty' or 'Peek: ...')
  async clickPeek() {
    await this.peekBtn.click();
    await this.waitForToastVisible();
    return this.getToastText();
  }

  // Click Clear and wait for toast
  async clickClear() {
    await this.clearBtn.click();
    await this.waitForToastContains('Queue cleared');
    await this.page.waitForTimeout(50);
  }

  // Wait until toast contains specific substring
  async waitForToastContains(substring, timeout = 2000) {
    await this.page.waitForFunction(
      (sel, s) => {
        const el = document.querySelector(sel);
        return el && el.style.display !== 'none' && el.textContent.includes(s);
      },
      '#toast',
      substring,
      { timeout }
    );
  }

  // Wait for toast visible (any text)
  async waitForToastVisible(timeout = 2000) {
    await this.page.waitForFunction(
      (sel) => {
        const el = document.querySelector(sel);
        return el && el.style.display !== 'none' && (el.textContent || '').trim().length > 0;
      },
      '#toast',
      { timeout }
    );
  }

  // Return toast text content
  async getToastText() {
    return (await this.toast.textContent())?.trim() ?? '';
  }

  // Get size pill text
  async getSizeText() {
    return (await this.sizePill.textContent())?.trim() ?? '';
  }

  // Get peek pill text
  async getPeekPillText() {
    return (await this.peekPill.textContent())?.trim() ?? '';
  }

  // Count nodes in visualization (elements with class .node)
  async getNodeCount() {
    return await this.page.locator('#queueWrap .node').count();
  }

  // Get the text of the front node (index 0) if present
  async getFrontNodeText() {
    const nodes = this.page.locator('#queueWrap .node');
    if ((await nodes.count()) === 0) return null;
    return (await nodes.nth(0).textContent())?.trim() ?? null;
  }

  // Get whether dequeue/peek/clear buttons are disabled
  async isDequeueDisabled() {
    return await this.dequeueBtn.isDisabled();
  }
  async isPeekDisabled() {
    return await this.peekBtn.isDisabled();
  }
  async isClearDisabled() {
    return await this.clearBtn.isDisabled();
  }
}

test.describe('Queue Demonstration (FSM validation)', () => {
  // capture page errors and console errors per test
  test.beforeEach(async ({ page }) => {
    // no-op here; actual listeners added per-test to isolate arrays
  });

  // Test initial Idle state (S0_Idle)
  test('S0_Idle: initial render shows empty queue and disabled controls', async ({ page }) => {
    // capture console errors & page errors
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', e => pageErrors.push(String(e)));

    await page.goto(APP_URL);
    await page.waitForLoadState('networkidle');

    const qp = new QueuePage(page);

    // Verify the visualization shows an empty note
    await expect(qp.queueWrap).toContainText('Queue is empty. Enqueue an item to get started.');

    // Size and peek pills reflect empty queue
    await expect(qp.sizePill).toHaveText('Size: 0');
    await expect(qp.peekPill).toHaveText('Peek: —');

    // Dequeue/Peek/Clear should be disabled when empty
    expect(await qp.isDequeueDisabled()).toBe(true);
    expect(await qp.isPeekDisabled()).toBe(true);
    expect(await qp.isClearDisabled()).toBe(true);

    // Assert there were no uncaught page errors or console.error messages
    expect(pageErrors).toHaveLength(0);
    expect(consoleErrors).toHaveLength(0);
  });

  // Test enqueue actions including S1_Enqueued and InputEnter transition
  test('S1_Enqueued: enqueue via button, via Enter key, and via Random; state updates and toasts', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', e => pageErrors.push(String(e)));

    await page.goto(APP_URL);
    await page.waitForLoadState('networkidle');
    const qp = new QueuePage(page);

    // Enqueue via button
    await qp.enqueue('alpha');
    expect(await qp.getSizeText()).toBe('Size: 1');
    expect(await qp.getPeekPillText()).toBe('Peek: alpha');
    expect(await qp.getNodeCount()).toBe(1);
    expect(await qp.getFrontNodeText()).toContain('alpha');
    // toast should have last message 'Enqueued: alpha'
    expect((await qp.getToastText()).startsWith('Enqueued:')).toBe(true);

    // Enqueue via Enter key (transition S1_Enqueued -> S0_Idle per FSM)
    await qp.enqueueViaEnter('beta');
    expect(await qp.getSizeText()).toBe('Size: 2');
    expect(await qp.getPeekPillText()).toBe('Peek: alpha'); // front remains 'alpha'
    expect(await qp.getNodeCount()).toBe(2);

    // Enqueue via Random button: we can't know exact value, but queue size should increase and toast prefix should be 'Enqueued:'
    const prevCount = await qp.getNodeCount();
    await qp.clickRandom();
    const newCount = await qp.getNodeCount();
    expect(newCount).toBeGreaterThanOrEqual(prevCount + 1);

    // No unexpected console or page errors
    expect(pageErrors).toHaveLength(0);
    expect(consoleErrors).toHaveLength(0);
  });

  // Test peek behavior (S3_Peeked) for both empty and non-empty queues
  test('S3_Peeked: peek on empty displays queue-empty toast; peek on non-empty shows front', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', e => pageErrors.push(String(e)));

    await page.goto(APP_URL);
    await page.waitForLoadState('networkidle');
    const qp = new QueuePage(page);

    // Peek when empty -> 'Queue is empty' toast
    await qp.peekBtn.click();
    await qp.waitForToastContains('Queue is empty');
    expect(await qp.getToastText()).toContain('Queue is empty');

    // Enqueue a known value, then peek -> 'Peek: value'
    await qp.enqueue('peekVal');
    await qp.peekBtn.click();
    await qp.waitForToastContains('Peek:');
    const toastText = await qp.getToastText();
    expect(toastText).toContain('Peek: peekVal');

    // No unexpected errors
    expect(pageErrors).toHaveLength(0);
    expect(consoleErrors).toHaveLength(0);
  });

  // Test dequeue behavior (S2_Dequeued) including Delete key shortcut
  test('S2_Dequeued: dequeue removes front element and updates visualization; Delete key triggers dequeue', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', e => pageErrors.push(String(e)));

    await page.goto(APP_URL);
    await page.waitForLoadState('networkidle');
    const qp = new QueuePage(page);

    // Prepare queue with three items
    await qp.enqueue('one');
    await qp.enqueue('two');
    await qp.enqueue('three');
    expect(await qp.getSizeText()).toBe('Size: 3');
    expect(await qp.getFrontNodeText()).toContain('one');

    // Click Dequeue (animation ~320ms). After completion, size should be 2 and front should be 'two'
    await qp.clickDequeue();
    // Allow small buffer after toast detection
    await page.waitForTimeout(40);
    expect(await qp.getSizeText()).toBe('Size: 2');
    expect(await qp.getFrontNodeText()).toContain('two');

    // Use Delete key to trigger another dequeue (document listener handles this)
    await page.keyboard.press('Delete');
    // Wait for Dequeued toast
    await qp.waitForToastContains('Dequeued:');
    await page.waitForTimeout(40);

    expect(await qp.getSizeText()).toBe('Size: 1');
    expect(await qp.getFrontNodeText()).toContain('three');

    // Dequeue until empty, then attempt another dequeue and expect 'Queue is empty' toast
    await qp.clickDequeue(); // removes 'three'
    await page.waitForTimeout(50);
    expect(await qp.getSizeText()).toBe('Size: 0');
    // Now click dequeue again - should present 'Queue is empty' toast immediately
    await qp.dequeueBtn.click();
    await qp.waitForToastContains('Queue is empty');
    expect((await qp.getToastText()).toContain('Queue is empty')).toBe(true);

    // No unexpected errors
    expect(pageErrors).toHaveLength(0);
    expect(consoleErrors).toHaveLength(0);
  });

  // Test clear behavior (S4_Cleared) and that it returns to Idle (S0_Idle)
  test('S4_Cleared: clear empties the queue and shows toast; buttons disabled afterward', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', e => pageErrors.push(String(e)));

    await page.goto(APP_URL);
    await page.waitForLoadState('networkidle');
    const qp = new QueuePage(page);

    // Enqueue some items
    await qp.enqueue('a');
    await qp.enqueue('b');
    expect(await qp.getSizeText()).toBe('Size: 2');

    // Click clear
    await qp.clickClear();
    // After clear, size 0 and empty note displayed
    expect(await qp.getSizeText()).toBe('Size: 0');
    await expect(qp.queueWrap).toContainText('Queue is empty. Enqueue an item to get started.');

    // Buttons that should be disabled in Idle
    expect(await qp.isDequeueDisabled()).toBe(true);
    expect(await qp.isPeekDisabled()).toBe(true);
    expect(await qp.isClearDisabled()).toBe(true);

    // No unexpected errors
    expect(pageErrors).toHaveLength(0);
    expect(consoleErrors).toHaveLength(0);
  });

  // Edge cases and accessibility / keyboard shortcuts
  test('Edge cases: enqueuing empty input shows warning; Ctrl+E focuses input', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', e => pageErrors.push(String(e)));

    await page.goto(APP_URL);
    await page.waitForLoadState('networkidle');
    const qp = new QueuePage(page);

    // Attempt to enqueue empty string -> toast 'Enter a value to enqueue' and input focused
    await qp.valueInput.fill('   ');
    await qp.enqueueBtn.click();
    await qp.waitForToastContains('Enter a value to enqueue');
    expect((await qp.getToastText()).toContain('Enter a value to enqueue')).toBe(true);

    // Ensure input is focused after invalid enqueue attempt (UI code calls valueInput.focus())
    const active = await page.evaluate(() => document.activeElement?.id || null);
    expect(active).toBe('valueInput');

    // Test keyboard shortcut Ctrl+E focuses the input
    // Use direct keyboard press for Control+e
    await page.keyboard.press('Control+e');
    const active2 = await page.evaluate(() => document.activeElement?.id || null);
    expect(active2).toBe('valueInput');

    // No unexpected errors
    expect(pageErrors).toHaveLength(0);
    expect(consoleErrors).toHaveLength(0);
  });

  // Comprehensive flow: exercise many transitions in sequence to validate FSM coverage
  test('Comprehensive flow: exercise all transitions and state entries/exits', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    const consoleMessages = [];
    page.on('console', msg => {
      // collect all console messages for inspection
      consoleMessages.push({type: msg.type(), text: msg.text()});
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', e => pageErrors.push(String(e)));

    await page.goto(APP_URL);
    await page.waitForLoadState('networkidle');
    const qp = new QueuePage(page);

    // Start Idle (S0), Enqueue twice (S1)
    await qp.enqueue('first');
    await qp.enqueue('second');

    // Peek (S3)
    await qp.peekBtn.click();
    await qp.waitForToastContains('Peek:');

    // Dequeue (S2) twice to return to Idle
    await qp.clickDequeue();
    await qp.clickDequeue();
    // Should now be empty and back to Idle
    expect(await qp.getSizeText()).toBe('Size: 0');
    await expect(qp.queueWrap).toContainText('Queue is empty. Enqueue an item to get started.');

    // Random enqueue (S1)
    await qp.clickRandom();
    expect((await qp.getToastText()).startsWith('Enqueued:')).toBeTruthy();
    // Clear (S4)
    await qp.clickClear();
    expect(await qp.getSizeText()).toBe('Size: 0');

    // Ensure expected visual updates happened across the flow
    expect(await qp.getNodeCount()).toBe(0);

    // No uncaught exceptions during the comprehensive flow
    expect(pageErrors).toHaveLength(0);
    expect(consoleErrors).toHaveLength(0);

    // Optionally assert we saw expected toast messages in consoleMessages or toast flow
    const toastMsgs = consoleMessages.filter(m => m.type === 'error');
    // Ensure there were no console.error messages
    expect(toastMsgs.length).toBe(0);
  });
});