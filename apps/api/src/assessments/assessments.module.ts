import { Module } from "@nestjs/common";
import { AssessmentsController } from "./assessments.controller";
import { AssessmentsService } from "./assessments.service";
import { ImportService } from "./import.service";

@Module({
  controllers: [AssessmentsController],
  providers: [AssessmentsService, ImportService],
  exports: [AssessmentsService, ImportService],
})
export class AssessmentsModule {}
