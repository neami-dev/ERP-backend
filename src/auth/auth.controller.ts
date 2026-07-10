
import { Body, Controller, Post, HttpCode, HttpStatus, Get, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { AuthGuard } from './auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @HttpCode(HttpStatus.OK)
  @Post('login')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        username: {
          type: 'string',
          example: 'john',
        },
        password: {
          type: 'string',
          example: 'changeme',
        },
      },
      required: ['username', 'password'],
    },
  })
  signIn(@Body() signInDto: Record<string, any>) {
    return this.authService.signIn(signInDto?.username, signInDto?.password);
  }

  @UseGuards(AuthGuard)
  @Get('profile')
  @ApiBearerAuth('access_token')
  getProfile(@Request() req) {
    return req.user;
  }
}
