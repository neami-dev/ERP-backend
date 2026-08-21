# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands
```bash
npm install  # Install dependencies
npm run lint --fix  # Lint and fix code (eslint)
npm run format  # Format TypeScript files (prettier)
npm run test  # Run unit tests (Jest)
npm run test:cov  # Run tests with coverage
npm run test:e2e  # Run e2e tests
npm run start  # Start application
npm run start:dev  # Development server with watch mode
npm run start:prod  # Production service
```

## Architectural Overview
1. **Modular Structure**: The app is organized into discrete modules:
   - `users` module for user management
   - `products` module for product handling
   - `purchases` module for purchase orders
   - `warehouses` for inventory tracking
   - `stock-movements` for tracking physical movements
   - `suppliers` for supplier management
   - `companies` for company-specific logic

2. **Database Setup**: PostgreSQL using TypeORM with database configuration in `/src/config/database.config.ts`.

3. **Authentication**: JWT-based authentication managed in `/src/auth/` with external configuration loading.

4. **Document Sequence**: Purchase orders use document number management from `/common/document-number/document-number.module`.

## Key Implementations to Note
- All business logic is separated into service layers (e.g., `purchase-orders.service.ts`)
- TypeORM is used for database interactions with entities like `PurchaseOrder` and `Supplier`
- Swagger integration for API documentation
- Pagination/variants handling through mapped types

## Testing Approach
- Unit tests follow a naming convention `*spec.ts`
- Coverage reports generated in `coverage/`
- E2E tests configured in `test/jest-e2e.json`

## Deployment
- Production deployment uses AWS via [NestJS Mau](https://mau.nestjs.com)
- Deployment command: `npm install -g @nestjs/mau && mau deploy`

## Code Quality
- Formatted with Prettier
- Linted with ESLint + Prettier plugin
- TypeScript compiler configured in `tsconfig.json`

This structure emphasizes clear separation of concerns, RESTful API design, and proper document number generation for business operations.