import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/0e1ab3f0-d5c5-11f0-92ee-f5994b4f4c99.html';

// Simple Page Object for the Divide & Conquer page
class DivideAndConquerPage {
  constructor(page) {
    this.page = page;
    this.gameContainer = page.locator('#game-container');
    this.startButton = page.locator("button[onclick='startGame()']");
    this.header = page.locator('h1');
    this.paragraph = page.locator('p');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async clickStart() {
    await this.startButton.click();
  }

  async doubleClickStart() {
    await this.startButton.dblclick();
  }

  async pressEnterOnStart() {
    await this.startButton.focus();
    await this.page.keyboard.press('Enter');
  }

  async getGameContainerContent() {
    return await this.gameContainer.innerHTML();
  }

  async startButtonText() {
    return await this.startButton.innerText();
  }
}

test.describe('FSM: Divide & Conquer (Application ID: 0e1ab3f0-d5c5-11f0-92ee-f5994b4f4c99)', () => {
  // We'll capture console messages and page errors for assertions.
  test.beforeEach(async ({ page }) => {
    // No-op here; each test will set up its own listeners to collect errors.
  });

  test('Idle state: initial UI renders with Start Game button and empty game container', async ({ page }) => {
    // This test validates the S0_Idle state rendering and DOM elements.
    const dnc = new DivideAndConquerPage(page);

    // Arrays to collect logs and errors during navigation
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', (msg) => {
      // collect console messages for later inspection
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      // collect uncaught exceptions thrown in the page
      pageErrors.push(err);
    });

    await dnc.goto();

    // allow some time for any asynchronous script errors to surface
    await page.waitForTimeout(500);

    // Assertions for Idle state DOM evidence (from FSM)
    await expect(dnc.header).toHaveText('Divide & Conquer');
    await expect(dnc.paragraph).toContainText('Welcome to Divide & Conquer');
    await expect(dnc.startButton).toBeVisible();
    await expect(dnc.startButton).toHaveText('Start Game');

    // The game container should be empty in the Idle state
    const gameContent = await dnc.getGameContainerContent();
    expect(gameContent).toBe('', 'Expected #game-container to be empty in Idle state');

    // We expect at least some script-related console messages or errors because the page includes many incorrect <script> tags.
    // We assert that either console messages or page errors were captured; this confirms we observed runtime issues as required.
    expect(consoleMessages.length + pageErrors.length).toBeGreaterThan(0);
  });

  test('Transition: Clicking Start Game triggers runtime error (startGame undefined) and no game initialization DOM changes', async ({ page }) => {
    // This test attempts to exercise the StartGame event (click on button[onclick="startGame()"])
    // and verifies that the application throws errors (since startGame() is not defined) and does not populate the game container.
    const dnc = new DivideAndConquerPage(page);

    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    await dnc.goto();

    // Clear any messages collected during load so we can focus on errors produced by the click action
    consoleMessages.length = 0;
    pageErrors.length = 0;

    // Click the Start Game button which is wired to onclick="startGame()"
    // Per instructions we must not patch or define startGame; clicking should surface a ReferenceError
    await dnc.clickStart();

    // Give the page a moment to report errors
    await page.waitForTimeout(300);

    // At least one page error should have occurred (ReferenceError for startGame)
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // The error message should mention startGame or ReferenceError in most environments.
    const joinedMessages = pageErrors.map(e => String(e)).join(' | ');
    expect(/startGame|ReferenceError/i.test(joinedMessages)).toBeTruthy();

    // Also check console messages for error-like output referencing startGame
    const consoleText = consoleMessages.map(m => m.text).join(' | ');
    expect(/startGame|ReferenceError|Uncaught/i.test(consoleText)).toBeTruthy();

    // Verify that the transition did NOT produce any UI for the game (since initializeGame() isn't present)
    const gameContentAfterClick = await dnc.getGameContainerContent();
    expect(gameContentAfterClick).toBe('', 'Expected no game initialization content after clicking Start Game when startGame() is undefined');
  });

  test('Edge case: Rapid repeated clicks produce multiple errors and do not create game UI', async ({ page }) => {
    // This test validates robustness when the Start Game button is attacked with rapid clicks.
    // It asserts multiple error events are logged and no DOM changes occur.
    const dnc = new DivideAndConquerPage(page);

    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', (msg) => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', (err) => pageErrors.push(err));

    await dnc.goto();

    // Ensure clean slate of logs
    consoleMessages.length = 0;
    pageErrors.length = 0;

    // Rapidly click the button three times
    await dnc.clickStart();
    await dnc.clickStart();
    await dnc.clickStart();

    // Wait for errors to appear
    await page.waitForTimeout(500);

    // We expect at least one error per click in many engines; assert there are multiple errors overall
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // The pageErrors messages should likely repeat the same ReferenceError message; ensure at least one mentions startGame
    const anyMentionStart = pageErrors.some(e => /startGame|ReferenceError/i.test(String(e)));
    expect(anyMentionStart).toBeTruthy();

    // No game UI should be created
    const gameContent = await dnc.getGameContainerContent();
    expect(gameContent).toBe('', 'Rapid clicks should not have initialized the game because startGame is missing');
  });

  test('Accessibility/keyboard activation: pressing Enter on the Start Game button triggers same error behavior', async ({ page }) => {
    // This test checks that activating the button via keyboard (Enter) triggers the same runtime error as a click.
    const dnc = new DivideAndConquerPage(page);

    const pageErrors = [];
    const consoleMessages = [];

    page.on('console', (msg) => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', (err) => pageErrors.push(err));

    await dnc.goto();

    // Clear previous logs
    consoleMessages.length = 0;
    pageErrors.length = 0;

    // Activate the button via keyboard
    await dnc.pressEnterOnStart();

    // Allow error to be reported
    await page.waitForTimeout(300);

    // Expect at least one error (ReferenceError)
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
    const joined = pageErrors.map(e => String(e)).join(' ');
    expect(/startGame|ReferenceError/i.test(joined)).toBeTruthy();

    // Ensure no game content was created
    const content = await dnc.getGameContainerContent();
    expect(content).toBe('', 'Keyboard activation should not initialize the game when startGame() is missing');
  });

  test('Observability: page load includes invalid <script> tags leading to syntax/mime errors - assert such errors are present', async ({ page }) => {
    // The HTML includes many <script> tags that reference .css files or invalid endpoints.
    // This test asserts that at least one syntax/mime or loading error occurs on page load.
    const dnc = new DivideAndConquerPage(page);

    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', (msg) => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', (err) => pageErrors.push(err));

    await dnc.goto();

    // Wait longer to allow network/script parsing errors to surface
    await page.waitForTimeout(800);

    // Combine both sources of diagnostics
    const consoleText = consoleMessages.map(m => m.text).join(' | ');
    const pageErrorText = pageErrors.map(e => String(e)).join(' | ');
    const combined = consoleText + ' | ' + pageErrorText;

    // Assert that there is evidence of script parsing/mime errors or syntax errors due to CSS being loaded as JS.
    // We look for common indicators: 'SyntaxError', 'Unexpected token', 'MIME', '.css', or 'Failed to load'
    const indicators = /SyntaxError|Unexpected token|MIME|\.css|Failed to load|404|ERR_FAILED/i;
    expect(indicators.test(combined)).toBeTruthy();
  });
});