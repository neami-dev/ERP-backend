import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreatePurchaseOrderDto } from '../dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from '../dto/update-purchase-order.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { PurchaseOrder } from '../entities/purchase-order.entity';
import { DataSource, Repository } from 'typeorm';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { Supplier } from 'src/suppliers/entities/supplier.entity';
import { DocumentType } from 'src/common/ document-number/document-type.enum';
import { DocumentNumberService } from 'src/common/ document-number/document-number.service';
import { Company } from 'src/companies/entities/company.entity';

@Injectable()
export class PurchaseOrdersService {
  constructor(
    @InjectRepository(PurchaseOrder)
    private readonly purchaseOrderRepo: Repository<PurchaseOrder>,
    @InjectRepository(Supplier)
    private readonly supplierRepo: Repository<Supplier>,
    private readonly documentNumberService: DocumentNumberService,
    private readonly dataSource: DataSource
  ) { }

  /**
 * Creates a new purchase order within a database transaction.
 *
 * Workflow:
 * - Validates that the supplier exists.
 * - Validates that the company exists.
 * - Generates a unique purchase order number.
 * - Creates and saves the purchase order.
 * - Commits the transaction if all operations succeed.
 *
 * If any step fails, the transaction is rolled back to ensure
 * data consistency.
 *
 * @param createPurchaseOrderDto Data required to create a purchase order.
 * @returns The newly created purchase order.
 * @throws {NotFoundException} If the supplier does not exist.
 * @throws {NotFoundException} If the company does not exist.
 */
  async create(createPurchaseOrderDto: CreatePurchaseOrderDto) {

    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    const supplierId = createPurchaseOrderDto.supplierId;
    const companyId = createPurchaseOrderDto.companyId;

    try {
      const supplier = await queryRunner.manager.findOneBy(Supplier, {
        id: supplierId,
      });

      if (!supplier) {
        throw new NotFoundException('Supplier not found');
      }

      const company = await queryRunner.manager.existsBy(Company, {
        id: companyId
      })

      if (!company) {
        throw new NotFoundException("Company not found")
      }

      const orderNumber = await this.documentNumberService.generate(
        companyId,
        DocumentType.PURCHASE_ORDER,
        queryRunner,
      );
      const purchaseOrder = queryRunner.manager.create(PurchaseOrder, {
        createPurchaseOrderDto,
        orderNumber,
        orderDate: new Date(),
      });

      await queryRunner.manager.save(purchaseOrder);

      await queryRunner.commitTransaction();

      return purchaseOrder;

    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;

    } finally {
      await queryRunner.release();
    }

  }

  async findAll(query: PaginationDto) {
    const { page, limit } = query;

    const skip = (page - 1) * limit;
    const [purchaseOrders, total] = await this.purchaseOrderRepo.findAndCount({
      skip,
      take: limit,
    });

    return {
      data: purchaseOrders,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const purchaseOrder = await this.purchaseOrderRepo.findOneBy({ id });
    if (!purchaseOrder) {
      throw new NotFoundException('Purchase order not found');
    }
    return purchaseOrder;
  }

  async update(id: string, updatePurchaseOrderDto: UpdatePurchaseOrderDto) {


    const purchaseOrder = await this.findOne(id);

    // Handle supplierId update if provided
    if (updatePurchaseOrderDto?.supplierId !== undefined) {
      // If supplierId is explicitly set to null/undefined, we might want to handle that
      // For now, if provided, we'll update the relation
      if (updatePurchaseOrderDto.supplierId) {
        const supplier = await this.supplierRepo.findOneBy({ id: updatePurchaseOrderDto.supplierId });
        if (!supplier) {
          throw new NotFoundException('Supplier not found');
        }
        purchaseOrder.supplier = supplier;
      } else {
        // If supplierId is null/empty string, we could set supplier to null
        // purchaseOrder.supplier = null;
      }
      // Remove supplierId from updatePurchaseOrderDto so Object.assign doesn't overwrite our relation handling
      delete updatePurchaseOrderDto.supplierId;
    }

    Object.assign(purchaseOrder, updatePurchaseOrderDto);
    return this.purchaseOrderRepo.save(purchaseOrder);
  }

  async remove(id: string) {
    const purchaseOrder = await this.findOne(id);
    if (!purchaseOrder) {
      throw new NotFoundException('Purchase order not found');
    }
    return this.purchaseOrderRepo.remove(purchaseOrder);
  }
}
