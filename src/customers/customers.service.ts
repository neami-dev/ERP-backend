import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Customer } from './entities/customer.entity';
import { Repository } from 'typeorm';
import { PaginationDto } from 'src/common/dto/pagination.dto';

@Injectable()
export class CustomersService {
  constructor(@InjectRepository(Customer) private readonly customerRepo: Repository<Customer>) { }

  async create(createCustomerDto: CreateCustomerDto) {
    const existingEmail = await this.customerRepo.existsBy({ email: createCustomerDto.email });
    if (existingEmail) {
      throw new ConflictException('Customer with this email already exists');
    }
    const existingName = await this.customerRepo.existsBy({ name: createCustomerDto.name });
    if (existingName) {
      throw new ConflictException('Customer with this name already exists');
    }
    const customer = this.customerRepo.create(createCustomerDto);
    return this.customerRepo.save(customer);
  }

  async findAll(query: PaginationDto) {
    const { page, limit } = query;
    const skip = (page - 1) * limit;
    const [customers, total] = await this.customerRepo.findAndCount({ skip, take: limit });
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

  async findOne(id: string) {
    const customer = await this.customerRepo.findOneBy({ id });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }
    return customer;
  }

  async update(id: string, updateCustomerDto: UpdateCustomerDto) {
    if (updateCustomerDto?.email) {
      const exists = await this.customerRepo.existsBy({ email: updateCustomerDto.email });
      if (exists) {
        throw new ConflictException('Another customer with this email already exists');
      }
    }
    if (updateCustomerDto?.name) {
      const exists = await this.customerRepo.existsBy({ name: updateCustomerDto.name });
      if (exists) {
        throw new ConflictException('Another customer with this name already exists');
      }
    }
    const customer = await this.findOne(id);
    Object.assign(customer, updateCustomerDto);
    return this.customerRepo.save(customer);
  }

  async remove(id: string) {
    const customer = await this.findOne(id);
    return this.customerRepo.remove(customer);
  }
}
