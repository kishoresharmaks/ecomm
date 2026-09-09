import { IsEmail, IsOptional, IsString, MaxLength, Matches } from "class-validator";

export class SubscribeDto {
  @IsEmail({}, { message: "Please enter a valid email address." })
  @MaxLength(320, { message: "Email must be at most 320 characters." })
  @Matches(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, { message: "Please enter a valid email address." })
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200, { message: "Name must be at most 200 characters." })
  @Matches(/^[\p{L} .'-]+$/u, { message: "Name contains invalid characters." })
  name?: string;
}
