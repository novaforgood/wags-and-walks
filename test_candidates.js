const { test, expect } = require('@playwright/test');

test('test candidates page popover', async ({ page }) => {
  await page.goto('http://localhost:3000/candidates');
  await page.waitForTimeout(1000);
  
  // Click accept on the first candidate
  await page.locator('.candidates_acceptBtn__81Q2f, .candidates_selectBtn__gJ4xT').first().click();
  await page.waitForTimeout(500);
  
  // take a screenshot of the popup
  await page.screenshot({ path: 'candidates_popover.png', clip: { x: 500, y: 150, width: 600, height: 400 } });

  // Click cancel
  await page.locator('.candidates_confirmCancelBtn__m9aK7').click();
  
  // click the 'Red Flags' tab
  await page.click('text="Red Flags"');
  await page.waitForTimeout(500);

  // take a full screenshot of red flags page
  await page.screenshot({ path: 'red_flags_full.png' });
});
