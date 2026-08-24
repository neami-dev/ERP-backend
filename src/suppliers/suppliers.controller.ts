import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { RequirePermissions } from 'src/auth/decorators/require-permissions.decorator';
import { ApiPaginatedResponse } from 'src/common/dto/paginated.dto';
import { Permission } from 'src/common/permissions/permission';
import { Supplier } from './entities/supplier.entity';

@ApiTags('suppliers')
@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Post()
  @RequirePermissions(Permission.SUPPLIERS_CREATE)
  @ApiOperation({ summary: 'Create a supplier for the current company' })
  @ApiCreatedResponse({ type: Supplier })
  create(
    @Body() createSupplierDto: CreateSupplierDto,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.suppliersService.create(createSupplierDto, companyId);
  }

  @Get()
  @RequirePermissions(Permission.SUPPLIERS_READ)
  @ApiOperation({ summary: 'Get the suppliers of the current company' })
  @ApiPaginatedResponse(Supplier)
  findAll(
    @Query() query: PaginationDto,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.suppliersService.findAll(query, companyId);
  }

  @Get(':id')
  @RequirePermissions(Permission.SUPPLIERS_READ)
  @ApiOperation({ summary: 'Get a supplier by ID' })
  @ApiOkResponse({ type: Supplier })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.suppliersService.findOne(id, companyId);
  }

  @Patch(':id')
  @RequirePermissions(Permission.SUPPLIERS_UPDATE)
  @ApiOperation({ summary: 'Update a supplier by ID' })
  @ApiOkResponse({ type: Supplier })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateSupplierDto: UpdateSupplierDto,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.suppliersService.update(id, updateSupplierDto, companyId);
  }

  @Delete(':id')
  @RequirePermissions(Permission.SUPPLIERS_DELETE)
  @ApiOperation({ summary: 'Delete a supplier by ID' })
  @ApiOkResponse({ type: Supplier })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.suppliersService.remove(id, companyId);
  }
}
