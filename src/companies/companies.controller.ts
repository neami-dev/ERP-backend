import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { CompaniesService } from './companies.service';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';

/**
 * There is no POST here: a company is created only by `POST /auth/signup`,
 * together with its first user and its document sequences. There is no DELETE
 * either — removing a company means removing a whole customer's data, which is
 * not something a single API call should be able to do.
 */
@ApiTags('companies')
@Controller('companies')
export class CompaniesController {
  constructor(
    private readonly companiesService: CompaniesService,
  ) { }

  // Declared before ':id' on purpose: Nest matches routes in order, so with
  // ':id' first the literal "me" would be parsed as an id and ParseUUIDPipe
  // would answer 400.
  @Get('me')
  @ApiOperation({
    summary: 'Get the company of the current user',
  })
  findMine(@CurrentUser('companyId') companyId: string) {
    return this.companiesService.findMine(companyId);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a company by ID (your own company only)',
  })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.companiesService.findOne(id, companyId);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a company by ID (your own company only)',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateCompanyDto: UpdateCompanyDto,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.companiesService.update(id, updateCompanyDto, companyId);
  }
}
