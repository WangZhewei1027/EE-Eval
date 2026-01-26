import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/0126-test-2/html/b320a3e0-fa6f-11f0-8b85-ef7eb1621a3f.html';

test.describe('Binary Search Tree (BST) Interactive Application', () => {
  
  test.beforeEach(async ({ page }) => {
    // Navigate to the application page before each test
    await page.goto(BASE_URL);
  });

  test('should render the page correctly', async ({ page }) => {
    // Validate that the page is rendered and contains expected content
    const content = await page.textContent('body');
    expect(content).toContain('Binary Search Tree (BST)');
    expect(content).toContain('Node Structure');
    expect(content).toContain('Basic Operations');
  });

  test('should log ReferenceError when trying to access undefined function', async ({ page }) => {
    // Check for ReferenceError in console
    const [error] = await Promise.all([
      page.waitForEvent('console', { timeout: 5000 }),
      page.evaluate(() => { return someUndefinedFunction(); }) // Intentionally call an undefined function
    ]);
    expect(error.type()).toBe('error');
    expect(error.text()).toContain('ReferenceError');
  });

  test('should log SyntaxError when there is a syntax issue', async ({ page }) => {
    // Check for SyntaxError in console
    const [error] = await Promise.all([
      page.waitForEvent('console', { timeout: 5000 }),
      page.evaluate(() => { eval('var a = '); }) // Intentionally cause a syntax error
    ]);
    expect(error.type()).toBe('error');
    expect(error.text()).toContain('SyntaxError');
  });

  test('should log TypeError when trying to call a non-function', async ({ page }) => {
    // Check for TypeError in console
    const [error] = await Promise.all([
      page.waitForEvent('console', { timeout: 5000 }),
      page.evaluate(() => { let notAFunction = null; notAFunction(); }) // Intentionally call a null value
    ]);
    expect(error.type()).toBe('error');
    expect(error.text()).toContain('TypeError');
  });

  test('should validate that no interactive elements are present', async ({ page }) => {
    // Validate that there are no interactive elements like buttons or inputs
    const buttons = await page.$$('button');
    const inputs = await page.$$('input');
    expect(buttons.length).toBe(0; // No buttons should be present
    expect(inputs.length).toBe(0); // No inputs should be present
  });

  test('should validate that no event handlers are defined', async ({ page }) => {
    // Check for event handlers
    const eventHandlers = await page.evaluate(() => {
      return Object.keys(window).filter(key => key.startsWith('on'));
    });
    expect(eventHandlers.length).toBe(0); // No event handlers should be defined
  });

  test.afterEach(async ({ page }) => {
    // Optionally, you can perform cleanup or logging after each test
    console.log('Test completed');
  });
});