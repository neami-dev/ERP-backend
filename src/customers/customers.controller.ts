import { Controller, Get, Post, Body, Patch, Param, Delete, Query, ParseUUIDPipe } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { ApiPaginatedResponse } from 'src/common/dto/paginated.dto';
import { Customer } from './entities/customer.entity';

@ApiTags('customers')
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) { }

  @Post()
  @ApiOperation({ summary: 'Create a customer for the current company' })
  @ApiCreatedResponse({ type: Customer })
  create(
    @Body() createCustomerDto: CreateCustomerDto,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.customersService.create(createCustomerDto, companyId);
  }

  @Get()
  @ApiOperation({ summary: 'Get the customers of the current company' })
  @ApiPaginatedResponse(Customer)
  findAll(
    @Query() query: PaginationDto,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.customersService.findAll(query, companyId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a customer by ID' })
  @ApiOkResponse({ type: Customer })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.customersService.findOne(id, companyId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a customer by ID' })
  @ApiOkResponse({ type: Customer })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateCustomerDto: UpdateCustomerDto,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.customersService.update(id, updateCustomerDto, companyId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a customer by ID' })
  @ApiOkResponse({ type: Customer })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.customersService.remove(id, companyId);
  }
}
