import { Module } from "@nestjs/common";
import { AssessmentCategoriesController } from "./assessment-categories.controller";
import { AssessmentCategoriesService } from "./assessment-categories.service";

@Module({
  controllers: [AssessmentCategoriesController],
  providers: [AssessmentCategoriesService],
  exports: [AssessmentCategoriesService],
})
export class AssessmentCategoriesModule {}
