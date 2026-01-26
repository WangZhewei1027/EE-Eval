import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324f0d73-fa73-11f0-a9d0-d7a1991987c6.html';

/**
 * Page Object for the OSI Model demo page
 */
class OsiPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.tableRows = page.locator('#osiTable tr');
    this.description = page.locator('#description');
    this.descriptionHeading = page.locator('#description h2');
    this.descriptionParagraph = page.locator('#description p');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickRowByIndex(n) {
    // nth(0) is the header row. Rows for layers start at index 1.
    await this.tableRows.nth(n).click();
  }

  async getDescriptionHeading() {
    return (await this.descriptionHeading.textContent())?.trim() ?? '';
  }

  async getDescriptionParagraph() {
    return (await this.descriptionParagraph.textContent())?.trim() ?? '';
  }

  async getDescriptionInnerHTML() {
    // Return innerHTML for exact-content checks
    return await this.page.locator('#description').evaluate((el) => el.innerHTML);
  }

  async rowCount() {
    return await this.tableRows.count();
  }
}

const LAYERS = [
  /* index 1 */ {
    name: 'Physical Layer',
    func: 'The Physical Layer transmits raw bit streams over a physical medium.'
  },
  /* index 2 */ {
    name: 'Data Link Layer',
    func: 'The Data Link Layer provides node-to-node data transfer and handles error correction from the Physical Layer.'
  },
  /* index 3 */ {
    name: 'Network Layer',
    func: 'The Network Layer determines the path for data transmission and handles routing of packets.'
  },
  /* index 4 */ {
    name: 'Transport Layer',
    func: 'The Transport Layer ensures complete data transfer and provides error recovery and flow control.'
  },
  /* index 5 */ {
    name: 'Session Layer',
    func: 'The Session Layer manages sessions between applications, facilitating communication.'
  },
  /* index 6 */ {
    name: 'Presentation Layer',
    func: 'The Presentation Layer translates data formats, encryption, and compression.'
  },
  /* index 7 */ {
    name: 'Application Layer',
    func: "The Application Layer provides network services directly to the user's application."
  }
];

test.describe('OSI Model Demo - FSM states and transitions', () => {
  // Containers to capture console messages and page errors for each test run
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages (log, error, warning, etc.)
    page.on('console', (msg) => {
      const text = `[console:${msg.type()}] ${msg.text()}`;
      consoleMessages.push(text);
    });

    // Capture runtime exceptions on the page (ReferenceError, TypeError, etc.)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the application page
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // Provide helpful diagnostics if a test failed: log console messages and page errors
    if (pageErrors.length > 0) {
      // Do not modify page; just surface what occurred.
      // Tests themselves may assert on these arrays.
    }
  });

  test('S0_Idle: initial render shows the idle prompt and description container', async ({ page }) => {
    // Validate initial state (S0_Idle) as described in FSM:
    // - The page should render the description container with the prompt text.
    const osi = new OsiPage(page);

    // Ensure the table exists and has expected rows (header + 7 layers)
    const totalRows = await osi.rowCount();
    expect(totalRows).toBeGreaterThanOrEqual(8); // header + 7 layer rows

    // The initial description should prompt the user to click a layer
    const innerHTML = await osi.getDescriptionInnerHTML();
    // Normalize whitespace and assert initial prompt exists
    expect(innerHTML).toContain('Click on a layer to see its description.');

    // The FSM entry action mentions renderPage() but the implementation does not define it.
    // We assert the absence of a global renderPage function so we document the mismatch.
    const renderPageType = await page.evaluate(() => typeof window.renderPage);
    expect(renderPageType).toBe('undefined');

    // Also verify there were no runtime errors during initial load
    expect(pageErrors.length).toBe(0);
  });

  test.describe('LayerClick events: clicking each OSI layer row shows correct description (transition S0 -> S1)', () => {
    // For each layer row (indices 1..7) click and verify description updates accordingly
    for (let i = 0; i < LAYERS.length; i++) {
      const rowIndex = i + 1; // table row index in DOM (0 is header)
      const layer = LAYERS[i];

      test(`Clicking row ${rowIndex} shows "${layer.name}" and its function`, async ({ page }) => {
        const osi = new OsiPage(page);

        // Precondition: showDescription exists as a function in the page
        const showDescType = await page.evaluate(() => typeof window.showDescription);
        expect(showDescType).toBe('function');

        // Click the specific row to trigger the transition
        await osi.clickRowByIndex(rowIndex);

        // After the click, the description heading and paragraph should match the clicked layer
        const heading = await osi.getDescriptionHeading();
        const paragraph = await osi.getDescriptionParagraph();

        expect(heading).toBe(layer.name);
        expect(paragraph).toBe(layer.func);

        // Ensure no runtime page errors resulted from clicking
        expect(pageErrors.length).toBe(0);
      });
    }
  });

  test('Clicking the header row (no onclick) does not change the description', async ({ page }) => {
    // Validate edge case: header row has no onclick handler; clicking it should not change description
    const osi = new OsiPage(page);

    const initialInner = await osi.getDescriptionInnerHTML();

    // Click header row (index 0)
    await osi.clickRowByIndex(0);

    const afterInner = await osi.getDescriptionInnerHTML();

    // No change expected (still the idle prompt)
    expect(afterInner).toBe(initialInner);

    // No runtime errors should be thrown by clicking a non-action row
    expect(pageErrors.length).toBe(0);
  });

  test('Rapid sequential clicks: last click determines final description and no errors occur', async ({ page }) => {
    // Edge case: simulate rapid user clicks across multiple rows and ensure final state is the last clicked
    const osi = new OsiPage(page);

    // Perform rapid clicks on rows 1, 2, 3, 7 in quick succession
    const clickSequence = [1, 2, 3, 7]; // indices mapped to layer rows
    for (const idx of clickSequence) {
      // Fire clicks without awaiting network or DOM transitions (they are synchronous here)
      await osi.clickRowByIndex(idx);
    }

    // Final expected corresponds to the last clicked row (index 7 corresponds to LAYERS[6])
    const expected = LAYERS[6];
    const heading = await osi.getDescriptionHeading();
    const paragraph = await osi.getDescriptionParagraph();

    expect(heading).toBe(expected.name);
    expect(paragraph).toBe(expected.func);

    expect(pageErrors.length).toBe(0);
  });

  test('Behavioral: showDescription function updates DOM exactly with provided values', async ({ page }) => {
    // Validate that showDescription uses the provided arguments to set innerHTML as in implementation
    const osi = new OsiPage(page);

    // Click the Data Link layer (row index 2 -> LAYERS[1])
    await osi.clickRowByIndex(2);

    // The implementation injects an <h2> and <p>. Confirm tags exist and contain expected text.
    const heading = await osi.getDescriptionHeading();
    const paragraph = await osi.getDescriptionParagraph();

    expect(heading).toBe(LAYERS[1].name);
    expect(paragraph).toBe(LAYERS[1].func);

    // No runtime errors during this DOM update
    expect(pageErrors.length).toBe(0);
  });

  test('Implementation mismatch check: renderPage() entry action is not present and thus cannot be invoked', async ({ page }) => {
    // FSM specified renderPage() on entering Idle state. Here we check for its presence but do not call it.
    const typeOfRenderPage = await page.evaluate(() => typeof window.renderPage);
    // We expect it to be undefined in this implementation.
    expect(typeOfRenderPage).toBe('undefined');

    // Confirm that showDescription exists (the interactive behavior is implemented)
    const typeOfShowDescription = await page.evaluate(() => typeof window.showDescription);
    expect(typeOfShowDescription).toBe('function');

    // No runtime errors observed so far
    expect(pageErrors.length).toBe(0);
  });

  test('Diagnostics: capture console output and ensure no unexpected runtime exceptions occurred during interactions', async ({ page }) => {
    const osi = new OsiPage(page);

    // Perform a couple interactions
    await osi.clickRowByIndex(1); // Physical
    await osi.clickRowByIndex(4); // Transport

    // At this point, we assert that there were no page errors (ReferenceError, TypeError, etc.)
    expect(pageErrors.length).toBe(0);

    // It's acceptable if there are console messages (for debugging); assert they are strings if present
    for (const msg of consoleMessages) {
      expect(typeof msg).toBe('string');
    }
  });
});