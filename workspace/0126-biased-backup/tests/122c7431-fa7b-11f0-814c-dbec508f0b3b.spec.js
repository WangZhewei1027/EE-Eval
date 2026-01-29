import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122c7431-fa7b-11f0-814c-dbec508f0b3b.html';

// Page Object to encapsulate interactions and queries for the Big-O Notation app
class BigOPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.startButton = page.locator('#start-button');
    this.resetButton = page.locator('#reset-button');
    this.clearButton = page.locator('#clear-button');
    this.maximizeButton = page.locator('#maximize-button');
    this.interactButton = page.locator('#interact-button');
    this.inputField = page.locator('#input-field');
    this.addButton = page.locator('#add-button');
    this.subtractButton = page.locator('#subtract-button');
    this.multiplyButton = page.locator('#multiply-button');
    this.divideButton = page.locator('#divide-button');
    this.clearInputFieldButton = page.locator('#clear-input-field');
    this.submitButton = page.locator('#submit-button');
    this.output = page.locator('#output');
    this.results = page.locator('#results');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async fillInput(value) {
    await this.inputField.fill(String(value));
  }

  async clickStart() {
    await this.startButton.click();
  }

  async clickReset() {
    await this.resetButton.click();
  }

  async clickClear() {
    await this.clearButton.click();
  }

  async clickMaximize() {
    await this.maximizeButton.click();
  }

  async clickInteract() {
    await this.interactButton.click();
  }

  async clickAdd() {
    await this.addButton.click();
  }

  async clickSubtract() {
    await this.subtractButton.click();
  }

  async clickMultiply() {
    await this.multiplyButton.click();
  }

  async clickDivide() {
    await this.divideButton.click();
  }

  async clickClearInputField() {
    await this.clearInputFieldButton.click();
  }

  async clickSubmit() {
    await this.submitButton.click();
  }

  async outputText() {
    return (await this.output.textContent()) || '';
  }

  async inputValue() {
    return (await this.inputField.inputValue()) || '';
  }

  async isInteractVisible() {
    // Use Playwright's isVisible which checks computed visibility
    try {
      return await this.interactButton.isVisible();
    } catch {
      return false;
    }
  }

  async isInteractDisabled() {
    return await this.interactButton.isDisabled();
  }

  async isStartDisabled() {
    return await this.startButton.isDisabled();
  }

  async interactColor() {
    // read style.color computed (inline style set by script)
    return await this.page.evaluate((el) => el.style.color, await this.interactButton.elementHandle());
  }

  async interactDisplayStyle() {
    return await this.page.evaluate((el) => el.style.display, await this.interactButton.elementHandle());
  }
}

test.describe('Big-O Notation FSM and UI behavior - Application 122c7431...', () => {
  // Containers for console and page errors observed during a test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages for the page (info/warn/error etc.)
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      // push the error object; tests will assert absence/presence as needed
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // After each test assert there were no runtime page errors (ReferenceError/SyntaxError/TypeError).
    // The instructions required us to observe console logs and page errors and assert them.
    // Here we assert that no uncaught exceptions happened in the page runtime during the test.
    const errorTypes = pageErrors.map((e) => (e && e.name) || 'UnknownError');

    // If pageErrors is non-empty, provide detailed failure message listing errors.
    expect(pageErrors.length, `Expected no uncaught page errors, but found: ${errorTypes.join(', ')}`).toBe(0);

    // Also assert that console did not emit 'error' level messages.
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length, `Expected no console.error messages, but found: ${consoleErrors.map(c => c.text).join(' | ')}`).toBe(0);
  });

  test.describe('State S0_Idle (Initial)', () => {
    test('Initial page render should be Idle: start button present, output empty', async ({ page }) => {
      // Validate initial rendering and idle state (S0_Idle)
      const app = new BigOPage(page);
      await app.goto();

      // The Start button must be present and enabled
      await expect(app.startButton).toBeVisible();
      await expect(app.startButton).toBeEnabled();

      // Output should be empty on initial render (entry action renderPage() in FSM maps to rendering)
      expect(await app.outputText()).toBe('');

      // Interact button initially should be visible (no init script hiding it) and enabled
      expect(await app.isInteractVisible()).toBe(true);
      expect(await app.isInteractDisabled()).toBe(false);

      // Input field should exist and be empty
      await expect(app.inputField).toBeVisible();
      expect(await app.inputValue()).toBe('');
    });
  });

  test.describe('Transitions from S0_Idle to S1_Started and related behaviors', () => {
    test('Start button sets output to Big-O Notation of input and changes button states (S1_Started)', async ({ page }) => {
      const app = new BigOPage(page);
      await app.goto();

      // Fill input with a numeric value and click start
      await app.fillInput('42');
      await app.clickStart();

      // Output should reflect the parsed numeric value
      expect(await app.outputText()).toBe('Big-O Notation of input: 42');

      // Start button should be disabled after starting
      expect(await app.isStartDisabled()).toBe(true);

      // Interact button should be enabled, visible, and styled blue per start()
      expect(await app.isInteractDisabled()).toBe(false);
      expect(await app.isInteractVisible()).toBe(true);
      expect(await app.interactColor()).toBe('blue');
      expect(await app.interactDisplayStyle()).toBe('block');
    });

    test('Start with empty input should show NaN in output (edge case: non-numeric input)', async ({ page }) => {
      const app = new BigOPage(page);
      await app.goto();

      // Ensure input is empty and click start
      await app.fillInput('');
      await app.clickStart();

      // parseFloat('') -> NaN, so output should include NaN
      expect(await app.outputText()).toBe('Big-O Notation of input: NaN');

      // Start disabled and interact enabled/displayed as per start()
      expect(await app.isStartDisabled()).toBe(true);
      expect(await app.isInteractDisabled()).toBe(false);
      expect(await app.isInteractVisible()).toBe(true);
    });
  });

  test.describe('Interact flows (S2_Interacted and S3_Cleared behaviors)', () => {
    test('Interact when input <= 100 retains Big-O output and hides/disables interact (S2_Interacted)', async ({ page }) => {
      const app = new BigOPage(page);
      await app.goto();

      // Start with a value <= 100
      await app.fillInput('50');
      await app.clickStart();

      // Click interact -> should set same output and then hide/disable interact
      await app.clickInteract();

      expect(await app.outputText()).toBe('Big-O Notation of input: 50');

      // After a successful interact, interact button is hidden and disabled, start is enabled
      expect(await app.isInteractVisible()).toBe(false);
      expect(await app.isInteractDisabled()).toBe(true);
      expect(await app.isStartDisabled()).toBe(false);
    });

    test('Interact when input > 100 shows "Too big!" and does not hide interact (edge case)', async ({ page }) => {
      const app = new BigOPage(page);
      await app.goto();

      // Provide a value greater than 100
      await app.fillInput('150');
      await app.clickStart();

      // Click interact -> should display "Too big!" and leave interact enabled/visible
      await app.clickInteract();

      expect(await app.outputText()).toBe('Too big!');

      // interact should still be visible and enabled (script does not change state when >100)
      expect(await app.isInteractVisible()).toBe(true);
      expect(await app.isInteractDisabled()).toBe(false);

      // Start remains disabled because start() previously disabled it
      expect(await app.isStartDisabled()).toBe(true);
    });

    test('Clear button transitions to Cleared (S3_Cleared) from Started', async ({ page }) => {
      const app = new BigOPage(page);
      await app.goto();

      // Start first
      await app.fillInput('77');
      await app.clickStart();

      // Now click Clear button
      await app.clickClear();

      // Output and input should be cleared
      expect(await app.outputText()).toBe('');
      expect(await app.inputValue()).toBe('');

      // Interact button should be hidden and disabled, start should be enabled
      expect(await app.isInteractVisible()).toBe(false);
      expect(await app.isInteractDisabled()).toBe(true);
      expect(await app.isStartDisabled()).toBe(false);
    });
  });

  test.describe('Arithmetic operation transitions (stay in S1_Started but update output)', () => {
    test('Add button updates output with doubled result and resets interact/start state', async ({ page }) => {
      const app = new BigOPage(page);
      await app.goto();

      await app.fillInput('5');
      await app.clickStart();
      await app.clickAdd();

      // result = value * 2 => 10
      expect(await app.outputText()).toBe('Big-O Notation of input: 5, Output: 10');

      // After operation, interact should be hidden & disabled; start enabled
      expect(await app.isInteractVisible()).toBe(false);
      expect(await app.isInteractDisabled()).toBe(true);
      expect(await app.isStartDisabled()).toBe(false);
    });

    test('Subtract button updates output with value-5 result', async ({ page }) => {
      const app = new BigOPage(page);
      await app.goto();

      await app.fillInput('20');
      await app.clickStart();
      await app.clickSubtract();

      expect(await app.outputText()).toBe('Big-O Notation of input: 20, Output: 15');

      expect(await app.isInteractVisible()).toBe(false);
      expect(await app.isInteractDisabled()).toBe(true);
      expect(await app.isStartDisabled()).toBe(false);
    });

    test('Multiply button updates output with value*10 result', async ({ page }) => {
      const app = new BigOPage(page);
      await app.goto();

      await app.fillInput('3');
      await app.clickStart();
      await app.clickMultiply();

      expect(await app.outputText()).toBe('Big-O Notation of input: 3, Output: 30');

      expect(await app.isInteractVisible()).toBe(false);
      expect(await app.isInteractDisabled()).toBe(true);
      expect(await app.isStartDisabled()).toBe(false);
    });

    test('Divide button updates output with value/2 result', async ({ page }) => {
      const app = new BigOPage(page);
      await app.goto();

      await app.fillInput('8');
      await app.clickStart();
      await app.clickDivide();

      expect(await app.outputText()).toBe('Big-O Notation of input: 8, Output: 4');

      expect(await app.isInteractVisible()).toBe(false);
      expect(await app.isInteractDisabled()).toBe(true);
      expect(await app.isStartDisabled()).toBe(false);
    });

    test('Arithmetic operations with non-numeric input produce NaN results (edge case)', async ({ page }) => {
      const app = new BigOPage(page);
      await app.goto();

      // Non-numeric input
      await app.fillInput('not-a-number');
      await app.clickStart();
      await app.clickAdd();

      // parseFloat('not-a-number') -> NaN, NaN * 2 -> NaN so string will include "NaN"
      expect((await app.outputText()).includes('NaN')).toBe(true);
    });
  });

  test.describe('Clear Input Field, Reset, Maximize, and Submit behaviors', () => {
    test('Clear Input Field clears input and output and resets button visibility', async ({ page }) => {
      const app = new BigOPage(page);
      await app.goto();

      await app.fillInput('99');
      await app.clickStart();

      await app.clickClearInputField();

      expect(await app.inputValue()).toBe('');
      expect(await app.outputText()).toBe('');
      expect(await app.isInteractVisible()).toBe(false);
      expect(await app.isInteractDisabled()).toBe(true);
      expect(await app.isStartDisabled()).toBe(false);
    });

    test('Reset button clears output and hides/disables interact (similar to clear)', async ({ page }) => {
      const app = new BigOPage(page);
      await app.goto();

      await app.fillInput('12');
      await app.clickStart();

      await app.clickReset();

      expect(await app.outputText()).toBe('');
      expect(await app.isInteractVisible()).toBe(false);
      expect(await app.isInteractDisabled()).toBe(true);
      expect(await app.isStartDisabled()).toBe(false);
    });

    test('Maximize sets the Big-O output and hides/disables interact', async ({ page }) => {
      const app = new BigOPage(page);
      await app.goto();

      await app.fillInput('7');
      // Intentionally do NOT click start first to ensure maximize can be used independently
      await app.clickMaximize();

      // maximize uses parseFloat on the input field; since we set it to 7, expect output accordingly
      expect(await app.outputText()).toBe('Big-O Notation of input: 7');

      // interact hidden and disabled, start enabled after maximize
      expect(await app.isInteractVisible()).toBe(false);
      expect(await app.isInteractDisabled()).toBe(true);
      expect(await app.isStartDisabled()).toBe(false);
    });

    test('Submit button exists and is clickable (has no handler in HTML, ensure no errors on click)', async ({ page }) => {
      const app = new BigOPage(page);
      await app.goto();

      // Clicking submit should not throw; there is no event handler attached in the implementation.
      // We specifically observe console/page errors in afterEach; clicking should be safe.
      await app.clickSubmit();

      // No crash expected: output unchanged
      expect(await app.outputText()).toBe('');
    });
  });

  test.describe('Comprehensive scenario - exercise full FSM flow', () => {
    test('Full user scenario exercising start -> add -> clear -> start -> interact(>100) -> reset', async ({ page }) => {
      const app = new BigOPage(page);
      await app.goto();

      // start with 4 and do add
      await app.fillInput('4');
      await app.clickStart();
      expect(await app.outputText()).toBe('Big-O Notation of input: 4');

      await app.clickAdd();
      expect(await app.outputText()).toBe('Big-O Notation of input: 4, Output: 8');

      // clear input and output
      await app.clickClear();
      expect(await app.outputText()).toBe('');
      expect(await app.inputValue()).toBe('');

      // start with 200 then try interact to trigger "Too big!"
      await app.fillInput('200');
      await app.clickStart();
      expect(await app.outputText()).toBe('Big-O Notation of input: 200');

      await app.clickInteract();
      expect(await app.outputText()).toBe('Too big!');

      // reset at the end
      await app.clickReset();
      expect(await app.outputText()).toBe('');
      expect(await app.isInteractVisible()).toBe(false);
      expect(await app.isStartDisabled()).toBe(false);
    });
  });
});