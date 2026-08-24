import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { RequirePermissions } from 'src/auth/decorators/require-permissions.decorator';
import { Permission } from 'src/common/permissions/permission';
import { hashPassword } from 'src/common/security/password.util';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @RequirePermissions(Permission.USERS_MANAGE)
  @ApiOperation({ summary: 'Create a user in the current company' })
  @ApiCreatedResponse({ type: User })
  async create(
    @Body() createUserDto: CreateUserDto,
    @CurrentUser('companyId') companyId: string,
  ) {
    const { password, ...rest } = createUserDto;
    const passwordHash = await hashPassword(password);

    return this.usersService.create({
      ...rest,
      password: passwordHash,
      companyId,
    });
  }

  @Get()
  @RequirePermissions(Permission.USERS_READ)
  @ApiOperation({ summary: 'Get the users of the current company' })
  @ApiOkResponse({ type: [User] })
  findAll(@CurrentUser('companyId') companyId: string) {
    return this.usersService.findAllByCompany(companyId);
  }

  @Get(':id')
  @RequirePermissions(Permission.USERS_READ)
  @ApiOperation({ summary: 'Get a user by ID' })
  @ApiOkResponse({ type: User })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.usersService.findOneInCompany(id, companyId);
  }

  @Patch(':id')
  @RequirePermissions(Permission.USERS_MANAGE)
  @ApiOperation({ summary: "Update a user's profile, active status or role" })
  @ApiOkResponse({ type: User })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.usersService.update(id, updateUserDto, companyId);
  }
}
