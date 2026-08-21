import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';

import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { Company } from '../companies/entities/company.entity';
import { CompaniesService } from '../companies/companies.service';
import { SignUpDto } from './dto/sign-up.dto';
import { SignInDto } from './dto/sign-in.dto';

const BCRYPT_ROUNDS = 10;

export interface JwtPayload {
  sub: string;
  email: string;
  companyId: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly companiesService: CompaniesService,
    private readonly jwtService: JwtService,
    private readonly dataSource: DataSource,
  ) { }

  /**
   * Registers a brand new account: creates the company, its default document
   * sequences, and the first user of that company.
   *
   * Everything runs in a single transaction, so a failure half way through
   * cannot leave a company without a user or a company without sequences.
   */
  async signUp(signUpDto: SignUpDto) {
    const { companyName, email, password, firstName, lastName } = signUpDto;

    // Hashing is slow on purpose (~100ms), so it is done before the
    // transaction opens rather than holding a database connection while it runs.
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      if (await this.usersService.existsByEmail(email, queryRunner.manager)) {
        throw new ConflictException('A user with this email already exists');
      }

      // Each module writes its own tables, and both are handed this
      // transaction's manager — so signup only decides the order, and a
      // failure at any point rolls the whole thing back.
      const company = await this.companiesService.create(
        { name: companyName },
        queryRunner.manager,
      );

      const user = await this.usersService.create(
        {
          email,
          password: passwordHash,
          firstName,
          lastName,
          companyId: company.id,
        },
        queryRunner.manager,
      );

      await queryRunner.commitTransaction();

      return this.buildAuthResponse(user, company);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async signIn(signInDto: SignInDto) {
    const { email, password } = signInDto;

    const user = await this.usersService.findByEmailWithPassword(email);

    // Compare against a dummy hash when the user does not exist, so that a
    // wrong email and a wrong password take the same time to answer and
    // cannot be told apart by timing.
    const hash = user?.password ?? '$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv';
    const passwordMatches = await bcrypt.compare(password, hash);

    if (!user || !passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('This account is disabled');
    }

    return this.buildAuthResponse(user);
  }

  private async buildAuthResponse(user: User, company?: Company) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      companyId: user.companyId,
    };

    return {
      access_token: await this.jwtService.signAsync(payload),
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        companyId: user.companyId,
        companyName: company?.name,
      },
    };
  }
}
