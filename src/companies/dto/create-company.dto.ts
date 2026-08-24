import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsEmail,
    IsIn,
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsString,
    Matches,
    Max,
    MaxLength,
    Min,
} from 'class-validator';
import {
    EmptyToNull,
    TrimAndCompact,
    UpperCase,
} from 'src/common/transformers/normalize';

/**
 * Currencies this company may be billed in.
 *
 * Restricted to two decimal places: `roundMoney()` rounds to two, and every
 * money column is `numeric(10, 2)`. A three-decimal currency (TND, KWD) or a
 * zero-decimal one (JPY) would be silently wrong in its last digit.
 */
export const SUPPORTED_CURRENCIES = [
    'MAD',
    'EUR',
    'USD',
    'GBP',
    'CHF',
    'CAD',
    'AED',
    'SAR',
] as const;

export class CreateCompanyDto {
    @ApiProperty({
        example: 'ABC Manufacturing',
        description: 'Company name',
    })
    @IsString()
    @IsNotEmpty()
    @MaxLength(150)
    name: string;

    @ApiPropertyOptional({
        example: 'contact@abc.com',
        description: 'Company email',
    })
    @IsOptional()
    @IsEmail()
    email?: string;

    @ApiPropertyOptional({
        example: '+212600000000',
        description: 'Company phone number',
    })
    @IsOptional()
    @IsString()
    @MaxLength(30)
    phone?: string;

    @ApiPropertyOptional({
        example: 'Casablanca, Morocco',
        description: 'Company address',
    })
    @IsOptional()
    @IsString()
    @MaxLength(255)
    address?: string;

    @ApiPropertyOptional({
        example: '001234567000025',
        description:
            'Identifiant Commun de l\'Entreprise — exactly 15 digits. Required ' +
            'on a Moroccan invoice.',
    })
    @IsOptional()
    @EmptyToNull()
    @TrimAndCompact()
    @Matches(/^\d{15}$/, { message: 'ICE must be exactly 15 digits.' })
    ice?: string | null;

    @ApiPropertyOptional({
        example: '12345678',
        description:
            'Identifiant Fiscal (IF), the tax identifier printed beside the ICE. ' +
            'Length varies, so only digits and a generous cap are enforced.',
    })
    @IsOptional()
    @EmptyToNull()
    @TrimAndCompact()
    @Matches(/^\d{1,20}$/, { message: 'IF must contain only digits.' })
    taxId?: string | null;

    @ApiPropertyOptional({
        example: '123456',
        description:
            'Registre de Commerce number, issued by one commercial court — pair ' +
            'it with `rcCity`. No single national format exists, so this only ' +
            'rejects obvious junk.',
    })
    @IsOptional()
    @EmptyToNull()
    @TrimAndCompact()
    @Matches(/^[0-9A-Za-z/-]{1,20}$/, {
        message: 'RC number may only contain letters, digits, "/" and "-".',
    })
    rcNumber?: string | null;

    @ApiPropertyOptional({
        example: 'Casablanca',
        description: 'The commercial court that issued the RC number.',
    })
    @IsOptional()
    @EmptyToNull()
    @IsString()
    @MaxLength(80)
    rcCity?: string | null;

    @ApiPropertyOptional({
        example: '1234567',
        description: 'CNSS employer affiliation number, used on payroll documents.',
    })
    @IsOptional()
    @EmptyToNull()
    @TrimAndCompact()
    @Matches(/^\d{1,20}$/, { message: 'CNSS number must contain only digits.' })
    cnss?: string | null;

    @ApiPropertyOptional({
        example: '12345678',
        description: 'Taxe professionnelle (patente) number.',
    })
    @IsOptional()
    @EmptyToNull()
    @TrimAndCompact()
    @Matches(/^\d{1,20}$/, { message: 'Patente number must contain only digits.' })
    patente?: string | null;

    @ApiPropertyOptional({
        example: 'MAD',
        enum: SUPPORTED_CURRENCIES,
        description:
            'ISO 4217 code every amount in this company is expressed in. A ' +
            'display label, not a conversion — there is no per-document ' +
            'currency, so changing this relabels existing documents rather ' +
            'than converting them.',
    })
    @IsOptional()
    @UpperCase()
    @IsIn(SUPPORTED_CURRENCIES, {
        message: `defaultCurrency must be one of: ${SUPPORTED_CURRENCIES.join(', ')}`,
    })
    defaultCurrency?: string;

    @ApiPropertyOptional({
        example: 1,
        minimum: 1,
        maximum: 12,
        description:
            'Month the accounting year opens, 1-12. Reporting periods only — ' +
            'document numbers keep using the calendar year regardless of this ' +
            'value.',
    })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(12)
    fiscalYearStartMonth?: number;
}