import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3d85ac2-fa73-11f0-83e0-8d7be1d51901.html';

// Page Object Model for the Ω interactive page
class OmegaPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  // Element handles
  async presetF() { return this.page.locator('#presetF'); }
  async presetG() { return this.page.locator('#presetG'); }
  async customF() { return this.page.locator('#customF'); }
  async customG() { return this.page.locator('#customG'); }
  async nStart() { return this.page.locator('#nStart'); }
  async nMax() { return this.page.locator('#nMax'); }
  async sampleStep() { return this.page.locator('#sampleStep'); }
  async testBtn() { return this.page.locator('#testBtn'); }
  async resetBtn() { return this.page.locator('#resetBtn'); }
  async resultBox() { return this.page.locator('#result'); }
  async codeBox() { return this.page.locator('#codeBox'); }
  async canvas() { return this.page.locator('#plot'); }

  // Helpers
  async getResultDisplayStyle() {
    return await this.page.evaluate(() => document.getElementById('result').style.display);
  }
  async getCodeBoxText() {
    return (await this.codeBox()).innerText();
  }
  async getCustomValues() {
    return {
      f: await (await this.customF()).inputValue(),
      g: await (await this.customG()).inputValue()
    };
  }

  // Interactions
  async clickTest() {
    await (await this.testBtn()).click();
  }
  async clickReset() {
    await (await this.resetBtn()).click();
  }
  async setCustomF(value) {
    await (await this.customF()).fill(value);
  }
  async setCustomG(value) {
    await (await this.customG()).fill(value);
  }
  async setNStart(value) {
    await (await this.nStart()).fill(String(value));
  }
  async setNMax(value) {
    await (await this.nMax()).fill(String(value));
  }
  async changePresetFByIndex(index) {
    await (await this.presetF()).selectOption({ index });
  }
  async changePresetGByIndex(index) {
    await (await this.presetG()).selectOption({ index });
  }
  async getPresetFValue() {
    return await this.page.evaluate(() => document.getElementById('presetF').value);
  }
  async getPresetGValue() {
    return await this.page.evaluate(() => document.getElementById('presetG').value);
  }
  async getResultHtml() {
    return await this.page.evaluate(() => document.getElementById('result').innerHTML);
  }
  async getCanvasDataUrl() {
    // returns a small check to ensure something is drawn (dataURL exists)
    return await this.page.evaluate(() => {
      const c = document.getElementById('plot');
      try { return c.toDataURL(); } catch(e) { return null; }
    });
  }
}

test.describe('Big-Omega (Ω) Notation — Interactive Demonstration (FSM driven tests)', () => {
  // capture console messages, dialogs, and page errors for each test
  test.beforeEach(async ({ page }) => {
    // arrays available via page context by closure
  });

  test('S0 Idle: initial render, code box and hidden result (page load)', async ({ page }) => {
    // Capture console and page errors
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', m => consoleMessages.push({type: m.type(), text: m.text()}));
    page.on('pageerror', e => pageErrors.push(e));

    const dialogMessages = [];
    page.on('dialog', async dialog => {
      dialogMessages.push(dialog.message());
      await dialog.dismiss();
    });

    // Navigate to the app (window.load should run and draw defaults)
    await page.goto(APP_URL, { waitUntil: 'load' });

    const p = new OmegaPage(page);

    // Validate main heading exists (evidence for S0_Idle)
    const title = await page.locator('h1').innerText();
    expect(title).toContain('Big-Omega (Ω) Notation — Interactive Demonstration');

    // Code box should reflect preset functions on initial render
    const codeText = await (await p.codeBox()).innerText();
    expect(codeText).toMatch(/^f\(n\) =/);

    // Result box should be hidden initially (S0 idle evidence)
    const resultStyle = await p.getResultDisplayStyle();
    expect(resultStyle).toBe('none');

    // Canvas dataURL should be available (plot drawn on load)
    const dataUrl = await p.getCanvasDataUrl();
    expect(typeof dataUrl).toBe('string');
    expect(dataUrl.length).toBeGreaterThan(100); // sanity: dataURL not empty

    // No page errors should have been emitted on a normal load
    expect(pageErrors.length).toBe(0);
    // Console should not contain severe errors (we assert there is no console.error)
    const errors = consoleMessages.filter(m => m.type === 'error');
    expect(errors.length).toBe(0);
    // No unexpected dialogs on load
    expect(dialogMessages.length).toBe(0);
  });

  test('Transition S0 -> S1: clicking Test shows result and updates code box & plot', async ({ page }) => {
    const consoleMessages1 = [];
    const pageErrors1 = [];
    const dialogs = [];
    page.on('console', m => consoleMessages.push({type: m.type(), text: m.text()}));
    page.on('pageerror', e => pageErrors.push(e));
    page.on('dialog', async d => { dialogs.push(d.message()); await d.accept(); });

    await page.goto(APP_URL, { waitUntil: 'load' });
    const p1 = new OmegaPage(page);

    // Ensure presets have known values (precondition)
    const presetFVal = await p.getPresetFValue();
    const presetGVal = await p.getPresetGValue();
    expect(presetFVal).toBeTruthy();
    expect(presetGVal).toBeTruthy();

    // Click Test to initiate empirical test (TestButtonClick event)
    await p.clickTest();

    // After clicking, resultBox.style.display should be block (S1_Testing evidence)
    await expect(page.locator('#result')).toHaveCSS('display', 'block');

    const resultHtml = await p.getResultHtml();
    // result should either claim 'Empirical result' or 'No constant' message.
    expect(
      resultHtml.includes('Empirical result:') ||
      resultHtml.includes('No constant')
    ).toBeTruthy();

    // Code box should have been updated to the expressions used
    const codeText1 = await (await p.codeBox()).innerText();
    expect(codeText).toContain('f(n) =');
    expect(codeText).toContain('g(n) =');

    // Canvas should have been updated (dataURL exists)
    const canvasData = await p.getCanvasDataUrl();
    expect(typeof canvasData).toBe('string');
    expect(canvasData.length).toBeGreaterThan(100);

    // No page runtime errors expected as a result of normal operation
    expect(pageErrors.length).toBe(0);
    const errors1 = consoleMessages.filter(m => m.type === 'error');
    expect(errors.length).toBe(0);

    // No unexpected dialogs should have been shown for a valid run
    expect(dialogs.length).toBe(0);
  });

  test('Transition S0 -> S2 and back via WindowLoad: reset clears custom inputs and hides result, reload returns to idle', async ({ page }) => {
    const pageErrors2 = [];
    page.on('pageerror', e => pageErrors.push(e));
    await page.goto(APP_URL, { waitUntil: 'load' });
    const p2 = new OmegaPage(page);

    // Fill custom fields and run test to show the result (enter Testing state)
    await p.setCustomF('4*n + 10');
    await p.setCustomG('n');
    await p.clickTest();
    await expect(page.locator('#result')).toHaveCSS('display', 'block');

    // Now click Reset presets (ResetButtonClick -> S2_Resetting)
    await p.clickReset();

    // After reset, custom fields should be cleared and result hidden
    const custom = await p.getCustomValues();
    expect(custom.f).toBe('');
    expect(custom.g).toBe('');

    const resultStyle1 = await p.getResultDisplayStyle();
    expect(resultStyle).toBe('none');

    // Presets should be reset to first option
    const presetFVal1 = await p.getPresetFValue();
    const presetGVal1 = await p.getPresetGValue();
    expect(presetFVal).toBeTruthy();
    expect(presetGVal).toBeTruthy();

    // Now simulate WindowLoad transition: reload page which triggers the load handler and returns to Idle
    await page.reload({ waitUntil: 'load' });

    // After reload result box should still be hidden (S2_Resetting -> S0_Idle)
    await expect(page.locator('#result')).toHaveCSS('display', 'none');

    // No page errors during reset/reload
    expect(pageErrors.length).toBe(0);
  });

  test('S1 Testing: changing presetF and presetG while in Testing updates code box and clears corresponding custom fields', async ({ page }) => {
    await page.goto(APP_URL, { waitUntil: 'load' });
    const p3 = new OmegaPage(page);

    // Run a test to enter Testing state
    await p.clickTest();
    await expect(page.locator('#result')).toHaveCSS('display', 'block');

    // Set customG to a non-empty value to ensure presetF change uses customG when updating code box
    await p.setCustomG('n*n');

    // Change presetF: customF should be cleared and codeBox updated to use presetF and customG or presetG
    await p.changePresetFByIndex(1); // choose another preset
    const customVals1 = await p.getCustomValues();
    expect(customVals1.f).toBe(''); // S1 -> S1 on PresetFChange clears customF

    const codeText1 = await (await p.codeBox()).innerText();
    // codeBox should contain the new presetF expression
    const newPresetFVal = await p.getPresetFValue();
    expect(codeText1).toContain(newPresetFVal);

    // Now change presetG: customG should be cleared and codeBox updated
    await p.setCustomF('4*n + 2'); // make customF non-empty
    await p.changePresetGByIndex(2);
    const customVals2 = await p.getCustomValues();
    expect(customVals2.g).toBe(''); // S1 -> S1 on PresetGChange clears customG

    const codeText2 = await (await p.codeBox()).innerText();
    const newPresetGVal = await p.getPresetGValue();
    expect(codeText2).toContain(newPresetGVal);

    // Ensure we remain in Testing state (result still visible)
    await expect(page.locator('#result')).toHaveCSS('display', 'block');
  });

  test('Edge case: invalid custom f(n) expression triggers alert and prevents test (no uncaught errors)', async ({ page }) => {
    const pageErrors3 = [];
    page.on('pageerror', e => pageErrors.push(e));

    const dialogMessages1 = [];
    page.on('dialog', async dialog => {
      dialogMessages.push(dialog.message());
      await dialog.accept();
    });

    await page.goto(APP_URL, { waitUntil: 'load' });
    const p4 = new OmegaPage(page);

    // Put an invalid expression into customF that makeFunc will reject
    await p.setCustomF('bad$$expr');
    await p.setCustomG('n'); // valid

    await p.clickTest();

    // The app should show an alert about invalid f(n). Intercepted above.
    expect(dialogMessages.length).toBeGreaterThanOrEqual(1);
    const foundInvalidMsg = dialogMessages.some(m => m.includes('Invalid f(n) expression'));
    expect(foundInvalidMsg).toBe(true);

    // Ensure result is still hidden (no transition to S1)
    const resultStyle2 = await p.getResultDisplayStyle();
    expect(resultStyle).toBe('none');

    // No uncaught page errors expected
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: nMax <= nStart triggers an alert and prevents test', async ({ page }) => {
    const dialogMessages2 = [];
    page.on('dialog', async d => { dialogMessages.push(d.message()); await d.accept(); });

    await page.goto(APP_URL, { waitUntil: 'load' });
    const p5 = new OmegaPage(page);

    // Provide valid expressions but set nMax <= nStart to trigger the validation alert
    await p.setCustomF('n');
    await p.setCustomG('1');
    await p.setNStart(100);
    await p.setNMax(10);

    await p.clickTest();

    // Expect a dialog about n max must be greater than n start.
    expect(dialogMessages.length).toBeGreaterThanOrEqual(1);
    expect(dialogMessages.some(m => m.includes('n max must be greater than n start'))).toBe(true);

    // Result should still be hidden
    const resultStyle3 = await p.getResultDisplayStyle();
    expect(resultStyle).toBe('none');
  });

  test('S1 -> S0 via WindowLoad: after testing, reload hides result and plots defaults', async ({ page }) => {
    await page.goto(APP_URL, { waitUntil: 'load' });
    const p6 = new OmegaPage(page);

    // Run test to enter Testing state
    await p.clickTest();
    await expect(page.locator('#result')).toHaveCSS('display', 'block');

    // Reload page to simulate window.load event and return to idle
    await page.reload({ waitUntil: 'load' });

    // After reload, result must be hidden
    await expect(page.locator('#result')).toHaveCSS('display', 'none');

    // Code box should have been reset/initialized for presets
    const codeText2 = await (await p.codeBox()).innerText();
    expect(codeText).toContain('f(n) =');
    expect(codeText).toContain('g(n) =');

    // Canvas should have data
    const dataUrl1 = await p.getCanvasDataUrl();
    expect(typeof dataUrl).toBe('string');
    expect(dataUrl.length).toBeGreaterThan(100);
  });

  // Final test to assert that no unexpected console errors or page errors occurred during a series of typical interactions
  test('Observe console and page errors across interactions (should be none)', async ({ page }) => {
    const consoleMessages2 = [];
    const pageErrors4 = [];
    page.on('console', m => consoleMessages.push({type: m.type(), text: m.text()}));
    page.on('pageerror', e => pageErrors.push(e));

    await page.goto(APP_URL, { waitUntil: 'load' });
    const p7 = new OmegaPage(page);

    // Perform some typical interactions
    await p.clickTest();
    await p.changePresetFByIndex(3);
    await p.changePresetGByIndex(1);
    await p.setCustomF('');
    await p.setCustomG('');
    await p.clickReset();

    // Allow a short moment for any async errors to surface
    await page.waitForTimeout(200);

    // Assert no page errors
    expect(pageErrors.length).toBe(0);

    // Assert no console.error messages (warnings/info may exist, but no errors)
    const errors2 = consoleMessages.filter(m => m.type === 'error');
    expect(errors.length).toBe(0);
  });
});