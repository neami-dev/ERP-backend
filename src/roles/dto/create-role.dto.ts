import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';

import { ALL_PERMISSIONS, Permission } from 'src/common/permissions/permission';

export class CreateRoleDto {
  @ApiProperty({ example: 'Warehouse Staff' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({
    example: [Permission.PRODUCTS_READ, Permission.STOCK_MOVEMENTS_CREATE],
    enum: ALL_PERMISSIONS,
    isArray: true,
    description: 'Exact permissions this role grants.',
  })
  @IsArray()
  @ArrayUnique()
  @IsIn(ALL_PERMISSIONS, { each: true })
  permissions: Permission[];
}
