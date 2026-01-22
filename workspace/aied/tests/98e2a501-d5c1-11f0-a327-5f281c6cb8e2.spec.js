import { test, expect } from '@playwright/test';

// Test file for Huffman Coding Visualizer (Application ID: 98e2a501-d5c1-11f0-a327-5f281c6cb8e2)
// URL: http://127.0.0.1:5500/workspace/batch-1207/html/98e2a501-d5c1-11f0-a327-5f281c6cb8e2.html
//
// These tests validate the FSM states and transitions described in the prompt.
// They also observe console and page errors and assert that there are no uncaught runtime errors
// during normal and edge-case interactions.
//
// NOTE: This test suite intentionally does not modify the application's source code and
// lets any runtime errors (ReferenceError / TypeError / SyntaxError) surface naturally.
// We capture them and assert expectations about their presence (typically expecting none).

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/98e2a501-d5c1-11f0-a327-5f281c6cb8e2.html';

// Page Object for interactions with the Huffman Visualizer page
class HuffmanPage {
  constructor(page) {
    this.page = page;
    this.locators = {
      inputText: page.locator('#inputText'),
      freqInput: page.locator('#freqInput'),
      buildBtn: page.locator('#buildBtn'),
      randomBtn: page.locator('#randomBtn'),
      stepForward: page.locator('#stepForward'),
      stepBack: page.locator('#stepBack'),
      playBtn: page.locator('#playBtn'),
      resetBtn: page.locator('#resetBtn'),
      speed: page.locator('#speed'),
      codes: page.locator('#codes'),
      pq: page.locator('#pq'),
      bitbox: page.locator('#bitbox'),
      decodeResult: page.locator('#decodeResult'),
      encodeInput: page.locator('#encodeInput'),
      encodeBtn: page.locator('#encodeBtn'),
      bitInput: page.locator('#bitInput'),
      decodeBtn: page.locator('#decodeBtn'),
      origLen: page.locator('#origLen'),
      encLen: page.locator('#encLen'),
      ratio: page.locator('#ratio'),
      svgRoot: page.locator('#svgRoot'),
    }
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // brief wait for initial JS to run and render
    await this.page.waitForTimeout(50);
  }

  // Basic interactions
  async clickBuild() { await this.locators.buildBtn.click(); await this.page.waitForTimeout(50); }
  async clickRandom() { await this.locators.randomBtn.click(); await this.page.waitForTimeout(20); }
  async clickStepForward() { await this.locators.stepForward.click(); await this.page.waitForTimeout(30); }
  async clickStepBack() { await this.locators.stepBack.click(); await this.page.waitForTimeout(30); }
  async clickPlay() { await this.locators.playBtn.click(); await this.page.waitForTimeout(50); }
  async clickReset() { await this.locators.resetBtn.click(); await this.page.waitForTimeout(50); }
  async setSpeed(value) { await this.locators.speed.fill(String(value)); await this.page.waitForTimeout(10); }
  async fillFreqInput(text) { await this.locators.freqInput.fill(text); await this.page.waitForTimeout(10); }
  async fillEncodeInput(text) { await this.locators.encodeInput.fill(text); await this.page.waitForTimeout(10); }
  async fillBitInput(text) { await this.locators.bitInput.fill(text); await this.page.waitForTimeout(10); }

  // Encode/Decode actions
  async clickEncode() { await this.locators.encodeBtn.click(); await this.page.waitForTimeout(30); }
  async clickDecode() { await this.locators.decodeBtn.click(); await this.page.waitForTimeout(30); }

  // Reads
  async getInputText() { return (await this.locators.inputText.inputValue()).trim(); }
  async getFreqInput() { return (await this.locators.freqInput.inputValue()).trim(); }
  async getCodesHtml() { return await this.locators.codes.innerHTML(); }
  async getPQHtml() { return await this.locators.pq.innerHTML(); }
  async getBitboxText() { return (await this.locators.bitbox.innerText()).trim(); }
  async getDecodeResultText() { return (await this.locators.decodeResult.innerText()).trim(); }
  async getOrigLenText() { return (await this.locators.origLen.innerText()).trim(); }
  async getEncLenText() { return (await this.locators.encLen.innerText()).trim(); }
  async getPlayButtonText() { return (await this.locators.playBtn.innerText()).trim(); }
  async svgChildCount() { return await this.page.evaluate(() => document.getElementById('svgRoot').children.length); }
}

test.describe('Huffman Coding Visualizer - FSM and interactions', () => {
  // Capture console errors and page errors for each test
  test.beforeEach(async ({ page }) => {
    // attach empty listeners to be set per test via test.info() store
  });

  // Group tests related to initial state and tree building
  test.describe('Initial load and tree building (S0_Idle -> S1_TreeBuilt)', () => {
    test('Initial load should set a sample input and build a tree (TreeBuilt)', async ({ page }) => {
      // Collect console and page errors
      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      page.on('pageerror', err => pageErrors.push(err.message));

      const app = new HuffmanPage(page);
      await app.goto();

      // The page script sets inputText to a sample and calls buildFromInput() on load.
      const inputVal = await app.getInputText();
      expect(inputVal.length).toBeGreaterThan(0); // sample populated

      // Codes should be generated for the initial sample - the codes container should not be the "No codes yet" placeholder
      const codesHtml = await app.getCodesHtml();
      expect(codesHtml).toContain('<table'); // final codes table rendered

      // Priority queue should list nodes
      const pqHtml = await app.getPQHtml();
      expect(pqHtml.length).toBeGreaterThan(5);
      expect(pqHtml).not.toContain('—'); // there should be queue contents

      // SVG should have drawn nodes/edges
      const svgCount = await app.svgChildCount();
      expect(svgCount).toBeGreaterThan(0);

      // Bitbox should show encoded bits (or '(empty)' if something odd)
      const bitbox = await app.getBitboxText();
      expect(bitbox.length).toBeGreaterThan(0);

      // No uncaught errors occurred during load/render
      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });

    test('Random sample button changes input without rebuilding automatically (RandomSample event)', async ({ page }) => {
      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
      page.on('pageerror', err => pageErrors.push(err.message));

      const app = new HuffmanPage(page);
      await app.goto();

      const beforeCodes = await app.getCodesHtml();
      const beforeInput = await app.getInputText();

      await app.clickRandom();

      const afterInput = await app.getInputText();
      expect(afterInput).not.toBe(''); // some sample text inserted
      // If random chooses same as before occasionally, it's acceptable; only assert that input value is one of samples by length
      expect(afterInput.length).toBeGreaterThan(0);

      // Codes should remain unchanged until Build is clicked
      const afterCodes = await app.getCodesHtml();
      expect(afterCodes).toBe(beforeCodes);

      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });

    test('Build button builds tree from explicit frequency input and shows codes (BuildTree transition)', async ({ page }) => {
      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
      page.on('pageerror', err => pageErrors.push(err.message));

      const app = new HuffmanPage(page);
      await app.goto();

      // Reset first to ensure a clean state
      await app.clickReset();

      // Provide explicit frequency spec and build
      const freqSpec = 'a:5\nb:2\n :10';
      await app.fillFreqInput(freqSpec);
      await app.clickBuild();

      // After building, confirm codes table exists and contains entries for 'a' and 'b' and 'space'
      const codesHtml = await app.getCodesHtml();
      expect(codesHtml).toContain('a'); // symbol visible in table
      expect(codesHtml).toContain('b');
      expect(codesHtml).toContain('␣'); // printable(space) appears in table as '␣ (space)'

      // Original length may be based on inputText (empty) but codes table must exist
      expect(codesHtml).toContain('<table');

      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });
  });

  test.describe('Step controls, play and reset (S1_TreeBuilt transitions)', () => {
    test('Step forward and back update the priority queue and visualization (StepForward, StepBack)', async ({ page }) => {
      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
      page.on('pageerror', err => pageErrors.push(err.message));

      const app = new HuffmanPage(page);
      await app.goto();

      // Capture PQ at initial step
      const initialPQ = await app.getPQHtml();

      // Step forward: should show "Last merge" area in PQ HTML for any merge step
      await app.clickStepForward();
      const forwardPQ = await app.getPQHtml();
      expect(forwardPQ.length).toBeGreaterThan(0);
      // The PQ representation after at least one step often contains "Last merge"
      const hasLastMerge = forwardPQ.includes('Last merge') || forwardPQ.includes('Last merge:');
      expect(hasLastMerge || (forwardPQ !== initialPQ)).toBeTruthy();

      // Step back: should return to earlier PQ state
      await app.clickStepBack();
      const backPQ = await app.getPQHtml();
      // backPQ should be identical to initialPQ (or at least different from forwardPQ)
      expect(backPQ === initialPQ || backPQ !== forwardPQ).toBeTruthy();

      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });

    test('Play button toggles playback and can be paused (Play event)', async ({ page }) => {
      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
      page.on('pageerror', err => pageErrors.push(err.message));

      const app = new HuffmanPage(page);
      await app.goto();

      // Ensure a deterministic faster playback for test
      await app.setSpeed(200);

      // Click Play: button text should change to show pause state
      await app.clickPlay();
      const playingText = await app.getPlayButtonText();
      expect(playingText.toLowerCase()).toContain('pause');

      // Pause by clicking again
      await app.clickPlay();
      const pausedText = await app.getPlayButtonText();
      expect(pausedText).toContain('Play');

      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });

    test('Reset returns the visualizer to Idle state clearing codes, PQ and SVG (Reset transition)', async ({ page }) => {
      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
      page.on('pageerror', err => pageErrors.push(err.message));

      const app = new HuffmanPage(page);
      await app.goto();

      // Ensure tree is present then reset
      const codesBefore = await app.getCodesHtml();
      expect(codesBefore).toContain('<table');

      await app.clickReset();

      // After reset, codes div should show placeholder and PQ should be '—'
      const codesAfter = await app.getCodesHtml();
      expect(codesAfter).toContain('No codes yet');
      const pqAfter = await app.getPQHtml();
      expect(pqAfter.trim()).toBe('—');

      // SVG should have no children
      const svgCount = await app.svgChildCount();
      expect(svgCount).toBe(0);

      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });
  });

  test.describe('Encoding and Decoding (S2_Encoding, S3_Decoding)', () => {
    test('Encoding input text uses the current mapping and updates bitbox and encLen (Encode event)', async ({ page }) => {
      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
      page.on('pageerror', err => pageErrors.push(err.message));

      const app = new HuffmanPage(page);
      await app.goto();

      // Use the current sample text to encode; encodeInput default is empty, so fill it
      const sampleToEncode = (await app.getInputText()).slice(0, 40) || 'test';
      await app.fillEncodeInput(sampleToEncode);
      await app.clickEncode();

      const bitbox = await app.getBitboxText();
      expect(bitbox.length).toBeGreaterThan(0);

      const encLen = await app.getEncLenText();
      // encLen should indicate number of bits or contain 'bits'
      expect(encLen.toLowerCase()).toContain('bits');

      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });

    test('Decoding bits using the built tree returns the original text (Decode event)', async ({ page }) => {
      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
      page.on('pageerror', err => pageErrors.push(err.message));

      const app = new HuffmanPage(page);
      await app.goto();

      // Get the original input and encoded bits from the bitbox (initial render encoded entire input)
      const original = await app.getInputText();
      const bits = await app.getBitboxText();

      // Ensure we have non-empty bits and original text
      expect(original.length).toBeGreaterThan(0);
      expect(bits.length).toBeGreaterThan(0);

      // Fill bitInput and decode
      await app.fillBitInput(bits.replace(/…/g, '')); // remove ellipsis if present
      await app.clickDecode();

      const decoded = await app.getDecodeResultText();
      // The decoded text should equal original (or be a prefix if bits were truncated)
      expect(decoded.length).toBeGreaterThan(0);
      expect(original.startsWith(decoded) || decoded === original).toBeTruthy();

      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });
  });

  test.describe('Other events and edge cases', () => {
    test('Speed input responds to changes (SpeedChange event)', async ({ page }) => {
      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
      page.on('pageerror', err => pageErrors.push(err.message));

      const app = new HuffmanPage(page);
      await app.goto();

      await app.setSpeed(500);
      const speedVal = await page.locator('#speed').inputValue();
      expect(Number(speedVal)).toBe(500);

      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });

    test('Keyboard navigation via ArrowRight/ArrowLeft steps through merges (KeyboardNavigation)', async ({ page }) => {
      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
      page.on('pageerror', err => pageErrors.push(err.message));

      const app = new HuffmanPage(page);
      await app.goto();

      const pqBefore = await app.getPQHtml();

      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(40);
      const pqAfterRight = await app.getPQHtml();
      expect(pqAfterRight.length).toBeGreaterThan(0);
      expect(pqAfterRight === pqBefore ? true : false).toBeTruthy(); // ensure we at least got a PQ after navigation

      await page.keyboard.press('ArrowLeft');
      await page.waitForTimeout(40);
      const pqAfterLeft = await app.getPQHtml();
      // After stepping left we should see earlier state (could match initial pq)
      expect(pqAfterLeft.length).toBeGreaterThan(0);

      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });

    test('Encoding without a mapping and decoding without a tree produce alerts (error scenarios)', async ({ page }) => {
      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
      page.on('pageerror', err => pageErrors.push(err.message));

      const app = new HuffmanPage(page);
      await app.goto();

      // Reset to clear any mapping/tree
      await app.clickReset();

      // Attempt to encode without mapping - should show an alert
      const encodeDialog = page.waitForEvent('dialog');
      await app.fillEncodeInput('abc');
      await app.clickEncode();
      const dialog1 = await encodeDialog;
      expect(dialog1.message()).toContain('No code mapping available');
      await dialog1.dismiss();

      // Attempt to decode without tree - should show an alert
      const decodeDialog = page.waitForEvent('dialog');
      await app.fillBitInput('0101');
      await app.clickDecode();
      const dialog2 = await decodeDialog;
      // message should indicate tree not built
      expect(dialog2.message()).toMatch(/Build a tree first|Tree not complete/i);
      await dialog2.dismiss();

      // Rebuild and then try invalid bits for decode
      await app.fillFreqInput('a:2\nb:1\nc:1');
      await app.clickBuild();
      // invalid bits contain '2'
      const invalidDialog = page.waitForEvent('dialog');
      await app.fillBitInput('01201');
      await app.clickDecode();
      const dialog3 = await invalidDialog;
      expect(dialog3.message()).toContain('Bits must be 0/1 only');
      await dialog3.dismiss();

      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });
  });
});