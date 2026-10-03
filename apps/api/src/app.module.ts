import { Module, NestModule, MiddlewareConsumer } from "@nestjs/common";
import { APP_FILTER, APP_GUARD, APP_PIPE } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { ConfigModule } from "./config/config.module";
import { PrismaModule } from "./prisma/prisma.module";
import { AuditModule } from "./audit/audit.module";
import { AuthorizationModule } from "./authorization/resource-policy.service";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { RequestIdMiddleware } from "./common/middleware/request-id.middleware";
import { SessionAuthGuard } from "./auth/guards/session-auth.guard";
import { RolesGuard } from "./auth/guards/roles.guard";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { AcademicYearsModule } from "./academic-years/academic-years.module";
import { StudentsModule } from "./students/students.module";
import { GuardiansModule } from "./guardians/guardians.module";
import { ClassesModule } from "./classes/classes.module";
import { SubjectsModule } from "./subjects/subjects.module";
import { CurriculumModule } from "./curriculum/curriculum.module";
import { AssignmentsModule } from "./assignments/assignments.module";
import { AssessmentCategoriesModule } from "./assessment-categories/assessment-categories.module";
import { GradingModule } from "./grading/grading.module";
import { AssessmentsModule } from "./assessments/assessments.module";
import { ReportsModule } from "./reports/reports.module";
import { AuditQueryModule } from "./audit/audit.controller";

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    AuditModule,
    AuthorizationModule,
    AuthModule,
    UsersModule,
    AcademicYearsModule,
    StudentsModule,
    GuardiansModule,
    ClassesModule,
    SubjectsModule,
    CurriculumModule,
    AssignmentsModule,
    AssessmentCategoriesModule,
    GradingModule,
    AssessmentsModule,
    ReportsModule,
    AuditQueryModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: SessionAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
        // Indonesian message for malformed payloads. The OpenAPI contract
        // documents these as 422 ValidationError responses.
        exceptionFactory: (errors) => {
          const { UnprocessableEntityException } = require("@nestjs/common");
          const details = errors.map((e) => ({
            property: e.property,
            constraints: e.constraints,
          }));
          return new UnprocessableEntityException({
            code: "VALIDATION_ERROR",
            message: "Data yang dikirim tidak valid.",
            details: { fields: details },
          });
        },
      }),
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes("*");
  }
}
