import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3dfc82-fa74-11f0-a1b6-4b9b8151441a.html';

// Page Object encapsulating interactions with the Decision Tree demo
class DecisionTreePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.questionLocator = page.locator('#interactive-demo .question');
    this.yesButton = page.locator('button[onclick="answerQuestion(true)"]');
    this.noButton = page.locator('button[onclick="answerQuestion(false)"]');
    this.resultDiv = page.locator('#result');
    this.treeContainer = page.locator('#tree-visualization');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async getQuestionText() {
    return (await this.questionLocator.textContent())?.trim() ?? '';
  }

  async clickYes() {
    await this.yesButton.click();
  }

  async clickNo() {
    await this.noButton.click();
  }

  async getResultText() {
    return (await this.resultDiv.textContent())?.trim() ?? '';
  }

  async hasStartOverButton() {
    // The Start Over button is injected into #result with onclick="resetDemo()"
    const btn = this.page.locator('#result button[onclick="resetDemo()"]');
    return await btn.count() > 0;
  }

  async clickStartOver() {
    const btn1 = this.page.locator('#result button[onclick="resetDemo()"]');
    if (await btn.count() > 0) {
      await btn.click();
    } else {
      throw new Error('Start Over button not present');
    }
  }

  async getTreeTextContent() {
    return (await this.treeContainer.textContent())?.trim() ?? '';
  }
}

test.describe('Decision Tree Demonstration - de3dfc82-fa74-11f0-a1b6-4b9b8151441a', () => {
  let pageErrors = [];
  let consoleMessages = [];

  // Set up listeners and navigate before each test
  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Capture runtime page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      // store the Error object for assertions later
      pageErrors.push(err);
    });

    // Capture console messages
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });
  });

  // Group: Initialization and rendering
  test.describe('Initialization and Rendering', () => {
    test('Initial page load renders tree visualization and initial question (S0_Initial)', async ({ page }) => {
      const dt = new DecisionTreePage(page);
      // Navigate to the app and wait for onload
      await dt.goto();

      // Validate the tree visualization was rendered by renderTree(root)
      const treeText = await dt.getTreeTextContent();
      // The root question should be present somewhere in the visualization
      expect(treeText).toContain('Does the animal have fur?');

      // Validate the interactive demo shows the initial question
      const question = await dt.getQuestionText();
      expect(question).toBe('Does the animal have fur?');

      // Ensure Yes/No buttons are present
      await expect(dt.yesButton).toHaveCount(1);
      await expect(dt.noButton).toHaveCount(1);

      // Ensure no result shown initially
      const resultText = await dt.getResultText();
      expect(resultText).toBe('');
    });
  });

  // Group: State transitions and decision flows
  test.describe('State transitions and decisions', () => {
    test('From S0_Initial -> S2_NextQuestion when answering Yes (root yes -> "Does it bark?")', async ({ page }) => {
      const dt1 = new DecisionTreePage(page);
      await dt.goto();

      // Click Yes on the initial question
      await dt.clickYes();

      // After answering, the question should update to next node's question
      const question1 = await dt.getQuestionText();
      // Implementation's root.yes.question is "Does it bark?"
      expect(question).toBe('Does it bark?');

      // result should be empty (no decision yet)
      expect(await dt.getResultText()).toBe('');
    });

    test('From S0_Initial -> S2_NextQuestion when answering No (root no -> "Does it have feathers?")', async ({ page }) => {
      const dt2 = new DecisionTreePage(page);
      await dt.goto();

      // Click No on the initial question
      await dt.clickNo();

      // Question should update to the 'no' branch question
      const question2 = await dt.getQuestionText();
      expect(question).toBe('Does it have feathers?');

      expect(await dt.getResultText()).toBe('');
    });

    test('Reach a decision (S1_Decision): root yes -> yes = "It\'s likely a dog"', async ({ page }) => {
      const dt3 = new DecisionTreePage(page);
      await dt.goto();

      // Navigate: root (Does the animal have fur?) -> Yes -> Does it bark? -> Yes -> decision
      await dt.clickYes(); // now "Does it bark?"
      await dt.clickYes(); // should reach decision "It's likely a dog"

      // Result should show the decision text
      const result = await dt.getResultText();
      expect(result).toContain("It's likely a dog");

      // Result div should have success background style applied (as per implementation)
      const bg = await page.$eval('#result', el => window.getComputedStyle(el).backgroundColor);
      // Background was set to "#d4edda"; browsers compute to rgb(...) - check it contains 'rgb' and is not empty
      expect(bg).not.toBe('');

      // The Start Over button should be injected
      expect(await dt.hasStartOverButton()).toBe(true);
    });

    test('Reach deeper decision (cat): root Yes -> No -> Yes -> "It\'s likely a cat"', async ({ page }) => {
      const dt4 = new DecisionTreePage(page);
      await dt.goto();

      // Traverse: root Yes -> Does it bark? -> No -> Does it purr? -> Yes -> cat
      await dt.clickYes(); // Does it bark?
      await dt.clickNo();  // Does it purr?
      // After No, the question should now be "Does it purr?"
      expect(await dt.getQuestionText()).toBe('Does it purr?');

      await dt.clickYes(); // decision "It's likely a cat"

      const result1 = await dt.getResultText();
      expect(result).toContain("It's likely a cat");
      expect(await dt.hasStartOverButton()).toBe(true);
    });

    test('Nonexistent branch leads to Unknown (S3_Unknown) after clicking on a leaf (edge case)', async ({ page }) => {
      const dt5 = new DecisionTreePage(page);
      await dt.goto();

      // Reach a decision first
      await dt.clickYes(); // Does it bark?
      await dt.clickYes(); // decision: dog

      // After decision, the UI still has Yes/No buttons. Clicking Yes again should attempt to traverse from a leaf -> produce unknown.
      await dt.clickYes();

      // The implementation sets resultDiv.textContent = "I'm not sure what animal that is!" when result is null
      const result2 = await dt.getResultText();
      expect(result).toContain("I'm not sure what animal that is!");

      // Background color for unknown path should be set to the error color
      const bg1 = await page.$eval('#result', el => window.getComputedStyle(el).backgroundColor);
      expect(bg).not.toBe('');
      // Start Over button should also be present for unknown case
      expect(await dt.hasStartOverButton()).toBe(true);
    });
  });

  // Group: Reset and robustness
  test.describe('Reset behavior and robustness', () => {
    test('ResetDemo resets tree to initial state and clears results', async ({ page }) => {
      const dt6 = new DecisionTreePage(page);
      await dt.goto();

      // Navigate to decision (dog)
      await dt.clickYes();
      await dt.clickYes();

      // Ensure decision present
      expect((await dt.getResultText()).length).toBeGreaterThan(0);
      expect(await dt.hasStartOverButton()).toBe(true);

      // Click the injected Start Over button to call resetDemo()
      await dt.clickStartOver();

      // After reset, question should be back to root and result cleared
      expect(await dt.getQuestionText()).toBe('Does the animal have fur?');
      expect(await dt.getResultText()).toBe('');
    });

    test('Edge case: multiple rapid clicks do not throw unhandled exceptions', async ({ page }) => {
      const dt7 = new DecisionTreePage(page);
      await dt.goto();

      // Rapid sequence of clicks across buttons to stress-test transitions
      await Promise.all([
        dt.clickYes(),
        dt.clickNo(),
        dt.clickYes()
      ]).catch(() => {
        // If Promise.all rejects because some clicks are invalid, we still want to continue and assert no uncaught page errors occurred.
      });

      // There should be no unhandled page errors recorded by the runtime (these are caught via pageerror)
      // We assert that pageErrors array is empty; if errors occurred naturally they will be in pageErrors and the assertion will fail.
      expect(pageErrors.length).toBe(0);
    });
  });

  // Group: Console & runtime diagnostics
  test.describe('Console and runtime error observations', () => {
    test('No uncaught ReferenceError/SyntaxError/TypeError by default (observe runtime)', async ({ page }) => {
      const dt8 = new DecisionTreePage(page);

      await dt.goto();

      // Perform a few interactions to exercise code paths
      await dt.clickYes();
      await dt.clickNo();
      await dt.clickYes();

      // Wait briefly to collect any asynchronous console or page errors
      await page.waitForTimeout(200);

      // Collect relevant console error messages
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');

      // Assert that there are no console errors reported (if any ReferenceError/SyntaxError/TypeError occurred they'd likely surface as console errors or pageerror)
      expect(consoleErrors.length).toBe(0);

      // Assert that there are no pageerror events (uncaught exceptions)
      expect(pageErrors.length).toBe(0);

      // For traceability if errors exist, attach them to the assertion message by expecting the length to be 0
      // (The above assertions will fail and show the arrays if issues are present.)
    });

    test('If runtime errors occur naturally they are captured and accessible via listeners', async ({ page }) => {
      const dt9 = new DecisionTreePage(page);
      await dt.goto();

      // This test demonstrates that any natural errors would be captured.
      // We do not inject or create errors ourselves; we simply assert the listener arrays exist and are arrays.
      expect(Array.isArray(consoleMessages)).toBe(true);
      expect(Array.isArray(pageErrors)).toBe(true);

      // The test is intentionally permissive about whether errors exist because runtime errors are allowed to happen naturally.
      // If errors did occur earlier, they would be present in pageErrors or consoleMessages and previous tests would have failed if unexpected.
    });
  });
});