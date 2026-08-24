import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { Role } from './entities/role.entity';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { RequirePermissions } from 'src/auth/decorators/require-permissions.decorator';
import { ALL_PERMISSIONS, Permission } from 'src/common/permissions/permission';

@ApiTags('roles')
@Controller('roles')
@RequirePermissions(Permission.ROLES_MANAGE)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get('permissions')
  @ApiOperation({ summary: 'List every permission a role can be granted' })
  @ApiOkResponse({ type: [String] })
  listPermissions() {
    return ALL_PERMISSIONS;
  }

  @Post()
  @ApiOperation({ summary: 'Create a role for the current company' })
  @ApiCreatedResponse({ type: Role })
  create(
    @Body() createRoleDto: CreateRoleDto,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.rolesService.create(createRoleDto, companyId);
  }

  @Get()
  @ApiOperation({ summary: 'Get the roles of the current company' })
  @ApiOkResponse({ type: [Role] })
  findAll(@CurrentUser('companyId') companyId: string) {
    return this.rolesService.findAllByCompany(companyId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a role by ID' })
  @ApiOkResponse({ type: Role })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.rolesService.findOne(id, companyId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a role by ID' })
  @ApiOkResponse({ type: Role })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateRoleDto: UpdateRoleDto,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.rolesService.update(id, updateRoleDto, companyId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a role by ID' })
  @ApiOkResponse({ type: Role })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.rolesService.remove(id, companyId);
  }
}
