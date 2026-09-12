/** Export the generated presentation with its local assets, without a web server.
 * Run npm ci in web first. Optionally set CHROMIUM_PATH to an installed browser.
 */
import { chromium } from "../web/node_modules/playwright/index.mjs";
import { mkdir, copyFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROMIUM_PATH
    ? { executablePath: process.env.CHROMIUM_PATH }
    : {}),
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 780 },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(
    new URL("../web/public/deck/index.html", import.meta.url).href,
  );
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((image) => image.decode()));
    if (!document.fonts.check("12px DM"))
      throw new Error("Deck font did not load");
  });
  const slides = page.locator(".slide");
  if ((await slides.count()) !== 9) throw new Error("Expected nine slides");
  const screenshots = path.join(root, "docs/design");
  await mkdir(screenshots, { recursive: true });
  for (let i = 0; i < 9; i++) {
    await page.evaluate((index) => {
      location.hash = `#${index + 1}`;
    }, i);
    await slides.nth(i).waitFor({ state: "visible" });
    await slides
      .nth(i)
      .screenshot({ path: path.join(screenshots, `deck-${i + 1}.png`) });
  }
  await page.keyboard.press("Home");
  await page.keyboard.press("ArrowRight");
  if ((await page.locator("#count").innerText()) !== "02 / 09")
    throw new Error("Keyboard navigation failed");
  await page.keyboard.press("n");
  if (!(await page.locator("#notes-panel").isVisible()))
    throw new Error("Notes did not open");
  if (!(await page.locator("#speaker-copy").innerText()).length)
    throw new Error("Speaker notes missing");
  await page.keyboard.press("Escape");
  await page.keyboard.press("o");
  if ((await page.locator(".slide:visible").count()) !== 9)
    throw new Error("Overview missing slides");
  await slides.nth(4).locator("h1").click();
  if ((await page.locator("#count").innerText()) !== "05 / 09")
    throw new Error("Overview selection failed");
  await page.keyboard.press("End");
  if (!(await page.locator("#next").isDisabled()))
    throw new Error("Final slide navigation must stop");
  await page.keyboard.press("Home");
  if (!(await page.locator("#prev").isDisabled()))
    throw new Error("First slide navigation must stop");
  await page.pdf({
    path: path.join(root, "docs/PATAPIM-DECK.pdf"),
    printBackground: true,
    preferCSSPageSize: true,
    tagged: true,
    outline: true,
  });
  await copyFile(
    path.join(root, "docs/PATAPIM-DECK.pdf"),
    path.join(root, "web/public/deck/PATAPIM-DECK.pdf"),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: path.join(screenshots, "deck-mobile.png") });
  const bounds = await slides.nth(0).boundingBox();
  if (bounds.x < -1 || bounds.x + bounds.width > 391)
    throw new Error("Mobile slide is clipped");
  if (errors.length) throw new Error(errors.join("\n"));
  console.log(
    "Exported nine 16:9 slides, public PDF and screenshots. Assets, notes, keyboard, overview and mobile framing passed.",
  );
} finally {
  await browser.close();
}
