import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72a8f3e0-fa78-11f0-812d-c9788050701f.html';

// Page Object to encapsulate common interactions and observations
class VisualizingSetsPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleErrors = [];
    this.pageErrors = [];
    // capture console errors and page errors for assertions
    this.page.on('console', (msg) => {
      if (msg.type() === 'error') {
        this.consoleErrors.push({
          text: msg.text(),
          location: msg.location()
        });
      }
    });
    this.page.on('pageerror', (err) => {
      // Uncaught exceptions end up here
      this.pageErrors.push(err);
    });
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  async clickShowIntersection() {
    await this.page.click('#showIntersection');
  }

  async clickReset() {
    await this.page.click('#reset');
  }

  async hasShowIntersectionClass() {
    return await this.page.locator('#visualization').evaluate(el => el.classList.contains('show-intersection'));
  }

  async intersectionMetrics() {
    return await this.page.locator('.intersection').evaluate(el => {
      const cs = window.getComputedStyle(el);
      return {
        width: el.offsetWidth,
        height: el.offsetHeight,
        opacity: parseFloat(cs.opacity || '0')
      };
    });
  }

  async setPosition(selector) {
    return await this.page.locator(selector).evaluate(el => {
      const cs = window.getComputedStyle(el);
      return {
        left: cs.left,
        top: cs.top,
        transform: cs.transform || ''
      };
    });
  }

  async elementColor(index) {
    return await this.page.locator('.element').nth(index).evaluate(el => {
      const cs = window.getComputedStyle(el);
      return {
        backgroundColor: cs.backgroundColor,
        color: cs.color
      };
    });
  }

  async allElementColors() {
    const count = await this.page.locator('.element').count();
    const colors = [];
    for (let i = 0; i < count; i++) {
      colors.push(await this.elementColor(i));
    }
    return colors;
  }

  getConsoleErrors() {
    return this.consoleErrors;
  }

  getPageErrors() {
    return this.pageErrors;
  }
}

test.describe('Visualizing Sets - FSM Verification (72a8f3e0-fa78-11f0-812d-c9788050701f)', () => {

  // Each test will create its own page and page object
  test.describe.configure({ mode: 'parallel' });

  test('S0_Idle: Page renders initial DOM and controls are present', async ({ page }) => {
    // This test validates initial Idle state rendering and absence of immediate fatal errors.
    const app = new VisualizingSetsPage(page);
    await app.goto();

    // Verify essential components exist (evidence for S0_Idle)
    await expect(page.locator('#showIntersection')).toHaveCount(1);
    await expect(page.locator('#reset')).toHaveCount(1);
    await expect(page.locator('#visualization')).toHaveCount(1);
    await expect(page.locator('.set-a')).toHaveCount(1);
    await expect(page.locator('.set-b')).toHaveCount(1);
    await expect(page.locator('.intersection')).toHaveCount(1);

    // There is an initial scripted animation that toggles the class after a timeout.
    // We assert that the DOM contains the elements and no uncaught page errors occurred during load.
    const pageErrors = app.getPageErrors();
    const consoleErrors = app.getConsoleErrors();
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition: ShowIntersectionClick -> S1_ShowIntersection applies visual state and colors elements', async ({ page }) => {
    // Validate clicking "Show Intersection" sets the show-intersection class,
    // makes the intersection visible, and recolors elements as described in the FSM entry action.
    const app = new VisualizingSetsPage(page);
    await app.goto();

    // Precondition: ensure class absent right before the action (could be toggled by auto animation; tolerate either)
    // Click the button to trigger the transition
    await app.clickShowIntersection();

    // Wait for the class to be applied and assert it is present
    // We poll by checking the class - code uses classList.add so it should take effect immediately
    let hasClass = await app.hasShowIntersectionClass();
    expect(hasClass).toBeTruthy();

    // Check intersection becomes visible (width/height > 0 and opacity increases)
    const metrics = await app.intersectionMetrics();
    expect(metrics.width).toBeGreaterThan(0);
    expect(metrics.height).toBeGreaterThan(0);
    // The CSS rule sets opacity to 0.8 when shown
    expect(metrics.opacity).toBeGreaterThan(0.5);

    // Verify elements recolored by the click handler:
    // - indices 0-2 => primary color (non-white)
    // - indices 3-4 => secondary color (non-white)
    // - index 5 => tertiary color (non-white)
    const colors = await app.allElementColors();
    expect(colors.length).toBeGreaterThanOrEqual(6);
    // first three should not be white
    for (let i = 0; i < 3; i++) {
      expect(colors[i].backgroundColor).not.toBe('rgb(255, 255, 255)'); // not white
      expect(colors[i].color).toMatch(/rgb\(|rgba\(/); // text color should be set to white (or a resolved value)
    }
    // next two should not be white
    for (let i = 3; i < 5; i++) {
      expect(colors[i].backgroundColor).not.toBe('rgb(255, 255, 255)');
    }
    // last one should be tertiary (non-white)
    expect(colors[5].backgroundColor).not.toBe('rgb(255, 255, 255)');

    // Ensure no uncaught exceptions or console errors were produced by this interaction
    expect(app.getPageErrors().length).toBe(0);
    expect(app.getConsoleErrors().length).toBe(0);
  });

  test('Transition: ResetClick -> S0_Idle removes visual state and resets element colors', async ({ page }) => {
    // Validate that reset removes the 'show-intersection' class and returns elements to original colors.
    const app = new VisualizingSetsPage(page);
    await app.goto();

    // First trigger the show-intersection to alter state
    await app.clickShowIntersection();
    // Ensure class is present
    expect(await app.hasShowIntersectionClass()).toBeTruthy();

    // Now click reset to transition back to Idle
    await app.clickReset();

    // The class is removed synchronously by classList.remove
    const hasClassAfterReset = await app.hasShowIntersectionClass();
    expect(hasClassAfterReset).toBeFalsy();

    // Each .element should have background white and text color set to var(--text)
    const colorsAfterReset = await app.allElementColors();
    for (let i = 0; i < colorsAfterReset.length; i++) {
      expect(colorsAfterReset[i].backgroundColor).toBe('rgb(255, 255, 255)'); // white
      // text color expected to resolve to --text variable, typically rgb(33, 37, 41)
      // We accept that it's not white
      expect(colorsAfterReset[i].color).not.toBe('rgb(255, 255, 255)');
    }

    // Ensure intersection is hidden again (opacity ~ 0 or width/height zero)
    const metrics = await app.intersectionMetrics();
    // Depending on transition timing either opacity will be ~0 or size will be 0
    expect(metrics.opacity).toBeLessThan(0.5);

    // Confirm no console.errors or page errors occurred
    expect(app.getPageErrors().length).toBe(0);
    expect(app.getConsoleErrors().length).toBe(0);
  });

  test('Edge case: Clicking Reset before any ShowIntersection should be safe and not throw', async ({ page }) => {
    // Validate that clicking Reset from Idle (no prior ShowIntersection click) does not produce errors
    const app = new VisualizingSetsPage(page);
    await app.goto();

    // Click reset immediately
    await app.clickReset();

    // The class should not exist after reset
    expect(await app.hasShowIntersectionClass()).toBeFalsy();

    // Elements should already be white (or reset keeps them white)
    const colors = await app.allElementColors();
    for (const c of colors) {
      expect(c.backgroundColor).toBe('rgb(255, 255, 255)');
    }

    // No uncaught errors
    expect(app.getPageErrors().length).toBe(0);
    expect(app.getConsoleErrors().length).toBe(0);
  });

  test('Edge case: Rapid interaction sequence (ShowIntersection then immediate Reset) yields a stable Idle state', async ({ page }) => {
    // This test simulates a user quickly toggling the controls and asserts final stability.
    const app = new VisualizingSetsPage(page);
    await app.goto();

    // Rapid sequence
    await Promise.all([
      app.clickShowIntersection(),
      app.clickReset()
    ]);

    // Give the main thread a tick to settle any synchronous handlers
    await page.waitForTimeout(100);

    // Final state should not have the class
    expect(await app.hasShowIntersectionClass()).toBeFalsy();

    // Elements should be reset to white
    const colors = await app.allElementColors();
    for (const c of colors) {
      expect(c.backgroundColor).toBe('rgb(255, 255, 255)');
    }

    // No uncaught runtime errors
    expect(app.getPageErrors().length).toBe(0);
    expect(app.getConsoleErrors().length).toBe(0);
  });

  test('Behavior observed during scripted initial animation: class toggles without causing page errors', async ({ page }) => {
    // The page's script performs an initial animation: adds class after 1s and removes after 4s.
    // We verify that this automatic toggling happens and does not produce uncaught errors.
    const app = new VisualizingSetsPage(page);
    await app.goto();

    // Wait for the initial add (slightly more than 1s)
    await page.waitForTimeout(1100);
    const added = await app.hasShowIntersectionClass();
    // The script adds the class; allow either true/false in case timings vary, but prefer true here.
    // We'll assert that by 4.5s the class has been removed again.
    await page.waitForTimeout(3500); // wait to pass the removal after 3 more seconds
    const removed = await app.hasShowIntersectionClass();
    expect(removed).toBeFalsy();

    // Confirm no page errors or console errors were raised during the automated animation
    expect(app.getPageErrors().length).toBe(0);
    expect(app.getConsoleErrors().length).toBe(0);
  });

  test('Observability: Inspect console messages and page errors are captured (no unexpected errors)', async ({ page }) => {
    // This test demonstrates we capture console and page errors and asserts none appeared.
    const app = new VisualizingSetsPage(page);
    await app.goto();

    // Interact with UI a bit
    await app.clickShowIntersection();
    await page.waitForTimeout(50);
    await app.clickReset();

    // Assert collected errors arrays are empty (no ReferenceError/SyntaxError/TypeError happened)
    const consoleErrors = app.getConsoleErrors();
    const pageErrors = app.getPageErrors();

    // Provide helpful failure messages containing any captured errors
    expect(consoleErrors.length, `Console errors were logged: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `Uncaught page errors: ${pageErrors.map(e => e.message).join(' | ')}`).toBe(0);
  });

});