import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) { }

  /**
   * Finds a user by email, including the password hash.
   *
   * The password column is `select: false`, so it is pulled in explicitly
   * here. Use this only for authentication — never to build an API response.
   */
  async findByEmailWithPassword(email: string): Promise<User | null> {
    return await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.email = :email', { email })
      .getOne();
  }

  async existsByEmail(email: string): Promise<boolean> {
    return await this.userRepository.existsBy({ email });
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
}
