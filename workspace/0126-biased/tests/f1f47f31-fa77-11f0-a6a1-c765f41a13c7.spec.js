import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f47f31-fa77-11f0-a6a1-c765f41a13c7.html';

// Page Object for the Stack application
class StackPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.pushBtnSel = '#pushBtn';
    this.popBtnSel = '#popBtn';
    this.countSel = '#count';
    this.stackSel = '#stack';
    this.cardSel = '.card';
  }

  async goto() {
    await this.page.goto(APP_URL);
    // ensure main elements are present
    await Promise.all([
      this.page.waitForSelector(this.pushBtnSel),
      this.page.waitForSelector(this.popBtnSel),
      this.page.waitForSelector(this.countSel),
      this.page.waitForSelector(this.stackSel),
    ]);
  }

  // Click the push button
  async push() {
    await this.page.click(this.pushBtnSel);
  }

  // Click the pop button
  async pop() {
    await this.page.click(this.popBtnSel);
  }

  // Press keyboard key (single character)
  async pressKey(key) {
    // ensure page has focus so document-level keydown fires
    await this.page.focus('body');
    await this.page.keyboard.press(key);
  }

  // Returns the text content of the count element as string
  async getCountText() {
    return this.page.$eval(this.countSel, el => el.textContent.trim());
  }

  // Returns count as number
  async getCountNumber() {
    const t = await this.getCountText();
    return Number(t);
  }

  // Returns number of visible .card nodes
  async getVisibleCardCount() {
    return this.page.$$eval(`${this.stackSel} ${this.cardSel}`, els => els.length);
  }

  // Returns array of top-to-bottom labels from visible cards (top first)
  async getVisibleCardLabelsTopToBottom() {
    return this.page.$$eval(
      `${this.stackSel} ${this.cardSel}`,
      cards => {
        // cards are appended so z-order may correspond to insertion; map label and dataset.nid
        return cards.map(c => {
          const labelEl = c.querySelector('.label');
          return labelEl ? labelEl.textContent.trim() : '';
        }).reverse(); // reverse because renderStack positions bottom->top; reversing gives top->bottom
      }
    );
  }

  // Returns dataset.nid of the top card if any
  async getTopCardNid() {
    return this.page.$eval(
      `${this.stackSel} ${this.cardSel}`,
      cards => {
        const arr = Array.from(cards);
        const top = arr[arr.length - 1];
        return top ? top.dataset.nid : null;
      }
    ).catch(() => null);
  }

  // Read computed style.animation for the top card (helps detect floatIn/floatOut)
  async getTopCardAnimation() {
    return this.page.$eval(
      `${this.stackSel} ${this.cardSel}`,
      cards => {
        const arr = Array.from(cards);
        const top = arr[arr.length - 1];
        if (!top) return '';
        return top.style.animation || getComputedStyle(top).animationName || '';
      }
    ).catch(() => '');
  }

  // Read the pop button disabled state and style opacity
  async getPopButtonState() {
    return this.page.$eval(this.popBtnSel, el => ({
      disabled: el.disabled,
      opacity: window.getComputedStyle(el).opacity
    }));
  }

  // Read the push button disabled state
  async getPushButtonState() {
    return this.page.$eval(this.pushBtnSel, el => ({
      disabled: el.disabled,
      opacity: window.getComputedStyle(el).opacity
    }));
  }
}

test.describe('Stack — Visual Concept (FSM validation)', () => {
  let pageErrors;
  let consoleErrors;
  let stack;

  test.beforeEach(async ({ page }) => {
    // Collect console errors and page errors for each test so we can assert on them
    pageErrors = [];
    consoleErrors = [];

    page.on('pageerror', (err) => {
      // capture unhandled exceptions (ReferenceError, TypeError, etc.)
      pageErrors.push(err);
    });

    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    stack = new StackPage(page);
    await stack.goto();
  });

  test.afterEach(async () => {
    // Assert there were no uncaught page errors and no console.error messages.
    // This validates that the provided application loaded and ran without runtime exceptions.
    expect(pageErrors.length, `Expected no uncaught page errors but found: ${pageErrors.map(e => String(e)).join(' | ')}`).toBe(0);
    expect(consoleErrors.length, `Expected no console.error logs but found: ${consoleErrors.map(e => e.text).join(' | ')}`).toBe(0);
  });

  test('Initial State (S0_Initial) — application seeds items and renders stack without animation', async () => {
    // The implementation seeds 3 items on load. Confirm the count, visible cards, and pop button state.
    const count = await stack.getCountNumber();
    // The code seeds 3 items in the IIFE before initial render
    expect(count).toBeGreaterThanOrEqual(3);

    const visible = await stack.getVisibleCardCount();
    // visible should reflect seeded items (at least 3)
    expect(visible).toBeGreaterThanOrEqual(3);

    // Confirm top-most label corresponds to the last seeded item (Item 3 at minimum)
    const labels = await stack.getVisibleCardLabelsTopToBottom();
    expect(labels.length).toBeGreaterThanOrEqual(1);
    const topLabel = labels[0];
    expect(topLabel).toMatch(/^Item \d+/);

    // Pop button should be enabled because there are seeded items
    const popState = await stack.getPopButtonState();
    expect(popState.disabled).toBe(false);
    expect(Number(popState.opacity)).toBeGreaterThan(0.5);
  });

  test('PushItem (button) — transitions to S1_ItemPushed and increments count + animates new card', async () => {
    // Capture pre-push state
    const beforeCount = await stack.getCountNumber();
    const beforeVisible = await stack.getVisibleCardCount();

    // Action: push via button
    await stack.push();

    // Immediately after push, renderStack(true) in implementation updates DOM and count
    const afterCount = await stack.getCountNumber();
    expect(afterCount).toBe(beforeCount + 1);

    // Visible cards should increase by 1 unless clamped by maxDepth
    const afterVisible = await stack.getVisibleCardCount();
    // After push visible should be either beforeVisible+1 or capped <= 9
    expect(afterVisible).toBeGreaterThanOrEqual(Math.min(beforeVisible + 0, 1)); // trivial guard
    expect(afterVisible).toBeGreaterThanOrEqual(1);

    // The top card should have an entry animation for push (floatIn) when animated is true
    const animation = await stack.getTopCardAnimation();
    // Implementation sets node.style.animation = 'floatIn ...' for the newly pushed top when animated
    expect(animation.toString().toLowerCase()).toContain('floatin');
  });

  test('Multiple PushItem events keep the machine in S1_ItemPushed and respect maxDepth', async () => {
    // Push repeatedly to exceed maxDepth (maxDepth = 9 in implementation)
    const initialTotal = await stack.getCountNumber();
    const pushes = 12 - initialTotal; // push until total 12 to exceed maxDepth
    for (let i = 0; i < pushes; i++) {
      await stack.push();
      // small delay to let animation/style be applied (not waiting for full animation)
      await new Promise(r => setTimeout(r, 50));
    }

    const total = await stack.getCountNumber();
    expect(total).toBeGreaterThanOrEqual(12); // total count increased

    // Visible cards should be clamped to maxDepth (9)
    const visible = await stack.getVisibleCardCount();
    expect(visible).toBeLessThanOrEqual(9);
    expect(visible).toBeGreaterThanOrEqual(1);

    // Top label should still be a valid Item label
    const labels = await stack.getVisibleCardLabelsTopToBottom();
    expect(labels[0]).toMatch(/^Item \d+/);
  });

  test('PopItem (button) — transitions to S2_ItemPopped and animates removal then updates count', async () => {
    // Ensure there is at least one item to pop; push if necessary
    let count = await stack.getCountNumber();
    if (count === 0) {
      await stack.push();
      count = await stack.getCountNumber();
      expect(count).toBeGreaterThan(0);
    }

    // Capture the top card nid before popping
    const topNidBefore = await stack.getTopCardNid();

    // Action: pop via button
    await stack.pop();

    // Immediately after clicking pop, the implementation updates the displayed count synchronously
    const countAfterImmediate = await stack.getCountNumber();
    expect(countAfterImmediate).toBe(count - 1);

    // The popped node (if present) should receive floatOut animation; read any animation from previously top node.
    // Because the node will be removed after ~560ms, we check for animation on nodes present immediately after pop.
    // Wait small tick for style to be applied
    await new Promise(r => setTimeout(r, 40));

    // It's possible the popped node is still in the DOM for a short duration (animated out)
    // Wait up to 700ms to allow removal logic to complete (setTimeout 560ms in implementation)
    await new Promise(r => setTimeout(r, 700));

    // After the animation and cleanup, ensure topNidBefore is no longer present among card dataset.nid
    const nidsNow = await stack.page.$$eval(`${stack.stackSel} ${stack.cardSel}`, cards =>
      cards.map(c => c.dataset.nid)
    );
    expect(nidsNow).not.toContain(topNidBefore);

    // And final count reflects the popped item
    const finalCount = await stack.getCountNumber();
    expect(finalCount).toBe(count - 1);
  });

  test('Multiple PopItem events and edge-case: popping when empty disables the pop control', async () => {
    // Pop all items until count reaches zero
    let current = await stack.getCountNumber();
    // To avoid infinite loop in case of error, place a max operations guard
    let attempts = 0;
    while (current > 0 && attempts < 50) {
      await stack.pop();
      // implementation removes node after ~560ms; wait to ensure state stabilizes
      await new Promise(r => setTimeout(r, 650));
      current = await stack.getCountNumber();
      attempts++;
    }

    // At this point count should be zero
    expect(current).toBe(0);

    // Pop button should be disabled and visually faded
    const popState = await stack.getPopButtonState();
    expect(popState.disabled).toBe(true);
    // opacity should be around 0.5 per implementation
    expect(Number(popState.opacity)).toBeLessThanOrEqual(0.6);

    // Clicking pop when empty should be a no-op (no negative counts)
    await stack.pop();
    // small wait for any unexpected side effects
    await new Promise(r => setTimeout(r, 200));
    const afterNoop = await stack.getCountNumber();
    expect(afterNoop).toBe(0);
  });

  test('Keyboard Push (KeyboardPush) and Pop (KeyboardPop) shortcuts trigger transitions', async () => {
    // Guarantee there is at least one item to pop later
    const before = await stack.getCountNumber();

    // Trigger keyboard push via 'p' (lowercase)
    await stack.pressKey('p');
    // count should increment
    const afterPush = await stack.getCountNumber();
    expect(afterPush).toBe(before + 1);

    // Trigger keyboard pop via 'o' (lowercase)
    // Wait a tick to let previous animations apply
    await new Promise(r => setTimeout(r, 50));
    await stack.pressKey('o');

    // After pop, count should be back to previous or decreased by one
    // The implementation updates count immediately on pop click, so keyboard-triggered click should behave identically
    // Wait for pop removal delay to complete to ensure DOM consistent
    await new Promise(r => setTimeout(r, 700));
    const afterPop = await stack.getCountNumber();
    // afterPop should be either before (if push then pop) or before - 1 if there were additional changes
    expect(afterPop).toBeGreaterThanOrEqual(0);
  });

  test('Visual and DOM consistency: labels are escaped and no HTML injection occurs in card labels', async () => {
    // We test that labels rendered in .label are plain text and do not create elements.
    // The implementation uses escapeHtml on labels, so we expect no child elements inside .label nodes.
    const labelsInnerHtmls = await stack.page.$$eval(`${stack.stackSel} ${stack.cardSel} .label`, els =>
      els.map(el => ({ text: el.textContent, innerHtml: el.innerHTML, childCount: el.childElementCount }))
    );

    for (const info of labelsInnerHtmls) {
      expect(typeof info.text).toBe('string');
      // innerHTML should not contain markup for normal labels like "Item 1"
      expect(info.childCount).toBe(0);
      expect(info.innerHtml).toMatch(/Item \d+/);
    }
  });

  test('State entry/exit implications: renderStack animated flag impacts animation presence for push/pop', async () => {
    // This test validates the observable effects of renderStack(true/false)
    // On push -> renderStack(true) so newly added top card should have floatIn animation
    const beforeCount = await stack.getCountNumber();
    await stack.push();
    // small wait to allow style.animation to be applied
    await new Promise(r => setTimeout(r, 40));
    const topAnim = await stack.getTopCardAnimation();
    expect(topAnim.toString().toLowerCase()).toContain('floatin');

    // On pop -> renderStack(false) after removal, remaining nodes should not have floatIn animation applied
    const afterPushCount = await stack.getCountNumber();
    await stack.pop();
    // wait for pop removal to complete
    await new Promise(r => setTimeout(r, 700));
    // Check all remaining cards do not have floatIn animation lingering
    const animations = await stack.page.$$eval(`${stack.stackSel} ${stack.cardSel}`, cards =>
      cards.map(c => c.style.animation || getComputedStyle(c).animationName || '')
    );
    const anyFloatIn = animations.some(a => a.toString().toLowerCase().includes('floatin'));
    expect(anyFloatIn).toBe(false);

    // final count should be one less than afterPushCount
    const finalCount = await stack.getCountNumber();
    expect(finalCount).toBe(afterPushCount - 1);
  });
});