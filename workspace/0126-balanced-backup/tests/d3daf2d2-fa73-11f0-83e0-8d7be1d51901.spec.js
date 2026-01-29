import { test, expect } from '@playwright/test';

// Playwright E2E tests for Garbage Collection Demo (Mark-and-Sweep)
// Application URL (served by test environment)
const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3daf2d2-fa73-11f0-83e0-8d7be1d51901.html';

// Page object to encapsulate interactions and queries
class GCAppPage {
  constructor(page) {
    this.page = page;
    // Controls
    this.selectors = {
      objName: '#objName',
      objSize: '#objSize',
      allocBtn: '#allocBtn',
      fromSel: '#fromSel',
      toSel: '#toSel',
      linkBtn: '#linkBtn',
      unlinkBtn: '#unlinkBtn',
      rootGlobal: '#rootGlobal',
      rootDOM: '#rootDOM',
      rootStack: '#rootStack',
      simulateBtn: '#simulateBtn',
      sweepBtn: '#sweepBtn',
      resetBtn: '#resetBtn',
      exClosure: '#ex-closure',
      exDomLeak: '#ex-dom-leak',
      exTimer: '#ex-timer',
      statObjects: '#stat-objects',
      statTotal: '#stat-total',
      statReach: '#stat-reachable',
      statGarbage: '#stat-garbage',
      log: '#log',
      svg: '#svg'
    };
  }

  // Navigate to app and wait for initial rendering
  async goto() {
    // Capture uncaught errors in test-level array if needed (set up in test hooks)
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    // Wait for the app's main controls to be available
    await this.page.waitForSelector(this.selectors.allocBtn);
    // Ensure seed logs are present (initialization)
    await this.page.waitForFunction((sel) => {
      const el = document.querySelector(sel);
      return el && el.textContent && el.textContent.includes('Initial objects created.');
    }, this.selectors.log);
  }

  // Read current stats as numbers
  async getStats() {
    const objs = await this.page.locator(this.selectors.statObjects).innerText();
    const total = await this.page.locator(this.selectors.statTotal).innerText();
    const reach = await this.page.locator(this.selectors.statReach).innerText();
    const garbage = await this.page.locator(this.selectors.statGarbage).innerText();
    return {
      objects: Number(objs),
      totalKB: Number(total),
      reachableKB: Number(reach),
      garbageKB: Number(garbage)
    };
  }

  // Read log content (most recent messages at top)
  async getLogText() {
    return this.page.locator(this.selectors.log).innerText();
  }

  // Allocate an object via controls; size value is the option value (string)
  async allocate(name = '', sizeValue = '4') {
    if (name !== undefined) {
      await this.page.fill(this.selectors.objName, name);
    }
    await this.page.selectOption(this.selectors.objSize, sizeValue);
    await Promise.all([
      this.page.waitForResponse(response => response.ok() || response.status() >= 0).catch(()=>{}), // noop to allow click to proceed
      this.page.click(this.selectors.allocBtn)
    ]);
    // small wait to allow UI update
    await this.page.waitForTimeout(150);
  }

  // Helper to select options by visible text fragment (option text contains id and name)
  async selectFromByTextFragment(fragment) {
    const from = this.page.locator(this.selectors.fromSel);
    // ensure dropdown has the option
    await from.waitFor();
    const option = from.locator('option', { hasText: fragment });
    await expect(option.first()).toBeVisible();
    const val = await option.first().getAttribute('value');
    await from.selectOption(val);
    return val;
  }
  async selectToByTextFragment(fragment) {
    const to = this.page.locator(this.selectors.toSel);
    await to.waitFor();
    const option = to.locator('option', { hasText: fragment });
    await expect(option.first()).toBeVisible();
    const val = await option.first().getAttribute('value');
    await to.selectOption(val);
    return val;
  }

  // Add reference from currently selected fromSel to toSel (assumes selections set)
  async addReference() {
    await this.page.click(this.selectors.linkBtn);
    // small wait for log update
    await this.page.waitForTimeout(120);
  }

  async removeReference() {
    await this.page.click(this.selectors.unlinkBtn);
    await this.page.waitForTimeout(120);
  }

  // Call simulate GC and wait until "Mark phase complete" log entry appears
  async simulateGC() {
    await this.page.click(this.selectors.simulateBtn);
    await this.page.waitForFunction((sel) => {
      const el = document.querySelector(sel);
      return el && el.textContent && el.textContent.includes('Mark phase complete.');
    }, this.selectors.log, { timeout: 5000 });
  }

  // Call sweep and wait for UI update
  async sweep() {
    await this.page.click(this.selectors.sweepBtn);
    // sweep logs quickly; wait briefly for log updates
    await this.page.waitForTimeout(200);
  }

  // Reset heap, accepting confirm dialog
  async resetAccept() {
    // Intercept confirm and accept it
    this.page.once('dialog', async dialog => {
      expect(dialog.type()).toBe('confirm');
      await dialog.accept();
    });
    await this.page.click(this.selectors.resetBtn);
    // allow UI update
    await this.page.waitForTimeout(120);
  }

  // Click a root button; if selection is required and missing, an alert dialog will show
  async clickRoot(rootSelector, expectAlert = false) {
    if (expectAlert) {
      this.page.once('dialog', async dialog => {
        expect(dialog.type()).toBe('alert');
        await dialog.accept();
      });
    }
    await this.page.click(rootSelector);
    await this.page.waitForTimeout(120);
  }

  // Click an example and wait for its log message to appear
  async clickExample(selector, expectedMsgFragment) {
    await this.page.click(selector);
    await this.page.waitForFunction((sel, frag) => {
      const el = document.querySelector(sel);
      return el && el.textContent && el.textContent.includes(frag);
    }, this.selectors.log, expectedMsgFragment, { timeout: 3000 });
    await this.page.waitForTimeout(100);
  }

  // Get number of edge (line) elements in svg (approx for checking references drawn)
  async svgLineCount() {
    return this.page.evaluate((sel) => {
      const svg = document.querySelector(sel);
      if (!svg) return 0;
      return svg.querySelectorAll('line').length;
    }, this.selectors.svg);
  }

  // Get number of node elements (g[data-id]) in svg
  async svgNodeCount() {
    return this.page.evaluate((sel) => {
      const svg = document.querySelector(sel);
      if (!svg) return 0;
      return svg.querySelectorAll('g[data-id]').length;