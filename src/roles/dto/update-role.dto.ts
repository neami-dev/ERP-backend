import { PartialType } from '@nestjs/swagger';

import { CreateRoleDto } from './create-role.dto';

// `isOwnerRole` is intentionally not a field here: it can only be set by
// `RolesService.createOwnerRole` at signup, never through the API.
export class UpdateRoleDto extends PartialType(CreateRoleDto) {}
