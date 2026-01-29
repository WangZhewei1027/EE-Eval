import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3d6ad12-fa73-11f0-83e0-8d7be1d51901.html';

// Page object encapsulating interactions and common assertions
class BinarySearchPage {
  constructor(page) {
    this.page = page;
    this.size = page.locator('#size');
    this.sizeVal = page.locator('#sizeVal');
    this.genMode = page.locator('#genMode');
    this.arrayInput = page.locator('#arrayInput');
    this.targetInput = page.locator('#target');
    this.setTargetBtn = page.locator('#setTarget');
    this.randTargetBtn = page.locator('#randTarget');
    this.generateBtn = page.locator('#generate');
    this.startBtn = page.locator('#start');
    this.stepBtn = page.locator('#step');
    this.stepBackBtn = page.locator('#stepBack');
    this.autoBtn = page.locator('#auto');
    this.speedEl = page.locator('#speed');
    this.algoSelect = page.locator('#algo');

    this.message = page.locator('#message');
    this.iterCount = page.locator('#iterCount');
    this.compCount = page.locator('#compCount');
    this.lowHigh = page.locator('#lowHigh');
    this.result = page.locator('#result');
    this.range = page.locator('#range');
    this.targetLabel = page.locator('#targetLabel');
    this.visualBoxes = page.locator('#visual .box');
  }

  // Helpers that mimic user interactions
  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async getArrayInputValues() {
    const text = (await this.arrayInput.inputValue()).trim();
    if (!text) return [];
    return text.split(',').map(s => s.trim()).filter(s => s.length).map(v => {
      const n = Number(v);
      return Number.isFinite(n) ? n : v;
    });
  }

  async clickGenerate() {
    await this.generateBtn.click();
  }

  async clickSetTarget() {
    await this.setTargetBtn.click();
  }

  async clickStart() {
    await this.startBtn.click();
  }

  async clickStep() {
    await this.stepBtn.click();
  }

  async clickStepBack() {
    await this.stepBackBtn.click();
  }

  async clickAuto() {
    await this.autoBtn.click();
  }

  async clickRandomTarget() {
    await this.randTargetBtn.click();
  }

  async setTargetValue(val) {
    await this.targetInput.fill(String(val));
  }

  async setArrayInput(text) {
    await this.arrayInput.fill(text);
    // ensure input event fires (Playwright fill triggers input)
  }

  async setSize(val) {
    // range inputs: directly set value and dispatch event
    await this.page.evaluate((v) => {
      const el = document.getElementById('size');
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, String(val));
  }

  async changeGenMode(value) {
    await this.genMode.selectOption(value);
  }

  async changeAlgo(value) {
    await this.algoSelect.selectOption(value);
  }

  async setSpeed(value) {
    await this.page.evaluate((v) => {
      const el = document.getElementById('speed');
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, String(value));
  }

  // Assertions
  async expectIdleMessage() {
    await expect(this.message).toHaveText('Idle — prepare an array and start searching.');
  }

  async expectArrayInputPopulatedWithCount(expectedCount) {
    const vals = await this.getArrayInputValues();
    expect(vals.length).toBe(expectedCount);
  }

  async expectStepButtonsDisabled(backDisabled = true, forwardDisabled = true, autoDisabled = true) {
    await expect(this.stepBackBtn).toHaveJS