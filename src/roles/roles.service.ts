import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';

import { Role } from './entities/role.entity';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { ALL_PERMISSIONS } from 'src/common/permissions/permission';
import { isUniqueViolation } from 'src/common/database/postgres-errors';
import { removeEntity } from 'src/common/database/remove-entity';

const OWNER_ROLE_NAME = 'Owner';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
  ) {}

  /**
   * Creates the one role every company gets for free at signup. It carries
   * every permission in the catalog for transparent display in the UI, but
   * `PermissionsGuard` never actually reads this list for it — `isOwnerRole`
   * alone is what grants access, so a permission added to the catalog later
   * is automatically available to the owner without touching this row.
   */
  async createOwnerRole(
    companyId: string,
    manager?: EntityManager,
  ): Promise<Role> {
    const repo = this.repo(manager);
    const role = repo.create({
      name: OWNER_ROLE_NAME,
      permissions: ALL_PERMISSIONS,
      isOwnerRole: true,
      companyId,
    });

    return await repo.save(role);
  }

  async create(dto: CreateRoleDto, companyId: string): Promise<Role> {
    const role = this.roleRepo.create({ ...dto, companyId });

    try {
      return await this.roleRepo.save(role);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('A role with this name already exists');
      }

      throw error;
    }
  }

  async findAllByCompany(companyId: string): Promise<Role[]> {
    return await this.roleRepo.findBy({ companyId });
  }

  async findOne(id: string, companyId: string): Promise<Role> {
    const role = await this.roleRepo.findOneBy({ id, companyId });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    return role;
  }

  async update(
    id: string,
    dto: UpdateRoleDto,
    companyId: string,
  ): Promise<Role> {
    const role = await this.findOne(id, companyId);

    if (role.isOwnerRole) {
      throw new ForbiddenException('The Owner role cannot be changed');
    }

    Object.assign(role, dto);

    try {
      return await this.roleRepo.save(role);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('A role with this name already exists');
      }

      throw error;
    }
  }

  async remove(id: string, companyId: string): Promise<Role> {
    const role = await this.findOne(id, companyId);

    if (role.isOwnerRole) {
      throw new ForbiddenException('The Owner role cannot be deleted');
    }

    return await removeEntity(
      this.roleRepo,
      role,
      'This role cannot be deleted: it is still assigned to users. Move them to another role first.',
    );
  }

  /** The caller's transaction if there is one, otherwise the default connection. */
  private repo(manager?: EntityManager): Repository<Role> {
    return manager ? manager.getRepository(Role) : this.roleRepo;
  }
}
