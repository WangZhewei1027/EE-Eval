import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b3e653-fa74-11f0-bb9a-db7e6ecdeeaa.html';

// Page object encapsulating commonly used selectors & actions for the AST demo page.
class AstDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.codeInput = page.locator('#codeInput');
    this.parseBtn = page.locator('#parseBtn');
    this.astOutput = page.locator('#astOutput');
    this.explanation = page.locator('#explanation');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async setInput(value) {
    // Replace the textarea value and blur to emulate user input.
    await this.codeInput.fill(value);
  }

  async clickParse() {
    await this.parseBtn.click();
  }

  async getOutputText() {
    return (await this.astOutput.textContent()) ?? '';
  }

  async getOutputHTML() {
    return (await this.astOutput.innerHTML()) ?? '';
  }

  async waitForOutputNonEmpty(timeout = 2000) {
    await this.page.waitForFunction(
      selector => {
        const el = document.querySelector(selector);
        return el && el.textContent && el.textContent.trim().length > 0;
      },
      '#astOutput',
      { timeout }
    );
  }
}

test.describe('AST Demonstration - FSM states and transitions', () => {
  // Collect console errors and page errors for each test to assert unexpected runtime errors.
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console messages of severity 'error'
    page.on('console', msg => {
      try {
        if (msg.type() === 'error') {
          consoleErrors.push({ text: msg.text(), location: msg.location() });
        }
      } catch (e) {
        // swallow unexpected inspection errors of the console message object
        consoleErrors.push({ text: String(msg), location: null });
      }
    });

    // Capture unhandled page errors
    page.on('pageerror', err => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // Basic guarantee: tests will assert specific expectations themselves.
    // Here we do not automatically fail on console/page errors; individual tests assert as needed.
  });

  test('Initial page load triggers an initial parse and renders AST (S0_Idle -> S1_Parsing -> S3_Output)', async ({ page }) => {
    // Validate that on load the page renders and an initial parse happens automatically.
    const app = new AstDemoPage(page);

    await app.goto();

    // Wait for the output to be populated by the initial parse triggered on window.load.
    await app.waitForOutputNonEmpty(3000);

    const outputText = await app.getOutputText();

    // Expect the output to contain AST node types for the default example "a + b * (c - 2)"
    // This demonstrates that initial renderPage() and parseAndRender() were executed.
    expect(outputText).toContain('BinaryExpression');
    expect(outputText).toContain('Identifier'); // variables like a, b, c
    expect(outputText).toContain('Literal'); // numeric literal 2

    // Ensure the #codeInput textarea contains the example expression (evidence for S0_Idle)
    const codeValue = await page.locator('#codeInput').inputValue();
    expect(codeValue).toContain('a + b * (c - 2)');

    // There should be no uncaught page errors on regular load.
    expect(pageErrors.length, `Unexpected page errors on load: ${pageErrors.map(e=>String(e)).join(', ')}`).toBe(0);

    // Console errors should be empty as well for a healthy load.
    expect(consoleErrors.length, `Unexpected console errors on load: ${JSON.stringify(consoleErrors)}`).toBe(0);
  });

  test.describe('Parsing interactions (ParseClick and InputChange equivalents)', () => {
    test('Clicking Parse with a valid expression updates AST output (Idle->Parsing->Output)', async ({ page }) => {
      // This test validates parseBtn.addEventListener('click', parseAndRender);
      const app = new AstDemoPage(page);
      await app.goto();

      // Replace the input with a simple valid expression and click parse to trigger parsing.
      await app.setInput('x * (y + 3)');
      await app.clickParse();

      // Wait until output updates to a non-empty result
      await app.waitForOutputNonEmpty(2000);
      const outText = await app.getOutputText();

      // Expect AST structure for the expression:
      // - 'BinaryExpression' for the multiplication
      // - 'Identifier' for x and y
      // - 'Literal' or the number 3 should appear
      expect(outText).toContain('BinaryExpression');
      expect(outText).toContain('Identifier');
      expect(outText).toContain('3');

      // HTML highlighting should wrap numbers or keys with span classes (syntaxHighlight evidence)
      const outHTML = await app.getOutputHTML();
      // The syntaxHighlight wraps numbers in <span class="number">...</span>
      expect(outHTML).toMatch(/class="number"/);

      // No unexpected runtime errors occurred while parsing a valid expression.
      expect(pageErrors.length, 'No page errors expected when parsing valid expression').toBe(0);
      expect(consoleErrors.length, 'No console errors expected when parsing valid expression').toBe(0);
    });

    test('Parsing an incomplete expression shows a SyntaxError message (Parsing->Error)', async ({ page }) => {
      // This validates that parser exceptions are caught and result in astOutput.textContent = `Error: ${e.message}`
      const app = new AstDemoPage(page);
      await app.goto();

      await app.setInput('a +'); // incomplete expression should cause 'Unexpected end of input'
      await app.clickParse();

      // Wait for output to appear
      await app.waitForOutputNonEmpty(2000);
      const outText = await app.getOutputText();

      // The app catches the parser's SyntaxError and displays "Error: ..."
      expect(outText.startsWith('Error:'), 'Expected an Error: message for incomplete input').toBe(true);
      // The parser typically uses message 'Unexpected end of input'
      expect(outText).toContain('Unexpected end of input');

      // Ensure errors are displayed in DOM rather than as uncaught runtime errors.
      expect(pageErrors.length, 'No uncaught page errors expected for handled parser errors').toBe(0);
      expect(consoleErrors.length, 'No console errors expected for handled parser errors').toBe(0);
    });

    test('Unknown character in input results in displayed SyntaxError (tokenize error -> Error state)', async ({ page }) => {
      // This test covers the tokenize branch that throws for unknown characters:
      // tokenization throws 'Unknown token: %' which should be caught and displayed.
      const app = new AstDemoPage(page);
      await app.goto();

      await app.setInput('a % b');
      await app.clickParse();

      await app.waitForOutputNonEmpty(2000);
      const outText = await app.getOutputText();

      expect(outText).toContain('Error:');
      expect(outText).toContain('Unknown token: %');

      // No uncaught exceptions should appear in the browser console/page error stream.
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Empty input displays "Please enter an expression." (Parsing -> Error as empty input special case)', async ({ page }) => {
      // The parseAndRender function short-circuits on empty input and sets astOutput.textContent accordingly.
      const app = new AstDemoPage(page);
      await app.goto();

      // Clear the textarea content to an empty string and trigger parse.
      await app.setInput('');
      await app.clickParse();

      // Wait for output text update:
      await page.waitForFunction(
        () => {
          const el = document.querySelector('#astOutput');
          return el && el.textContent === 'Please enter an expression.';
        },
        { timeout: 2000 }
      );

      const outText = await app.getOutputText();
      expect(outText).toBe('Please enter an expression.');

      // No uncaught runtime errors for this handled condition.
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test('DOM contains required components and attributes (evidence for S0_Idle)', async ({ page }) => {
    // This test verifies the presence and attributes of the key components described in the FSM:
    // - #codeInput textarea with spellcheck="false" and prefilled example text
    // - #parseBtn button with expected label
    // - #astOutput pre element with aria attributes
    const app = new AstDemoPage(page);
    await app.goto();

    // Ensure textarea exists and has the expected attribute
    const textarea = page.locator('#codeInput');
    await expect(textarea).toBeVisible();
    const spell = await textarea.getAttribute('spellcheck');
    expect(spell).toBe('false');

    // The default example content should be present
    const content = await textarea.inputValue();
    expect(content).toContain('Example:'); // comment line
    expect(content).toContain('a + b * (c - 2)');

    // Ensure parse button exists and has correct text
    const btn = page.locator('#parseBtn');
    await expect(btn).toBeVisible();
    expect((await btn.innerText()).trim()).toBe('Parse to AST');

    // Ensure AST output element exists and has the aria attributes specified in FSM
    const pre = page.locator('#astOutput');
    await expect(pre).toBeVisible();
    expect(await pre.getAttribute('aria-live')).toBe('polite');
    expect(await pre.getAttribute('aria-atomic')).toBe('true');

    // No runtime errors expected when merely verifying DOM presence.
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case: deeply nested parentheses and large numbers produce AST or a handled error', async ({ page }) => {
    // This test exercises parser boundaries. It either produces a correct AST or a handled SyntaxError.
    const app = new AstDemoPage(page);
    await app.goto();

    // Deeply nested parentheses: create a moderately deep expression without causing stack blowup.
    const depth = 60;
    const open = '('.repeat(depth);
    const close = ')'.repeat(depth);
    const expr = `${open}1 + 2${close}`;

    await app.setInput(expr);
    await app.clickParse();

    // Wait for output to be non-empty (either AST or an Error message)
    await app.waitForOutputNonEmpty(4000);
    const outText = await app.getOutputText();

    // Accept either a successful AST or an Error message, but ensure no uncaught exceptions.
    const isErrorMessage = outText.startsWith('Error:');
    if (isErrorMessage) {
      // If an error is displayed, it must be from the parser/tokenizer and handled.
      expect(outText).toContain('Error:');
    } else {
      // Otherwise, we expect AST content
      expect(outText).toContain('BinaryExpression');
      expect(outText).toContain('Literal');
    }

    expect(pageErrors.length, 'No uncaught page errors expected for nested expression').toBe(0);
    expect(consoleErrors.length, 'No console errors expected for nested expression').toBe(0);
  });
});