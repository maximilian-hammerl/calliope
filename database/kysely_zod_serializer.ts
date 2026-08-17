import {
  type ColumnMetadata,
  type DatabaseMetadata,
  type EnumCollection,
  type GeneratorDialect,
  type SerializeFileOptions,
  type Serializer,
  type TableMetadata,
  toKyselyCamelCase,
} from "kysely-codegen";

/**
 * Schemas that are too long to repeat for every column. Only the ones a column actually
 * uses are written out, so the generated file never declares something unused.
 */
const HELPER_SCHEMAS: Record<string, string> = {
  int16: "z.int().min(-32768).max(32767)",
  int32: "z.int().min(-2147483648).max(2147483647)",
};

const DATATYPE_TYPES_TO_ZOD_SCHEMAS: Record<string, string> = {
  // We use uuidv7 in this project
  "uuid": "z.uuidv7()",

  "bool": "z.boolean()",
  "boolean": "z.boolean()",

  "bytea": "z.instanceof(Uint8Array)",

  "smallint": "int16",
  "int2": "int16",
  "int2multirange": "z.string()",
  "int": "int32",
  "integer": "int32",
  "int4": "int32",
  "int4multirange": "z.string()",
  "bigint": "z.bigint()",
  "int8": "z.bigint()",
  "int8multirange": "z.string()",
  "decimal": "z.number()",
  "numeric": "z.number()",
  "real": "z.number()",
  "float4": "z.number()",
  "double precision": "z.number()",
  "float8": "z.number()",

  "text": "z.string()",
  "varchar": "z.string()",
  "char": "z.string()",
  "bpchar": "z.string()",

  "timestamp": "z.iso.datetime({ local: true })",
  "timestamptz": "z.iso.datetime({ offset: true })",
  "date": "z.iso.date()",
  "time": "z.iso.time()",
  "interval": "z.string()",

  "json": "z.unknown()",
  "jsonb": "z.unknown()",
};

// https://github.com/RobinBlomberg/kysely-codegen/releases/tag/0.18.0 -> 'Custom serializers and dialects'
export class ZodSerializer implements Serializer {
  serializeFile(
    metadata: DatabaseMetadata,
    _dialect: GeneratorDialect,
    options?: SerializeFileOptions,
  ): string {
    const enumNames = this.getEnumNames(metadata.enums);

    // Serialized first, because which helpers are needed is only known afterwards.
    const usedHelperSchemas = new Set<string>();
    const tables = this.serializeTables(
      metadata.tables,
      enumNames,
      usedHelperSchemas,
      options,
    );

    return 'import * as z from "zod";\n\n' +
      this.serializeHelperSchemas(usedHelperSchemas) +
      this.serializeEnums(metadata.enums) +
      tables;
  }

  private serializeHelperSchemas(usedHelperSchemas: Set<string>): string {
    let output = "";

    for (const [name, schema] of Object.entries(HELPER_SCHEMAS)) {
      if (usedHelperSchemas.has(name)) {
        output += `const ${name} = ${schema};\n\n`;
      }
    }

    return output;
  }

  private getZodSchemaForColumn(
    schema: string,
    table: string,
    column: ColumnMetadata,
    enumNames: Array<string>,
    usedHelperSchemas: Set<string>,
    options?: SerializeFileOptions,
  ): string {
    if (options?.overrides?.columns !== undefined) {
      const override =
        options.overrides.columns[`${schema}.${table}.${column.name}`] ??
          options.overrides.columns[`${table}.${column.name}`] ??
          options.overrides.columns[column.name];
      if (override !== undefined) {
        return String(override);
      }
    }

    let zodSchema: string | undefined;
    if (enumNames.includes(column.dataType)) {
      zodSchema = this.databaseEntityToZodSchemaName(column.dataType);
    } else {
      zodSchema = DATATYPE_TYPES_TO_ZOD_SCHEMAS[column.dataType];
    }

    if (zodSchema === undefined) {
      throw new Error(
        `Unknown data type ${column.dataType} for column ${column.name} of table ` +
          `${schema}.${table}. Add it to DATATYPE_TYPES_TO_ZOD_SCHEMAS, or override the ` +
          `column in the kysely-codegen configuration.`,
      );
    }

    if (zodSchema in HELPER_SCHEMAS) {
      usedHelperSchemas.add(zodSchema);
    }

    if (column.isArray) {
      zodSchema = `z.array(${zodSchema})`;
    }

    if (column.isNullable) {
      zodSchema = `${zodSchema}.nullable()`;
    }

    if (column.comment) {
      // Escaped, so a backtick or a `${` in the comment cannot break out of the string.
      zodSchema = `${zodSchema}.describe(${JSON.stringify(column.comment)})`;
    }

    return zodSchema;
  }

  private serializeTable(
    table: TableMetadata,
    enumNames: Array<string>,
    usedHelperSchemas: Set<string>,
    options?: SerializeFileOptions,
  ): string {
    const zodSchemaName = this.databaseEntityToZodSchemaName(table.name);
    let output = `export const ${zodSchemaName} = z.object({\n`;

    for (const column of table.columns) {
      const columnName = options?.camelCase
        ? toKyselyCamelCase(column.name)
        : column.name;

      output += `  ${columnName}: ${
        this.getZodSchemaForColumn(
          table.schema ?? "public",
          table.name,
          column,
          enumNames,
          usedHelperSchemas,
          options,
        )
      },\n`;
    }

    output += `});`;

    return output;
  }

  private serializeTables(
    tables: Array<TableMetadata>,
    enumNames: Array<string>,
    usedHelperSchemas: Set<string>,
    options?: SerializeFileOptions,
  ): string {
    let output = "";

    for (const table of tables) {
      output += this.serializeTable(
        table,
        enumNames,
        usedHelperSchemas,
        options,
      ) + "\n\n";
    }

    return output;
  }

  private serializeEnum(
    enumNameWithSchema: string,
    enumEntries: Array<string>,
  ): string {
    const enumName = this.getEnumName(enumNameWithSchema);

    let enumPluralName: string;
    switch (enumName.at(-1)) {
      case "s":
        enumPluralName = `${enumName}es`;
        break;
      case "y":
        enumPluralName = `${enumName.slice(0, -1)}ies`;
        break;
      default:
        enumPluralName = `${enumName}s`;
    }
    const zodArrayName = enumPluralName.toUpperCase();

    // Escaped, so a quote or a backslash in a value cannot break the output.
    let output = `export const ${zodArrayName} = [${
      enumEntries.map((entry) => JSON.stringify(entry)).join(", ")
    }] as const;\n`;

    const zodSchemaName = this.databaseEntityToZodSchemaName(enumName);
    output += `export const ${zodSchemaName} = z.enum(${zodArrayName});`;

    return output;
  }

  private serializeEnums(enums: EnumCollection): string {
    let output = "";

    for (
      const [enumNameWithSchema, enumEntries] of Object.entries(enums.enums)
    ) {
      if (enumEntries === undefined) {
        continue;
      }

      output += this.serializeEnum(enumNameWithSchema, enumEntries) + "\n\n";
    }

    return output;
  }

  private getEnumNames(enums: EnumCollection): Array<string> {
    return Object.entries(enums.enums)
      .filter(([_enumNameWithSchema, enumEntries]) => enumEntries !== undefined)
      .map(([enumNameWithSchema]) => this.getEnumName(enumNameWithSchema));
  }

  private getEnumName(enumNameWithSchema: string): string {
    const [_schemaName, enumName] = enumNameWithSchema.split(".") as [
      string,
      string,
    ];

    return enumName;
  }

  private databaseEntityToZodSchemaName(type: string): string {
    return type.toUpperCase() + "_SCHEMA";
  }
}
