import { IsUUID } from "class-validator";

export class CreateTeacherAssignmentDto {
  @IsUUID("4", { message: "teacherId tidak valid." })
  teacherId!: string;

  @IsUUID("4", { message: "academicYearId tidak valid." })
  academicYearId!: string;

  @IsUUID("4", { message: "semesterId tidak valid." })
  semesterId!: string;

  @IsUUID("4", { message: "classId tidak valid." })
  classId!: string;

  @IsUUID("4", { message: "subjectId tidak valid." })
  subjectId!: string;
}
