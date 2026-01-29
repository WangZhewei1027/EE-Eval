import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122dacb2-fa7b-11f0-814c-dbec508f0b3b.html';

// Simple page object to encapsulate interactions with the app
class AppPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // Use accessible roles where possible
    this.addButton = page.getByRole('button', { name: 'Add Person' });
    this.deleteButton = page.getByRole('button', { name: 'Delete Person' });
    this.saveButton = page.getByRole('button', { name: 'Save Data' });
    this.clearButton = page.getByRole('button', { name: 'Clear Data' });
    this.nameInput = page.locator('#name');
    this.errorMessage = page.locator('#errorMessage');
    this.personSlider = page.locator('#personSlider');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Ensure DOM is loaded
    await this.page.waitForLoadState('domcontentloaded');
  }

  async getName() {
    return await this.nameInput.inputValue();
  }

  async setName(value) {
    await this.nameInput.fill(value);
  }

  async clickAdd() {
    await this.addButton.click();
  }

  async clickDelete() {
    await this.deleteButton.click();
  }

  async clickSave() {
    await this.saveButton.click();
  }

  async clickClear() {
    await this.clearButton.click();
  }

  async getErrorText() {
    return (await this.errorMessage.textContent())?.trim() ?? '';
  }

  async getSliderValue() {
    return await this.personSlider.inputValue();
  }

  async setSliderValue(val) {
    await this.personSlider.fill(String(val));
    // For range inputs, set inputValue may not always dispatch events; use evaluate if needed
    await this.page.evaluate((selector, v) => {
      const el = document.querySelector(selector);
      if (el) el.value = v;
    }, '#personSlider', String(val));
  }
}

// Helper to perform an action and capture any page error that occurs as a result
async function capturePageErrorDuring(page, action) {
  // Use Promise.race with a small timeout? Prefer explicit waitForEvent paired with action
  const waitForError = page.waitForEvent('pageerror');
  const actionPromise = action();
  const results = await Promise.allSettled([waitForError, actionPromise]);
  // If waitForError fulfilled -> error object
  if (results[0].status === 'fulfilled') {
    return results[0].value;
  }
  return null;
}

test.describe('Design Patterns - Interactive App (122dacb2...)', () => {
  // Basic lifecycle: load the page before each test
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto(APP_URL);
    await page.waitForLoadState('domcontentloaded');
  });

  test('Initial render: inputs and controls are present and have expected initial values', async ({ page }) => {
    // Validate that render shows the basic UI (S0_Idle)
    const app = new AppPage(page);

    // The name input should be present and initialized to "John" per HTML
    await expect(app.nameInput).toBeVisible();
    const name = await app.getName();
    expect(name).toBe('John');

    // Slider should exist and default to "5"
    await expect(app.personSlider).toBeVisible();
    const sliderValue = await app.getSliderValue();
    expect(sliderValue).toBe('5');

    // The error message span should exist and be empty in Idle
    await expect(app.errorMessage).toBeVisible();
    const errText = await app.getErrorText();
    expect(errText).toBe('');
  });

  test.describe('Add Person and Delete Person interactions (state transitions between Idle and Error)', () => {
    test('Clicking Add Person with valid name remains in Idle and clears any previous errors', async ({ page }) => {
      // This test validates:
      // - When name length >= 2, clicking Add Person does not produce JS runtime errors
      // - Error message is cleared (S0_Idle behavior)
      const app = new AppPage(page);

      // Ensure a valid name is present
      await app.setName('John');
      expect(await app.getName()).toBe('John');

      // Capture any pageerror during click (there should be none)
      const pageError = await capturePageErrorDuring(page, async () => {
        await app.clickAdd();
      });
      expect(pageError).toBeNull();

      // Error message should remain empty
      expect(await app.getErrorText()).toBe('');
    });

    test('Clicking Add Person with short name sets error message (transition to Error state)', async ({ page }) => {
      // This validates the S0_Idle -> S1_Error transition on AddPerson when name < 2
      const app = new AppPage(page);

      // Set short name
      await app.setName('A');
      expect(await app.getName()).toBe('A');

      // Clicking Add Person should not throw a JS runtime error; it should set the error message text
      const pageError = await capturePageErrorDuring(page, async () => {
        await app.clickAdd();
      });
      expect(pageError).toBeNull();

      // Verify the error message text matches the expected string from the implementation
      const err = await app.getErrorText();
      expect(err).toBe('Name must be at least 2 characters.');
    });

    test('From Error state, Add Person with valid name clears error (S1_Error -> S0_Idle)', async ({ page }) => {
      // This validates that clicking Add Person when currently in Error state and providing valid input clears the error
      const app = new AppPage(page);

      // Create error state first
      await app.setName('X');
      await app.clickAdd();
      expect(await app.getErrorText()).toBe('Name must be at least 2 characters.');

      // Now set a valid name and click Add Person to clear the error
      await app.setName('Bob');
      const pageError = await capturePageErrorDuring(page, async () => {
        await app.clickAdd();
      });
      expect(pageError).toBeNull();

      // Error should be cleared according to the implementation of addPerson()
      expect(await app.getErrorText()).toBe('');
    });

    test('Clicking Delete Person with short name sets error message (S0_Idle -> S1_Error) and Delete does not clear error when name later valid (implementation detail)', async ({ page }) => {
      // This test checks both the expected transition to Error on DeletePerson with short name
      // and observes the implementation detail that DeletePerson does not clear errorMessage when name becomes valid (contrary to FSM expectation).
      const app = new AppPage(page);

      // Step 1: short name -> triggers error
      await app.setName('Z');
      const errBefore = await app.getErrorText();
      // ensure currently empty before click
      expect(errBefore === '' || errBefore === 'Name must be at least 2 characters.' ).toBeTruthy();

      const pageError1 = await capturePageErrorDuring(page, async () => {
        await app.clickDelete();
      });
      // deletePerson implementation sets the errorMessage for short name rather than throwing
      expect(pageError1).toBeNull();

      // Error message should now be set
      expect(await app.getErrorText()).toBe('Name must be at least 2 characters.');

      // Step 2: Now set a valid name and click Delete Person
      await app.setName('Charlie');
      expect(await app.getName()).toBe('Charlie');

      // According to FSM the error would be cleared on S1_Error->S0_Idle via DeletePerson,
      // but the actual implementation does not clear errorMessage in deletePerson's else branch.
      const pageError2 = await capturePageErrorDuring(page, async () => {
        await app.clickDelete();
      });
      expect(pageError2).toBeNull();

      // Assert the observed implementation detail: error message remains (not cleared) after Delete Person
      const errAfter = await app.getErrorText();
      // It should still be the previous message because deletePerson does not clear it in code
      expect(errAfter).toBe('Name must be at least 2 characters.');
    });
  });

  test.describe('Save Data and Clear Data event behavior and runtime errors', () => {
    test('Clicking Save Data triggers a runtime error due to missing #age element (assert TypeError/pageerror)', async ({ page }) => {
      // The implementation of saveData tries to access document.getElementById("age").value
      // but there is no element with id="age" in the HTML. This should cause a pageerror (TypeError).
      const app = new AppPage(page);

      // Ensure name is valid (though error will be about age)
      await app.setName('John');

      // Capture pageerror thrown during clicking Save Data
      const [error] = await Promise.allSettled([
        page.waitForEvent('pageerror').then(e => e).catch(e => e),
        (async () => {
          // Click the Save Data button which invokes saveData()
          await app.clickSave();
        })()
      ]);

      // Depending on timing and browser, waitForEvent may resolve or reject - normalize:
      // Use page.waitForEvent above in a try/catch would have been sufficient; here we examine whether a pageerror occurred.
      // To be robust, try to capture the pageerror via an alternate method if not caught above.
      let pageError = null;
      try {
        pageError = await page.waitForEvent('pageerror', { timeout: 1000 });
      } catch (e) {
        // If waitForEvent times out, attempt to see if earlier Promise captured something
        // No additional action; pageError remains null
      }

      // If pageError is null, check the settled result for an Error object
      if (!pageError && error && error.status === 'fulfilled' && error.value) {
        pageError = error.value;
      }

      // At this point we expect a page error to have been raised by saveData due to missing age element.
      expect(pageError).not.toBeNull();
      // The error message should indicate inability to read property 'value' or similar TypeError
      const msg = String(pageError?.message || pageError);
      expect(msg).toMatch(/(Cannot read (property|properties) .*value|Cannot read property 'value'|Cannot read properties of null|TypeError)/i);
    });

    test('Clicking Clear Data triggers a runtime error due to missing #age element (assert TypeError/pageerror)', async ({ page }) => {
      // clearData sets document.getElementById("age").value = "";
      // Since #age is missing this should cause a pageerror (TypeError).
      const app = new AppPage(page);

      // Capture pageerror during clear action
      const pageError = await capturePageErrorDuring(page, async () => {
        await app.clickClear();
      });

      expect(pageError).not.toBeNull();
      const msg = String(pageError.message || pageError);
      expect(msg).toMatch(/(Cannot set property 'value'|Cannot read (property|properties) .*value|Cannot read properties of null|TypeError|Cannot set)/i);
    });
  });

  test.describe('Edge cases and UI validations', () => {
    test('Slider change updates its value and does not produce errors', async ({ page }) => {
      // Validate slider interactions (not directly part of FSM transitions but part of UI)
      const app = new AppPage(page);

      // Change slider value to "8"
      await app.setSliderValue(8);
      const sliderValue = await app.getSliderValue();
      // The input value for range is represented as string
      expect(sliderValue).toBe('8');

      // Ensure no runtime errors occurred just by interacting with slider
      // Try to assert no pageerror within a short timeframe
      let pageError = null;
      try {
        pageError = await page.waitForEvent('pageerror', { timeout: 200 }).catch(() => null);
      } catch (e) {
        pageError = null;
      }
      expect(pageError).toBeNull();
    });

    test('Name input edge cases: empty string and exactly 1 char behave as error state', async ({ page }) => {
      const app = new AppPage(page);

      // Empty string
      await app.setName('');
      await app.clickAdd();
      expect(await app.getErrorText()).toBe('Name must be at least 2 characters.');

      // Exactly 1 character
      await app.setName('Q');
      await app.clickAdd();
      expect(await app.getErrorText()).toBe('Name must be at least 2 characters.');

      // Two characters should clear error
      await app.setName('Al');
      await app.clickAdd();
      expect(await app.getErrorText()).toBe('');
    });
  });
});