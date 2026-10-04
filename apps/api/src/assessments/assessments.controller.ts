import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Put,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { Request } from "express";
import { APP_CONFIG, AppConfig } from "../config/configuration";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { Errors } from "../common/errors/api-exception";
import { ApiErrorCode } from "../common/errors/error-codes";
import type { SessionUser } from "../auth/types/session-user";
import { AssessmentsService } from "./assessments.service";
import { ImportService } from "./import.service";
import { BulkScoresDto, CreateAssessmentDto, ImportCommitDto } from "./dto/assessment.dto";

@Controller("assessments")
export class AssessmentsController {
  constructor(
    private readonly service: AssessmentsService,
    private readonly importService: ImportService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Get()
  @Roles("SUPERADMIN", "TEACHER")
  async list(@CurrentUser() user: SessionUser, @Query() query: Record<string, string>) {
    return this.service.list(user, query);
  }

  @Post()
  @Roles("SUPERADMIN", "TEACHER")
  async create(@CurrentUser() user: SessionUser, @Body() dto: CreateAssessmentDto, @Req() req: Request) {
    return this.service.create(user, dto, req);
  }

  @Get(":id")
  @Roles("SUPERADMIN", "TEACHER")
  async get(@CurrentUser() user: SessionUser, @Param("id") id: string) {
    return this.service.get(user, id);
  }

  @Get(":id/scores")
  @Roles("SUPERADMIN", "TEACHER")
  async listScores(@CurrentUser() user: SessionUser, @Param("id") id: string) {
    return this.service.listScores(user, id);
  }

  @Put(":id/scores")
  @Roles("SUPERADMIN", "TEACHER")
  async replaceScores(
    @CurrentUser() user: SessionUser,
    @Param("id") id: string,
    @Body() dto: BulkScoresDto,
    @Req() req: Request,
  ) {
    return this.service.replaceScores(user, id, dto, req);
  }

  @Delete(":id/scores/:studentId")
  @HttpCode(204)
  @Roles("SUPERADMIN", "TEACHER")
  async deleteScore(
    @CurrentUser() user: SessionUser,
    @Param("id") id: string,
    @Param("studentId") studentId: string,
    @Req() req: Request,
  ) {
    await this.service.deleteScore(user, id, studentId, req);
  }

  @Post(":id/scores/import")
  @HttpCode(200)
  @Roles("SUPERADMIN", "TEACHER")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async previewImport(
    @CurrentUser() user: SessionUser,
    @Param("id") id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) {
      throw Errors.validation(ApiErrorCode.IMPORT_INVALID_FORMAT, "File tidak ditemukan pada request.");
    }
    const maxBytes = this.config.maxUploadMb * 1024 * 1024;
    if (file.size > maxBytes) {
      throw Errors.validation(
        ApiErrorCode.IMPORT_INVALID_FORMAT,
        `Ukuran file melebihi batas ${this.config.maxUploadMb} MB.`,
      );
    }
    return this.importService.preview(user, id, {
      buffer: file.buffer,
      originalname: file.originalname,
    });
  }

  @Post(":id/scores/import/commit")
  @HttpCode(200)
  @Roles("SUPERADMIN", "TEACHER")
  async commitImport(
    @CurrentUser() user: SessionUser,
    @Param("id") id: string,
    @Body() dto: ImportCommitDto,
    @Req() req: Request,
  ) {
    return this.importService.commit(user, id, dto.importId, req);
  }
}
