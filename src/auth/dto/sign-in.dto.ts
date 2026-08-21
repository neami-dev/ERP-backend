import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SignInDto {
  @ApiProperty({ example: 'ali@abc.com' })
  @IsEmail()
  @MaxLength(255)
  email: string;

  @ApiProperty({ example: 'secret123' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(72)
  password: string;
}
