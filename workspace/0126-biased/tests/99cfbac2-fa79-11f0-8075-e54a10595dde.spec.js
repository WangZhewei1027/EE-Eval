import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99cfbac2-fa79-11f0-8075-e54a10595dde.html';

class ProcessPage {
  /**
   * Page object encapsulating interactions with the Interactive Process Demonstrator.
   * Methods intentionally interact with the page exactly as-is (no patching or global injection).
   */
  constructor(page) {
    this.page = page;
    this.step1 = page.locator('#step1');
    this.step2 = page.locator('#step2');
    this.step3 = page.locator('#step3');
    this.step4 = page.locator('#step4');

    this.startButton = page.locator('button[onclick="nextStep(1)"]');
    this.nextFrom2Button = page.locator('button[onclick="nextStep(2)"]');
    this.nextFrom3Button = page.locator('button[onclick="nextStep(3)"]');
    this.backFrom2Button = page.locator('button[onclick="previousStep(2)"]');
    this.backFrom3Button = page.locator('button[onclick="previousStep(3)"]');
    this.resetButton = page.locator('button[onclick="resetProcess()"]');

    this.inputA = page.locator('#inputA');
    this.sliderB = page.locator('#sliderB');
    this.sliderBValue = page.locator('#sliderBValue');

    this.displayInputA = page.locator('#displayInputA');
    this.displaySliderB = page.locator('#displaySliderB');
  }

  async open() {
    await this.page.goto(BASE_URL);
  }

  // Start the process: from step1 to step2
  async startProcess() {
    await this.startButton.click();
  }

  // Fill input A text
  async setInputA(text) {
    await this.inputA.fill(text);
  }

  // Set slider value and dispatch input event so oninput handler runs
  async setSliderB(value) {
    // Work through page context to ensure native input event fires exactly as in the page environment.
    await this.page.$eval('#sliderB', (el, val) => {
      el.value = String(val);
      // Dispatch native input event to trigger oninput handler defined inline.
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, value);
  }

  // Proceed from step2 to step3 (Next Step)
  async nextFrom2() {
    await this.nextFrom2Button.click();
  }

  // Proceed from step3 to step4 (Confirm)
  async nextFrom3() {
    await this.nextFrom3Button.click();
  }

  // Go back from step2 to step1
  async backFrom2() {
    await this.backFrom2Button.click();
  }

  // Go back from step3 to step2
  async backFrom3() {
    await this.backFrom3Button.click();
  }

  // Reset process from step4 to step1
  async resetProcess() {
    await this.resetButton.click();
  }

  // Helpers to evaluate visibility and values

  async isStepVisible(stepLocator) {
    // Use isVisible which checks computed styles
    return stepLocator.isVisible();
  }

  async getDisplayedInputA() {
    return (await this.displayInputA.textContent()) || '';
  }

  async getDisplayedSliderB() {
    return (await this.displaySliderB.textContent()) || '';
  }

  async getSliderDisplayedSpanValue() {
    return (await this.sliderBValue.textContent()) || '';
  }

  async getInputAValue() {
    return (await this.inputA.inputValue()) || '';
  }

  async getSliderBValue() {
    return (await this.sliderB.evaluate(el => el.value));
  }
}

test.describe('Interactive Process Demonstrator - FSM validation', () => {
  let page;
  let proc;
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ browser }) => {
    // Create a fresh page for each test
    page = await browser.newPage();
    consoleErrors = [];
    pageErrors = [];

    // Capture console error messages
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location()
        });
      }
    });

    // Capture uncaught exceptions on the page
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    proc = new ProcessPage(page);
    await proc.open();
  });

  test.afterEach(async () => {
    // Assert there were no uncaught page errors
    // This validates that loading and interactions did not produce runtime exceptions like ReferenceError/TypeError.
    expect(pageErrors, 'Unexpected uncaught page errors').toEqual([]);
    expect(consoleErrors, 'Unexpected console.error calls').toEqual([]);

    await page.close();
  });

  test('Initial state (S1_ChooseAction) is shown and has Start Process button', async () => {
    // Validate initial state UI: step1 visible and others hidden
    expect(await proc.isStepVisible(proc.step1)).toBeTruthy();
    expect(await proc.isStepVisible(proc.step2)).toBeFalsy();
    expect(await proc.isStepVisible(proc.step3)).toBeFalsy();
    expect(await proc.isStepVisible(proc.step4)).toBeFalsy();

    // Ensure Start Process button exists and is enabled
    await expect(proc.startButton).toBeVisible();
    await expect(proc.startButton).toBeEnabled();
  });

  test('Transition: Start Process -> Step 2 (S1 -> S2)', async () => {
    // Click Start Process and verify step2 becomes visible
    await proc.startProcess();

    expect(await proc.isStepVisible(proc.step1)).toBeFalsy();
    expect(await proc.isStepVisible(proc.step2)).toBeTruthy();
  });

  test('Configure Options (S2) - input and slider interactions update UI', async () => {
    // Navigate to step2
    await proc.startProcess();
    // Edge case: slider default displays correct initial value
    expect(await proc.getSliderDisplayedSpanValue()).toBe('50');

    // Set inputA and slider value and ensure slider's oninput updates the span
    await proc.setInputA('Test Value A');
    await proc.setSliderB(80);

    // The span next to the slider should reflect the updated value immediately
    expect(await proc.getSliderDisplayedSpanValue()).toBe('80');

    // Ensure form controls hold the expected values
    expect(await proc.getInputAValue()).toBe('Test Value A');
    expect(await proc.getSliderBValue()).toBe('80');
  });

  test('Transition S2 -> S3 (Next Step) updates confirmation display', async () => {
    // Navigate to step2
    await proc.startProcess();

    // Set fields with specific values
    await proc.setInputA('Confirmed A');
    await proc.setSliderB(33);

    // Proceed to confirmation (step3)
    await proc.nextFrom2();

    // Validate visibility: step3 visible, others hidden
    expect(await proc.isStepVisible(proc.step1)).toBeFalsy();
    expect(await proc.isStepVisible(proc.step2)).toBeFalsy();
    expect(await proc.isStepVisible(proc.step3)).toBeTruthy();

    // Confirm displayed values are copied correctly into confirmation spans
    expect(await proc.getDisplayedInputA()).toBe('Confirmed A');
    expect(await proc.getDisplayedSliderB()).toBe('33');
  });

  test('Back transitions: S2 -> S1 and S3 -> S2 behave correctly', async () => {
    // From step1 to step2
    await proc.startProcess();
    expect(await proc.isStepVisible(proc.step2)).toBeTruthy();

    // Back from step2 to step1
    await proc.backFrom2();
    expect(await proc.isStepVisible(proc.step1)).toBeTruthy();
    expect(await proc.isStepVisible(proc.step2)).toBeFalsy();

    // Move forward to step2 and then to step3
    await proc.startProcess();
    await proc.nextFrom2();

    // Back from step3 to step2
    await proc.backFrom3();
    expect(await proc.isStepVisible(proc.step2)).toBeTruthy();
    expect(await proc.isStepVisible(proc.step3)).toBeFalsy();
  });

  test('Complete flow to final step (S3 -> S4) and Reset process (S4 -> S1) resets controls', async () => {
    // Start at step1
    // Go to step2
    await proc.startProcess();

    // Set some values
    await proc.setInputA('Final A');
    await proc.setSliderB(99);

    // Next to step3 (confirmation)
    await proc.nextFrom2();
    // Confirm shows values
    expect(await proc.getDisplayedInputA()).toBe('Final A');
    expect(await proc.getDisplayedSliderB()).toBe('99');

    // Confirm -> step4
    await proc.nextFrom3();

    // Validate step4 visible
    expect(await proc.isStepVisible(proc.step4)).toBeTruthy();

    // Click reset to go back to step1
    await proc.resetProcess();

    // After reset: step1 visible and inputs reset
    expect(await proc.isStepVisible(proc.step1)).toBeTruthy();
    expect(await proc.isStepVisible(proc.step2)).toBeFalsy();
    expect(await proc.isStepVisible(proc.step3)).toBeFalsy();
    expect(await proc.isStepVisible(proc.step4)).toBeFalsy();

    // inputA should be cleared, slider reset to 50, slider span updated, and confirmation spans cleared
    expect(await proc.getInputAValue()).toBe('');
    expect(await proc.getSliderBValue()).toBe('50');
    expect(await proc.getSliderDisplayedSpanValue()).toBe('50');
    expect(await proc.getDisplayedInputA()).toBe('');
    expect(await proc.getDisplayedSliderB()).toBe('');
  });

  test('Edge case: Proceed with empty inputs from S2 to S3 should display empty values (no errors)', async () => {
    // Move to step2
    await proc.startProcess();

    // Ensure inputs are empty/default
    await proc.setInputA('');
    await proc.setSliderB(50);

    // Proceed to confirmation
    await proc.nextFrom2();

    // Expect displayed values to reflect emptiness/defaults
    expect(await proc.getDisplayedInputA()).toBe('');
    expect(await proc.getDisplayedSliderB()).toBe('50');
  });

  test('Verify that FSM-declared entry action renderPage() is not present in the global scope (do not inject)', async () => {
    // The FSM mentioned an entry action renderPage() for the initial state.
    // The implementation does not define renderPage; assert that it is undefined.
    // We deliberately do not inject or define renderPage ourselves; we only observe the page.
    const hasRenderPage = await page.evaluate(() => {
      return typeof window.renderPage !== 'function';
    });
    // Expect renderPage is not defined as a function. This validates mismatch between FSM meta and implementation.
    expect(hasRenderPage).toBeTruthy();
  });

  test('Observe console and page errors during a full interaction flow (ensures none are produced)', async () => {
    // Perform a full run through of interactions
    await proc.startProcess();
    await proc.setInputA('ObserveErrors');
    await proc.setSliderB(25);
    await proc.nextFrom2();
    await proc.nextFrom3();
    await proc.resetProcess();

    // The afterEach hook asserts there are no console/page errors; we also make an assertion here for clarity.
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });
});