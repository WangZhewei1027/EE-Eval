import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/0126-test-2/html/3743c790-fa72-11f0-a50e-db70fa563cae.html';

test.describe('Interactive Color Mixer Tests', () => {
    test.beforeEach(async ({ page }) => {
        // Navigate to the interactive color mixer application
        await page.goto(BASE_URL);
    });

    test('Initial state validation', async ({ page }) => {
        // Validate the initial color display is white
        const colorDisplay = await page.locator('#colorDisplay');
        const bgColor = await colorDisplay.evaluate(el => getComputedStyle(el).backgroundColor);
        expect(bgColor).toBe('rgb(255, 255, 255)'); // Initial color should be white
    });

    test.describe('RGB Slider and Input Tests', () => {
        test('Adjust Red slider and verify color change', async ({ page }) => {
            const redSlider = page.locator('#red');
            await redSlider.fill('128'); // Set red value to 128
            await redSlider.dispatchEvent('input'); // Trigger input event
            const colorDisplay = await page.locator('#colorDisplay');
            const bgColor = await colorDisplay.evaluate(el => getComputedStyle(el).backgroundColor);
            expect(bgColor).toBe('rgb(128, 255, 255)'); // Verify the color change
        });

        test('Adjust Green slider and verify color change', async ({ page }) => {
            const greenSlider = page.locator('#green');
            await greenSlider.fill('128');
            await greenSlider.dispatchEvent('input');
            const colorDisplay = await page.locator('#colorDisplay');
            const bgColor = await colorDisplay.evaluate(el => getComputedStyle(el).backgroundColor);
            expect(bgColor).toBe('rgb(255, 128, 255)'); // Verify the color change
        });

        test('Adjust Blue slider and verify color change', async ({ page }) => {
            const blueSlider = page.locator('#blue');
            await blueSlider.fill('128');
            await blueSlider.dispatchEvent('input');
            const colorDisplay = await page.locator('#colorDisplay');
            const bgColor = await colorDisplay.evaluate(el => getComputedStyle(el).backgroundColor);
            expect(bgColor).toBe('rgb(255, 255, 128)'); // Verify the color change
        });

        test('Adjust Red input and verify color change', async ({ page }) => {
            const redValue = page.locator('#redValue');
            await redValue.fill('64');
            await redValue.dispatchEvent('input');
            const colorDisplay = await page.locator('#colorDisplay');
            const bgColor = await colorDisplay.evaluate(el => getComputedStyle(el).backgroundColor);
            expect(bgColor).toBe('rgb(64, 255, 255)'); // Verify the color change
        });

        test('Adjust Green input and verify color change', async ({ page }) => {
            const greenValue = page.locator('#greenValue');
            await greenValue.fill('64');
            await greenValue.dispatchEvent('input');
            const colorDisplay = await page.locator('#colorDisplay');
            const bgColor = await colorDisplay.evaluate(el => getComputedStyle(el).backgroundColor);
            expect(bgColor).toBe('rgb(255, 64, 255)'); // Verify the color change
        });

        test('Adjust Blue input and verify color change', async ({ page }) => {
            const blueValue = page.locator('#blueValue');
            await blueValue.fill('64');
            await blueValue.dispatchEvent('input');
            const colorDisplay = await page.locator('#colorDisplay');
            const bgColor = await colorDisplay.evaluate(el => getComputedStyle(el).backgroundColor);
            expect(bgColor).toBe('rgb(255, 255, 64)'); // Verify the color change
        });
    });

    test.describe('Color Adjustment Tests', () => {
        test('Darken color and verify change', async ({ page }) => {
            const darkenButton = page.locator('#darken');
            await darkenButton.click(); // Click darken button
            const colorDisplay = await page.locator('#colorDisplay');
            const bgColor = await colorDisplay.evaluate(el => getComputedStyle(el).backgroundColor);
            expect(bgColor).toBe('rgb(225, 225, 225)'); // Verify the color darkens
        });

        test('Lighten color and verify change', async ({ page }) => {
            const lightenButton = page.locator('#lighten');
            await lightenButton.click(); // Click lighten button
            const colorDisplay = await page.locator('#colorDisplay');
            const bgColor = await colorDisplay.evaluate(el => getComputedStyle(el).backgroundColor);
            expect(bgColor).toBe('rgb(255, 255, 255)'); // Verify the color lightens back to white
        });
    });

    test('Reset colors and verify reset state', async ({ page }) => {
        const redSlider = page.locator('#red');
        const greenSlider = page.locator('#green');
        const blueSlider = page.locator('#blue');
        const resetButton = page.locator('#reset');

        // Adjust colors
        await redSlider.fill('100');
        await greenSlider.fill('150');
        await blueSlider.fill('200');
        await resetButton.click(); // Click reset button

        const colorDisplay = await page.locator('#colorDisplay');
        const bgColor = await colorDisplay.evaluate(el => getComputedStyle(el).backgroundColor);
        expect(bgColor).toBe('rgb(255, 255, 255)'); // Verify color is reset to white
    });

    test('Error handling for invalid input', async ({ page }) => {
        const redValue = page.locator('#redValue');
        await redValue.fill('300'); // Invalid value
        await redValue.dispatchEvent('input');
        const colorDisplay = await page.locator('#colorDisplay');
        const bgColor = await colorDisplay.evaluate(el => getComputedStyle(el).backgroundColor);
        expect(bgColor).toBe('rgb(255, 255, 255)'); // Verify color does not change due to invalid input
    });
});