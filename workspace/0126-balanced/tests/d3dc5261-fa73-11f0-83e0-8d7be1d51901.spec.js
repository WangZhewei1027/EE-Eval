import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3dc5261-fa73-11f0-83e0-8d7be1d51901.html';

// Page object encapsulating interactions with the demo UI
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.inputText = page.locator('#inputText');
    this.algo = page.locator('#algo');
    this.computeBtn = page.locator('#computeBtn');
    this.hashOutput = page.locator('#hashOutput');
    this.showBitsBtn = page.locator('#showBitsBtn');
    this.bitOutput = page.locator('#bitOutput');
    this.avalancheBtn = page.locator('#avalancheBtn');

    this.baseText = page.locator('#baseText');
    this.modifiedText = page.locator('#modifiedText');
    this.avAlgo = page.locator('#avAlgo');
    this.checkAvalanche = page.locator('#checkAvalanche');
    this.avResult = page.locator('#avResult');

    this.toyBits = page.locator('#toyBits');
    this.charset = page.locator('#charset');
    this.findCollisionBtn = page.locator('#findCollisionBtn');
    this.findTargetCollisionBtn = page.locator('#findTargetCollisionBtn');
    this.bfPreimageBtn = page.locator('#bfPreimageBtn');
    this.collisionOutput = page.locator('#collisionOutput');
    this.targetString = page.locator('#targetString');
    this.maxLen = page.locator('#maxLen');

    this.bucketsCount = page.locator('#bucketsCount');
    this.keysInput = page.locator('#keysInput');
    this.tableHashAlgo = page.locator('#tableHashAlgo');
    this.buildTableBtn = page.locator('#buildTableBtn');
    this.clearTableBtn = page.locator('#clearTableBtn');
    this.tableBuckets = page.locator('#tableBuckets');
  }

  async computeHash({ input = null, algoValue = null } = {}) {
    if (input !== null) await this.inputText.fill(input);
    if (algoValue !== null) await this.algo.selectOption(algoValue);
    await this.computeBtn.click();
    // Wait for the output to update from the "Computing..." or default text
    await expect(this.hashOutput).toHaveText(/Algorithm:/, { timeout: 5000 });
    return this.hashOutput.textContent();
  }

  async showBits() {
    await this.showBitsBtn.click();
    // After clicking, bitOutput should be visible and contain spans or text
    await expect(this.bitOutput).toBeVisible();
    // bitOutput is filled with inline spans separated by spaces/newlines
    const content = await this.bitOutput.innerHTML();
    return content;
  }

  async triggerAvalanche(input = null, algoValue = null) {
    if (input !== null) await this.inputText.fill(input);
    if (algoValue !== null) await this.algo.selectOption(algoValue);
    await this.avalancheBtn.click();
    // Avalanche sets hashOutput to include Original and Modified and shows bitOutput
    await expect(this.hashOutput).toHaveText(/Original:/, { timeout: 5000 });
    await expect(this.bitOutput).toBeVisible();
    return {
      hashText: await this.hashOutput.textContent(),
      bitsHtml: await this.bitOutput.innerHTML()
    };
  }

  async computeHammingDistance({ base = null, modified = null, algoValue = null } = {}) {
    if (base !== null) await this.baseText.fill(base);
    if (modified !== null) await this.modifiedText.fill(modified);
    if (algoValue !== null) await this.avAlgo.selectOption(algoValue);
    await this.checkAvalanche.click();
    await expect(this.avResult).toHaveText(/Hamming distance:/, { timeout: 500