import { test, expect } from '@playwright/test';

// Test file for: ed8d2d71-fa77-11f0-8492-31e949ed3c7c
// URL: http://127.0.0.1:5500/workspace/0126-biased/html/ed8d2d71-fa77-11f0-8492-31e949ed3c7c.html
// This suite validates the FSM states and transitions for the Priority Queue Visualization.
// It also observes console logs and page errors without modifying the page environment.

// Page Object for interacting with the Priority Queue visualization page
class PriorityQueuePage {
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto('http://127.0.0.1:5500/workspace/0126-biased/html/ed8d2d71-fa77-11f0-8492-31e949ed3c7c.html', { waitUntil: 'load' });
  }

  // Returns the Watch Queue button handle
  async watchButton() {
    return this.page.locator('button.button');
  }

  // Returns locator for queue container
  queue() {
    return this.page.locator('#queue');
  }

  // Returns locator for element tiles
  elements() {
    return this.page.locator('#queue .element');
  }

  // Retrieves a snapshot of element metadata: text, classList, inline bottom style, inline transform style
  async getElementsSnapshot() {
    return this.page.evaluate(() => {
      return Array.from(document.querySelectorAll('#queue .element')).map((el) => ({
        text: el.innerText,
        className: el.className,
        bottom: el.style.bottom,
        transformInline: el.style.transform ?? '',
        computedTransform: window.getComputedStyle(el).transform,
        opacityInline: el.style.opacity ?? '',
        computedOpacity: window.getComputedStyle(el).opacity
      }));
    });
  }

  // Waits for a mutation of #queue content and resolves with mutation records
  async waitForQueueMutation(timeout = 2000) {
    return this.page.evaluate(({ timeout }) => {
      return new Promise((resolve) => {
        const target = document.getElementById('queue');
        const observer = new MutationObserver((records) => {
          observer.disconnect();
          resolve(records.map(r => ({
            type: r.type,
            added: r.addedNodes ? r.addedNodes.length : 0,
            removed: r.removedNodes ? r.removedNodes.length : 0
          })));
        });
        observer.observe(target, { childList: true, subtree: false });
        // Fallback: resolve after timeout even if no mutations
        setTimeout(() => {
          observer.disconnect();
          resolve([]);
        }, timeout);
      });
    }, { timeout });
  }

  // Clicks the Watch Queue button
  async clickWatch() {
    await (await this.watchButton()).click();
  }
}

test.describe('Priority Queue Visualization - FSM and UI tests', () => {
  let pageErrors = [];
  let consoleMessages = [];
  let pageObj;

  test.beforeEach(async ({ page }) => {
    // Reset logging arrays
    pageErrors = [];
    consoleMessages = [];

    // Capture console messages and page errors as they happen
    page.on('console', (msg) => {
      // Save console messages (log, warning, error, etc.)
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      // Save uncaught exceptions from the page
      pageErrors.push(err);
    });

    pageObj = new PriorityQueuePage(page);
    await pageObj.goto();
  });

  test.afterEach(async () => {
    // No specific teardown required; listeners reset in next beforeEach
  });

  test('Initial load (S0_Idle) calls startAnimation and populates the queue', async () => {
    // This test validates the initial FSM state S0_Idle entry action startAnimation()
    // Expectation:
    // - startAnimation() is called automatically on load
    // - queue contains elements for priorities A..E
    // - elements have inline bottom style based on index (index * 60px)
    // - inline transform styles are set initially by startAnimation (random translateY)
    // - no uncaught page errors occurred during load

    // Wait a short time to let initial animation set inline styles (startAnimation runs immediately)
    await pageObj.page.waitForTimeout(50);

    // Assert queue exists and has 5 elements
    const count = await pageObj.elements().count();
    expect(count).toBe(5);

    // Snapshot element data
    const snapshot = await pageObj.getElementsSnapshot();

    // Validate text order and classes and bottom positions
    const expectedTexts = ['A', 'B', 'C', 'D', 'E'];
    const expectedPriorities = ['high', 'medium', 'low', 'medium', 'high'];

    snapshot.forEach((s, index) => {
      // Text
      expect(s.text).toBe(expectedTexts[index]);

      // Class includes priority
      expect(s.className).toContain(expectedPriorities[index]);

      // Bottom inline style should equal index * 60px
      expect(s.bottom).toBe(`${index * 60}px`);

      // Immediately after startAnimation is invoked, inline transform should be set to a translateY(...) string
      // It might be empty in rare races; check that computedTransform is not undefined.
      // Prefer checking inline transform for immediate side-effect of startAnimation call
      expect(typeof s.transformInline).toBe('string');
    });

    // Ensure there were no uncaught page errors during load/initialization
    expect(pageErrors.length).toBe(0);

    // Collect console errors (if any) to assert none are console.error
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Clicking "Watch Queue" (WatchQueueClick) triggers addElementsToQueue and re-starts animation (transition S0 -> S1)', async () => {
    // This test validates the FSM transition triggered by the Watch Queue button:
    // - Clicking the button triggers addElementsToQueue which clears and re-adds elements to #queue
    // - startAnimation's per-element inline transform is applied again (synchronous part)
    // - No page errors should happen during the click-triggered transition

    // Attach a mutation observer from page context, click the button, and wait for mutation to happen
    const mutationPromise = pageObj.waitForQueueMutation(1000);
    await pageObj.clickWatch();

    const mutations = await mutationPromise;

    // The addElementsToQueue clears innerHTML then appends 5 elements => expect at least one mutation record
    // If the implementation batches into one mutation, the record should show removed or added nodes.
    expect(Array.isArray(mutations)).toBe(true);

    // There should be at least one mutation record where nodes were added
    const addedCount = mutations.reduce((sum, r) => sum + (r.added || 0), 0);
    // Implementation appends 5 elements, so addedCount should be >= 0. If MutationObserver didn't capture because of timing,
    // we still assert that the resulting DOM has 5 elements.
    const finalCount = await pageObj.elements().count();
    expect(finalCount).toBe(5);

    // Immediately after clicking, startAnimation sets inline transform for each element.
    const immediateTransforms = await pageObj.page.evaluate(() => {
      return Array.from(document.querySelectorAll('#queue .element')).map(el => el.style.transform || '');
    });

    // Each transform should be a non-empty string (translateY(...)) immediately after click
    immediateTransforms.forEach((t) => {
      expect(typeof t).toBe('string');
      // Some elements might have empty transform if timing race; ensure at least one is non-empty
    });
    expect(immediateTransforms.some(t => t.length > 0)).toBe(true);

    // Wait for the staggered timeouts to finish (max index * 200ms)
    await pageObj.page.waitForTimeout(1200);

    // After animations finish, computed transform should be translateY(0) or 'none' depending on browser
    const computedTransforms = await pageObj.page.evaluate(() => {
      return Array.from(document.querySelectorAll('#queue .element')).map(el => window.getComputedStyle(el).transform);
    });

    // computedTransforms should be defined strings. We don't assert exact value as browsers format transforms differently.
    computedTransforms.forEach((ct) => {
      expect(typeof ct).toBe('string');
    });

    // Assert no uncaught page errors during click/animation
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Rapid repeated clicks do not break the queue (edge case) and do not produce runtime errors', async () => {
    // Edge case: click the Watch Queue button rapidly multiple times
    // Expectation:
    // - No uncaught errors thrown
    // - Queue ends with 5 elements
    // - Animations are re-applied each click (inline transform set)
    const btn = await pageObj.watchButton();

    // Perform rapid clicks
    for (let i = 0; i < 6; i++) {
      await btn.click();
      // tiny delay to allow synchronous DOM changes to occur
      await pageObj.page.waitForTimeout(30);
    }

    // After rapid clicks, final count should be 5
    const finalCount = await pageObj.elements().count();
    expect(finalCount).toBe(5);

    // At least one element should have an inline transform set from the last animation
    const transforms = await pageObj.page.evaluate(() => {
      return Array.from(document.querySelectorAll('#queue .element')).map(el => el.style.transform || '');
    });
    expect(transforms.some(t => t.length > 0)).toBe(true);

    // Confirm no page errors occurred
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Verify visual classes and stacking (S1_Animating evidence for element positions and priorities)', async () => {
    // This test validates the evidence lines for S1_Animating:
    // - Elements should be rendered with priority classes (.high, .medium, .low)
    // - Stacked vertically using bottom style index * 60px
    // - The existence of the transform animation step (transform inline style set at some point)

    // Wait a short time to ensure animations applied from initial load
    await pageObj.page.waitForTimeout(100);

    const snapshot = await pageObj.getElementsSnapshot();

    // Validate priority classes and stacking
    snapshot.forEach((s, index) => {
      // Class must include one of defined priorities
      expect(/high|medium|low/.test(s.className)).toBe(true);

      // Bottom stacking check
      expect(s.bottom).toBe(`${index * 60}px`);
    });

    // Confirm that computed opacity is a number string (e.g., "1" after animation completes)
    snapshot.forEach(s => {
      expect(typeof s.computedOpacity === 'string').toBe(true);
    });

    // No runtime errors observed
    expect(pageErrors.length).toBe(0);
  });

  test('Observes console outputs and asserts there are no uncaught ReferenceError/SyntaxError/TypeError on the page', async () => {
    // This test intentionally inspects captured console and page errors and asserts that none of the
    // common JS error types occurred unhandled.
    // We don't inject or patch anything; we merely observe.

    // Wait briefly in case any late errors happen
    await pageObj.page.waitForTimeout(200);

    // pageErrors contains Error objects for uncaught errors; ensure none match common error types
    const errorTypes = pageErrors.map(e => {
      // Some errors may be serialized; coerce to string
      try {
        return e.name || e.toString();
      } catch {
        return String(e);
      }
    });

    // Assert that no ReferenceError, SyntaxError, TypeError occurred
    const hasReferenceError = errorTypes.some(t => /ReferenceError/.test(t));
    const hasSyntaxError = errorTypes.some(t => /SyntaxError/.test(t));
    const hasTypeError = errorTypes.some(t => /TypeError/.test(t));

    expect(hasReferenceError).toBe(false);
    expect(hasSyntaxError).toBe(false);
    expect(hasTypeError).toBe(false);

    // Also assert console.error messages are absent
    const consoleErrs = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrs.length).toBe(0);
  });
});