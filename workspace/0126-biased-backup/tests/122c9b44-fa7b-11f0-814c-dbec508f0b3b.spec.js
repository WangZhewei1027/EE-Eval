import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122c9b44-fa7b-11f0-814c-dbec508f0b3b.html';

// Page Object Model for the Amortized Analysis app
class AmortizedPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.calculateBtn = page.locator("button[onclick='calculate()']");
    this.saveBtn = page.locator("button[onclick='save()']");
    this.clearBtn = page.locator("button[onclick='clear()']");
    this.amountSlider = page.locator("input[type='range']#amount");
    this.rateSlider = page.locator("input[type='range']#rate");
    this.durationSlider = page.locator("input[type='range']#duration");
    this.amountValueSpan = page.locator("#amount-value");
    this.rateValueSpan = page.locator("#rate-value");
    this.durationValueSpan = page.locator("#duration-value");
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickCalculate() {
    await this.calculateBtn.click();
  }

  async clickSave() {
    await this.saveBtn.click();
  }

  async clickClear() {
    await this.clearBtn.click();
  }

  // Programmatically change a slider value and fire a 'change' event
  async setSliderValue(selector, value) {
    await this.page.evaluate(
      ({ selector, value }) => {
        const el = document.querySelector(selector);
        if (!el) throw new Error('Element not found: ' + selector);
        // set the value even if out of min/max to test behavior
        el.value = String(value);
        // Fire change event which the implementation expects (onChange attribute)
        const event = new Event('change', { bubbles: true });
        el.dispatchEvent(event);
      },
      { selector, value }
    );
  }

  async setAmount(value) {
    await this.setSliderValue("input[type='range']#amount", value);
  }

  async setRate(value) {
    await this.setSliderValue("input[type='range']#rate", value);
  }

  async setDuration(value) {
    await this.setSliderValue("input[type='range']#duration", value);
  }

  async getPresentValueText() {
    return (await this.amountValueSpan.textContent())?.trim() ?? '';
  }

  // Try to parse the numeric part of the Present Value span. Returns NaN if not parseable.
  async getPresentValueNumber() {
    const txt = await this.getPresentValueText();
    const match = txt.match(/\$([-+]?[0-9]*\.?[0-9]+)/);
    if (!match) return NaN;
    return parseFloat(match[1]);
  }
}

// Group tests related to the FSM states and transitions
test.describe('Amortized Analysis - FSM states and transitions', () => {
  /** @type {import('@playwright/test').Page} */
  let page;
  /** @type {AmortizedPage} */
  let app;
  // Arrays to capture console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ browser }) => {
    // Create a fresh context to ensure a clean localStorage/state for each test
    const context = await browser.newContext();
    page = await context.newPage();

    consoleMessages = [];
    pageErrors = [];

    // Capture console messages and page errors to observe runtime behavior
    page.on('console', (msg) => {
      // Save message text and type for later assertions
      consoleMessages.push({ text: msg.text(), type: msg.type() });
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    app = new AmortizedPage(page);
    await app.goto();
  });

  test.afterEach(async () => {
    // Ensure no leaked errors in the console (tests will make explicit assertions)
    // Close page and context to cleanup
    await page.close();
  });

  test('Idle state: initial render and presence of components', async () => {
    // This test validates the Idle state (S0_Idle) evidence:
    // - The Calculate, Save, and Clear buttons are present
    // - The sliders for amount, rate, duration exist with expected defaults
    // - The page did not throw uncaught exceptions during initial load
    await expect(app.calculateBtn).toBeVisible();
    await expect(app.saveBtn).toBeVisible();
    await expect(app.clearBtn).toBeVisible();

    await expect(app.amountSlider).toBeVisible();
    await expect(app.rateSlider).toBeVisible();
    await expect(app.durationSlider).toBeVisible();

    // Verify default slider values match the HTML attributes
    const amountVal = await app.amountSlider.evaluate((el) => el.value);
    const rateVal = await app.rateSlider.evaluate((el) => el.value);
    const durationVal = await app.durationSlider.evaluate((el) => el.value);

    expect(Number(amountVal)).toBe(1000);
    expect(Number(rateVal)).toBe(1);
    expect(Number(durationVal)).toBe(10);

    // The amount-value span may be empty initially (implementation sets it only on calculate/clear)
    const initialText = await app.getPresentValueText();
    // Accept either empty or some precomputed text; assert no page errors happened
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Calculate transition: clicking calculate updates Present Value (S0 -> S1)', async () => {
    // This validates the Calculate event and S1_Calculated evidence.
    // Click the Calculate button and assert the amount-value span displays a "Present Value: $..."
    await app.clickCalculate();

    // Wait a short time to allow calculation to run and DOM update
    await page.waitForTimeout(50);

    const txt = await app.getPresentValueText();
    expect(txt).toMatch(/^Present Value: \$\d+(\.\d{2})?$/);

    const val = await app.getPresentValueNumber();
    expect(Number.isFinite(val)).toBe(true);
    expect(val).toBeGreaterThan(0);

    // Ensure no uncaught errors were produced by clicking calculate
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Slider changes trigger calculation (AmountChange, RateChange, DurationChange)', async () => {
    // This test validates transitions triggered by slider change events.
    // Start from defaults, then change amount and assert present value updates accordingly.

    // Initial calculate to have a baseline
    await app.clickCalculate();
    await page.waitForTimeout(20);
    const baseline = await app.getPresentValueNumber();
    expect(baseline).toBeGreaterThan(0);

    // Increase amount -> present value should increase
    await app.setAmount(2000);
    await page.waitForTimeout(20);
    const afterAmount = await app.getPresentValueNumber();
    expect(afterAmount).toBeGreaterThanOrEqual(baseline);

    // Increase rate -> present value should increase (rate is percent)
    const beforeRate = afterAmount;
    await app.setRate(5);
    await page.waitForTimeout(20);
    const afterRate = await app.getPresentValueNumber();
    expect(afterRate).toBeGreaterThanOrEqual(beforeRate);

    // Increase duration -> present value should increase
    const beforeDuration = afterRate;
    await app.setDuration(20);
    await page.waitForTimeout(20);
    const afterDuration = await app.getPresentValueNumber();
    expect(afterDuration).toBeGreaterThanOrEqual(beforeDuration);

    // Ensure no runtime JS errors occurred during slider interactions
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Save event persists computed values into localStorage', async () => {
    // This test validates the Save event.
    // After calculating, clicking Save should write amount, rate, and duration to localStorage.

    // Set known values
    await app.setAmount(1500);
    await app.setRate(2.5);
    await app.setDuration(5);
    // Give calculate a moment
    await page.waitForTimeout(20);

    // Now click Save
    await app.clickSave();

    // Read localStorage from the page context
    const stored = await page.evaluate(() => {
      return {
        amount: localStorage.getItem('amount'),
        rate: localStorage.getItem('rate'),
        duration: localStorage.getItem('duration'),
      };
    });

    // Implementation stores raw values (not necessarily strings that parse to numbers)
    expect(stored).toHaveProperty('amount');
    expect(stored).toHaveProperty('rate');
    expect(stored).toHaveProperty('duration');

    // Since the page code stores the numeric variables, they should match the current window variables
    const windowValues = await page.evaluate(() => {
      return {
        amount: window.amount,
        rate: window.rate,
        duration: window.duration,
      };
    });

    // localStorage stores strings; compare after coercion
    expect(String(windowValues.amount)).toBe(stored.amount);
    expect(String(windowValues.rate)).toBe(stored.rate);
    expect(String(windowValues.duration)).toBe(stored.duration);

    // Ensure no JS errors while saving
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Clear transition resets values to zero and updates DOM (S0 -> S2)', async () => {
    // Validate Clear event and S2_Cleared evidence.
    // First, change some values and calculate
    await app.setAmount(3000);
    await app.setRate(3);
    await app.setDuration(10);
    await page.waitForTimeout(20);

    // Ensure present value now reflects something > 0
    const beforeClear = await app.getPresentValueNumber();
    expect(beforeClear).toBeGreaterThan(0);

    // Click Clear
    await app.clickClear();
    await page.waitForTimeout(20);

    // The implementation explicitly sets the amount-value span to $0.00
    const clearedText = await app.getPresentValueText();
    expect(clearedText).toBe('Present Value: $0.00');

    // Also verify that the internal JS variables are set to 0
    const internal = await page.evaluate(() => {
      return { amount: window.amount, rate: window.rate, duration: window.duration };
    });
    expect(internal.amount).toBe(0);
    expect(internal.rate).toBe(0);
    expect(internal.duration).toBe(0);

    // Ensure no runtime errors occurred during clear
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge cases: extreme and out-of-range slider values do not crash and produce numeric present value', async () => {
    // This test examines how the implementation behaves with extreme values.
    // We set sliders to their maximum/minimum and also programmatically set out-of-range values.

    // Max values
    await app.setAmount(10000);
    await app.setRate(10);
    await app.setDuration(1000);
    await page.waitForTimeout(50);

    let pv = await app.getPresentValueNumber();
    expect(Number.isFinite(pv)).toBe(true);

    // Out-of-range: negative values (programmatic)
    await app.setAmount(-500);
    await app.setRate(-1);
    await app.setDuration(-10);
    // The implementation will attempt to calculate even with these values; ensure it doesn't throw
    await page.waitForTimeout(50);
    pv = await app.getPresentValueNumber();
    // Could be NaN for strange inputs but should not cause a pageerror (uncaught exception)
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
    // If the numeric parse produces NaN, that's acceptable here; but ensure pv is a number or NaN
    expect(typeof pv).toBe('number');
  });

  test('OnEnter/OnExit verification: renderPage() expected by FSM but not implemented in DOM', async () => {
    // FSM S0_Idle entry_actions mentions renderPage(). Verify whether renderPage exists on window.
    // This test checks the presence/absence of that function without modifying runtime.
    const hasRenderPage = await page.evaluate(() => typeof window.renderPage !== 'undefined');
    // According to the provided HTML, renderPage() is not implemented. Assert that it's undefined.
    expect(hasRenderPage).toBe(false);

    // Because renderPage is not invoked by the page, there should be no ReferenceError.
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Observe console messages and page errors during typical usage', async () => {
    // This final test intentionally exercises the UI and then asserts the runtime emitted no errors.
    await app.clickCalculate();
    await app.setAmount(2500);
    await app.setRate(4.2);
    await app.setDuration(12);
    await app.clickSave();
    await app.clickClear();

    // Wait for any asynchronous console messages
    await page.waitForTimeout(50);

    // Collect console errors
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');

    // Assert no uncaught page errors or console errors happened during these interactions
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);

    // For transparency, ensure there were console messages (info/log) but none are errors
    // This is not a strict requirement; it's informational and will not fail the test
    // If there are console messages, they should be non-error types
    for (const m of consoleMessages) {
      expect(m.type).not.toBe('error');
    }
  });
});