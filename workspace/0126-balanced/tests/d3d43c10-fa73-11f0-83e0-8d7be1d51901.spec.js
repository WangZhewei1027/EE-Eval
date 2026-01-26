import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3d43c10-fa73-11f0-83e0-8d7be1d51901.html';

// Page Object Model for the Dynamic Array demo
class DynamicArrayPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // controls
    this.initCap = page.locator('#initCap');
    this.resetBtn = page.locator('#resetBtn');
    this.appendVal = page.locator('#appendVal');
    this.appendBtn = page.locator('#appendBtn');
    this.insertIdx = page.locator('#insertIdx');
    this.insertVal = page.locator('#insertVal');
    this.insertBtn = page.locator('#insertBtn');
    this.setIdx = page.locator('#setIdx');
    this.setVal = page.locator('#setVal');
    this.setBtn = page.locator('#setBtn');
    this.getIdx = page.locator('#getIdx');
    this.getBtn = page.locator('#getBtn');
    this.removeIdx = page.locator('#removeIdx');
    this.removeBtn = page.locator('#removeBtn');
    this.popBtn = page.locator('#popBtn');
    this.manyN = page.locator('#manyN');
    this.manyBtn = page.locator('#manyBtn');
    this.speed = page.locator('#speed');
    this.speedVal = page.locator('#speedVal');
    this.autoShrink = page.locator('#autoShrink');

    // status & visuals
    this.sizeEl = page.locator('#size');
    this.capEl = page.locator('#capacity');
    this.copiedEl = page.locator('#copied');
    this.memory = page.locator('#memory');
    this.log = page.locator('#log');
    this.hint = page.locator('#hint');
  }

  async resetWithCapacity(n) {
    await this.initCap.fill(String(n));
    await this.resetBtn.click();
    // after reset, capacity should update to requested value
    await expect(this.capEl).toHaveText(String(Math.max(1, Math.floor(n))));
  }

  // Append a value and wait for size to increase (use prevSize to wait)
  async append(value, prevSize = null) {
    await this.appendVal.fill(value);
    await this.appendBtn.click();
    if (prevSize !== null) {
      await this.page.waitForFunction(
        (sel, expected) => document.querySelector(sel).innerText === String(expected),
        this.sizeEl.selector,
        prevSize + 1,
        { timeout: 5000 }
      );
    }
    // wait for a visible appended log entry to appear
    await expect(this.log).toContainText(`Appended "${value}"`, { timeout: 5000 });
  }

  async appendMany(n) {
    await this.manyN.fill(String(n));
    await this.manyBtn.click();
    // Wait until size equals the logged count: after many, size should have increased by n
    // We'll poll the log for last "Appended" lines; but simpler: wait for size to be >= n (if starting from zero)
    await this.page.waitForFunction(
      (sel) => Number(document.querySelector(sel).innerText) >= 1,
      this.sizeEl.selector,
      { timeout: 5000 }
    );
    // basic sanity: expect log contains at least one appended entry
    await expect(this.log).toContainText('Appended "', { timeout: 5000 });
  }

  // Insert at index and wait for the corresponding log entry
  async insert(index, value) {
    await this.insertIdx.fill(String(index));
    await this.insertVal.fill(value);
    await this.insertBtn.click();
    await expect(this.log).toContainText(`Inserted "${value}" at index ${index}`, { timeout: 5000 });
  }

  async set(index, value) {
    await this.setIdx.fill(String(index));
    await this.setVal.fill(value);
    await this.setBtn.click();
    await expect(this.log).toContainText(`Set index ${index} = "${value}"`, { timeout: 2000 });
  }

  async get(index) {
    await this.getIdx.fill(String(index));
    await this.getBtn.click();
    // get logs "Get index X -> Y" (or out of bounds)
    await this.page.waitForTimeout(200); // brief pause for log update
  }

  async remove(index) {
    await this.removeIdx.fill(String(index));
    await this.removeBtn.click();
    await this.page.waitForTimeout(200); // small pause to let removal log
    await expect(this.log).toContainText(`Removed index ${index}`, { timeout: 2000 });
  }

  async pop() {
    await this.popBtn.click();
    await this.page.waitForTimeout(200);
    // Log either "Popped" or "Pop from empty array"
  }

  async setSpeed(ms) {
    await this.speed.fill(String(ms));
    // speed input updates speedVal on input event
    await this.speed.dispatchEvent('input');
    await expect(this.speedVal).toContainText(String(ms) + 'ms');
  }

  async toggleAutoShrink(on = true) {
    const checked = await this.autoShrink.isChecked();
    if (checked !== on) {
      await this.autoShrink.click();
    }
    // no direct DOM change to assert here
  }

  async getSize() {
    return Number(await this.sizeEl.textContent());
  }
  async getCapacity() {
    return Number(await this.capEl.textContent());
  }
  async getLogText() {
    return await this.log.textContent();
  }

  // helper to wait until a particular log message appears
  async waitForLogContains(substr, timeout = 5000) {
    await this.page.waitForFunction(
      (sel, s) => document.querySelector(sel).innerText.includes(s),
      this.log.selector,
      substr,
      { timeout }
    );
  }

  // Wait for a transient copying highlight to appear (used to detect resize animation)
  async waitForCopyingCell(timeout = 3000) {
    await this.page.waitForSelector('.cell.copying', { timeout });
  }

  // Read visible values from memory's top row (value cells). It creates cap value cells then cap index cells;
  // we will read first 'capacity' value cell texts
  async readTopRowValues() {
    const cap = await this.getCapacity();
    // the memory element contains 2*cap children: first cap are value cells
    const values = [];
    for (let i = 0; i < cap; i++) {
      const locator = this.memory.locator(`.cell:nth-child(${i + 1}) .value`);
      values.push((await locator.textContent()) || '');