import { Inject, Injectable, Logger } from "@nestjs/common";
import * as puppeteer from "puppeteer-core";
import { APP_CONFIG, AppConfig } from "../config/configuration";
import { Errors } from "../common/errors/api-exception";
import { PdfReportData, renderReportHtml } from "./report-template";

/**
 * Renders report card PDFs with Chromium (puppeteer-core + system Chrome).
 * No browser download is performed; the executable path is configurable
 * via CHROME_EXECUTABLE_PATH (default /opt/meta-chromium/chrome).
 */
@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  async renderReportPdf(data: PdfReportData): Promise<Buffer> {
    const executablePath = this.config.chromeExecutablePath;
    let browser: puppeteer.Browser | undefined;
    try {
      browser = await puppeteer.launch({
        executablePath,
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
        timeout: this.config.pdfTimeoutMs,
      });
    } catch (err) {
      this.logger.error(`Failed to launch Chromium at ${executablePath}: ${String(err)}`);
      throw Errors.badRequest(
        "Gagal membuat PDF: browser Chromium tidak tersedia. Periksa CHROME_EXECUTABLE_PATH.",
      );
    }

    try {
      const page = await browser.newPage();
      // Static report HTML: domcontentloaded is sufficient; networkidle0
      // can hang in sandboxed environments with no external resources.
      await page.setContent(renderReportHtml(data), {
        waitUntil: "domcontentloaded",
        timeout: this.config.pdfTimeoutMs,
      });
      const pdf = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "24px", bottom: "24px", left: "24px", right: "24px" },
        timeout: this.config.pdfTimeoutMs,
      });
      return Buffer.from(pdf);
    } finally {
      await browser.close().catch(() => undefined);
    }
  }
}
