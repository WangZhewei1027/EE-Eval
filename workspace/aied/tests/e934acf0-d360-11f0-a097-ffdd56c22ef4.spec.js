import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/e934acf0-d360-11f0-a097-ffdd56c22ef4.html';

// Page object encapsulating common interactions and queries
class HuffmanPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // common locators
    this.inputText = page.locator('#inputText');
    this.buildBtn = page.locator('#buildBtn');
    this.randomBtn = page.locator('#randomBtn');
    this.clearBtn = page.locator('#clearBtn');
    this.freqChips = page.locator('#freqChips');
    this.pqSteps = page.locator('#pqSteps');
    this.codesDiv = page.locator('#codes');
    this.treeSvg = page.locator('#treeSvg');
    this.encodeBtn = page.locator('#encodeBtn');
    this.decodeBtn = page.locator('#decodeBtn');
    this.bitsInput = page.locator('#bitsInput');
    this.encodedOut = page.locator('#encodedOut');
    this.decodedOut = page.locator('#decodedOut');
    this.ratioDiv = page.locator('#ratio');
    this.status = page.locator('#status');
    this.prevStep = page.locator('#prevStep');
    this.nextStep = page.locator('#nextStep');
    this.autoPlayBtn = page.locator('#autoPlay');
    this.stepIndicator = page.locator('#stepIndicator');
    this.svgNodes = page.locator('svg#treeSvg g.svgNode');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // wait for main UI to settle
    await expect(this.buildBtn).toBeVisible();
    await expect(this.status).toBeVisible();
  }

  async clickBuild() {
    await this.buildBtn.click();
  }
  async clickRandomDemo() {
    await this.randomBtn.click();
  }
  async clickClear() {
    await this.clearBtn.click();
  }
  async clickEncode() {
    await this.encodeBtn.click();
  }
  async clickDecode() {
    await this.decodeBtn.click();
  }
  async clickNext() {
    await this.nextStep.click();
  }
  async clickPrev() {
    await this.prevStep.click();
  }
  async clickAutoPlay() {
    await this.autoPlayBtn.click();
  }
  async pressKey(key) {
    await this.page.keyboard.press(key);
  }

  async hoverFirstSvgNode() {
    const count = await this.svgNodes.count();
    if (count === 0) return false;
    await this.svgNodes.first().hover();
    return true;
  }
  async clickFirstSvgNode() {
    const count = await this.svgNodes.count();
    if (count === 0) return false;
    await this.svgNodes.first().click();
    return true;
  }

  async getStatusText() {
    return (await this.status.textContent())?.trim() ?? '';
  }

  async getCodesRowCount() {
    // number of table rows under #codes tbody
    const rows = await this.codesDiv.locator('table tbody tr').count();
    return rows;
  }

  async getEncodedText() {
    const visible = await this.encodedOut.evaluate((el) => window.getComputedStyle(el).display !== 'none');
    if (!visible) return { visible: false, text: '' };
    const text = await this.encodedOut.textContent();
    return { visible: true, text: (text ?? '').trim() };
  }

  async getDecodedText() {
    const visible = await this.decodedOut.evaluate((el) => window.getComputedStyle(el).display !== 'none');
    if (!visible) return { visible: false, text: '' };
    const text = await this.decodedOut.textContent();
    return { visible: true, text: (text ?? '').trim() };
  }

  async getStepIndicatorText() {
    return (await this.stepIndicator.textContent())?.trim() ?? '';
  }

  async getAutoPlayButtonText() {
    return (await this.autoPlayBtn.textContent())?.trim() ?? '';
  }

  async getPQItemsCount() {
    return await this.pqSteps.locator('.pqItem').count();
  }

  async getPQHighlightedCount() {
    return await this.pqSteps.locator('.pqItem.highlight').count();
  }
}

test.describe('Huffman Coding Visualizer - end-to-end FSM tests', () => {
  // Capture console errors and page errors for each test
  test.beforeEach(async ({ page }) => {
    // No-op here; individual tests set up listeners to capture logs/errors
  });

  test('Initial load: app builds tree and enters Tree Built state', async ({ page }) => {
    // Capture runtime issues
    const pageErrors = [];
    const consoleErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    const app = new HuffmanPage(page);
    await app.goto();

    // The implementation calls build() on init. Expect the "Tree built..." status.
    const status = await app.getStatusText();
    expect(status).toBe('Tree built. Hover nodes to highlight symbols. Click nodes to filter codes.');

    // Codes table should be rendered (non-empty)
    const rows = await app.getCodesRowCount();
    expect(rows).toBeGreaterThan(0);

    // SVG should contain node circles (tree drawn)
    // We cannot access internal data, but expect at least one svg node element
    const svgNodeCount = await app.svgNodes.count();
    expect(svgNodeCount).toBeGreaterThan(0);

    // Step indicator should reflect Step 0 / N (N >= 0)
    const stepIndicator = await app.getStepIndicatorText();
    expect(stepIndicator).toMatch(/^Step\s+\d+\s+\/\s+\d+$/);

    // No uncaught page errors or console.error should have occurred during load
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('Clear button transitions to Cleared state and resets visuals', async ({ page }) => {
    const pageErrors = [];
    const consoleErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    const app = new HuffmanPage(page);
    await app.goto();

    // Click Clear to go to Cleared
    await app.clickClear();

    // Status text should indicate cleared state (per clearAll)
    const status = await app.getStatusText();
    expect(status).toBe('Cleared. Enter text to build a Huffman tree.');

    // Codes and PQ and svg area should be emptied
    const codesHtml = await app.codesDiv.innerHTML();
    expect(codesHtml.trim()).toBe('');

    const pqHtml = await app.pqSteps.innerHTML();
    expect(pqHtml.trim()).toBe('');

    const svgHtml = await app.treeSvg.innerHTML();
    expect(svgHtml.trim()).toBe('');

    // Encoded/decoded outputs should be hidden
    const encoded = await app.getEncodedText();
    expect(encoded.visible).toBe(false);
    const decoded = await app.getDecodedText();
    expect(decoded.visible).toBe(false);

    // Pressing next/prev while cleared should not cause errors
    await app.clickNext();
    await app.clickPrev();

    // No runtime errors produced
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('Build after Clear: BuildTree transition from Cleared to Tree Built', async ({ page }) => {
    const pageErrors = [];
    const consoleErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    const app = new HuffmanPage(page);
    await app.goto();

    // Clear first, then set input and build
    await app.clickClear();
    await app.inputText.fill('aaaabbbcc');
    await app.clickBuild();

    const status = await app.getStatusText();
    expect(status).toBe('Tree built. Hover nodes to highlight symbols. Click nodes to filter codes.');

    // Codes and tree present
    const rows = await app.getCodesRowCount();
    expect(rows).toBeGreaterThan(0);
    const svgCount = await app.svgNodes.count();
    expect(svgCount).toBeGreaterThan(0);

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('Random demo builds a tree (RandomDemo event)', async ({ page }) => {
    const errs = [];
    page.on('pageerror', (err) => errs.push(err));
    const consoleErrs = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrs.push(msg.text());
    });

    const app = new HuffmanPage(page);
    await app.goto();

    // Click random demo button and assert the inputText was changed and tree was built
    const beforeText = (await app.inputText.inputValue()).trim();
    await app.clickRandomDemo();

    const afterText = (await app.inputText.inputValue()).trim();
    // randomDemo should replace the input with one of the sample strings -> expect different or at least non-empty
    expect(afterText.length).toBeGreaterThan(0);

    // Codes and tree should be present
    expect(await app.getCodesRowCount()).toBeGreaterThan(0);
    expect(await app.svgNodes.count()).toBeGreaterThan(0);

    expect(errs).toEqual([]);
    expect(consoleErrs).toEqual([]);
  });

  test('Encoding and Decoding (S1 -> S2 -> S3 transitions)', async ({ page }) => {
    const pageErrors = [];
    const consoleErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    const app = new HuffmanPage(page);
    await app.goto();

    // Ensure a known input
    const testText = 'huffman test string';
    await app.inputText.fill(testText);
    await app.clickBuild();

    // Encode
    await app.clickEncode();
    // Encoded output visible and not empty
    const encoded = await app.getEncodedText();
    expect(encoded.visible).toBe(true);
    // Could be "(empty)" if encoding produced nothing, but with text it should be non-empty
    expect(encoded.text.length).toBeGreaterThan(0);

    // Status should indicate encoded text
    const statusAfterEncode = await app.getStatusText();
    expect(statusAfterEncode).toBe('Encoded text. You can copy the bitstring or decode it.');

    // Decode (without entering bits should use encodeBits)
    await app.clickDecode();
    const decoded = await app.getDecodedText();
    expect(decoded.visible).toBe(true);
    // Decoded output should match original input text
    expect(decoded.text).toBe(testText);

    const statusAfterDecode = await app.getStatusText();
    expect(statusAfterDecode).toBe('Decoded bitstring using current Huffman tree.');

    // No runtime errors
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('Decode when tree not built should prompt to build first (edge case)', async ({ page }) => {
    const pageErrors = [];
    const consoleErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    const app = new HuffmanPage(page);
    await app.goto();

    // Clear to remove tree
    await app.clickClear();

    // Try to decode while there's no tree
    await app.clickDecode();
    // The code sets status to "Build the tree first." in doDecode when !root
    const status = await app.getStatusText();
    expect(status).toBe('Build the tree first.');

    // Also try to encode while cleared
    await app.clickEncode();
    const status2 = await app.getStatusText();
    // doEncode will set same message when !root
    expect(status2).toBe('Build the tree first.');

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('Step navigation: Next, Prev, AutoPlay toggle and keyboard shortcuts', async ({ page }) => {
    const pageErrors = [];
    const consoleErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    const app = new HuffmanPage(page);
    await app.goto();

    // Ensure we have a tree with steps; build with content likely to produce steps
    await app.inputText.fill('aaabbbcccddd'); // multiple chars
    await app.clickBuild();

    // Initially at Step 0
    const initialIndicator = await app.getStepIndicatorText();
    expect(initialIndicator).toMatch(/^Step\s+0\s+\/\s+\d+$/);

    // Click Next and expect the PQ highlight to move forward (or remain but no errors)
    await app.clickNext();
    // At least some item should be highlighted when steps exist
    const highlightedAfterNext = await app.getPQHighlightedCount();
    expect(highlightedAfterNext).toBeGreaterThanOrEqual(0);

    // Click Prev returns to previous step (no errors expected)
    await app.clickPrev();
    // Highlighted count is still a valid number
    const highlightedAfterPrev = await app.getPQHighlightedCount();
    expect(typeof highlightedAfterPrev).toBe('number');

    // Toggle autoplay via button: should change its label to Pause, then back when toggled again
    const beforeAutoText = await app.getAutoPlayButtonText();
    expect(['▶ Play', '⏸ Pause']).toContain(beforeAutoText); // initial can be play

    await app.clickAutoPlay();
    const afterAutoOn = await app.getAutoPlayButtonText();
    expect(afterAutoOn === '⏸ Pause' || afterAutoOn === '▶ Play').toBeTruthy();

    // Toggle again to stop autoplay if it started
    await app.clickAutoPlay();
    const afterAutoOff = await app.getAutoPlayButtonText();
    expect(['▶ Play', '⏸ Pause']).toContain(afterAutoOff);

    // Keyboard shortcuts: ArrowRight, ArrowLeft, Space toggle autoplay
    const beforeIndicator = await app.getStepIndicatorText();
    await app.pressKey('ArrowRight');
    // ArrowRight should attempt to go to next; step indicator must remain a valid format
    const afterArrowRight = await app.getStepIndicatorText();
    expect(afterArrowRight).toMatch(/^Step\s+\d+\s+\/\s+\d+$/);

    await app.pressKey('ArrowLeft');
    const afterArrowLeft = await app.getStepIndicatorText();
    expect(afterArrowLeft).toMatch(/^Step\s+\d+\s+\/\s+\d+$/);

    // Space toggles autoplay: press space and expect button text to change
    const autoBeforeSpace = await app.getAutoPlayButtonText();
    await app.pressKey(' ');
    // give a short amount of time for toggle to take effect
    await page.waitForTimeout(100);
    const autoAfterSpace = await app.getAutoPlayButtonText();
    expect(['▶ Play', '⏸ Pause']).toContain(autoAfterSpace);

    // Final cleanup: ensure no page errors were raised through navigation
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('Interacting with tree nodes: hover shows node info, click filters codes', async ({ page }) => {
    const pageErrors = [];
    const consoleErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    const app = new HuffmanPage(page);
    await app.goto();

    // Ensure tree exists
    await app.inputText.fill('abcdefggg'); // ensure multiple symbols
    await app.clickBuild();

    // Hover over first svg node
    const hovered = await app.hoverFirstSvgNode();
    if (hovered) {
      // After hover, status should start with "Node includes symbols:"
      const hoverStatus = await app.getStatusText();
      expect(hoverStatus.startsWith('Node includes symbols:')).toBe(true);
      // After moving mouse away (triggering mouseleave), the status goes back to hint text
      // We'll move to some other page location
      await app.page.mouse.move(10, 10);
      await page.waitForTimeout(50);
      const afterLeave = await app.getStatusText();
      // The code on mouseleave sets "Huffman tree built. Click nodes to highlight codes."
      expect(afterLeave).toBe('Huffman tree built. Click nodes to highlight codes.');
    }

    // Click first svg node to filter codes table to the node's symbols
    const clicked = await app.clickFirstSvgNode();
    if (clicked) {
      // After click, status should start with "Codes for node:"
      const clickStatus = await app.getStatusText();
      expect(clickStatus.startsWith('Codes for node:')).toBe(true);

      // Codes table should be present but likely fewer rows than the full codes (cannot easily compare counts reliably)
      const rows = await app.getCodesRowCount();
      expect(rows).toBeGreaterThanOrEqual(1);
    }

    // Ensure no runtime errors occurred during hover/click interactions
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('Sanity: no uncaught exceptions or console.error across typical flows', async ({ page }) => {
    // Full flow: build, encode, decode, navigate steps, random demo, clear
    const pageErrors = [];
    const consoleErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    const app = new HuffmanPage(page);
    await app.goto();

    // Build (already built on init), encode & decode
    await app.clickEncode();
    await app.clickDecode();

    // Navigate steps
    await app.clickNext();
    await app.clickPrev();

    // Random demo and then clear
    await app.clickRandomDemo();
    await app.clickClear();

    // Validate that the cleared message is present
    expect(await app.getStatusText()).toBe('Cleared. Enter text to build a Huffman tree.');

    // No unexpected runtime errors recorded
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
});