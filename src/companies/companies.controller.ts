import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Put,
  Res,
} from '@nestjs/common';
import {
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';

import { CompaniesService } from './companies.service';
import { CompanyLogosService } from './company-logos.service';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { UploadCompanyLogoDto } from './dto/upload-company-logo.dto';
import { CompanyLogoDto } from './dto/company-logo.dto';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { Company } from './entities/company.entity';

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
    private readonly companyLogosService: CompanyLogosService,
  ) { }

  // Declared before ':id' on purpose: Nest matches routes in order, so with
  // ':id' first the literal "me" would be parsed as an id and ParseUUIDPipe
  // would answer 400.
  @Get('me')
  @ApiOperation({
    summary: 'Get the company of the current user',
  })
  @ApiOkResponse({ type: Company })
  findMine(@CurrentUser('companyId') companyId: string) {
    return this.companiesService.findMine(companyId);
  }

  // `me` only, no `:id/logo` variant: this is a singleton sub-resource of the
  // caller's own company, and every other route in this controller already
  // scopes writes to it. A `:id` form would buy nothing but another
  // `assertIsOwnCompany` call and another place for the route-ordering trap
  // above to resurface.
  @Put('me/logo')
  @ApiOperation({ summary: "Replace the current user's company logo" })
  @ApiOkResponse({ type: CompanyLogoDto })
  async uploadLogo(
    @Body() dto: UploadCompanyLogoDto,
    @CurrentUser('companyId') companyId: string,
  ) {
    return await this.companyLogosService.upload(companyId, dto);
  }

  @Get('me/logo')
  @ApiOperation({ summary: "Download the current user's company logo" })
  @ApiProduces('image/png', 'image/jpeg', 'image/webp')
  @ApiOkResponse({ description: 'The raw image bytes.' })
  async downloadLogo(
    @CurrentUser('companyId') companyId: string,
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Res({ passthrough: false }) res: Response,
  ) {
    const logo = await this.companyLogosService.findBytes(companyId);
    const etag = `"${logo.checksum}"`;

    res.setHeader('ETag', etag);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, max-age=0, must-revalidate');

    // Thrown above, so the exception filter still handles a missing logo —
    // everything from here on writes directly to the response and bypasses
    // that filter, which is why nothing after this point can throw.
    if (ifNoneMatch === etag) {
      res.status(HttpStatus.NOT_MODIFIED).end();
      return;
    }

    res.setHeader('Content-Type', logo.contentType);
    res.setHeader('Content-Length', logo.byteSize);
    res.status(HttpStatus.OK).end(logo.data);
  }

  @Delete('me/logo')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Remove the current user's company logo" })
  @ApiNoContentResponse()
  async removeLogo(@CurrentUser('companyId') companyId: string) {
    await this.companyLogosService.remove(companyId);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a company by ID (your own company only)',
  })
  @ApiOkResponse({ type: Company })
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
  @ApiOkResponse({ type: Company })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateCompanyDto: UpdateCompanyDto,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.companiesService.update(id, updateCompanyDto, companyId);
  }
}
