import { IsEmail, IsEnum, IsOptional, IsString, Matches, MinLength } from "class-validator";
import { UserRole } from "@prisma/client";

// At least 15 chars, one lowercase, one uppercase, one digit, one special char
const STRONG_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{15,}$/;

export class CreateUserDto {
  @IsString()
  @MinLength(3)
  username!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(15)
  @Matches(STRONG_PASSWORD_REGEX, {
    message: "Password must be at least 15 characters and include uppercase, lowercase, digit, and special character",
  })
  password!: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}

export class UpdateUserDto {
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}

export class ResetPasswordDto {
  @IsString()
  @MinLength(15)
  @Matches(STRONG_PASSWORD_REGEX, {
    message: "Password must be at least 15 characters and include uppercase, lowercase, digit, and special character",
  })
  newPassword!: string;
}
