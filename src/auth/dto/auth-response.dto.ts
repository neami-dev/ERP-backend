import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** The signed-in user, as returned by signup and login. Never includes the password. */
export class AuthUserDto {
  @ApiProperty({ example: '5164f90e-3a72-4906-85b4-f66d3b0b1397' })
  id: string;

  @ApiProperty({ example: 'ali@abc.com' })
  email: string;

  @ApiProperty({ example: 'Ali' })
  firstName: string;

  @ApiPropertyOptional({ example: 'Neami' })
  lastName?: string;

  @ApiProperty({ example: 'ff83ac6c-40c8-4c36-b393-017f4e83b50b' })
  companyId: string;

  @ApiPropertyOptional({
    example: 'ABC Manufacturing',
    description: 'Only returned by signup, where the company was just created.',
  })
  companyName?: string;
}

export class AuthResponseDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description:
      'JWT to send as `Authorization: Bearer <token>` on every other request.',
  })
  access_token: string;

  @ApiProperty({ type: AuthUserDto })
  user: AuthUserDto;
}

/** The payload carried inside the JWT, as returned by `GET /auth/profile`. */
export class JwtPayloadDto {
  @ApiProperty({ description: 'User id.' })
  sub: string;

  @ApiProperty({ example: 'ali@abc.com' })
  email: string;

  @ApiProperty({ description: 'Company the user belongs to.' })
  companyId: string;

  @ApiProperty({ description: 'Issued at, unix seconds.' })
  iat: number;

  @ApiProperty({ description: 'Expires at, unix seconds.' })
  exp: number;
}
