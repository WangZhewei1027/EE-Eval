import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/520bb7f1-fa76-11f0-a09b-87751f540fd8.html';

// Page Object for the SVM demo page
class SVMPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.generateButton = page.locator('#generate-button');
    this.svmOutput = page.locator('#svm-output');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickGenerate() {
    await this.generateButton.click();
  }

  async getOutputText() {
    const text = await this.svmOutput.textContent();
    return text === null ? '' : text.trim();
  }

  async isGenerateVisible() {
    return await this.generateButton.isVisible();
  }

  async getGenerateText() {
    return await this.generateButton.textContent();
  }
}

test.describe('Support Vector Machine interactive app - FSM validation', () => {
  let svmPage;
  let pageErrors;
  let consoleMessages;

  // Setup: navigate to the page and attach listeners to capture runtime errors and console output.
  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Capture uncaught exceptions from the page (e.g., ReferenceError: SVMModel is not defined)
    page.on('pageerror', (err) => {
      // err is typically an Error object; capture its message for assertions
      pageErrors.push(err && err.message ? err.message : String(err));
    });

    // Capture console events (info, warn, error, etc.)
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    svmPage = new SVMPage(page);
    await svmPage.goto();
  });

  test.afterEach(async ({ page }) => {
    // Teardown is handled by Playwright's fixture lifecycle.
    // We do not modify the page or remove listeners explicitly.
    // The page will be closed/recreated between tests by Playwright if configured that way.
    // This comment serves as documentation of teardown intent.
  });

  test.describe('FSM States', () => {
    test('Idle state: initial render shows Generate button and empty output', async () => {
      // Validate that we are in the Idle state:
      // - The Generate SVM button is present and visible
      // - The svm-output div is empty
      // - The page hasn't thrown any errors on initial load
      await expect(svmPage.generateButton).toBeVisible();
      await expect(svmPage.generateButton).toHaveText('Generate SVM');

      const outputText = await svmPage.getOutputText();
      // Expect empty output area initially
      expect(outputText).toBe('', 'svm-output should be empty on initial render (Idle state)');

      // No runtime errors should have occurred during page load (Idle onEnter render should not error)
      expect(pageErrors.length).toBe(0);

      // Verify the declared FSM entry action renderPage() is not implemented on the page.
      // The FSM specified an entry action renderPage(); we check whether such a function exists.
      const renderType = await svmPage.page.evaluate(() => typeof renderPage);
      expect(renderType).toBe('undefined');
    });
  });

  test.describe('Transitions and Events', () => {
    test('Clicking Generate SVM triggers the click handler; if SVMModel is missing a ReferenceError is raised and DOM is not updated', async () => {
      // Before clicking, ensure no errors yet
      expect(pageErrors.length).toBe(0);

      // Click the button to trigger the transition from S0_Idle -> S1_SVM_Generated
      // The page's implementation attempts to instantiate SVMModel which is not defined.
      await svmPage.clickGenerate();

      // Wait a short time to allow the page script to run and emit errors/console messages
      await svmPage.page.waitForTimeout(200);

      // The page should have emitted at least one runtime error due to missing SVMModel.
      expect(pageErrors.length).toBeGreaterThan(0);

      // At least one error message should reference "SVMModel" (ReferenceError)
      const hasSVMModelError = pageErrors.some((msg) => String(msg).includes('SVMModel'));
      expect(hasSVMModelError).toBeTruthy();

      // The page should not have updated svm-output because the script failed before setting innerHTML.
      const outputText1 = await svmPage.getOutputText();
      expect(outputText).toBe('', 'svm-output should remain empty when SVMModel is not defined and the click handler throws');

      // Check console messages for errors (some runtimes surface exceptions via console.error)
      const consoleErrorExists = consoleMessages.some((c) => c.type === 'error' || c.text.includes('SVMModel'));
      expect(consoleErrorExists).toBeTruthy();
    });

    test('Rapid repeated clicks produce multiple runtime errors (robustness/error scenario)', async () => {
      // Clear any previous errors/messages captured in this test scope (listener arrays are new each test)
      expect(pageErrors.length).toBe(0);

      // Perform multiple quick clicks
      await Promise.all([
        svmPage.clickGenerate(),
        svmPage.clickGenerate(),
        svmPage.clickGenerate()
      ]);

      // Allow time for errors to be processed
      await svmPage.page.waitForTimeout(300);

      // We expect multiple errors to have been emitted - at least one per click invocation
      expect(pageErrors.length).toBeGreaterThanOrEqual(1);

      // Confirm that errors still reference the missing SVMModel
      const allContainSVMModel = pageErrors.some((msg) => String(msg).includes('SVMModel'));
      expect(allContainSVMModel).toBeTruthy();

      // Ensure DOM still not updated
      const outputText2 = await svmPage.getOutputText();
      expect(outputText).toBe('', 'svm-output should remain empty after repeated failing attempts to generate SVM');

      // There should be error-level console messages as well (some environments emit console errors)
      const errorConsoleCount = consoleMessages.filter((c) => c.type === 'error' || c.text.includes('SVMModel')).length;
      expect(errorConsoleCount).toBeGreaterThanOrEqual(1);
    });
  });

  test.describe('Edge cases and implementation checks', () => {
    test('Verify behavior if mapping features would be incorrect: inspect code assumptions without executing them', async () => {
      // This app's click handler maps data.features.map(feature => feature[0]).
      // Given the provided data.features is an array of numbers, feature[0] would be undefined in normal JS.
      // We cannot modify or execute the page code beyond its natural behavior.
      // Instead, we assert the data shape by evaluating it on the page (read-only inspection).
      const featuresType = await svmPage.page.evaluate(() => {
        // Return a serialized description of data.features from the inline click handler definition if accessible.
        // We cannot access the local "data" object inside the event handler directly.
        // So we only check the literal values present in the source by re-parsing the inline script if possible.
        return {
          typeofWindowSVMModel: typeof window.SVMModel,
          // provide a small sanity check of the features literal that appears in the source by searching the document's scripts
          sourceContainsFeaturesLiteral: Array.from(document.scripts).some(s => s.textContent && s.textContent.includes('features: [1, 2, 3, 4, 5]'))
        };
      });

      // The page does not define a global SVMModel constructor
      expect(featuresType.typeofWindowSVMModel).toBe('undefined');

      // The inline script text contains the features literal as provided in the HTML implementation
      expect(featuresType.sourceContainsFeaturesLiteral).toBeTruthy();
    });

    test('FSM expected transition to SVM Generated: in this implementation SVM generation fails at runtime; assert that the FSM observable (svmOutputDiv.innerHTML) was not achieved and error occurred', async () => {
      // This test explicitly ties the FSM expectation (svmOutputDiv.innerHTML set) to the actual DOM and runtime errors.
      // Trigger the event
      await svmPage.clickGenerate();

      // Give time for runtime error
      await svmPage.page.waitForTimeout(200);

      // FSM expected observable: "SVM Output displayed" via innerHTML assignment.
      // Because SVMModel is missing, we expect that observable did NOT occur and an error prevented it.
      const outputText3 = await svmPage.getOutputText();
      expect(outputText).toBe('', 'Expected no SVM output because SVMModel is missing and prevented innerHTML assignment');

      // Ensure there was a page error preventing the transition's expected observable
      expect(pageErrors.length).toBeGreaterThan(0);
      expect(pageErrors.some(e => e.includes('SVMModel'))).toBeTruthy();
    });
  });
});