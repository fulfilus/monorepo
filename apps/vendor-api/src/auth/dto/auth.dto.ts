import { IsString, MinLength, Matches } from "class-validator";

export class LoginDto {
  @IsString()
  username!: string;

  @IsString()
  @MinLength(15, { message: "Password must be at least 15 characters" })
  password!: string;
}

export class TwoFaConfirmDto {
  @IsString()
  tempToken!: string;

  @IsString()
  code!: string;
}

export class TwoFaVerifyDto {
  @IsString()
  code!: string;
}

export class ChangePasswordDto {
  @IsString()
  currentPassword!: string;

  @IsString()
  @MinLength(15, { message: "Password must be at least 15 characters" })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{15,}$/, {
    message: "Password must contain uppercase, lowercase, digit, and special character",
  })
  newPassword!: string;
}
