import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Not, Repository } from 'typeorm';

import { User } from './entities/user.entity';
import { isUniqueViolation } from 'src/common/database/postgres-errors';
import { RolesService } from 'src/roles/roles.service';

export interface CreateUserData {
  email: string;
  /** Already hashed — this service never sees a plain password. */
  password: string;
  firstName: string;
  lastName?: string;
  companyId: string;
  roleId: string;
}

export interface UpdateUserData {
  firstName?: string;
  lastName?: string;
  isActive?: boolean;
  roleId?: string;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly rolesService: RolesService,
  ) {}

  /**
   * Creates a user.
   *
   * Every method here takes an optional `manager`, the same way
   * `DocumentNumberService` does. Pass a transaction's `EntityManager` and the
   * write joins that transaction; omit it and it runs on its own.
   *
   * Without this, signup could not use the service at all: the injected
   * repository is bound to the default connection, so a user created through
   * it would be committed immediately and would survive a rollback of the
   * company it belongs to.
   *
   * The roleId is only checked against `RolesService` when there is no
   * `manager`: signup creates the Owner role in the same not-yet-committed
   * transaction, so looking it up through the default connection would find
   * nothing and fail a perfectly valid signup.
   */
  async create(data: CreateUserData, manager?: EntityManager): Promise<User> {
    if (!manager) {
      await this.rolesService.findOne(data.roleId, data.companyId);
    }

    const repo = this.repo(manager);
    const user = repo.create(data);

    try {
      return await repo.save(user);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('A user with this email already exists');
      }

      throw error;
    }
  }

  /**
   * Finds a user by email, including the password hash and their company.
   *
   * The password column is `select: false`, so it is pulled in explicitly
   * here. Use this only for authentication — never to build an API response.
   *
   * The company comes along because the sign-in response names it, and
   * joining here costs nothing next to the bcrypt compare that follows.
   */
  async findByEmailWithPassword(email: string): Promise<User | null> {
    return await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .leftJoinAndSelect('user.company', 'company')
      .where('user.email = :email', { email })
      .getOne();
  }

  async existsByEmail(
    email: string,
    manager?: EntityManager,
  ): Promise<boolean> {
    return await this.repo(manager).existsBy({ email });
  }

  async findOne(id: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: { company: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async findAllByCompany(companyId: string): Promise<User[]> {
    return await this.userRepository.find({
      where: { companyId },
      relations: { role: true },
    });
  }

  /** Scoped to the caller's company — used by `UsersController`, unlike `findOne`. */
  async findOneInCompany(id: string, companyId: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id, companyId },
      relations: { role: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  /**
   * Updates a user's profile fields, active status, or role.
   *
   * A company must always keep at least one active user holding the Owner
   * role — otherwise nobody could manage roles or users again. So changing
   * a user away from the Owner role, or deactivating them, is refused when
   * they are the last one holding it.
   */
  async update(
    id: string,
    data: UpdateUserData,
    companyId: string,
  ): Promise<User> {
    const user = await this.findOneInCompany(id, companyId);

    const leavesOwnerRole =
      user.role.isOwnerRole &&
      ((data.roleId && data.roleId !== user.roleId) || data.isActive === false);

    if (leavesOwnerRole) {
      const remainingOwners = await this.userRepository.countBy({
        companyId,
        roleId: user.roleId,
        isActive: true,
        id: Not(id),
      });

      if (remainingOwners === 0) {
        throw new ConflictException(
          'This company must always have at least one active Owner.',
        );
      }
    }

    if (data.roleId) {
      await this.rolesService.findOne(data.roleId, companyId);
    }

    Object.assign(user, data);

    await this.userRepository.save(user);

    // `role` may now point at the old relation in memory if `roleId` changed
    // — reload so the response reflects the role actually saved.
    return await this.findOneInCompany(id, companyId);
  }

  /** The caller's transaction if there is one, otherwise the default connection. */
  private repo(manager?: EntityManager): Repository<User> {
    return manager ? manager.getRepository(User) : this.userRepository;
  }
}
