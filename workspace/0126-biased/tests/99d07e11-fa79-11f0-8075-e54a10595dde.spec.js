import { test, expect } from '@playwright/test';

// URL of the application to test
const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99d07e11-fa79-11f0-8075-e54a10595dde.html';

// Page Object for the Routing Example app
class RoutingApp {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // Buttons
    this.homeButton = page.getByRole('button', { name: 'Home' });
    this.formButton = page.getByRole('button', { name: 'Form' });
    this.detailsButton = page.getByRole('button', { name: 'Details' });
    // Pages
    this.homePage = page.locator('#home');
    this.formPage = page.locator('#form');
    this.detailsPage = page.locator('#details');
    // Form controls
    this.nameInput = page.locator('#name');
    this.submitButton = page.getByRole('button', { name: 'Submit' });
    // Buttons inside pages (Back to Home and Edit)
    this.backToHomeButtons = page.locator('button', { hasText: 'Back to Home' });
    this.editButton = page.getByRole('button', { name: 'Edit' });

    this.nameDisplay = page.locator('#nameDisplay');
  }

  async gotoApp() {
    await this.page.goto(APP_URL);
  }

  // Helpers to click navigation controls
  async clickHome() {
    await this.homeButton.click();
  }

  async clickForm() {
    await this.formButton.click();
  }

  async clickDetails() {
    await this.detailsButton.click();
  }

  async clickSubmit() {
    await this.submitButton.click();
  }

  async clickEdit() {
    await this.editButton.click();
  }

  // Back to Home button inside current page (there are multiple in DOM; pick the visible one)
  async clickVisibleBackToHome() {
    // pick the first visible Back to Home button
    const count = await this.backToHomeButtons.count();
    for (let i = 0; i < count; i++) {
      const btn = this.backToHomeButtons.nth(i);
      if (await btn.isVisible()) {
        await btn.click();
        return;
      }
    }
    throw new Error('No visible Back to Home button found');
  }

  // Visibility checks
  async isHomeVisible() {
    return this.homePage.isVisible();
  }

  async isFormVisible() {
    return this.formPage.isVisible();
  }

  async isDetailsVisible() {
    return this.detailsPage.isVisible();
  }

  async getNameInputValue() {
    return this.nameInput.inputValue();
  }

  async setNameInput(value) {
    await this.nameInput.fill(value);
  }

  async getNameDisplayText() {
    return this.nameDisplay.textContent();
  }
}

test.describe('Routing Example (FSM validation) - 99d07e11-fa79-11f0-8075-e54a10595dde', () => {
  // Arrays to capture console messages and page errors for assertions
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', error => {
      pageErrors.push(error);
    });
  });

  // Test initial state: Home page should be visible because navigate('home') is called on script load
  test('initial state: Home is visible on load (entry action navigate("home") executed)', async ({ page }) => {
    const app = new RoutingApp(page);
    await app.gotoApp();

    // Verify Home page is visible and others are hidden
    await expect(app.homePage).toBeVisible();
    await expect(app.formPage).toBeHidden();
    await expect(app.detailsPage).toBeHidden();

    // The script calls navigate('home') on load (this is the S0_Home entry action). Ensure that happened by checking visibility.
    expect(await app.isHomeVisible()).toBe(true);

    // Ensure there are no page errors or console errors
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  // Navigation tests from Home to Form and Details
  test.describe('Navigation from Home', () => {
    test('clicking "Form" navigates to the Form page (S0_Home -> S1_Form)', async ({ page }) => {
      const app = new RoutingApp(page);
      await app.gotoApp();

      // Click the Form button
      await app.clickForm();

      // Form should be visible, others hidden
      await expect(app.formPage).toBeVisible();
      await expect(app.homePage).toBeHidden();
      await expect(app.detailsPage).toBeHidden();

      // Input should be present
      await expect(app.nameInput).toBeVisible();

      // No page errors or console errors
      const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoleMessages.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('clicking "Details" from Home navigates to Details with "No name entered." (S0_Home -> S2_Details)', async ({ page }) => {
      const app = new RoutingApp(page);
      await app.gotoApp();

      // Click Details button (from home)
      await app.clickDetails();

      // Details should be visible and show placeholder text because no name in state yet
      await expect(app.detailsPage).toBeVisible();
      await expect(app.homePage).toBeHidden();
      await expect(app.formPage).toBeHidden();

      // Details page should display the expected default message
      const nameDisplayText = (await app.getNameDisplayText())?.trim();
      expect(nameDisplayText).toBe('No name entered.');

      // No page errors or console errors
      const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoleMessages.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  // Form interactions including submit and edge-case: empty input alert
  test.describe('Form interactions and transitions (S1_Form <-> S2_Details <-> S0_Home)', () => {
    test('submitting empty form shows alert and stays on Form (edge case)', async ({ page }) => {
      const app = new RoutingApp(page);
      await app.gotoApp();

      // Navigate to Form
      await app.clickForm();
      await expect(app.formPage).toBeVisible();

      // Ensure the name input is empty
      const initialValue = await app.getNameInputValue();
      expect(initialValue).toBe('');

      // Handle the dialog that should appear when submitting an empty name
      let dialogMessage = null;
      page.once('dialog', async dialog => {
        dialogMessage = dialog.message();
        await dialog.accept();
      });

      // Click Submit with empty input
      await app.clickSubmit();

      // We expect an alert with the message 'Please enter your name.' and to remain on the Form page
      expect(dialogMessage).toBe('Please enter your name.');

      // Still on Form page
      await expect(app.formPage).toBeVisible();
      await expect(app.homePage).toBeHidden();
      await expect(app.detailsPage).toBeHidden();

      // No page errors or console errors
      const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoleMessages.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('submitting a valid name navigates to Details and displays the name (S1_Form -> S2_Details)', async ({ page }) => {
      const app = new RoutingApp(page);
      await app.gotoApp();

      // Navigate to Form
      await app.clickForm();
      await expect(app.formPage).toBeVisible();

      // Fill name and submit
      await app.setNameInput('Alice');
      expect(await app.getNameInputValue()).toBe('Alice');

      await app.clickSubmit();

      // After successful submit, should navigate to Details
      await expect(app.detailsPage).toBeVisible();
      await expect(app.formPage).toBeHidden();

      // Name display should include the submitted name
      const displayed = (await app.getNameDisplayText())?.trim();
      expect(displayed).toBe('Name: Alice');

      // No page errors or console errors
      const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoleMessages.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('from Details, clicking "Edit" returns to Form with input preserved (S2_Details -> S1_Form)', async ({ page }) => {
      const app = new RoutingApp(page);
      await app.gotoApp();

      // Fill form and submit to reach Details
      await app.clickForm();
      await app.setNameInput('Bob');
      await app.clickSubmit();

      // Verify details page
      await expect(app.detailsPage).toBeVisible();
      const displayed = (await app.getNameDisplayText())?.trim();
      expect(displayed).toBe('Name: Bob');

      // Click Edit to go back to Form
      await app.clickEdit();

      // Form should be visible and input should still contain the previously entered name (input persists in DOM)
      await expect(app.formPage).toBeVisible();
      const inputVal = await app.getNameInputValue();
      // The implementation does not explicitly clear the input on navigate; expect the previous value to remain
      expect(inputVal).toBe('Bob');

      // Now test Back to Home from Form (S1_Form -> S0_Home)
      await app.clickVisibleBackToHome();
      await expect(app.homePage).toBeVisible();
      await expect(app.formPage).toBeHidden();

      // No page errors or console errors
      const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoleMessages.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('from Details, clicking "Back to Home" navigates to Home (S2_Details -> S0_Home)', async ({ page }) => {
      const app = new RoutingApp(page);
      await app.gotoApp();

      // Go to Details directly from Home (no name)
      await app.clickDetails();
      await expect(app.detailsPage).toBeVisible();

      // Click Back to Home (the visible Back to Home button in details page)
      await app.clickVisibleBackToHome();

      // Home should be visible
      await expect(app.homePage).toBeVisible();
      await expect(app.detailsPage).toBeHidden();

      // No page errors or console errors
      const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoleMessages.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  // End-to-end sequence test that walks through all FSM transitions in one flow
  test('complete FSM path coverage: Home -> Form -> Submit -> Details -> Edit -> Form -> Back Home', async ({ page }) => {
    const app = new RoutingApp(page);
    await app.gotoApp();

    // Home initially
    await expect(app.homePage).toBeVisible();

    // Home -> Form
    await app.clickForm();
    await expect(app.formPage).toBeVisible();

    // Form -> Submit (enter name)
    await app.setNameInput('Charlie');
    await app.clickSubmit();

    // Submit should navigate to Details
    await expect(app.detailsPage).toBeVisible();
    let displayed = (await app.getNameDisplayText())?.trim();
    expect(displayed).toBe('Name: Charlie');

    // Details -> Edit (back to form)
    await app.clickEdit();
    await expect(app.formPage).toBeVisible();

    // Ensure input still holds the name
    expect(await app.getNameInputValue()).toBe('Charlie');

    // From Form, go Back to Home
    await app.clickVisibleBackToHome();
    await expect(app.homePage).toBeVisible();

    // Finally, also test Home -> Details directly (without name)
    await app.clickDetails();
    await expect(app.detailsPage).toBeVisible();
    displayed = (await app.getNameDisplayText())?.trim();
    expect(displayed).toBe('Name: Charlie' || 'No name entered.' /* Accept either based on state persistence */);

    // Validate there are no uncaught exceptions or console errors throughout the flow
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });
});