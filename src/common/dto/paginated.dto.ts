import { applyDecorators, Type } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiOkResponse,
  ApiProperty,
  getSchemaPath,
} from '@nestjs/swagger';

/** The `meta` block every list endpoint returns. */
export class PaginationMetaDto {
  @ApiProperty({ example: 1, description: 'The page that was returned.' })
  page: number;

  @ApiProperty({ example: 10, description: 'Rows per page.' })
  limit: number;

  @ApiProperty({ example: 42, description: 'Rows matching the query in total.' })
  total: number;

  @ApiProperty({ example: 5, description: 'Number of pages at this page size.' })
  totalPages: number;
}

/**
 * Documents a `{ data: Model[], meta }` list response in Swagger.
 *
 * The shape has to be spelled out as a schema rather than a class, because
 * OpenAPI has no generics — a `Paginated<Product>` class would be erased to a
 * single shared model and every list would end up documented as the same type.
 *
 * @example
 * \@ApiPaginatedResponse(Product)
 * findAll() { ... }
 */
export const ApiPaginatedResponse = <TModel extends Type<unknown>>(
  model: TModel,
) =>
  applyDecorators(
    ApiExtraModels(PaginationMetaDto, model),
    ApiOkResponse({
      description: `Paginated list of ${model.name}.`,
      schema: {
        type: 'object',
        required: ['data', 'meta'],
        properties: {
          data: {
            type: 'array',
            items: { $ref: getSchemaPath(model) },
          },
          meta: { $ref: getSchemaPath(PaginationMetaDto) },
        },
      },
    }),
  );
