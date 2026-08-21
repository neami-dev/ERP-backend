import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Not, QueryFailedError, Repository } from 'typeorm';

import { Company } from './entities/company.entity';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { DocumentNumberService } from 'src/common/ document-number/document-number.service';

/** Postgres error code for a violated unique constraint. */
const UNIQUE_VIOLATION = '23505';

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
    private readonly documentNumberService: DocumentNumberService,
  ) { }

  /**
   * Creates a company together with its document sequences.
   *
   * The two are done here as one operation because a company without
   * sequences is broken: the first purchase order, quotation or invoice it
   * tries to number throws 404. Callers cannot create one and forget the other.
   *
   * Takes the caller's `EntityManager`, the same way `DocumentNumberService`
   * does, so signup can create the company inside the transaction that also
   * creates the first user — and a failure below rolls both back together.
   */
  async create(
    data: { name: string },
    manager: EntityManager,
  ): Promise<Company> {
    await this.assertNameIsFree(data.name, manager);

    const company = manager.create(Company, data);

    try {
      await manager.save(company);
    } catch (error) {
      this.rethrowDuplicateNameAsConflict(error);
    }

    await this.documentNumberService.createDefaultSequences(company.id, manager);

    return company;
  }

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
      await this.assertNameIsFree(updateCompanyDto.name, undefined, companyId);
    }

    Object.assign(company, updateCompanyDto);

    try {
      return await this.companyRepository.save(company);
    } catch (error) {
      this.rethrowDuplicateNameAsConflict(error);
    }
  }

  /**
   * Company names are unique across the system.
   *
   * @param manager  The caller's transaction, if there is one.
   * @param ignoreId Company being updated, so it does not clash with itself.
   */
  private async assertNameIsFree(
    name: string,
    manager?: EntityManager,
    ignoreId?: string,
  ) {
    const taken = manager
      ? await manager.existsBy(Company, {
        name,
        ...(ignoreId && { id: Not(ignoreId) }),
      })
      : await this.companyRepository.existsBy({
        name,
        ...(ignoreId && { id: Not(ignoreId) }),
      });

    if (taken) {
      throw new ConflictException('Company with this name already exists');
    }
  }

  /**
   * Checking the name first still leaves a gap: two requests racing each other
   * both pass the check, then one insert loses on the unique constraint. This
   * turns that database error into the same 409 the check would have produced,
   * so both paths look identical to the client.
   */
  private rethrowDuplicateNameAsConflict(error: unknown): never {
    if (
      error instanceof QueryFailedError &&
      (error.driverError as { code?: string })?.code === UNIQUE_VIOLATION
    ) {
      throw new ConflictException('Company with this name already exists');
    }

    throw error;
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
