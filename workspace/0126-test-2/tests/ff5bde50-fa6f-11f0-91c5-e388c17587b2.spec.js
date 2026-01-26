import { test, expect } from '@playwright/test';

const url = 'http://127.0.0.1:5500/workspace/0126-test-2/html/ff5bde50-fa6f-11f0-91c5-e388c17587b2.html';

test.describe('Bubble Sort Interactive Application', () => {
  
  test.beforeEach(async ({ page }) => {
    // Navigate to the application page before each test
    await page.goto(url);
  });

  test('should render the page correctly in the Idle state', async ({ page }) => {
    // Validate the initial state of the application
    const content = await page.textContent('body');
    expect(content).toContain('Bubble Sort is a simple sorting algorithm that works by repeatedly stepping through the list to be sorted');
    expect(content).toContain('How Bubble Sort Works');
    expect(content).toContain('Time Complexity');
    expect(content).toContain('Space Complexity');
  });

  test('should display the explanation of Bubble Sort', async ({ page }) => {
    // Check if the explanation of Bubble Sort is present
    const explanation = await page.textContent('body');
    expect(explanation).toContain('1. Initialization: Start at the beginning of the list.');
    expect(explanation).toContain('2. Comparison: Compare the first two adjacent elements.');
    expect(explanation).toContain('3. Iteration: Move to the next pair of adjacent elements and repeat the comparison and possible swap.');
    expect(explanation).toContain('4. Repeat: Continue this process for each element in the list.');
    expect(explanation).toContain('5. Termination: The process is repeated until no swaps are needed.');
  });

  test('should show time complexity details', async ({ page }) => {
    // Validate the time complexity section
    const timeComplexity = await page.textContent('body');
    expect(timeComplexity).toContain('Best Case: O(n)');
    expect(timeComplexity).toContain('Average Case: O(n^2)');
    expect(timeComplexity).toContain('Worst Case: O(n^2)');
  });

  test('should show space complexity details', async ({ page }) => {
    // Validate the space complexity section
    const spaceComplexity = await page.textContent('body');
    expect(spaceComplexity).toContain('Space Complexity: O(1)');
  });

  test('should not have any interactive elements or event handlers', async ({ page }) => {
    // Check for the absence of interactive elements
    const buttons = await page.$$('button');
    const inputs = await page.$$('input');
    expect(buttons.length).toBe(0;
    expect(inputs.length).toBe(0);
  });

  test('should log errors if any JavaScript issues occur', async ({ page }) => {
    // Listen for console errors
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Trigger an error scenario (if applicable)
    // Since there are no interactive elements, we expect no errors to be logged
    await page.evaluate(() => {
      // Intentionally cause an error (if needed)
      // For example, calling a non-existent function
      // nonExistentFunction();
    });

    // Assert that there are no console errors
    expect(consoleErrors.length).toBe(0);
  });

  test.afterEach(async ({ page }) => {
    // Cleanup actions can be performed here if needed
  });
});