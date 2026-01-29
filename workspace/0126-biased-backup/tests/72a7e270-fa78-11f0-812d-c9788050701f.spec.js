import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72a7e270-fa78-11f0-812d-c9788050701f.html';

// Page object to encapsulate common interactions and selectors
class ArrayAppPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.animateBtn = '#animateBtn';
    this.randomizeBtn = '#randomizeBtn';
    this.arrayElements = '.array-element';
    this.particlesContainer = '#particles';
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  async getArrayElementCount() {
    return await this.page.$$eval(this.arrayElements, els => els.length);
  }

  async getParticlesCount() {
    return await this.page.$$eval('#particles .particle', els => els.length);
  }

  async getArrayElementText(index = 0) {
    return await this.page.$eval(
      `${this.arrayElements}:nth-child(${index + 1})`,
      el => el.textContent?.trim() ?? ''
    );
  }

  async hasArrayIndexSpan(index = 0) {
    return await this.page.$eval(
      `${this.arrayElements}:nth-child(${index + 1})`,
      el => !!el.querySelector('.array-index')
    );
  }

  async clickAnimate() {
    await this.page.click(this.animateBtn);
  }

  async clickRandomize() {
    await this.page.click(this.randomizeBtn);
  }

  async waitForFirstElementTransformContains(substring, timeout = 1000) {
    // Wait for inline style.transform on first element to contain substring
    await this.page.waitForFunction(
      (sel, substr) => {
        const el = document.querySelector(sel);
        return el && el.style && el.style.transform && el.style.transform.includes(substr);
      },
      {},
      `${this.arrayElements}:first-child`,
      substring,
      { timeout }
    );
  }
}

test.describe('The Beauty of Arrays - FSM and UI integration tests', () => {
  let app;

  test.beforeEach(async ({ page }) => {
    app = new ArrayAppPage(page);
    // Collect console messages for assertions if needed
    page.context().clearCookies();
    await app.goto();
    // Ensure the main UI elements have been rendered
    await page.waitForSelector('.array-element');
    await page.waitForSelector('#particles');
    await page.waitForSelector('#animateBtn');
    await page.waitForSelector('#randomizeBtn');
  });

  test.describe('Idle state (S0_Idle) - page load and entry actions', () => {
    test('should create background particles on DOMContentLoaded (createParticles called)', async ({ page }) => {
      // This validates the S0 "createParticles" entry action ran on DOMContentLoaded.
      // Depending on viewport width the page creates 20 or 50 particles, ensure at least some were created.
      const particleCount = await app.getParticlesCount();
      // Expect at least 20 particles (mobile/desktop variations); being conservative with >= 20
      expect(particleCount).toBeGreaterThanOrEqual(20);

      // Validate array elements are present and initial content matches expected five elements and indices present
      const count = await app.getArrayElementCount();
      expect(count).toBe(5);

      // Each element initially should contain an index span like [0], [1], ...
      for (let i = 0; i < 5; i++) {
        const hasIndex = await app.hasArrayIndexSpan(i);
        expect(hasIndex).toBe(true);
        const text = await app.getArrayElementText(i);
        // Ensure it's not empty and contains at least one visible character (value or index)
        expect(text.length).toBeGreaterThan(0);
      }
    });
  });

  test.describe('Animating state (S1_Animating) - animateArray behavior', () => {
    test('clicking Animate Array triggers animation transforms on elements', async ({ page }) => {
      // Ensure clicking animate applies transform to elements (rotateY and scale)
      // Also ensure no page-level errors occur during animation
      const errors = [];
      page.on('pageerror', e => errors.push(e));
      const consoleErrors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });

      // Click animate
      await app.clickAnimate();

      // The first element has index 0 and is transformed immediately (index * 200 ms => 0)
      // Wait for transform to include 'rotateY' (occurs synchronously with setTimeout(0) effectively)
      await app.waitForFirstElementTransformContains('rotateY', 1500);

      // Verify that the inline style contains the expected animation transform briefly
      const firstTransform = await page.$eval('.array-element:first-child', el => el.style.transform);
      expect(firstTransform).toContain('rotateY');
      expect(firstTransform).toContain('scale');

      // Allow the animation to complete and revert (the code resets transform after 1000ms)
      await page.waitForTimeout(1200);
      const revertedTransform = await page.$eval('.array-element:first-child', el => el.style.transform);
      // After revert, script sets transform back to 'rotateY(0) scale(1)'
      expect(revertedTransform).toBe('rotateY(0) scale(1)');

      // Ensure no unexpected page errors during animate
      expect(errors.length).toBe(0);
      // Console errors (if any) would be a sign of issues; assert none
      expect(consoleErrors.length).toBe(0);
    });

    test('multiple clicks on Animate Array are tolerated and do not throw page errors', async ({ page }) => {
      const pageErrors = [];
      page.on('pageerror', e => pageErrors.push(e));

      // Rapidly click animate multiple times
      await app.clickAnimate();
      await app.clickAnimate();
      await app.clickAnimate();

      // Wait a bit for all scheduled transforms/timeouts to execute
      await page.waitForTimeout(1500);

      // Expect no page errors from repeated animation calls
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Randomizing state (S2_Randomizing) - randomizeValues behavior and error handling', () => {
    test('clicking Randomize Values triggers randomizeValues and results in a TypeError (as implemented)', async ({ page }) => {
      // This test intentionally allows the runtime error to occur and asserts that it does occur.
      // The application sets el.textContent then immediately reads el.querySelector('.array-index').textContent,
      // which will be null and lead to a TypeError. We must let that happen and assert it is reported.

      // Wait for the first element's initial text to be the known initial value '42' (sanity)
      const initialFirst = await app.getArrayElementText(0);
      expect(initialFirst).toContain('42');

      // Capture the pageerror event which signals uncaught exceptions in the page
      const [error] = await Promise.all([
        page.waitForEvent('pageerror'),
        (async () => {
          // Click the randomize button which (per the provided implementation) will throw a TypeError
          await app.clickRandomize();
        })()
      ]);

      // Validate that an Error object was captured and that it is a TypeError resulting from the broken implementation
      expect(error).toBeDefined();
      // Error.name may or may not be present exactly; message should reflect inability to read properties of null.
      // Assert at least that the message mentions 'textContent' or 'null' or 'Cannot read'
      const msg = error.message || '';
      const lowered = msg.toLowerCase();
      const indicatesTypeError = msg.includes('TypeError') || lowered.includes('cannot read') || lowered.includes('reading') || lowered.includes('textcontent') || lowered.includes('null');
      expect(indicatesTypeError).toBeTruthy();

      // Because the code sets element.textContent before the thrown TypeError,
      // the first .array-element will have had its index span removed (children replaced by textContent).
      // Confirm that the first element no longer contains a .array-index span and its text content changed.
      const hasIndexAfter = await app.hasArrayIndexSpan(0);
      expect(hasIndexAfter).toBe(false);

      const firstTextAfter = await app.getArrayElementText(0);
      // The value should not be the original "42" anymore (randomized to a number or symbol string)
      expect(firstTextAfter).not.toBe(initialFirst);
      expect(firstTextAfter.length).toBeGreaterThan(0);

      // The error was expected; do not rethrow it - the test asserts its presence.
    });

    test('subsequent clicks on Randomize Values also lead to errors (edge case)', async ({ page }) => {
      // First click to cause the initial failure (we capture the first pageerror)
      await app.clickRandomize();
      const firstErr = await page.waitForEvent('pageerror');
      expect(firstErr).toBeDefined();

      // Second click: since the DOM structure may already be altered, the function is still likely to throw again.
      // Capture another pageerror for the second click.
      const secondClickPromise = Promise.all([
        page.waitForEvent('pageerror'),
        app.clickRandomize()
      ]);

      const [, secondErr] = await secondClickPromise;
      expect(secondErr).toBeDefined();

      // At least ensure that the application still contains array elements (should be 5)
      const count = await app.getArrayElementCount();
      expect(count).toBe(5);
    });
  });

  test.describe('Additional validations and edge cases', () => {
    test('initial array element contents match the decorative initial values', async ({ page }) => {
      // Check that initial displayed values correspond to the HTML: [0] 42, [1] π, [2] ∞, [3] ∅, [4] Ω
      // We inspect raw element textContent; the index spans are present and will be included in textContent.
      const texts = [];
      for (let i = 0; i < 5; i++) {
        texts.push(await app.getArrayElementText(i));
      }

      // Validate presence of expected tokens; they may be wrapped with index spans, so do substring checks
      expect(texts[0]).toContain('42');
      expect(texts[1]).toContain('π');
      expect(texts[2]).toContain('∞');
      expect(texts[3]).toContain('∅');
      expect(texts[4]).toContain('Ω');
    });

    test('animate still works after a failed randomize (robustness check)', async ({ page }) => {
      // Trigger the known failing randomize to mutate the DOM and produce an error (we'll wait for the pageerror)
      await app.clickRandomize();
      await page.waitForEvent('pageerror');

      // Now attempt to animate: animation should still apply transforms even if some structure changed.
      const pageErrors = [];
      page.on('pageerror', e => pageErrors.push(e));

      await app.clickAnimate();

      // Wait for first element transform; even if inner structure changed, the element is present and style updated
      await app.waitForFirstElementTransformContains('rotateY', 1500);

      const transform = await page.$eval('.array-element:first-child', el => el.style.transform);
      expect(transform).toContain('rotateY');

      // Ensure no new page errors resulted from animate after the randomize failure
      expect(pageErrors.length).toBe(0);
    });
  });
});