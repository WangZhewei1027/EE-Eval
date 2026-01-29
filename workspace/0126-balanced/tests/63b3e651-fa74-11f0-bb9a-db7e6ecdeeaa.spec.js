import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b3e651-fa74-11f0-bb9a-db7e6ecdeeaa.html';

// Page Object for the compiler demo page
class CompilerPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.sourceSel = '#sourceCode';
    this.compileBtnSel = '#compileBtn';
    this.tokensSel = '#tokensOutput';
    this.parseSel = '#parseOutput';
    this.codeSel = '#codeOutput';
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  async getSource() {
    return this.page.locator(this.sourceSel).inputValue();
  }

  async setSource(text) {
    const ta = this.page.locator(this.sourceSel);
    await ta.fill(''); // clear first
    await ta.type(text);
  }

  async clickCompile() {
    await this.page.click(this.compileBtnSel);
  }

  tokensLocator() {
    return this.page.locator(this.tokensSel);
  }
  parseLocator() {
    return this.page.locator(this.parseSel);
  }
  codeLocator() {
    return this.page.locator(this.codeSel);
  }

  async getTokensText() {
    return this.tokensLocator().textContent();
  }
  async getParseText() {
    return this.parseLocator().textContent();
  }
  async getCodeText() {
    return this.codeLocator().textContent();
  }
  async getCodeInnerHTML() {
    return this.page.locator(this.codeSel).evaluate(el => el.innerHTML);
  }

  // Wait until tokens output becomes non-empty (used after compile)
  async waitForTokensNonEmpty(timeout = 2000) {
    await this.page.waitForFunction(selector => {
      const el = document.querySelector(selector);
      return el && el.textContent && el.textContent.trim().length > 0;
    }, this.tokensSel, { timeout });
  }
}

test.describe('Compiler Concept Demonstration - FSM states & transitions', () => {
  // Capture console messages and page errors to observe runtime problems
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    page.on('console', msg => {
      // Collect console messages including errors
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', err => {
      // Capture unhandled exceptions bubbling to pageerror
      pageErrors.push(err);
    });
  });

  test('S0_Idle: initial UI renders with expected components and default texts', async ({ page }) => {
    // Validate Idle state: textarea and outputs exist with initial content
    const app = new CompilerPage(page);
    await app.goto();

    // Verify source textarea has the expected initial program (multi-line)
    const source = await app.getSource();
    expect(source).toContain('a = 3 + 5 * (2 - 1);');
    expect(source).toContain('b = a * 4 - 7;');
    expect(source).toContain('b + 10;');

    // Verify outputs show the initial hints as per the HTML
    const tokensText = await app.getTokensText();
    const parseText = await app.getParseText();
    const codeText = await app.getCodeText();

    expect(tokensText).toContain('(Press "Compile" to see tokens)');
    expect(parseText).toContain('(Press "Compile" to see parse tree)');
    expect(codeText).toContain('(Press "Compile" to see code)');

    // No uncaught page errors should have occurred simply loading the page
    expect(pageErrors).toHaveLength(0);
  });

  test('S0_Idle -> S1_Compiling -> success: clicking Compile clears outputs then fills tokens, parse, and code', async ({ page }) => {
    // This test validates the transition from Idle to Compiling and successful compile result
    const app1 = new CompilerPage(page);
    await app.goto();

    // Attach a short listener snapshot before click
    const initialTokensBefore = await app.getTokensText();
    expect(initialTokensBefore).toContain('(Press "Compile" to see tokens)');

    // Click compile and assert immediate clearing behavior (S1_Compiling entry actions)
    await Promise.all([
      // Trigger click
      app.clickCompile(),
      // Wait for the microtask - token clearing is synchronous in click handler, we don't need extra wait
    ]);

    // Immediately after click, handlers clear these outputs; validate they are empty strings quickly
    // Use textContent() which may return null/empty; coerce to string
    const tokensAfterClick = await app.getTokensText();
    const parseAfterClick = await app.getParseText();
    const codeAfterClick = await app.getCodeText();

    // The FSM evidence shows tokensOutput.textContent = ''; parseOutput.textContent = ''; codeOutput.textContent = '';
    expect(tokensAfterClick === '' || (tokensAfterClick && tokensAfterClick.trim() === '')).toBeTruthy();
    expect(parseAfterClick === '' || (parseAfterClick && parseAfterClick.trim() === '')).toBeTruthy();
    expect(codeAfterClick === '' || (codeAfterClick && codeAfterClick.trim() === '')).toBeTruthy();

    // Now wait for the asynchronous compilation to finish and outputs to be populated
    await app.waitForTokensNonEmpty(3000); // tokens will be populated first

    const finalTokens = await app.getTokensText();
    const finalParse = await app.getParseText();
    const finalCode = await app.getCodeText();

    // Tokens output should include token type names like NUMBER or IDENT
    expect(finalTokens).toMatch(/NUMBER|IDENT|ASSIGN|SEMICOLON/);

    // Parse output should include structural names from the pretty printer: Program, Assignment, BinaryExpression, Identifier, Literal
    expect(finalParse).toMatch(/Program|Assignment|BinaryExpression|Identifier|Literal/);

    // Code output should include generated temporaries and assignments like t1 or assignment to 'a' or 'b'
    expect(finalCode).toMatch(/t1|t2|a =|b =/);

    // Ensure no unexpected unhandled page errors occurred during compile
    expect(pageErrors).toHaveLength(0);

    // Also ensure console did not report errors (if there are logs, make sure none with type 'error')
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(consoleErrors.length).toBe(0);
  });

  test('S1_Compiling -> S2_Error: syntax error during parsing results in error UI (codeOutput innerHTML contains .error)', async ({ page }) => {
    // This test intentionally supplies malformed source to exercise the Error state and the catch block
    const app2 = new CompilerPage(page);
    await app.goto();

    // Provide a missing closing parenthesis to provoke a parser error: Parser error: expected ')'
    const badSource = 'a = (1 + 2;\n'; // missing closing parenthesis and semicolon might also trigger
    await app.setSource(badSource);

    // Click compile to trigger compilation and catch path
    await app.clickCompile();

    // The click handler clears outputs immediately, so ensure they are blank
    const tokensCleared = await app.getTokensText();
    const parseCleared = await app.getParseText();
    expect(tokensCleared === '' || (tokensCleared && tokensCleared.trim() === '')).toBeTruthy();
    expect(parseCleared === '' || (parseCleared && parseCleared.trim() === '')).toBeTruthy();

    // After compile, since parser will throw, the catch will set codeOutput.innerHTML to a .error div
    // Wait for the code output innerHTML to contain an element with class "error"
    await page.waitForFunction(selector => {
      const el1 = document.querySelector(selector);
      return el && el.innerHTML && el.innerHTML.includes('class="error"');
    }, app.codeSel, { timeout: 2000 });

    const codeInnerHTML = await app.getCodeInnerHTML();
    expect(codeInnerHTML).toContain('class="error"');

    // Inspect the error message text to match the parser error
    // The parser throws "Parser error: expected ')'"
    expect(codeInnerHTML).toMatch(/Parser error: expected \'\)\'|Error during compilation/);

    // tokens and parse outputs remain empty in the catch path
    const tokensFinal = await app.getTokensText();
    const parseFinal = await app.getParseText();
    expect(tokensFinal === '' || (tokensFinal && tokensFinal.trim() === '')).toBeTruthy();
    expect(parseFinal === '' || (parseFinal && parseFinal.trim() === '')).toBeTruthy();

    // No unhandled page errors should have been emitted — the compile error is caught by the page script
    expect(pageErrors).toHaveLength(0);
  });

  test('Error scenario: lexer unknown character triggers caught error and displays error message', async ({ page }) => {
    // This test provokes a Lexer error to exercise the catch block and error display
    const app3 = new CompilerPage(page);
    await app.goto();

    // Insert an unknown character '$' which the lexer doesn't accept
    const badLexerSource = 'a = 3 $ 4;';
    await app.setSource(badLexerSource);

    // Click compile and wait for the error div to appear in code output
    await app.clickCompile();

    await page.waitForFunction(selector => {
      const el2 = document.querySelector(selector);
      return el && el.innerHTML && el.innerHTML.includes('class="error"');
    }, app.codeSel, { timeout: 2000 });

    const codeInnerHTML1 = await app.getCodeInnerHTML();
    expect(codeInnerHTML).toContain('class="error"');
    expect(codeInnerHTML).toMatch(/Lexer error: Unknown character/);

    // tokens and parse should be cleared as per catch block
    const tokensFinal1 = await app.getTokensText();
    const parseFinal1 = await app.getParseText();
    expect(tokensFinal === '' || (tokensFinal && tokensFinal.trim() === '')).toBeTruthy();
    expect(parseFinal === '' || (parseFinal && parseFinal.trim() === '')).toBeTruthy();

    // The error was handled by the page JavaScript (caught), so pageErrors remains empty
    expect(pageErrors).toHaveLength(0);
  });

  test('Verify that compile action is idempotent and multiple clicks behave consistently', async ({ page }) => {
    // This test clicks Compile multiple times and ensures behavior remains consistent and no unhandled errors are produced
    const app4 = new CompilerPage(page);
    await app.goto();

    // Use the default valid source
    for (let i = 0; i < 3; i++) {
      await app.clickCompile();

      // Wait until tokens are present after each compile
      await app.waitForTokensNonEmpty(2000);

      const tokens = await app.getTokensText();
      const parse = await app.getParseText();
      const code = await app.getCodeText();

      expect(tokens).toMatch(/NUMBER|IDENT/);
      expect(parse).toMatch(/Program|Assignment|BinaryExpression/);
      expect(code).toMatch(/t1|t2|a =|b =/);
    }

    // No unhandled page errors during repeated compiles
    expect(pageErrors).toHaveLength(0);
  });
});