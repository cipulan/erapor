import { Controller, Get, NotFoundException, Param, Res } from "@nestjs/common";
import { Response } from "express";
import { basename, join } from "node:path";
import { existsSync } from "node:fs";
import { Public } from "../common/decorators/roles.decorator";

/**
 * Serves Swagger UI for the committed OpenAPI contract (docs/api/openapi.yaml).
 * Public endpoint (no session needed) — the contract itself is not sensitive.
 *
 * Routes (under the global /api/v1 prefix):
 *   GET /api/v1/docs               -> Swagger UI HTML
 *   GET /api/v1/docs/openapi.yaml  -> the raw OpenAPI document
 *   GET /api/v1/docs/assets/:file  -> Swagger UI static assets
 */
@Public()
@Controller("docs")
export class DocsController {
  /** Directory of the swagger-ui-dist npm package (bundled, no CDN needed). */
  private readonly uiDir = join(require.resolve("swagger-ui-dist/package.json"), "..");

  /**
   * Absolute path to the OpenAPI contract. Resolved from the compiled file
   * location: <root>/apps/api/dist/docs/docs.controller.js -> <root>/docs/api/openapi.yaml.
   * The Dockerfile runner copies /app/docs for this reason.
   */
  private readonly specPath = join(__dirname, "..", "..", "..", "..", "docs", "api", "openapi.yaml");

  @Get()
  index(@Res() res: Response): void {
    res.type("text/html").send(`<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>eRapor API Docs</title>
  <link rel="stylesheet" href="./assets/swagger-ui.css" />
  <style>body { margin: 0; }</style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="./assets/swagger-ui-bundle.js"></script>
  <script>
    window.ui = SwaggerUIBundle({
      url: "./openapi.yaml",
      dom_id: "#swagger-ui",
      deepLinking: true,
      persistAuthorization: true,
    });
  </script>
</body>
</html>`);
  }

  @Get("openapi.yaml")
  spec(@Res() res: Response): void {
    if (!existsSync(this.specPath)) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Dokumen OpenAPI tidak ditemukan di server.",
      });
    }
    res.type("text/yaml").sendFile(this.specPath);
  }

  @Get("assets/:file")
  asset(@Param("file") file: string, @Res() res: Response): void {
    // Prevent path traversal — only serve files directly inside swagger-ui-dist.
    const safe = basename(file);
    const full = join(this.uiDir, safe);
    if (safe !== file || !existsSync(full)) {
      throw new NotFoundException({ code: "NOT_FOUND", message: "Aset tidak ditemukan." });
    }
    res.sendFile(full);
  }
}
