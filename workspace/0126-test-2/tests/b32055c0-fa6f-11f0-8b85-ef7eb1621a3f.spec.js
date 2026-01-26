import { test, expect } from '@playwright/test';

const url = 'http://127.0.0.1:5500/workspace/0126-test-2/html/b32055c0-fa6f-11f0-8b85-ef7eb1621a3f.html';

test.describe('Bubble Sort Interactive Application Tests', () => {
  
  test.beforeEach(async ({ page }) => {
    // Navigate to the application page before each test
    await page.goto(url);
  });

  test('should render the page correctly in Idle state', async ({ page }) => {
    // Validate that the page renders the expected content for the Idle state
    const content = await page.textContent('body');
    expect(content).toContain('Bubble Sort is a simple comparison-based sorting algorithm.');
    expect(content).toContain('How Bubble Sort Works:');
  });

  test('should display the explanation of Bubble Sort', async ({ page }) => {
    // Validate that the explanation of how Bubble Sort works is displayed
    const explanation = await page.textContent('body');
    expect(explanation).toContain('Compare: Start at the beginning of the list and compare the first two adjacent elements.');
    expect(explanation).toContain('Swap: If the first element is greater than the second element, swap them.');
    expect(explanation).toContain('Repeat: Move to the next pair of adjacent elements and repeat the compare-and-swap process.');
    expect(explanation).toContain('End Condition: The algorithm is complete when a pass through the list is made without any swaps, indicating that the list is sorted.');
  });

  test('should contain the time complexity information', async ({ page }) => {
    // Validate that the time complexity information is present
    const timeComplexity = await page.textContent('body');
    expect(timeComplexity).toContain('Best Case: O(n) when the list is already sorted.');
    expect(timeComplexity).toContain('Average Case: O(n^2)');
    expect(timeComplexity).toContain('Worst Case: O(n^2)');
  });

  test('should contain the space complexity information', async ({ page }) => {
    // Validate that the space complexity information is present
    const spaceComplexity = await page.textContent('body');
    expect(spaceComplexity).toContain('O(1) (in-place sorting)');
  });

  test('should display the example of Bubble Sort in Python', async ({ page }) => {
    // Validate that the example code for Bubble Sort is displayed
    const exampleCode = await page.textContent('body');
    expect(exampleCode).toContain('def bubble_sort(arr):');
    expect(exampleCode).toContain('arr[j], arr[j + 1] = arr[j + 1], arr[j]');
  });

  test('should log errors in the console if any occur', async ({ page }) => {
    // Listen for console errors and assert that they occur
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Trigger any potential errors (if applicable)
    await page.evaluate(() => {
      // Intentionally cause an error if there are any functions or variables that are not defined
      // This is just an example, adjust according to the actual implementation
      // nonExistentFunction();
    });

    // Wait for a moment to ensure all console messages are captured
    await page.waitForTimeout(1000);
    
    // Assert that there are console errors
    expect(consoleErrors.length).toBeGreaterThan(0);
  });

  test.afterEach(async ({ page }) => {
    // Optionally, you can perform cleanup or additional checks after each test
  });
});