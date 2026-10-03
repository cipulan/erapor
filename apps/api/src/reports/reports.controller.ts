import { Body, Controller, Get, HttpCode, Param, Post, Query, Req, Res, StreamableFile } from "@nestjs/common";
import { Request, Response } from "express";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { parsePagination } from "../common/http/pagination";
import type { SessionUser } from "../auth/types/session-user";
import { ReportsService } from "./reports.service";
import { PdfService } from "./pdf.service";
import { CreateRevisionDto, GenerateReportCardDto } from "./dto/report.dto";

@Controller("report-cards")
export class ReportsController {
  constructor(
    private readonly service: ReportsService,
    private readonly pdfService: PdfService,
  ) {}

  @Get()
  @Roles("SUPERADMIN", "TEACHER", "PARENT")
  async list(@CurrentUser() user: SessionUser, @Query() query: Record<string, string>) {
    return this.service.list(user, parsePagination(query), query);
  }

  @Post("generate")
  @Roles("SUPERADMIN", "TEACHER")
  async generate(@CurrentUser() user: SessionUser, @Body() dto: GenerateReportCardDto, @Req() req: Request) {
    return this.service.generate(user, dto, req);
  }

  @Get(":id")
  @Roles("SUPERADMIN", "TEACHER", "PARENT")
  async get(@CurrentUser() user: SessionUser, @Param("id") id: string) {
    return this.service.get(user, id);
  }

  @Post(":id/review")
  @HttpCode(200)
  @Roles("SUPERADMIN", "TEACHER")
  async review(@CurrentUser() user: SessionUser, @Param("id") id: string, @Req() req: Request) {
    return this.service.review(user, id, req);
  }

  @Post(":id/lock")
  @HttpCode(200)
  @Roles("SUPERADMIN", "TEACHER")
  async lock(@CurrentUser() user: SessionUser, @Param("id") id: string, @Req() req: Request) {
    return this.service.lock(user, id, req);
  }

  @Post(":id/publish")
  @HttpCode(200)
  @Roles("SUPERADMIN")
  async publish(@CurrentUser() user: SessionUser, @Param("id") id: string, @Req() req: Request) {
    return this.service.publish(user, id, req);
  }

  @Post(":id/revision")
  @Roles("SUPERADMIN", "TEACHER")
  async revision(
    @CurrentUser() user: SessionUser,
    @Param("id") id: string,
    @Body() dto: CreateRevisionDto,
    @Req() req: Request,
  ) {
    return this.service.revision(user, id, dto, req);
  }

  @Get(":id/pdf")
  @Roles("SUPERADMIN", "TEACHER", "PARENT")
  async pdf(
    @CurrentUser() user: SessionUser,
    @Param("id") id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const data = await this.service.getPdfData(user, id);
    const buffer = await this.pdfService.renderReportPdf(data);
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="rapor-${id}.pdf"`,
      "Content-Length": buffer.length,
    });
    return new StreamableFile(buffer);
  }
}
