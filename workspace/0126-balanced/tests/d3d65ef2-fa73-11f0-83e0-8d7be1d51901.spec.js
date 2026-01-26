import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3d65ef2-fa73-11f0-83e0-8d7be1d51901.html';

// Page Object for the Counting Sort Visualizer
class VisualizerPage {
  constructor(page) {
    this.page = page;
    // selectors
    this.sel = {
      arrayInput: '#arrayInput',
      btnRandom: '#btnRandom',
      btnFromInput: '#btnFromInput',
      btnReset: '#btnReset',
      btnStart: '#btnStart',
      btnPause: '#btnPause',
      btnStep: '#btnStep',
      btnFastForward: '#btnFastForward',
      sizeRange: '#sizeRange',
      minRange: '#minRange',
      maxRange: '#maxRange',
      speed: '#speed',
      inputVisual: '#inputVisual',
      countVisual: '#countVisual',
      outputVisual: '#outputVisual',
      offsetDisplay: '#offsetDisplay',
      phaseDisplay: '#phaseDisplay',
      stepDisplay: '#stepDisplay',
      rangeSize: '#rangeSize'
    };
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async click(selector) {
    await this.page.click(selector);
  }

  async getText(selector) {
    return (await this.page.locator(selector).innerText()).trim();
  }

  async getValue(selector) {
    return this.page.locator(selector).evaluate((el) => el.value);
  }

  async setValue(selector, value) {
    await this.page.fill(selector, String(value));
  }

  async getChildCount(selector) {
    return this.page.locator(selector).locator(':scope > *').count();
  }

  async waitForPhase(phaseText, timeout = 5000) {
    // Wait until the phaseDisplay contains exact text phaseText
    await this.page.waitForFunction(
      (sel, expected) => {
        const el = document.querySelector(sel);
        return el && el.textContent.trim() === expected;
      },
      this.sel.phaseDisplay,
      phaseText,
      { timeout }
    );
  }

  async waitForPhaseIncludes(substring, timeout = 5000) {
    await this.page.waitForFunction(
      (sel, expectedSub) => {
        const el = document.querySelector(sel);
        return el && el.textContent.trim().includes(expectedSub);
      },
      this.sel.phaseDisplay,
      substring,
      { timeout }
    );
  }

  async stepOnce() {
    await this.page.click(this.sel.btnStep);
  }

  async startAuto(speedMs = null) {
    if (speedMs !== null) {
      // set via clicking FastForward or using startAuto default
      await this.page.click(this.sel.btnStart);
    } else {
      await this.page.click(this.sel.btnStart);
    }
  }

  async pause() {
    await this.page.click(this.sel.btnPause);
  }

  async reset() {
    await this.page.click(this.sel.btnReset);
  }

  async generateRandom() {
    await this.page.click(this.sel.btnRandom);
  }

  async loadFromInput() {
    await this.page.click(this.sel.btnFromInput);
  }

  async runFast() {
    await this.page.click(this.sel.btnFastForward);
  }

  async setRangeSize(val) {
    await this.page.locator(this.sel.sizeRange).evaluate((el, v) => { el.value = String(v); el.dispatchEvent(new Event('input', { bubbles: true })); }, val);
  }

  async setMinRange(val) {
    await this.page.locator(this.sel.minRange).evaluate((el, v) => { el.value = String(v); el.dispatchEvent(new Event('input', { bubbles: true })); }, val);
  }

  async setMaxRange(val) {
    await this.page.locator(this.sel.maxRange).evaluate((el, v) => { el.value = String(v); el.dispatchEvent(new Event('input', { bubbles: true })); }, val);
  }

  async getArrayInputValue() {
    return this.page.locator(this.sel.arrayInput).evaluate((el) => el.value);
  }

  async getBtnDisabled(selector) {
    return this.page.locator(selector).evaluate((el) => el.disabled);
  }
}

// Tests grouped and organized
test.describe('Counting Sort Visualizer — FSM & UI Integration', () => {
  // capture console errors and page exceptions per test
  test.beforeEach(async ({ page }) => {
    // ensure we start with a clean slate
    await page.setViewportSize({ width: 1200, height: 900 });
  });

  // Test initial rendering and Idle state
  test('renders initial Idle state and main UI components', async ({ page }) => {
    // Capture console and page errors
    const consoleErrors = [];
    const pageErrors = [];
    page