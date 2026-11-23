export default async function (page) {
  await page.click('[data-testid=btn-new-space]');
  await page.fill('[data-testid=space-name-input]', 'Studio');
  await page.click('[data-testid=swatch-pastel-3]');
  await page.locator('.emoji', { hasText: '🎨' }).click();
  await page.waitForTimeout(250);
}
