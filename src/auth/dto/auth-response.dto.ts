import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * The signed-in user — the one shape returned by signup, login and
 * `GET /auth/profile`. Never includes the password.
 */
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

  @ApiProperty({
    example: 'ABC Manufacturing',
    description: 'The company this user belongs to. Always present.',
  })
  companyName: string;
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
