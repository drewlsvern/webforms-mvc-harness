import type { Page } from "playwright";
import type { InteractionRecord, NetworkEntry } from "../types/evidence.ts";

export interface PageCapture {
  dom: string;
  screenshot: Buffer;
  network: NetworkEntry[];
  interactions: InteractionRecord[];
  /** The URL the browser ended up on after navigation - may differ from the requested URL (a redirect). */
  landedUrl: string;
}

/**
 * Captures one page's runtime evidence. Interactions are recorded as the
 * interactive elements the page exposes (buttons, links, form fields) rather
 * than actually clicked - the crawler runs against a real application, and
 * blindly clicking every control (e.g. a "Delete" button) would have
 * unintended side effects.
 */
export async function capturePage(page: Page, url: string): Promise<PageCapture> {
  const network: NetworkEntry[] = [];
  const onResponse = (response: import("playwright").Response) => {
    network.push({ url: response.url(), method: response.request().method(), status: response.status() });
  };
  page.on("response", onResponse);

  try {
    await page.goto(url, { waitUntil: "networkidle" });
    const landedUrl = page.url();
    const dom = await page.content();
    const screenshot = await page.screenshot({ fullPage: true });
    const interactions = await page.$$eval(
      "button, a[href], input, select, textarea",
      (elements) =>
        elements.map((el) => ({
          type: el.tagName.toLowerCase(),
          selector: el.id ? `#${el.id}` : el.tagName.toLowerCase(),
          description: (el.textContent ?? el.getAttribute("name") ?? el.getAttribute("value") ?? "").trim().slice(0, 80),
        })),
    );
    return { dom, screenshot, network, interactions, landedUrl };
  } finally {
    page.off("response", onResponse);
  }
}
