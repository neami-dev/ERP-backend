import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';
import { Public } from './auth/decorators/public.decorator';

@ApiTags('App')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) { }

  @Public()
  @Get()
  @ApiOperation({ summary: 'API name and version. Open, no token needed.' })
  @ApiOkResponse({
    schema: {
      type: 'object',
      additionalProperties: true,
      example: { name: 'ERP API', version: '1.0' },
    },
  })
  getApiInfo() {
    return this.appService.getApiInfo();
  }

}
