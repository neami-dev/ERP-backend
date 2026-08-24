import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { StockMovementsService } from './stock-movements.service';
import { CreateStockMovementDto } from './dto/create-stock-movement.dto';
import { StockMovementQueryDto } from './dto/stock-movement-query.dto';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { RequirePermissions } from 'src/auth/decorators/require-permissions.decorator';
import { ApiPaginatedResponse } from 'src/common/dto/paginated.dto';
import { Permission } from 'src/common/permissions/permission';
import { StockMovement } from './entities/stock-movement.entity';

/**
 * There is no PATCH or DELETE here on purpose: movements are the stock audit
 * trail. A wrong movement is corrected by recording an ADJUSTMENT, never by
 * rewriting or deleting history.
 */
@ApiTags('stock-movements')
@Controller('stock-movements')
export class StockMovementsController {
  constructor(private readonly stockMovementsService: StockMovementsService) {}

  @Post()
  @RequirePermissions(Permission.STOCK_MOVEMENTS_CREATE)
  @ApiOperation({
    summary: 'Record a stock movement and apply it to inventory',
  })
  @ApiCreatedResponse({ type: StockMovement })
  create(
    @Body() createStockMovementDto: CreateStockMovementDto,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.stockMovementsService.create(createStockMovementDto, companyId);
  }

  @Get()
  @RequirePermissions(Permission.STOCK_MOVEMENTS_READ)
  @ApiOperation({
    summary: 'Get the stock movements of the current company',
  })
  @ApiPaginatedResponse(StockMovement)
  findAll(
    @Query() query: StockMovementQueryDto,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.stockMovementsService.findAll(query, companyId);
  }

  @Get(':id')
  @RequirePermissions(Permission.STOCK_MOVEMENTS_READ)
  @ApiOperation({ summary: 'Get a stock movement by ID' })
  @ApiOkResponse({ type: StockMovement })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.stockMovementsService.findOne(id, companyId);
  }
}
