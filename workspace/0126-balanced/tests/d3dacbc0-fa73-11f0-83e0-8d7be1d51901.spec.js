import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3dacbc0-fa73-11f0-83e0-8d7be1d51901.html';

// Page Object encapsulating interactions and queries against the demo app
class PatternsApp {
  constructor(page) {
    this.page = page;
    this.locators = {
      patternBtns: () => this.page.locator('.pattern-btn'),
      runBtn: () => this.page.locator('#runBtn'),
      showCodeBtn: () => this.page.locator('#showCodeBtn'),
      resetBtn: () => this.page.locator('#resetBtn'),
      pname: () => this.page.locator('#pname'),
      pcategory: () => this.page.locator('#pcategory'),
      pdesc: () => this.page.locator('#pdesc'),
      pcode: () => this.page.locator('#pcode'),
      codeWrap: () => this.page.locator('#codeWrap'),
      output: () => this.page.locator('#output'),
      controls: () => this.page.locator('#controls'),
      patternList: () => this.page.locator('#patternList'),
    };
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // Wait for sidebar to be built (buildSidebar is called during initialization)
    await expect(this.locators.patternList()).toBeVisible();
  }

  // Returns number of pattern buttons present
  async patternButtonCount() {
    return await this.locators.patternBtns().count();
  }

  // Click pattern by visible name (e.g., "Factory", "Singleton")
  async clickPatternByName(name) {
    const btn = this.page.locator('.pattern-btn', { hasText: name });
    await expect(btn).toHaveCount(1);
    await btn.click();
  }

  // Get the current displayed pattern name
  async getPatternNameText() {
    return (await this.locators.pname().innerText()).trim();
  }

  async getPatternCategoryText() {
    return (await this.locators.pcategory().innerText()).trim();
  }

  // Click Run demo
  async clickRun() {
    await this.locators.runBtn().click();
  }

  // Click Toggle code
  async clickToggleCode() {
    await this.locators.showCodeBtn().click();
  }

  // Click Reset output
  async clickReset() {
    await this.locators.resetBtn().click();
  }

  // Get codeWrap display style (block/none)
  async getCodeWrapDisplay() {
    return await this.page.evaluate(() => {
      const cw = document.getElementById('codeWrap');
      return cw ? getComputedStyle(cw).display : null;
    });
  }

  // Get controls container display style
  async getControlsDisplay() {
    return await this.page.evaluate(() => {
      const c = document.getElementById('controls');
      return c ? getComputedStyle(c).display : null;
    });
  }

  // Get innerText of output container (trimmed)
  async getOutputText() {
    return (await this.locators.output().innerText()).trim();
  }

  // Get number of child elements in controls
  async getControlsChildCount() {
    return await this.page.evaluate(() => {
      const c = document.getElementById('controls');
      return c ? c.children.length : 0;
    });
  }

  // Get pcode text content
  async getPcodeText() {
    return (await this.locators.pcode().innerText()).trim();
  }

  // Get whether a particular pattern button has 'active' class
  async isPatternButtonActive(name) {
    return await this.page.evaluate((n) => {
      const btn = Array.from(document.querySelectorAll('.pattern-btn')).find(b => b.textContent.includes(n));
      return btn ? btn.classList.contains('active') : false;
    }, name);
  }

  // Get the count of console 'error' messages captured in page context (for debugging checks)
  // Note: actual capture is handled in tests via page.on events; this is a helper fallback.
}

test.describe('Design Patterns Interactive Playground - FSM validation', () => {
  let pageErrors = [];
  let consoleErrors = [];

  test.beforeEach(async ({ page }) => {
    // Reset error collectors for each test
    pageErrors = [];
    consoleErrors = [];

    // Listen to page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Listen to console messages and collect error-level logs
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });
  });

  test.afterEach(async () => {
    // After each test ensure there are no unexpected uncaught exceptions or console error logs.
    // We assert this at the end of tests so failures surface if any real runtime errors occurred.
    expect(pageErrors, 'No uncaught page errors should have occurred').toEqual([]);
    expect(consoleErrors, 'No console.error messages should have been logged').toEqual([]);
  });

  test('Initialization (S0_Idle): sidebar built and first pattern auto-selected', async ({ page }) => {
    // Validate buildSidebar() executed on load: pattern buttons are present
    const app = new PatternsApp(page);
    await app.goto();

    // There should be multiple pattern buttons (detected components)
    const btnCount = await app.patternButtonCount();
    expect(btnCount).toBeGreaterThan(0);

    // Auto-select behavior: after initialization the first pattern should be shown in the main area
    const pname = await app.getPatternNameText();
    const pcat = await app.getPatternCategoryText();
    expect(pname.length).toBeGreaterThan(0);
    expect(pcat.length).toBeGreaterThan(0);

    // The output should have the ready message as set by showPattern
    const out = await app.getOutputText();
    expect(out).toContain('Ready. Click "Run demo" to execute.');

    // Also ensure no console or page errors were observed so far (collected in afterEach)
  });

  test('Pattern selection (S0 -> S1): selecting a pattern updates UI and sets active pattern', async ({ page }) => {
    const app = new PatternsApp(page);
    await app.goto();

    // Click a different pattern than the auto-selected one to validate showPattern(p)
    // Choose "Factory" pattern (known to exist)
    await app.clickPatternByName('Factory');

    // Verify main pane updated: name and category reflect the selected pattern
    const pname = await app.getPatternNameText();
    const pcat = await app.getPatternCategoryText();
    expect(pname).toBe('Factory');
    expect(pcat).toBe('Creational');

    // The 'active' class should be applied to the clicked pattern button
    const isActive = await app.isPatternButtonActive('Factory');
    expect(isActive).toBe(true);

    // showPattern should have cleared controls and written the Ready message
    const controlsDisplay = await app.getControlsDisplay();
    expect(controlsDisplay).toBe('none');

    const out = await app.getOutputText();
    expect(out).toContain('Ready. Click "Run demo" to execute.');
  });

  test('Run demo (S1 -> S2): running a demo clears output, shows controls, and populates output', async ({ page }) => {
    const app = new PatternsApp(page);
    await app.goto();

    // Select the Factory pattern and run its demo to validate controls are displayed and output filled
    await app.clickPatternByName('Factory');

    // Run demo
    await app.clickRun();

    // After clicking Run, output should no longer have the Ready message; demo replaces it
    const out = await app.getOutputText();
    expect(out.length).toBeGreaterThan(0);
    expect(out).toContain('Factory ready.');

    // Controls area should be visible and contain the select + Create button as provided by the demo
    const controlsDisplay = await app.getControlsDisplay();
    expect(controlsDisplay === 'flex' || controlsDisplay === 'block').toBeTruthy();

    const controlsCount = await app.getControlsChildCount();
    // Expect at least 2 controls (select + button)
    expect(controlsCount).toBeGreaterThanOrEqual(2);

    // Interact with the demo controls to ensure the demo's event handlers work
    // Select 'circle' and click Create, then assert output receives a new line describing the created shape
    // Using locator-based interactions to trigger the demo-created UI.
    const createBtn = page.locator('#controls button', { hasText: 'Create' });
    await expect(createBtn).toBeVisible();

    // Choose the select within controls
    const select = page.locator('#controls select');
    await expect(select).toBeVisible();

    // Select 'circle' and click Create
    await select.selectOption({ value: 'circle' });
    await createBtn.click();

    // Now output should have a line indicating 'Created: circle'
    const updatedOut = await app.getOutputText();
    expect(updatedOut).toContain('Created: circle');
  });

  test('Toggle code visibility (S1 <-> S3/S4): show and hide code area', async ({ page }) => {
    const app = new PatternsApp(page);
    await app.goto();

    // Ensure a known pattern is active; use "Builder" for this test
    await app.clickPatternByName('Builder');

    // Initially codeWrap should be hidden
    let display = await app.getCodeWrapDisplay();
    expect(display).toBe('none');

    // Toggle code to make it visible (S1 -> S3)
    await app.clickToggleCode();
    display = await app.getCodeWrapDisplay();
    expect(display).toBe('block');

    // The code block should contain the builder code snippet
    const codeText = await app.getPcodeText();
    expect(codeText).toContain('function UserBuilder');

    // Toggle again to hide (S3 -> S4)
    await app.clickToggleCode();
    display = await app.getCodeWrapDisplay();
    expect(display).toBe('none');

    // Rapid toggles should not produce errors - toggle multiple times
    for (let i = 0; i < 3; i++) {
      await app.clickToggleCode();
      await app.page.waitForTimeout(50);
      await app.clickToggleCode();
    }
  });

  test('Reset output (S2 -> S5): reset clears output and clears controls', async ({ page }) => {
    const app = new PatternsApp(page);
    await app.goto();

    // Select a pattern that creates controls, e.g., Decorator
    await app.clickPatternByName('Decorator');

    // Run its demo to populate controls and output
    await app.clickRun();

    // Sanity check controls visible and output contains 'Current:'
    let controlsDisplay = await app.getControlsDisplay();
    expect(controlsDisplay === 'flex' || controlsDisplay === 'block').toBeTruthy();
    let out = await app.getOutputText();
    expect(out).toContain('Current:');

    // Now click Reset output button (S2 -> S5) which should set output to 'Output cleared.' and clear controls
    await app.clickReset();

    // Output expected observable
    const resetOut = await app.getOutputText();
    expect(resetOut).toBe('Output cleared.');

    // Controls should be cleared and hidden per clearControls()
    const controlsCountAfterReset = await app.getControlsChildCount();
    expect(controlsCountAfterReset).toBe(0);

    const controlsDisplayAfterReset = await app.getControlsDisplay();
    expect(controlsDisplayAfterReset).toBe('none');
  });

  test('