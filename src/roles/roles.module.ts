import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Role } from './entities/role.entity';
import { RolesService } from './roles.service';
import { RolesController } from './roles.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Role])],
  controllers: [RolesController],
  providers: [RolesService],
  // AuthModule uses this to create the Owner role at signup and to check
  // permissions in PermissionsGuard; UsersModule uses it to validate that a
  // roleId given to create/update a user belongs to the caller's company.
  exports: [RolesService],
})
export class RolesModule {}
