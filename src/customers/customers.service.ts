import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';

import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { Customer } from './entities/customer.entity';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { removeEntity } from 'src/common/database/remove-entity';

/**
 * Every method takes the `companyId` of the caller, read from their JWT,
 * so a user can only ever see and touch the customers of their own company.
 */
@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
  ) {}

  async create(createCustomerDto: CreateCustomerDto, companyId: string) {
    await this.assertNoConflict(createCustomerDto, companyId);

    const customer = this.customerRepo.create({
      ...createCustomerDto,
      companyId,
    });

    return await this.customerRepo.save(customer);
  }

  async findAll(query: PaginationDto, companyId: string) {
    const { page, limit } = query;

    const [customers, total] = await this.customerRepo.findAndCount({
      where: { companyId },
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return {
      data: customers,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, companyId: string) {
    const customer = await this.customerRepo.findOneBy({ id, companyId });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return customer;
  }

  async update(
    id: string,
    updateCustomerDto: UpdateCustomerDto,
    companyId: string,
  ) {
    const customer = await this.findOne(id, companyId);

    await this.assertNoConflict(updateCustomerDto, companyId, id);

    Object.assign(customer, updateCustomerDto);

    return await this.customerRepo.save(customer);
  }

  async remove(id: string, companyId: string) {
    const customer = await this.findOne(id, companyId);

    return await removeEntity(
      this.customerRepo,
      customer,
      'This customer cannot be deleted: other records still reference it.',
    );
  }

  /**
   * Name and email are unique per company, not globally — the same customer
   * may buy from two different companies in the system.
   *
   * @param ignoreId Customer being updated, so it does not clash with itself.
   */
  private async assertNoConflict(
    dto: Partial<Pick<CreateCustomerDto, 'name' | 'email'>>,
    companyId: string,
    ignoreId?: string,
  ) {
    const idFilter = ignoreId ? { id: Not(ignoreId) } : {};

    if (dto.email) {
      const taken = await this.customerRepo.existsBy({
        email: dto.email,
        companyId,
        ...idFilter,
      });

      if (taken) {
        throw new ConflictException('Customer with this email already exists');
      }
    }

    if (dto.name) {
      const taken = await this.customerRepo.existsBy({
        name: dto.name,
        companyId,
        ...idFilter,
      });

      if (taken) {
        throw new ConflictException('Customer with this name already exists');
      }
    }
  }
}
