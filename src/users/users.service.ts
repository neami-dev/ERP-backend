import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';

import { User } from './entities/user.entity';
import { isUniqueViolation } from 'src/common/database/postgres-errors';

export interface CreateUserData {
  email: string;
  /** Already hashed — this service never sees a plain password. */
  password: string;
  firstName: string;
  lastName?: string;
  companyId: string;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) { }

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
   */
  async create(
    data: CreateUserData,
    manager?: EntityManager,
  ): Promise<User> {
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

  async existsByEmail(email: string, manager?: EntityManager): Promise<boolean> {
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
    return await this.userRepository.findBy({ companyId });
  }

  /** The caller's transaction if there is one, otherwise the default connection. */
  private repo(manager?: EntityManager): Repository<User> {
    return manager ? manager.getRepository(User) : this.userRepository;
  }
}
