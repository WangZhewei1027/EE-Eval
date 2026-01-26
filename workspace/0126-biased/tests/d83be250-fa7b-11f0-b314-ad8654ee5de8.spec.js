import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d83be250-fa7b-11f0-b314-ad8654ee5de8.html';

// Page Object for the demo area
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.demoBtnSelector = '#demoBtn';
    this.outputSelector = '#demoOutput';
    this.descSelector = '#demoDesc';
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async demoBtn() {
    return this.page.locator(this.demoBtnSelector);
  }

  async output() {
    return this.page.locator(this.outputSelector);
  }

  async desc() {
    return this.page.locator(this.descSelector);
  }

  async isOutputHidden() {
    return this.page.evaluate((sel) => {
      const el = document.querySelector(sel);
      return el ? el.hidden : true;
    }, this.outputSelector);
  }

  async isButtonDisabled() {
    return this.page.evaluate((sel) => {
      const btn = document.querySelector(sel);
      return !!(btn && btn.disabled);
    }, this.demoBtnSelector);
  }

  // Click the run demo button (uses Playwright click)
  async clickRun() {
    await this.page.click(this.demoBtnSelector);
  }

  // Wait until the demo output becomes visible (not hidden) and contains expected header text
  // We allow longer timeout because PBKDF2 with 100k iterations can be slow in some environments.
  async waitForOutputVisible(timeout = 120000) {
    await this.page.waitForFunction(
      (sel) => {
        const el = document.querySelector(sel);
        return !!el && el.hidden === false && /PBKDF2 Demo/i.test(el.textContent || '');
      },
      this.outputSelector,
      { timeout }
    );
  }

  // Read output textContent
  async getOutputText() {
    return this.page.evaluate((sel) => {
      const el = document.querySelector(sel);
      return el ? el.textContent : '';
    }, this.outputSelector);
  }

  // Parse salt and derived hex from the output text. Returns { saltHex, derivedHex }
  parseSaltAndDerived(text) {
    const saltMatch = text.match(/Salt \(hex[^\)]*\):\s*([0-9a-fA-F]+)/);
    let saltHex = saltMatch ? saltMatch[1].toLowerCase() : null;

    // The derived hex should be a standalone hex line (32 bytes -> 64 hex chars)
    // We look for a hex string of length >= 32 (to be robust) and prefer 64 chars.
    const hexCandidates = (text.match(/[0-9a-fA-F]{32,128}/g) || []).map(s => s.toLowerCase());
    // Prefer candidates that are 64 chars (32 bytes derived key)
    let derivedHex = hexCandidates.find(c => c.length === 64) || hexCandidates[hexCandidates.length - 1] || null;

    return { saltHex, derivedHex };
  }
}

// Group tests related to the PBKDF2 demo and the FSM described.
test.describe('PBKDF2 Demo - FSM Validation and UI behavior', () => {
  // Increase default timeout for this describe block since crypto ops may be slow
  test.setTimeout(2 * 60 * 1000); // 2 minutes

  // Shared beforeEach sets up console and pageerror capture and navigates to the app
  test.beforeEach(async ({ page }) => {
    // Attach console and pageerror handlers so tests can assert no unexpected errors occurred.
    page['_consoleMessages'] = [];
    page['_pageErrors'] = [];

    page.on('console', (msg) => {
      page['_consoleMessages'].push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      page['_pageErrors'].push(String(err));
    });

    // Navigate to the application under test
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // If there were page errors, include them in the test failure message when asserting none occurred.
    const pageErrors = page['_pageErrors'] || [];
    const consoleMessages = page['_consoleMessages'] || [];

    // Ensure that no unhandled page errors occurred during the test execution
    expect(pageErrors, `Unexpected page errors: ${pageErrors.join(' | ')}`).toHaveLength(0);

    // Optionally assert there are no console messages of type 'error'
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors, `Unexpected console.error messages: ${consoleErrors.map(e => e.text).join(' | ')}`).toHaveLength(0);
  });

  test('Initial Idle state: elements present, demo output hidden, button enabled', async ({ page }) => {
    // Validate Idle (S0_Idle) - renderPage() entry action implied by HTML
    const demoPage = new DemoPage(page);

    // Elements should exist
    const btn = await demoPage.demoBtn();
    await expect(btn).toHaveCount(1);
    await expect(btn).toBeVisible();
    await expect(btn).toHaveAttribute('aria-describedby', 'demoDesc');

    const desc = await demoPage.desc();
    await expect(desc).toHaveCount(1);
    await expect(desc).toBeVisible();

    const out = await demoPage.output();
    await expect(out).toHaveCount(1);

    // Output should be initially hidden per implementation evidence
    const hidden = await demoPage.isOutputHidden();
    expect(hidden).toBe(true);

    // Button should be enabled in Idle state
    const disabled = await demoPage.isButtonDisabled();
    expect(disabled).toBe(false);
  });

  test('Transition S0_Idle -> S1_DemoRunning and back: click runs demo, output shown, button disabled then re-enabled', async ({ page }) => {
    // This test validates event ButtonClickDemo triggers runDemo() (entry action) and then re-enable behavior
    const demoPage = new DemoPage(page);

    // Click the demo button to start demo (transition Idle -> DemoRunning)
    await demoPage.clickRun();

    // Immediately after click the button should be disabled (exit action on enter of demo running: btn disabled)
    // We check the disabled state quickly (it is set synchronously before async runDemo starts)
    const disabledAfterClick = await demoPage.isButtonDisabled();
    expect(disabledAfterClick).toBe(true);

    // Wait until output becomes visible and contains expected header (this waits for runDemo to complete)
    await demoPage.waitForOutputVisible();

    // Output should contain expected educational text and derived values
    const outText = await demoPage.getOutputText();
    expect(outText).toMatch(/PBKDF2 Demo \(educational example\)/i);
    expect(outText).toMatch(/Passphrase \(example\)/i);
    expect(outText).toMatch(/Algorithm: PBKDF2 with HMAC-SHA-256/i);
    expect(outText).toMatch(/Iterations:\s*100,000/i); // uses toLocaleString on iterations, so includes comma

    // Parse salt and derived hex and assert expected lengths
    const { saltHex, derivedHex } = demoPage.parseSaltAndDerived(outText);
    // Salt should be 16 bytes => 32 hex chars
    expect(saltHex, 'Salt hex should be present and 32 hex chars').toMatch(/^[0-9a-f]{32}$/);
    // Derived key 32 bytes => 64 hex chars
    expect(derivedHex, 'Derived hex should be present and 64 hex chars').toMatch(/^[0-9a-f]{64}$/);

    // After run completes, button should be re-enabled (transition back to Idle)
    const disabledAtEnd = await demoPage.isButtonDisabled();
    expect(disabledAtEnd).toBe(false);
  }, { timeout: 120000 });

  test('Edge case: multiple rapid clicks while running should not cause errors and should not crash the page', async ({ page }) => {
    // This test attempts to click the button multiple times in quick succession to test defensive disabling logic.
    const demoPage = new DemoPage(page);

    // Start the demo
    await demoPage.clickRun();

    // Immediately attempt another click(s) while the button is expected to be disabled
    // Use page.click but ignore any failures — the implementation should simply ignore because button.disabled is true
    // We do not want to patch or alter the page; just exercise it as-is.
    try {
      await page.click('#demoBtn', { timeout: 500 });
    } catch (err) {
      // Clicking a disabled button may throw an element not interactable error in some drivers — that's acceptable;
      // ensure no page-level exceptions were raised (pageerror handler will catch those).
    }

    // Also attempt a JS-level click (dispatch) — this should not be done by tests normally to mimic user interaction,
    // but is included here as an edge-case to ensure implementation resists mid-run re-invocation.
    await page.evaluate(() => {
      const btn = document.getElementById('demoBtn');
      if (btn) {
        // try programmatic click; if btn.disabled is true, the UI should not re-run demo logic.
        btn.click();
      }
    });

    // Wait for demo to finish and output become visible
    await demoPage.waitForOutputVisible();

    // Confirm demo completed successfully and no page errors occurred (checked in afterEach)
    const outText = await demoPage.getOutputText();
    expect(outText).toContain('PBKDF2 Demo');

    // Ensure button restored to enabled state
    const disabledAtEnd = await demoPage.isButtonDisabled();
    expect(disabledAtEnd).toBe(false);
  }, { timeout: 120000 });

  test('Re-run demo after completion produces new salt and (very likely) different derived key', async ({ page }) => {
    // Validate transition S0 -> S1 -> S0 then again S0 -> S1: repeated runs produce distinct salts (randomness)
    const demoPage = new DemoPage(page);

    // First run
    await demoPage.clickRun();
    await demoPage.waitForOutputVisible();
    const firstOutput = await demoPage.getOutputText();
    const parsed1 = demoPage.parseSaltAndDerived(firstOutput);
    expect(parsed1.saltHex).toMatch(/^[0-9a-f]{32}$/);
    expect(parsed1.derivedHex).toMatch(/^[0-9a-f]{64}$/);

    // Start second run (should be possible because button is enabled again)
    await demoPage.clickRun();
    await demoPage.waitForOutputVisible();
    const secondOutput = await demoPage.getOutputText();
    const parsed2 = demoPage.parseSaltAndDerived(secondOutput);
    expect(parsed2.saltHex).toMatch(/^[0-9a-f]{32}$/);
    expect(parsed2.derivedHex).toMatch(/^[0-9a-f]{64}$/);

    // The salt should very likely differ between runs; assert inequality to detect randomness
    // If they are equal (extremely unlikely), the test will fail which surfaces a potential defect
    expect(parsed1.saltHex).not.toEqual(parsed2.saltHex);

    // Derived outputs should also typically differ (due to different salt)
    expect(parsed1.derivedHex).not.toEqual(parsed2.derivedHex);

    // Final button state should be enabled (Idle)
    const disabledAtEnd = await demoPage.isButtonDisabled();
    expect(disabledAtEnd).toBe(false);
  }, { timeout: 2 * 60 * 1000 });

  test('Observability: capture console messages while interacting with demo (no unexpected errors)', async ({ page }) => {
    // This test exercises console logging capture and ensures the app does not emit console.error messages.
    const demoPage = new DemoPage(page);

    // Trigger a run
    await demoPage.clickRun();
    await demoPage.waitForOutputVisible();

    // Inspect captured console messages - we expect no console.error entries (checked in afterEach),
    // but ensure there is at least some console output captured (informational)
    const consoleMessages = page['_consoleMessages'] || [];
    // It's acceptable for consoleMessages to be empty; but we assert the capture mechanism works by checking the property exists.
    expect(Array.isArray(consoleMessages)).toBe(true);
  }, { timeout: 120000 });
});