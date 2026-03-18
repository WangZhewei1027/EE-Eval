import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0202-sample/html/a3708aa4-ffc4-11f0-821c-7d25bc609266.html';

class DemoPage {
  /**
   * Page Object for the Adjacency Matrix demo page.
   * Encapsulates selectors and common interactions so tests remain readable.
   */
  constructor(page) {
    this.page = page;
    this.button = page.locator('#demo-button');
    this.output = page.locator('#demo-output');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getButtonText() {
    return this.button.textContent();
  }

  async isButtonDisabled() {
    // Use evaluate to get the disabled property directly
    return await this.button.evaluate((b) => b.disabled === true);
  }

  async clickDemo() {
    await this.button.click();
  }

  async isDemoVisible() {
    // Check computed style display not 'none' and that element is attached
    return await this.page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return false;
      const style = window.getComputedStyle(el);
      return style && style.display !== 'none' && el.offsetParent !== null;
    }, '#demo-output');
  }

  async getDemoText() {
    return await this.output.textContent();
  }

  async waitForDemoOutputContains(text, opts = {}) {
    // Wait until demoOutput.textContent contains text
    await this.page.waitForFunction(
      (sel, t) => {
        const el = document.querySelector(sel);
        if (!el) return false;
        return el.textContent && el.textContent.indexOf(t) !== -1;
      },
      '#demo-output',
      text,
      opts
    );
  }
}

test.describe('Adjacency Matrix Interactive Demo (FSM: Idle -> Demo Visible)', () => {
  // Arrays to capture console and page errors for assertions
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages for later assertions
    page.on('console', (msg) => {
      // store simple representation
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      // err is an Error; capture its name and message
      pageErrors.push({
        name: err && err.name ? err.name : 'UnknownError',
        message: err && err.message ? err.message : String(err)
      });
    });

    // Navigate to the application under test
    // We intentionally load the page exactly as-is and do NOT patch or modify the environment.
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // Extra safety: give any pending demo promise a moment to produce console logs before closing
    // Do not modify application behavior; just allow pending microtasks to flush.
    await page.waitForTimeout(100);
    // Close page to free resources (Playwright will do this automatically for each test, but explicit is fine)
    await page.close();
  });

  test('Initial Idle state: page renders demo button and demo output is hidden', async ({ page }) => {
    // Validate initial Idle state per FSM S0_Idle
    const demo = new DemoPage(page);

    // Button exists with expected text
    await expect(demo.button).toBeVisible();
    const btnText = await demo.getButtonText();
    expect(btnText && btnText.trim()).toBe('Show Matrix Construction Demo');

    // demo-output exists and is initially hidden (style="display:none;")
    // We check both attribute and computed style
    const demoOutput = page.locator('#demo-output');
    await expect(demoOutput).toBeVisible({ timeout: 0 }).catch(() => {
      // The element is in DOM but initial CSS has display:none; so expect toBeVisible may fail.
      // Instead verify computed style display is 'none' explicitly.
    });

    const displayStyle = await page.evaluate(() => {
      const el = document.getElementById('demo-output');
      return el ? window.getComputedStyle(el).display : null;
    });
    expect(displayStyle).toBe('none');

    // Validate ARIA attributes and class as described in FSM components
    await expect(demoOutput).toHaveAttribute('aria-live', 'polite');
    await expect(demoOutput).toHaveAttribute('aria-atomic', 'true');
    await expect(demoOutput).toHaveClass(/demo-output/);

    // Ensure no uncaught page errors have occurred just from loading initial page
    // We capture and assert that there are no SyntaxError / ReferenceError / TypeError instances.
    const seriousErrors = pageErrors.filter(e =>
      ['ReferenceError', 'SyntaxError', 'TypeError'].includes(e.name)
    );
    expect(seriousErrors.length).toBe(0);
  });

  test('Transition: clicking demo button shows demo output and begins demo (S0_Idle -> S1_DemoVisible)', async ({ page }) => {
    // This test validates event ShowMatrixDemo and transition actions:
    // - demoOutput.style.display = 'block';
    // - demoOutput.textContent = '';
    // It also checks that the demo step text is added synchronously before the first sleep.
    const demo = new DemoPage(page);

    // Click the demo button to start demo
    await demo.clickDemo();

    // Immediately after click, demoOutput should become visible due to style change in handler
    const visible = await demo.isDemoVisible();
    expect(visible).toBe(true);

    // The demo routine appends initial info synchronously before any sleep:
    // It writes "Vertices: ..." and "Edges: ..." and then Step 1 lines.
    // Wait for "Vertices:" to appear (should be immediate).
    await demo.waitForDemoOutputContains('Vertices:', { timeout: 2000 });
    await demo.waitForDemoOutputContains('Edges:', { timeout: 2000 });
    // Also assert that matrix header (tab-separated vertices) appears
    const demoText = await demo.getDemoText();
    expect(demoText).toContain('Vertices:');
    expect(demoText).toContain('Edges:');
    // The matrixToString function adds a header line beginning with a tab then vertices joined by tabs
    // We assert presence of a line that contains a tab-separated header, e.g., "\t0\t1\t2\t3\t4"
    expect(demoText).toMatch(/\t0\s*\t1\s*\t2\s*\t3\s*\t4/);

    // Per implementation, the click handler sets demoButton.disabled = true before starting the async demo.
    const disabled = await demo.isButtonDisabled();
    expect(disabled).toBe(true);

    // Ensure no new uncaught ReferenceError/SyntaxError/TypeError occurred during the click and initial synchronous updates.
    const seriousErrors = pageErrors.filter(e =>
      ['ReferenceError', 'SyntaxError', 'TypeError'].includes(e.name)
    );
    expect(seriousErrors.length).toBe(0);

    // Also ensure there are no console.error entries captured in the short time after starting the demo
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Demo completes and button re-enables with text "Run Demo Again" (end of demo)', async ({ page }) => {
    // This test waits for the full demo to complete and asserts the button returns to enabled state
    // with updated text. The full demo includes several sleeps (1.5s each), so allow sufficient timeout.
    const demo = new DemoPage(page);

    // Start demo
    await demo.clickDemo();

    // Wait until the demo function completes and sets button.disabled = false and button text to 'Run Demo Again'
    // The total time: initial step + 7 edges each with 1.5s sleep => ~12s. Use generous timeout.
    await page.waitForFunction(() => {
      const btn = document.getElementById('demo-button');
      return btn && btn.disabled === false && btn.textContent && btn.textContent.trim().toLowerCase().includes('run demo again');
    }, null, { timeout: 30000 });

    // Validate button state and text
    const enabled = !(await demo.isButtonDisabled());
    expect(enabled).toBe(true);
    const text = (await demo.getButtonText()) || '';
    expect(text.trim()).toBe('Run Demo Again');

    // At demo end, the demo output should contain the 'Final adjacency matrix represents all edges.' message
    await demo.waitForDemoOutputContains('Final adjacency matrix represents all edges.', { timeout: 1000 });

    // Assert again no uncaught ReferenceError/SyntaxError/TypeError occurred during the full demo runtime
    const seriousErrors = pageErrors.filter(e =>
      ['ReferenceError', 'SyntaxError', 'TypeError'].includes(e.name)
    );
    expect(seriousErrors.length).toBe(0);
  });

  test('Edge case: multiple rapid clicks do not cause duplicate initial output or race conditions', async ({ page }) => {
    // This test attempts to click the button multiple times very quickly,
    // asserting that the demo is only started once per handler logic (the handler disables the button).
    const demo = new DemoPage(page);

    // Fire two clicks back-to-back. The handler sets disabled synchronously,
    // so the second click should have no additional effect. We use Promise.allSettled to fire clicks back-to-back.
    const clickPromises = [
      demo.button.click(),
      demo.button.click().catch((e) => {
        // If second click is rejected due to disabled element, swallow the error for test flow;
        // We'll assert the final output state instead of failing here.
        return e;
      })
    ];
    await Promise.allSettled(clickPromises);

    // Wait for initial content to be present (Vertices:)
    await demo.waitForDemoOutputContains('Vertices:', { timeout: 2000 });

    // Count occurrences of the "Vertices:" header - should be exactly 1 if second click didn't restart the demo instantly
    const demoText = await demo.getDemoText();
    const occurrences = (demoText.match(/Vertices:/g) || []).length;
    expect(occurrences).toBe(1);

    // Ensure the button is indeed disabled right after starting the demo
    expect(await demo.isButtonDisabled()).toBe(true);

    // No runtime ReferenceError/SyntaxError/TypeError should be observed as a consequence of rapid clicks
    const seriousErrors = pageErrors.filter(e =>
      ['ReferenceError', 'SyntaxError', 'TypeError'].includes(e.name)
    );
    expect(seriousErrors.length).toBe(0);
  });

  test('Observability: capture console and page errors and assert their nature (if any)', async ({ page }) => {
    // This test demonstrates observation of console and page errors as required.
    // It does not attempt to modify or patch the application; it only reports and asserts what naturally occurs.

    // Give the page a short time to potentially emit any logs or errors (some may be emitted on idle)
    await page.waitForTimeout(200);

    // We assert the structure of captured logs: that they are objects with type and text
    expect(Array.isArray(consoleMessages)).toBe(true);
    for (const msg of consoleMessages) {
      expect(msg).toHaveProperty('type');
      expect(msg).toHaveProperty('text');
    }

    // If any page errors occurred, they will be captured in pageErrors array.
    // We assert that they are reported as objects with name and message.
    for (const err of pageErrors) {
      expect(err).toHaveProperty('name');
      expect(err).toHaveProperty('message');
    }

    // As a safety / clarity measure, explicitly check for the presence of severe JS errors.
    // If any ReferenceError/SyntaxError/TypeError occurred, we include them in test output by failing with details.
    const severe = pageErrors.filter(e => ['ReferenceError', 'SyntaxError', 'TypeError'].includes(e.name));
    if (severe.length > 0) {
      // Fail the test with the captured severe error details to make it explicit in CI logs.
      const details = severe.map(e => `${e.name}: ${e.message}`).join('\n');
      throw new Error(`Severe JavaScript errors observed on page:\n${details}`);
    } else {
      // If none occurred, explicitly assert that the page had zero severe JS errors
      expect(severe.length).toBe(0);
    }

    // Also assert that console did not emit console.error messages (which would indicate runtime issues)
    const consoleErrs = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrs.length).toBe(0);
  });
});