import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';

import { Company } from './entities/company.entity';
import { UpdateCompanyDto } from './dto/update-company.dto';

/**
 * A company is the tenant itself, so this service is scoped differently from
 * the others: a user belongs to exactly one company and may only ever see and
 * edit that one. The id always comes from the JWT, never from the client.
 *
 * Companies are created by `POST /auth/signup` only — that is the single path
 * that also creates the first user and the document sequences.
 */
@Injectable()
export class CompaniesService {
  constructor(
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
  ) { }

  /** The company of the caller, taken from their token. */
  async findMine(companyId: string) {
    const company = await this.companyRepository.findOneBy({ id: companyId });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    return company;
  }

  /**
   * @throws {ForbiddenException} If the id is not the caller's own company.
   */
  async findOne(id: string, companyId: string) {
    this.assertIsOwnCompany(id, companyId);

    return await this.findMine(companyId);
  }

  async update(
    id: string,
    updateCompanyDto: UpdateCompanyDto,
    companyId: string,
  ) {
    this.assertIsOwnCompany(id, companyId);

    const company = await this.findMine(companyId);

    if (updateCompanyDto.name) {
      const nameTaken = await this.companyRepository.existsBy({
        name: updateCompanyDto.name,
        id: Not(companyId),
      });

      if (nameTaken) {
        throw new ConflictException('Company with this name already exists');
      }
    }

    Object.assign(company, updateCompanyDto);

    return await this.companyRepository.save(company);
  }

  /**
   * Unlike the other modules this answers 403, not 404. Hiding the row would
   * be pointless here: the caller already knows their own company id, so a
   * different id is plainly someone else's and saying so leaks nothing.
   */
  private assertIsOwnCompany(id: string, companyId: string) {
    if (id !== companyId) {
      throw new ForbiddenException('You can only access your own company');
    }
  }
}
