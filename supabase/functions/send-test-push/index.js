// Built by scripts/build-functions.mjs from supabase/functions-src. Do not edit.
import { Buffer as __Buffer } from "node:buffer";
import __process from "node:process";
globalThis.Buffer ??= __Buffer;
globalThis.process ??= __process;
import { setImmediate as __setImmediate, clearImmediate as __clearImmediate } from "node:timers";
globalThis.setImmediate ??= __setImmediate;
globalThis.clearImmediate ??= __clearImmediate;
var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// node_modules/drizzle-orm/entity.js
var entityKind = /* @__PURE__ */ Symbol.for("drizzle:entityKind");
function is(value2, type) {
  if (!value2 || typeof value2 !== "object") {
    return false;
  }
  if (value2 instanceof type) {
    return true;
  }
  if (!Object.prototype.hasOwnProperty.call(type, entityKind)) {
    throw new Error(
      `Class "${type.name ?? "<unknown>"}" doesn't look like a Drizzle entity. If this is incorrect and the class is provided by Drizzle, please report this as a bug.`
    );
  }
  let cls = Object.getPrototypeOf(value2).constructor;
  if (cls) {
    while (cls) {
      if (entityKind in cls && cls[entityKind] === type[entityKind]) {
        return true;
      }
      cls = Object.getPrototypeOf(cls);
    }
  }
  return false;
}

// node_modules/drizzle-orm/column.js
var Column = class {
  constructor(table, config) {
    this.table = table;
    this.config = config;
    this.name = config.name;
    this.keyAsName = config.keyAsName;
    this.notNull = config.notNull;
    this.default = config.default;
    this.defaultFn = config.defaultFn;
    this.onUpdateFn = config.onUpdateFn;
    this.hasDefault = config.hasDefault;
    this.primary = config.primaryKey;
    this.isUnique = config.isUnique;
    this.uniqueName = config.uniqueName;
    this.uniqueType = config.uniqueType;
    this.dataType = config.dataType;
    this.columnType = config.columnType;
    this.generated = config.generated;
    this.generatedIdentity = config.generatedIdentity;
  }
  static [entityKind] = "Column";
  name;
  keyAsName;
  primary;
  notNull;
  default;
  defaultFn;
  onUpdateFn;
  hasDefault;
  isUnique;
  uniqueName;
  uniqueType;
  dataType;
  columnType;
  enumValues = void 0;
  generated = void 0;
  generatedIdentity = void 0;
  config;
  mapFromDriverValue(value2) {
    return value2;
  }
  mapToDriverValue(value2) {
    return value2;
  }
  // ** @internal */
  shouldDisableInsert() {
    return this.config.generated !== void 0 && this.config.generated.type !== "byDefault";
  }
};

// node_modules/drizzle-orm/column-builder.js
var ColumnBuilder = class {
  static [entityKind] = "ColumnBuilder";
  config;
  constructor(name, dataType, columnType) {
    this.config = {
      name,
      keyAsName: name === "",
      notNull: false,
      default: void 0,
      hasDefault: false,
      primaryKey: false,
      isUnique: false,
      uniqueName: void 0,
      uniqueType: void 0,
      dataType,
      columnType,
      generated: void 0
    };
  }
  /**
   * Changes the data type of the column. Commonly used with `json` columns. Also, useful for branded types.
   *
   * @example
   * ```ts
   * const users = pgTable('users', {
   * 	id: integer('id').$type<UserId>().primaryKey(),
   * 	details: json('details').$type<UserDetails>().notNull(),
   * });
   * ```
   */
  $type() {
    return this;
  }
  /**
   * Adds a `not null` clause to the column definition.
   *
   * Affects the `select` model of the table - columns *without* `not null` will be nullable on select.
   */
  notNull() {
    this.config.notNull = true;
    return this;
  }
  /**
   * Adds a `default <value>` clause to the column definition.
   *
   * Affects the `insert` model of the table - columns *with* `default` are optional on insert.
   *
   * If you need to set a dynamic default value, use {@link $defaultFn} instead.
   */
  default(value2) {
    this.config.default = value2;
    this.config.hasDefault = true;
    return this;
  }
  /**
   * Adds a dynamic default value to the column.
   * The function will be called when the row is inserted, and the returned value will be used as the column value.
   *
   * **Note:** This value does not affect the `drizzle-kit` behavior, it is only used at runtime in `drizzle-orm`.
   */
  $defaultFn(fn) {
    this.config.defaultFn = fn;
    this.config.hasDefault = true;
    return this;
  }
  /**
   * Alias for {@link $defaultFn}.
   */
  $default = this.$defaultFn;
  /**
   * Adds a dynamic update value to the column.
   * The function will be called when the row is updated, and the returned value will be used as the column value if none is provided.
   * If no `default` (or `$defaultFn`) value is provided, the function will be called when the row is inserted as well, and the returned value will be used as the column value.
   *
   * **Note:** This value does not affect the `drizzle-kit` behavior, it is only used at runtime in `drizzle-orm`.
   */
  $onUpdateFn(fn) {
    this.config.onUpdateFn = fn;
    this.config.hasDefault = true;
    return this;
  }
  /**
   * Alias for {@link $onUpdateFn}.
   */
  $onUpdate = this.$onUpdateFn;
  /**
   * Adds a `primary key` clause to the column definition. This implicitly makes the column `not null`.
   *
   * In SQLite, `integer primary key` implicitly makes the column auto-incrementing.
   */
  primaryKey() {
    this.config.primaryKey = true;
    this.config.notNull = true;
    return this;
  }
  /** @internal Sets the name of the column to the key within the table definition if a name was not given. */
  setName(name) {
    if (this.config.name !== "") return;
    this.config.name = name;
  }
};

// node_modules/drizzle-orm/table.utils.js
var TableName = /* @__PURE__ */ Symbol.for("drizzle:Name");

// node_modules/drizzle-orm/pg-core/foreign-keys.js
var ForeignKeyBuilder = class {
  static [entityKind] = "PgForeignKeyBuilder";
  /** @internal */
  reference;
  /** @internal */
  _onUpdate = "no action";
  /** @internal */
  _onDelete = "no action";
  constructor(config, actions) {
    this.reference = () => {
      const { name, columns: columns2, foreignColumns } = config();
      return { name, columns: columns2, foreignTable: foreignColumns[0].table, foreignColumns };
    };
    if (actions) {
      this._onUpdate = actions.onUpdate;
      this._onDelete = actions.onDelete;
    }
  }
  onUpdate(action) {
    this._onUpdate = action === void 0 ? "no action" : action;
    return this;
  }
  onDelete(action) {
    this._onDelete = action === void 0 ? "no action" : action;
    return this;
  }
  /** @internal */
  build(table) {
    return new ForeignKey(table, this);
  }
};
var ForeignKey = class {
  constructor(table, builder) {
    this.table = table;
    this.reference = builder.reference;
    this.onUpdate = builder._onUpdate;
    this.onDelete = builder._onDelete;
  }
  static [entityKind] = "PgForeignKey";
  reference;
  onUpdate;
  onDelete;
  getName() {
    const { name, columns: columns2, foreignColumns } = this.reference();
    const columnNames = columns2.map((column2) => column2.name);
    const foreignColumnNames = foreignColumns.map((column2) => column2.name);
    const chunks = [
      this.table[TableName],
      ...columnNames,
      foreignColumns[0].table[TableName],
      ...foreignColumnNames
    ];
    return name ?? `${chunks.join("_")}_fk`;
  }
};

// node_modules/drizzle-orm/tracing-utils.js
function iife(fn, ...args) {
  return fn(...args);
}

// node_modules/drizzle-orm/pg-core/unique-constraint.js
function uniqueKeyName(table, columns2) {
  return `${table[TableName]}_${columns2.join("_")}_unique`;
}
var UniqueConstraintBuilder = class {
  constructor(columns2, name) {
    this.name = name;
    this.columns = columns2;
  }
  static [entityKind] = "PgUniqueConstraintBuilder";
  /** @internal */
  columns;
  /** @internal */
  nullsNotDistinctConfig = false;
  nullsNotDistinct() {
    this.nullsNotDistinctConfig = true;
    return this;
  }
  /** @internal */
  build(table) {
    return new UniqueConstraint(table, this.columns, this.nullsNotDistinctConfig, this.name);
  }
};
var UniqueOnConstraintBuilder = class {
  static [entityKind] = "PgUniqueOnConstraintBuilder";
  /** @internal */
  name;
  constructor(name) {
    this.name = name;
  }
  on(...columns2) {
    return new UniqueConstraintBuilder(columns2, this.name);
  }
};
var UniqueConstraint = class {
  constructor(table, columns2, nullsNotDistinct, name) {
    this.table = table;
    this.columns = columns2;
    this.name = name ?? uniqueKeyName(this.table, this.columns.map((column2) => column2.name));
    this.nullsNotDistinct = nullsNotDistinct;
  }
  static [entityKind] = "PgUniqueConstraint";
  columns;
  name;
  nullsNotDistinct = false;
  getName() {
    return this.name;
  }
};

// node_modules/drizzle-orm/pg-core/utils/array.js
function parsePgArrayValue(arrayString, startFrom, inQuotes) {
  for (let i = startFrom; i < arrayString.length; i++) {
    const char2 = arrayString[i];
    if (char2 === "\\") {
      i++;
      continue;
    }
    if (char2 === '"') {
      return [arrayString.slice(startFrom, i).replace(/\\/g, ""), i + 1];
    }
    if (inQuotes) {
      continue;
    }
    if (char2 === "," || char2 === "}") {
      return [arrayString.slice(startFrom, i).replace(/\\/g, ""), i];
    }
  }
  return [arrayString.slice(startFrom).replace(/\\/g, ""), arrayString.length];
}
function parsePgNestedArray(arrayString, startFrom = 0) {
  const result = [];
  let i = startFrom;
  let lastCharIsComma = false;
  while (i < arrayString.length) {
    const char2 = arrayString[i];
    if (char2 === ",") {
      if (lastCharIsComma || i === startFrom) {
        result.push("");
      }
      lastCharIsComma = true;
      i++;
      continue;
    }
    lastCharIsComma = false;
    if (char2 === "\\") {
      i += 2;
      continue;
    }
    if (char2 === '"') {
      const [value22, startFrom2] = parsePgArrayValue(arrayString, i + 1, true);
      result.push(value22);
      i = startFrom2;
      continue;
    }
    if (char2 === "}") {
      return [result, i + 1];
    }
    if (char2 === "{") {
      const [value22, startFrom2] = parsePgNestedArray(arrayString, i + 1);
      result.push(value22);
      i = startFrom2;
      continue;
    }
    const [value2, newStartFrom] = parsePgArrayValue(arrayString, i, false);
    result.push(value2);
    i = newStartFrom;
  }
  return [result, i];
}
function parsePgArray(arrayString) {
  const [result] = parsePgNestedArray(arrayString, 1);
  return result;
}
function makePgArray(array) {
  return `{${array.map((item) => {
    if (Array.isArray(item)) {
      return makePgArray(item);
    }
    if (typeof item === "string") {
      return `"${item.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
    }
    return `${item}`;
  }).join(",")}}`;
}

// node_modules/drizzle-orm/pg-core/columns/common.js
var PgColumnBuilder = class extends ColumnBuilder {
  foreignKeyConfigs = [];
  static [entityKind] = "PgColumnBuilder";
  array(size) {
    return new PgArrayBuilder(this.config.name, this, size);
  }
  references(ref, actions = {}) {
    this.foreignKeyConfigs.push({ ref, actions });
    return this;
  }
  unique(name, config) {
    this.config.isUnique = true;
    this.config.uniqueName = name;
    this.config.uniqueType = config?.nulls;
    return this;
  }
  generatedAlwaysAs(as) {
    this.config.generated = {
      as,
      type: "always",
      mode: "stored"
    };
    return this;
  }
  /** @internal */
  buildForeignKeys(column2, table) {
    return this.foreignKeyConfigs.map(({ ref, actions }) => {
      return iife(
        (ref2, actions2) => {
          const builder = new ForeignKeyBuilder(() => {
            const foreignColumn = ref2();
            return { columns: [column2], foreignColumns: [foreignColumn] };
          });
          if (actions2.onUpdate) {
            builder.onUpdate(actions2.onUpdate);
          }
          if (actions2.onDelete) {
            builder.onDelete(actions2.onDelete);
          }
          return builder.build(table);
        },
        ref,
        actions
      );
    });
  }
  /** @internal */
  buildExtraConfigColumn(table) {
    return new ExtraConfigColumn(table, this.config);
  }
};
var PgColumn = class extends Column {
  constructor(table, config) {
    if (!config.uniqueName) {
      config.uniqueName = uniqueKeyName(table, [config.name]);
    }
    super(table, config);
    this.table = table;
  }
  static [entityKind] = "PgColumn";
};
var ExtraConfigColumn = class extends PgColumn {
  static [entityKind] = "ExtraConfigColumn";
  getSQLType() {
    return this.getSQLType();
  }
  indexConfig = {
    order: this.config.order ?? "asc",
    nulls: this.config.nulls ?? "last",
    opClass: this.config.opClass
  };
  defaultConfig = {
    order: "asc",
    nulls: "last",
    opClass: void 0
  };
  asc() {
    this.indexConfig.order = "asc";
    return this;
  }
  desc() {
    this.indexConfig.order = "desc";
    return this;
  }
  nullsFirst() {
    this.indexConfig.nulls = "first";
    return this;
  }
  nullsLast() {
    this.indexConfig.nulls = "last";
    return this;
  }
  /**
   * ### PostgreSQL documentation quote
   *
   * > An operator class with optional parameters can be specified for each column of an index.
   * The operator class identifies the operators to be used by the index for that column.
   * For example, a B-tree index on four-byte integers would use the int4_ops class;
   * this operator class includes comparison functions for four-byte integers.
   * In practice the default operator class for the column's data type is usually sufficient.
   * The main point of having operator classes is that for some data types, there could be more than one meaningful ordering.
   * For example, we might want to sort a complex-number data type either by absolute value or by real part.
   * We could do this by defining two operator classes for the data type and then selecting the proper class when creating an index.
   * More information about operator classes check:
   *
   * ### Useful links
   * https://www.postgresql.org/docs/current/sql-createindex.html
   *
   * https://www.postgresql.org/docs/current/indexes-opclass.html
   *
   * https://www.postgresql.org/docs/current/xindex.html
   *
   * ### Additional types
   * If you have the `pg_vector` extension installed in your database, you can use the
   * `vector_l2_ops`, `vector_ip_ops`, `vector_cosine_ops`, `vector_l1_ops`, `bit_hamming_ops`, `bit_jaccard_ops`, `halfvec_l2_ops`, `sparsevec_l2_ops` options, which are predefined types.
   *
   * **You can always specify any string you want in the operator class, in case Drizzle doesn't have it natively in its types**
   *
   * @param opClass
   * @returns
   */
  op(opClass) {
    this.indexConfig.opClass = opClass;
    return this;
  }
};
var IndexedColumn = class {
  static [entityKind] = "IndexedColumn";
  constructor(name, keyAsName, type, indexConfig) {
    this.name = name;
    this.keyAsName = keyAsName;
    this.type = type;
    this.indexConfig = indexConfig;
  }
  name;
  keyAsName;
  type;
  indexConfig;
};
var PgArrayBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgArrayBuilder";
  constructor(name, baseBuilder, size) {
    super(name, "array", "PgArray");
    this.config.baseBuilder = baseBuilder;
    this.config.size = size;
  }
  /** @internal */
  build(table) {
    const baseColumn = this.config.baseBuilder.build(table);
    return new PgArray(
      table,
      this.config,
      baseColumn
    );
  }
};
var PgArray = class _PgArray extends PgColumn {
  constructor(table, config, baseColumn, range) {
    super(table, config);
    this.baseColumn = baseColumn;
    this.range = range;
    this.size = config.size;
  }
  size;
  static [entityKind] = "PgArray";
  getSQLType() {
    return `${this.baseColumn.getSQLType()}[${typeof this.size === "number" ? this.size : ""}]`;
  }
  mapFromDriverValue(value2) {
    if (typeof value2 === "string") {
      value2 = parsePgArray(value2);
    }
    return value2.map((v) => this.baseColumn.mapFromDriverValue(v));
  }
  mapToDriverValue(value2, isNestedArray = false) {
    const a = value2.map(
      (v) => v === null ? null : is(this.baseColumn, _PgArray) ? this.baseColumn.mapToDriverValue(v, true) : this.baseColumn.mapToDriverValue(v)
    );
    if (isNestedArray) return a;
    return makePgArray(a);
  }
};

// node_modules/drizzle-orm/pg-core/columns/enum.js
var PgEnumObjectColumnBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgEnumObjectColumnBuilder";
  constructor(name, enumInstance) {
    super(name, "string", "PgEnumObjectColumn");
    this.config.enum = enumInstance;
  }
  /** @internal */
  build(table) {
    return new PgEnumObjectColumn(
      table,
      this.config
    );
  }
};
var PgEnumObjectColumn = class extends PgColumn {
  static [entityKind] = "PgEnumObjectColumn";
  enum;
  enumValues = this.config.enum.enumValues;
  constructor(table, config) {
    super(table, config);
    this.enum = config.enum;
  }
  getSQLType() {
    return this.enum.enumName;
  }
};
var isPgEnumSym = /* @__PURE__ */ Symbol.for("drizzle:isPgEnum");
function isPgEnum(obj) {
  return !!obj && typeof obj === "function" && isPgEnumSym in obj && obj[isPgEnumSym] === true;
}
var PgEnumColumnBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgEnumColumnBuilder";
  constructor(name, enumInstance) {
    super(name, "string", "PgEnumColumn");
    this.config.enum = enumInstance;
  }
  /** @internal */
  build(table) {
    return new PgEnumColumn(
      table,
      this.config
    );
  }
};
var PgEnumColumn = class extends PgColumn {
  static [entityKind] = "PgEnumColumn";
  enum = this.config.enum;
  enumValues = this.config.enum.enumValues;
  constructor(table, config) {
    super(table, config);
    this.enum = config.enum;
  }
  getSQLType() {
    return this.enum.enumName;
  }
};
function pgEnum(enumName, input) {
  return Array.isArray(input) ? pgEnumWithSchema(enumName, [...input], void 0) : pgEnumObjectWithSchema(enumName, input, void 0);
}
function pgEnumWithSchema(enumName, values2, schema) {
  const enumInstance = Object.assign(
    (name) => new PgEnumColumnBuilder(name ?? "", enumInstance),
    {
      enumName,
      enumValues: values2,
      schema,
      [isPgEnumSym]: true
    }
  );
  return enumInstance;
}
function pgEnumObjectWithSchema(enumName, values2, schema) {
  const enumInstance = Object.assign(
    (name) => new PgEnumObjectColumnBuilder(name ?? "", enumInstance),
    {
      enumName,
      enumValues: Object.values(values2),
      schema,
      [isPgEnumSym]: true
    }
  );
  return enumInstance;
}

// node_modules/drizzle-orm/subquery.js
var Subquery = class {
  static [entityKind] = "Subquery";
  constructor(sql2, fields, alias, isWith = false, usedTables = []) {
    this._ = {
      brand: "Subquery",
      sql: sql2,
      selectedFields: fields,
      alias,
      isWith,
      usedTables
    };
  }
  // getSQL(): SQL<unknown> {
  // 	return new SQL([this]);
  // }
};
var WithSubquery = class extends Subquery {
  static [entityKind] = "WithSubquery";
};

// node_modules/drizzle-orm/version.js
var version = "0.45.4";

// node_modules/drizzle-orm/tracing.js
var otel;
var rawTracer;
var tracer = {
  startActiveSpan(name, fn) {
    if (!otel) {
      return fn();
    }
    if (!rawTracer) {
      rawTracer = otel.trace.getTracer("drizzle-orm", version);
    }
    return iife(
      (otel2, rawTracer2) => rawTracer2.startActiveSpan(
        name,
        (span) => {
          try {
            return fn(span);
          } catch (e) {
            span.setStatus({
              code: otel2.SpanStatusCode.ERROR,
              message: e instanceof Error ? e.message : "Unknown error"
              // eslint-disable-line no-instanceof/no-instanceof
            });
            throw e;
          } finally {
            span.end();
          }
        }
      ),
      otel,
      rawTracer
    );
  }
};

// node_modules/drizzle-orm/view-common.js
var ViewBaseConfig = /* @__PURE__ */ Symbol.for("drizzle:ViewBaseConfig");

// node_modules/drizzle-orm/table.js
var Schema = /* @__PURE__ */ Symbol.for("drizzle:Schema");
var Columns = /* @__PURE__ */ Symbol.for("drizzle:Columns");
var ExtraConfigColumns = /* @__PURE__ */ Symbol.for("drizzle:ExtraConfigColumns");
var OriginalName = /* @__PURE__ */ Symbol.for("drizzle:OriginalName");
var BaseName = /* @__PURE__ */ Symbol.for("drizzle:BaseName");
var IsAlias = /* @__PURE__ */ Symbol.for("drizzle:IsAlias");
var ExtraConfigBuilder = /* @__PURE__ */ Symbol.for("drizzle:ExtraConfigBuilder");
var IsDrizzleTable = /* @__PURE__ */ Symbol.for("drizzle:IsDrizzleTable");
var Table = class {
  static [entityKind] = "Table";
  /** @internal */
  static Symbol = {
    Name: TableName,
    Schema,
    OriginalName,
    Columns,
    ExtraConfigColumns,
    BaseName,
    IsAlias,
    ExtraConfigBuilder
  };
  /**
   * @internal
   * Can be changed if the table is aliased.
   */
  [TableName];
  /**
   * @internal
   * Used to store the original name of the table, before any aliasing.
   */
  [OriginalName];
  /** @internal */
  [Schema];
  /** @internal */
  [Columns];
  /** @internal */
  [ExtraConfigColumns];
  /**
   *  @internal
   * Used to store the table name before the transformation via the `tableCreator` functions.
   */
  [BaseName];
  /** @internal */
  [IsAlias] = false;
  /** @internal */
  [IsDrizzleTable] = true;
  /** @internal */
  [ExtraConfigBuilder] = void 0;
  constructor(name, schema, baseName) {
    this[TableName] = this[OriginalName] = name;
    this[Schema] = schema;
    this[BaseName] = baseName;
  }
};
function getTableName(table) {
  return table[TableName];
}
function getTableUniqueName(table) {
  return `${table[Schema] ?? "public"}.${table[TableName]}`;
}

// node_modules/drizzle-orm/sql/sql.js
var FakePrimitiveParam = class {
  static [entityKind] = "FakePrimitiveParam";
};
function isSQLWrapper(value2) {
  return value2 !== null && value2 !== void 0 && typeof value2.getSQL === "function";
}
function mergeQueries(queries) {
  const result = { sql: "", params: [] };
  for (const query2 of queries) {
    result.sql += query2.sql;
    result.params.push(...query2.params);
    if (query2.typings?.length) {
      if (!result.typings) {
        result.typings = [];
      }
      result.typings.push(...query2.typings);
    }
  }
  return result;
}
var StringChunk = class {
  static [entityKind] = "StringChunk";
  value;
  constructor(value2) {
    this.value = Array.isArray(value2) ? value2 : [value2];
  }
  getSQL() {
    return new SQL([this]);
  }
};
var SQL = class _SQL {
  constructor(queryChunks) {
    this.queryChunks = queryChunks;
    for (const chunk of queryChunks) {
      if (is(chunk, Table)) {
        const schemaName = chunk[Table.Symbol.Schema];
        this.usedTables.push(
          schemaName === void 0 ? chunk[Table.Symbol.Name] : schemaName + "." + chunk[Table.Symbol.Name]
        );
      }
    }
  }
  static [entityKind] = "SQL";
  /** @internal */
  decoder = noopDecoder;
  shouldInlineParams = false;
  /** @internal */
  usedTables = [];
  append(query2) {
    this.queryChunks.push(...query2.queryChunks);
    return this;
  }
  toQuery(config) {
    return tracer.startActiveSpan("drizzle.buildSQL", (span) => {
      const query2 = this.buildQueryFromSourceParams(this.queryChunks, config);
      span?.setAttributes({
        "drizzle.query.text": query2.sql,
        "drizzle.query.params": JSON.stringify(query2.params)
      });
      return query2;
    });
  }
  buildQueryFromSourceParams(chunks, _config) {
    const config = Object.assign({}, _config, {
      inlineParams: _config.inlineParams || this.shouldInlineParams,
      paramStartIndex: _config.paramStartIndex || { value: 0 }
    });
    const {
      casing,
      escapeName,
      escapeParam,
      prepareTyping,
      inlineParams,
      paramStartIndex
    } = config;
    return mergeQueries(chunks.map((chunk) => {
      if (is(chunk, StringChunk)) {
        return { sql: chunk.value.join(""), params: [] };
      }
      if (is(chunk, Name)) {
        return { sql: escapeName(chunk.value), params: [] };
      }
      if (chunk === void 0) {
        return { sql: "", params: [] };
      }
      if (Array.isArray(chunk)) {
        const result = [new StringChunk("(")];
        for (const [i, p2] of chunk.entries()) {
          result.push(p2);
          if (i < chunk.length - 1) {
            result.push(new StringChunk(", "));
          }
        }
        result.push(new StringChunk(")"));
        return this.buildQueryFromSourceParams(result, config);
      }
      if (is(chunk, _SQL)) {
        return this.buildQueryFromSourceParams(chunk.queryChunks, {
          ...config,
          inlineParams: inlineParams || chunk.shouldInlineParams
        });
      }
      if (is(chunk, Table)) {
        const schemaName = chunk[Table.Symbol.Schema];
        const tableName = chunk[Table.Symbol.Name];
        return {
          sql: schemaName === void 0 || chunk[IsAlias] ? escapeName(tableName) : escapeName(schemaName) + "." + escapeName(tableName),
          params: []
        };
      }
      if (is(chunk, Column)) {
        const columnName = casing.getColumnCasing(chunk);
        if (_config.invokeSource === "indexes") {
          return { sql: escapeName(columnName), params: [] };
        }
        const schemaName = chunk.table[Table.Symbol.Schema];
        return {
          sql: chunk.table[IsAlias] || schemaName === void 0 ? escapeName(chunk.table[Table.Symbol.Name]) + "." + escapeName(columnName) : escapeName(schemaName) + "." + escapeName(chunk.table[Table.Symbol.Name]) + "." + escapeName(columnName),
          params: []
        };
      }
      if (is(chunk, View)) {
        const schemaName = chunk[ViewBaseConfig].schema;
        const viewName = chunk[ViewBaseConfig].name;
        return {
          sql: schemaName === void 0 || chunk[ViewBaseConfig].isAlias ? escapeName(viewName) : escapeName(schemaName) + "." + escapeName(viewName),
          params: []
        };
      }
      if (is(chunk, Param)) {
        if (is(chunk.value, Placeholder)) {
          return { sql: escapeParam(paramStartIndex.value++, chunk), params: [chunk], typings: ["none"] };
        }
        const mappedValue = chunk.value === null ? null : chunk.encoder.mapToDriverValue(chunk.value);
        if (is(mappedValue, _SQL)) {
          return this.buildQueryFromSourceParams([mappedValue], config);
        }
        if (inlineParams) {
          return { sql: this.mapInlineParam(mappedValue, config), params: [] };
        }
        let typings = ["none"];
        if (prepareTyping) {
          typings = [prepareTyping(chunk.encoder)];
        }
        return { sql: escapeParam(paramStartIndex.value++, mappedValue), params: [mappedValue], typings };
      }
      if (is(chunk, Placeholder)) {
        return { sql: escapeParam(paramStartIndex.value++, chunk), params: [chunk], typings: ["none"] };
      }
      if (is(chunk, _SQL.Aliased) && chunk.fieldAlias !== void 0) {
        return { sql: escapeName(chunk.fieldAlias), params: [] };
      }
      if (is(chunk, Subquery)) {
        if (chunk._.isWith) {
          return { sql: escapeName(chunk._.alias), params: [] };
        }
        return this.buildQueryFromSourceParams([
          new StringChunk("("),
          chunk._.sql,
          new StringChunk(") "),
          new Name(chunk._.alias)
        ], config);
      }
      if (isPgEnum(chunk)) {
        if (chunk.schema) {
          return { sql: escapeName(chunk.schema) + "." + escapeName(chunk.enumName), params: [] };
        }
        return { sql: escapeName(chunk.enumName), params: [] };
      }
      if (isSQLWrapper(chunk)) {
        if (chunk.shouldOmitSQLParens?.()) {
          return this.buildQueryFromSourceParams([chunk.getSQL()], config);
        }
        return this.buildQueryFromSourceParams([
          new StringChunk("("),
          chunk.getSQL(),
          new StringChunk(")")
        ], config);
      }
      if (inlineParams) {
        return { sql: this.mapInlineParam(chunk, config), params: [] };
      }
      return { sql: escapeParam(paramStartIndex.value++, chunk), params: [chunk], typings: ["none"] };
    }));
  }
  mapInlineParam(chunk, { escapeString }) {
    if (chunk === null) {
      return "null";
    }
    if (typeof chunk === "number" || typeof chunk === "boolean") {
      return chunk.toString();
    }
    if (typeof chunk === "string") {
      return escapeString(chunk);
    }
    if (typeof chunk === "object") {
      const mappedValueAsString = chunk.toString();
      if (mappedValueAsString === "[object Object]") {
        return escapeString(JSON.stringify(chunk));
      }
      return escapeString(mappedValueAsString);
    }
    throw new Error("Unexpected param value: " + chunk);
  }
  getSQL() {
    return this;
  }
  as(alias) {
    if (alias === void 0) {
      return this;
    }
    return new _SQL.Aliased(this, alias);
  }
  mapWith(decoder) {
    this.decoder = typeof decoder === "function" ? { mapFromDriverValue: decoder } : decoder;
    return this;
  }
  inlineParams() {
    this.shouldInlineParams = true;
    return this;
  }
  /**
   * This method is used to conditionally include a part of the query.
   *
   * @param condition - Condition to check
   * @returns itself if the condition is `true`, otherwise `undefined`
   */
  if(condition) {
    return condition ? this : void 0;
  }
};
var Name = class {
  constructor(value2) {
    this.value = value2;
  }
  static [entityKind] = "Name";
  brand;
  getSQL() {
    return new SQL([this]);
  }
};
function isDriverValueEncoder(value2) {
  return typeof value2 === "object" && value2 !== null && "mapToDriverValue" in value2 && typeof value2.mapToDriverValue === "function";
}
var noopDecoder = {
  mapFromDriverValue: (value2) => value2
};
var noopEncoder = {
  mapToDriverValue: (value2) => value2
};
var noopMapper = {
  ...noopDecoder,
  ...noopEncoder
};
var Param = class {
  /**
   * @param value - Parameter value
   * @param encoder - Encoder to convert the value to a driver parameter
   */
  constructor(value2, encoder2 = noopEncoder) {
    this.value = value2;
    this.encoder = encoder2;
  }
  static [entityKind] = "Param";
  brand;
  getSQL() {
    return new SQL([this]);
  }
};
function sql(strings, ...params) {
  const queryChunks = [];
  if (params.length > 0 || strings.length > 0 && strings[0] !== "") {
    queryChunks.push(new StringChunk(strings[0]));
  }
  for (const [paramIndex, param2] of params.entries()) {
    queryChunks.push(param2, new StringChunk(strings[paramIndex + 1]));
  }
  return new SQL(queryChunks);
}
((sql2) => {
  function empty2() {
    return new SQL([]);
  }
  sql2.empty = empty2;
  function fromList(list) {
    return new SQL(list);
  }
  sql2.fromList = fromList;
  function raw(str) {
    return new SQL([new StringChunk(str)]);
  }
  sql2.raw = raw;
  function join(chunks, separator) {
    const result = [];
    for (const [i, chunk] of chunks.entries()) {
      if (i > 0 && separator !== void 0) {
        result.push(separator);
      }
      result.push(chunk);
    }
    return new SQL(result);
  }
  sql2.join = join;
  function identifier(value2) {
    return new Name(value2);
  }
  sql2.identifier = identifier;
  function placeholder2(name2) {
    return new Placeholder(name2);
  }
  sql2.placeholder = placeholder2;
  function param2(value2, encoder2) {
    return new Param(value2, encoder2);
  }
  sql2.param = param2;
})(sql || (sql = {}));
((SQL2) => {
  class Aliased {
    constructor(sql2, fieldAlias) {
      this.sql = sql2;
      this.fieldAlias = fieldAlias;
    }
    static [entityKind] = "SQL.Aliased";
    /** @internal */
    isSelectionField = false;
    getSQL() {
      return this.sql;
    }
    /** @internal */
    clone() {
      return new Aliased(this.sql, this.fieldAlias);
    }
  }
  SQL2.Aliased = Aliased;
})(SQL || (SQL = {}));
var Placeholder = class {
  constructor(name2) {
    this.name = name2;
  }
  static [entityKind] = "Placeholder";
  getSQL() {
    return new SQL([this]);
  }
};
function fillPlaceholders(params, values2) {
  return params.map((p2) => {
    if (is(p2, Placeholder)) {
      if (!(p2.name in values2)) {
        throw new Error(`No value for placeholder "${p2.name}" was provided`);
      }
      return values2[p2.name];
    }
    if (is(p2, Param) && is(p2.value, Placeholder)) {
      if (!(p2.value.name in values2)) {
        throw new Error(`No value for placeholder "${p2.value.name}" was provided`);
      }
      return p2.encoder.mapToDriverValue(values2[p2.value.name]);
    }
    return p2;
  });
}
var IsDrizzleView = /* @__PURE__ */ Symbol.for("drizzle:IsDrizzleView");
var View = class {
  static [entityKind] = "View";
  /** @internal */
  [ViewBaseConfig];
  /** @internal */
  [IsDrizzleView] = true;
  constructor({ name: name2, schema, selectedFields, query: query2 }) {
    this[ViewBaseConfig] = {
      name: name2,
      originalName: name2,
      schema,
      selectedFields,
      query: query2,
      isExisting: !query2,
      isAlias: false
    };
  }
  getSQL() {
    return new SQL([this]);
  }
};
Column.prototype.getSQL = function() {
  return new SQL([this]);
};
Table.prototype.getSQL = function() {
  return new SQL([this]);
};
Subquery.prototype.getSQL = function() {
  return new SQL([this]);
};

// node_modules/drizzle-orm/alias.js
var ColumnAliasProxyHandler = class {
  constructor(table) {
    this.table = table;
  }
  static [entityKind] = "ColumnAliasProxyHandler";
  get(columnObj, prop) {
    if (prop === "table") {
      return this.table;
    }
    return columnObj[prop];
  }
};
var TableAliasProxyHandler = class {
  constructor(alias, replaceOriginalName) {
    this.alias = alias;
    this.replaceOriginalName = replaceOriginalName;
  }
  static [entityKind] = "TableAliasProxyHandler";
  get(target, prop) {
    if (prop === Table.Symbol.IsAlias) {
      return true;
    }
    if (prop === Table.Symbol.Name) {
      return this.alias;
    }
    if (this.replaceOriginalName && prop === Table.Symbol.OriginalName) {
      return this.alias;
    }
    if (prop === ViewBaseConfig) {
      return {
        ...target[ViewBaseConfig],
        name: this.alias,
        isAlias: true
      };
    }
    if (prop === Table.Symbol.Columns) {
      const columns2 = target[Table.Symbol.Columns];
      if (!columns2) {
        return columns2;
      }
      const proxiedColumns = {};
      Object.keys(columns2).map((key2) => {
        proxiedColumns[key2] = new Proxy(
          columns2[key2],
          new ColumnAliasProxyHandler(new Proxy(target, this))
        );
      });
      return proxiedColumns;
    }
    const value2 = target[prop];
    if (is(value2, Column)) {
      return new Proxy(value2, new ColumnAliasProxyHandler(new Proxy(target, this)));
    }
    return value2;
  }
};
var RelationTableAliasProxyHandler = class {
  constructor(alias) {
    this.alias = alias;
  }
  static [entityKind] = "RelationTableAliasProxyHandler";
  get(target, prop) {
    if (prop === "sourceTable") {
      return aliasedTable(target.sourceTable, this.alias);
    }
    return target[prop];
  }
};
function aliasedTable(table, tableAlias) {
  return new Proxy(table, new TableAliasProxyHandler(tableAlias, false));
}
function aliasedTableColumn(column2, tableAlias) {
  return new Proxy(
    column2,
    new ColumnAliasProxyHandler(new Proxy(column2.table, new TableAliasProxyHandler(tableAlias, false)))
  );
}
function mapColumnsInAliasedSQLToAlias(query2, alias) {
  return new SQL.Aliased(mapColumnsInSQLToAlias(query2.sql, alias), query2.fieldAlias);
}
function mapColumnsInSQLToAlias(query2, alias) {
  return sql.join(query2.queryChunks.map((c2) => {
    if (is(c2, Column)) {
      return aliasedTableColumn(c2, alias);
    }
    if (is(c2, SQL)) {
      return mapColumnsInSQLToAlias(c2, alias);
    }
    if (is(c2, SQL.Aliased)) {
      return mapColumnsInAliasedSQLToAlias(c2, alias);
    }
    return c2;
  }));
}

// node_modules/drizzle-orm/errors.js
var DrizzleError = class extends Error {
  static [entityKind] = "DrizzleError";
  constructor({ message, cause }) {
    super(message);
    this.name = "DrizzleError";
    this.cause = cause;
  }
};
var DrizzleQueryError = class _DrizzleQueryError extends Error {
  constructor(query2, params, cause) {
    super(`Failed query: ${query2}
params: ${params}`);
    this.query = query2;
    this.params = params;
    this.cause = cause;
    Error.captureStackTrace(this, _DrizzleQueryError);
    if (cause) this.cause = cause;
  }
};
var TransactionRollbackError = class extends DrizzleError {
  static [entityKind] = "TransactionRollbackError";
  constructor() {
    super({ message: "Rollback" });
  }
};

// node_modules/drizzle-orm/logger.js
var ConsoleLogWriter = class {
  static [entityKind] = "ConsoleLogWriter";
  write(message) {
    console.log(message);
  }
};
var DefaultLogger = class {
  static [entityKind] = "DefaultLogger";
  writer;
  constructor(config) {
    this.writer = config?.writer ?? new ConsoleLogWriter();
  }
  logQuery(query2, params) {
    const stringifiedParams = params.map((p2) => {
      try {
        return JSON.stringify(p2);
      } catch {
        return String(p2);
      }
    });
    const paramsStr = stringifiedParams.length ? ` -- params: [${stringifiedParams.join(", ")}]` : "";
    this.writer.write(`Query: ${query2}${paramsStr}`);
  }
};
var NoopLogger = class {
  static [entityKind] = "NoopLogger";
  logQuery() {
  }
};

// node_modules/drizzle-orm/query-promise.js
var QueryPromise = class {
  static [entityKind] = "QueryPromise";
  [Symbol.toStringTag] = "QueryPromise";
  catch(onRejected) {
    return this.then(void 0, onRejected);
  }
  finally(onFinally) {
    return this.then(
      (value2) => {
        onFinally?.();
        return value2;
      },
      (reason) => {
        onFinally?.();
        throw reason;
      }
    );
  }
  then(onFulfilled, onRejected) {
    return this.execute().then(onFulfilled, onRejected);
  }
};

// node_modules/drizzle-orm/utils.js
function mapResultRow(columns2, row, joinsNotNullableMap) {
  const nullifyMap = {};
  const result = columns2.reduce(
    (result2, { path, field: field2 }, columnIndex) => {
      let decoder;
      if (is(field2, Column)) {
        decoder = field2;
      } else if (is(field2, SQL)) {
        decoder = field2.decoder;
      } else if (is(field2, Subquery)) {
        decoder = field2._.sql.decoder;
      } else {
        decoder = field2.sql.decoder;
      }
      let node2 = result2;
      for (const [pathChunkIndex, pathChunk] of path.entries()) {
        if (pathChunkIndex < path.length - 1) {
          if (!(pathChunk in node2)) {
            node2[pathChunk] = {};
          }
          node2 = node2[pathChunk];
        } else {
          const rawValue = row[columnIndex];
          const value2 = node2[pathChunk] = rawValue === null ? null : decoder.mapFromDriverValue(rawValue);
          if (joinsNotNullableMap && is(field2, Column) && path.length === 2) {
            const objectName = path[0];
            if (!(objectName in nullifyMap)) {
              nullifyMap[objectName] = value2 === null ? getTableName(field2.table) : false;
            } else if (typeof nullifyMap[objectName] === "string" && nullifyMap[objectName] !== getTableName(field2.table)) {
              nullifyMap[objectName] = false;
            }
          }
        }
      }
      return result2;
    },
    {}
  );
  if (joinsNotNullableMap && Object.keys(nullifyMap).length > 0) {
    for (const [objectName, tableName] of Object.entries(nullifyMap)) {
      if (typeof tableName === "string" && !joinsNotNullableMap[tableName]) {
        result[objectName] = null;
      }
    }
  }
  return result;
}
function orderSelectedFields(fields, pathPrefix) {
  return Object.entries(fields).reduce((result, [name, field2]) => {
    if (typeof name !== "string") {
      return result;
    }
    const newPath = pathPrefix ? [...pathPrefix, name] : [name];
    if (is(field2, Column) || is(field2, SQL) || is(field2, SQL.Aliased) || is(field2, Subquery)) {
      result.push({ path: newPath, field: field2 });
    } else if (is(field2, Table)) {
      result.push(...orderSelectedFields(field2[Table.Symbol.Columns], newPath));
    } else {
      result.push(...orderSelectedFields(field2, newPath));
    }
    return result;
  }, []);
}
function haveSameKeys(left, right) {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }
  for (const [index, key2] of leftKeys.entries()) {
    if (key2 !== rightKeys[index]) {
      return false;
    }
  }
  return true;
}
function mapUpdateSet(table, values2) {
  const entries = Object.entries(values2).filter(([, value2]) => value2 !== void 0).map(([key2, value2]) => {
    if (is(value2, SQL) || is(value2, Column)) {
      return [key2, value2];
    } else {
      return [key2, new Param(value2, table[Table.Symbol.Columns][key2])];
    }
  });
  if (entries.length === 0) {
    throw new Error("No values to set");
  }
  return Object.fromEntries(entries);
}
function applyMixins(baseClass, extendedClasses) {
  for (const extendedClass of extendedClasses) {
    for (const name of Object.getOwnPropertyNames(extendedClass.prototype)) {
      if (name === "constructor") continue;
      Object.defineProperty(
        baseClass.prototype,
        name,
        Object.getOwnPropertyDescriptor(extendedClass.prototype, name) || /* @__PURE__ */ Object.create(null)
      );
    }
  }
}
function getTableColumns(table) {
  return table[Table.Symbol.Columns];
}
function getTableLikeName(table) {
  return is(table, Subquery) ? table._.alias : is(table, View) ? table[ViewBaseConfig].name : is(table, SQL) ? void 0 : table[Table.Symbol.IsAlias] ? table[Table.Symbol.Name] : table[Table.Symbol.BaseName];
}
function getColumnNameAndConfig(a, b) {
  return {
    name: typeof a === "string" && a.length > 0 ? a : "",
    config: typeof a === "object" ? a : b
  };
}
function isConfig(data) {
  if (typeof data !== "object" || data === null) return false;
  if (data.constructor.name !== "Object") return false;
  if ("logger" in data) {
    const type = typeof data["logger"];
    if (type !== "boolean" && (type !== "object" || typeof data["logger"]["logQuery"] !== "function") && type !== "undefined") return false;
    return true;
  }
  if ("schema" in data) {
    const type = typeof data["schema"];
    if (type !== "object" && type !== "undefined") return false;
    return true;
  }
  if ("casing" in data) {
    const type = typeof data["casing"];
    if (type !== "string" && type !== "undefined") return false;
    return true;
  }
  if ("mode" in data) {
    if (data["mode"] !== "default" || data["mode"] !== "planetscale" || data["mode"] !== void 0) return false;
    return true;
  }
  if ("connection" in data) {
    const type = typeof data["connection"];
    if (type !== "string" && type !== "object" && type !== "undefined") return false;
    return true;
  }
  if ("client" in data) {
    const type = typeof data["client"];
    if (type !== "object" && type !== "function" && type !== "undefined") return false;
    return true;
  }
  if (Object.keys(data).length === 0) return true;
  return false;
}
var textDecoder = typeof TextDecoder === "undefined" ? null : new TextDecoder();

// node_modules/drizzle-orm/pg-core/columns/int.common.js
var PgIntColumnBaseBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgIntColumnBaseBuilder";
  generatedAlwaysAsIdentity(sequence) {
    if (sequence) {
      const { name, ...options } = sequence;
      this.config.generatedIdentity = {
        type: "always",
        sequenceName: name,
        sequenceOptions: options
      };
    } else {
      this.config.generatedIdentity = {
        type: "always"
      };
    }
    this.config.hasDefault = true;
    this.config.notNull = true;
    return this;
  }
  generatedByDefaultAsIdentity(sequence) {
    if (sequence) {
      const { name, ...options } = sequence;
      this.config.generatedIdentity = {
        type: "byDefault",
        sequenceName: name,
        sequenceOptions: options
      };
    } else {
      this.config.generatedIdentity = {
        type: "byDefault"
      };
    }
    this.config.hasDefault = true;
    this.config.notNull = true;
    return this;
  }
};

// node_modules/drizzle-orm/pg-core/columns/bigint.js
var PgBigInt53Builder = class extends PgIntColumnBaseBuilder {
  static [entityKind] = "PgBigInt53Builder";
  constructor(name) {
    super(name, "number", "PgBigInt53");
  }
  /** @internal */
  build(table) {
    return new PgBigInt53(table, this.config);
  }
};
var PgBigInt53 = class extends PgColumn {
  static [entityKind] = "PgBigInt53";
  getSQLType() {
    return "bigint";
  }
  mapFromDriverValue(value2) {
    if (typeof value2 === "number") {
      return value2;
    }
    return Number(value2);
  }
};
var PgBigInt64Builder = class extends PgIntColumnBaseBuilder {
  static [entityKind] = "PgBigInt64Builder";
  constructor(name) {
    super(name, "bigint", "PgBigInt64");
  }
  /** @internal */
  build(table) {
    return new PgBigInt64(
      table,
      this.config
    );
  }
};
var PgBigInt64 = class extends PgColumn {
  static [entityKind] = "PgBigInt64";
  getSQLType() {
    return "bigint";
  }
  // eslint-disable-next-line unicorn/prefer-native-coercion-functions
  mapFromDriverValue(value2) {
    return BigInt(value2);
  }
};
function bigint(a, b) {
  const { name, config } = getColumnNameAndConfig(a, b);
  if (config.mode === "number") {
    return new PgBigInt53Builder(name);
  }
  return new PgBigInt64Builder(name);
}

// node_modules/drizzle-orm/pg-core/columns/bigserial.js
var PgBigSerial53Builder = class extends PgColumnBuilder {
  static [entityKind] = "PgBigSerial53Builder";
  constructor(name) {
    super(name, "number", "PgBigSerial53");
    this.config.hasDefault = true;
    this.config.notNull = true;
  }
  /** @internal */
  build(table) {
    return new PgBigSerial53(
      table,
      this.config
    );
  }
};
var PgBigSerial53 = class extends PgColumn {
  static [entityKind] = "PgBigSerial53";
  getSQLType() {
    return "bigserial";
  }
  mapFromDriverValue(value2) {
    if (typeof value2 === "number") {
      return value2;
    }
    return Number(value2);
  }
};
var PgBigSerial64Builder = class extends PgColumnBuilder {
  static [entityKind] = "PgBigSerial64Builder";
  constructor(name) {
    super(name, "bigint", "PgBigSerial64");
    this.config.hasDefault = true;
  }
  /** @internal */
  build(table) {
    return new PgBigSerial64(
      table,
      this.config
    );
  }
};
var PgBigSerial64 = class extends PgColumn {
  static [entityKind] = "PgBigSerial64";
  getSQLType() {
    return "bigserial";
  }
  // eslint-disable-next-line unicorn/prefer-native-coercion-functions
  mapFromDriverValue(value2) {
    return BigInt(value2);
  }
};
function bigserial(a, b) {
  const { name, config } = getColumnNameAndConfig(a, b);
  if (config.mode === "number") {
    return new PgBigSerial53Builder(name);
  }
  return new PgBigSerial64Builder(name);
}

// node_modules/drizzle-orm/pg-core/columns/boolean.js
var PgBooleanBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgBooleanBuilder";
  constructor(name) {
    super(name, "boolean", "PgBoolean");
  }
  /** @internal */
  build(table) {
    return new PgBoolean(table, this.config);
  }
};
var PgBoolean = class extends PgColumn {
  static [entityKind] = "PgBoolean";
  getSQLType() {
    return "boolean";
  }
};
function boolean(name) {
  return new PgBooleanBuilder(name ?? "");
}

// node_modules/drizzle-orm/pg-core/columns/char.js
var PgCharBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgCharBuilder";
  constructor(name, config) {
    super(name, "string", "PgChar");
    this.config.length = config.length;
    this.config.enumValues = config.enum;
  }
  /** @internal */
  build(table) {
    return new PgChar(
      table,
      this.config
    );
  }
};
var PgChar = class extends PgColumn {
  static [entityKind] = "PgChar";
  length = this.config.length;
  enumValues = this.config.enumValues;
  getSQLType() {
    return this.length === void 0 ? `char` : `char(${this.length})`;
  }
};
function char(a, b = {}) {
  const { name, config } = getColumnNameAndConfig(a, b);
  return new PgCharBuilder(name, config);
}

// node_modules/drizzle-orm/pg-core/columns/cidr.js
var PgCidrBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgCidrBuilder";
  constructor(name) {
    super(name, "string", "PgCidr");
  }
  /** @internal */
  build(table) {
    return new PgCidr(table, this.config);
  }
};
var PgCidr = class extends PgColumn {
  static [entityKind] = "PgCidr";
  getSQLType() {
    return "cidr";
  }
};
function cidr(name) {
  return new PgCidrBuilder(name ?? "");
}

// node_modules/drizzle-orm/pg-core/columns/custom.js
var PgCustomColumnBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgCustomColumnBuilder";
  constructor(name, fieldConfig, customTypeParams) {
    super(name, "custom", "PgCustomColumn");
    this.config.fieldConfig = fieldConfig;
    this.config.customTypeParams = customTypeParams;
  }
  /** @internal */
  build(table) {
    return new PgCustomColumn(
      table,
      this.config
    );
  }
};
var PgCustomColumn = class extends PgColumn {
  static [entityKind] = "PgCustomColumn";
  sqlName;
  mapTo;
  mapFrom;
  constructor(table, config) {
    super(table, config);
    this.sqlName = config.customTypeParams.dataType(config.fieldConfig);
    this.mapTo = config.customTypeParams.toDriver;
    this.mapFrom = config.customTypeParams.fromDriver;
  }
  getSQLType() {
    return this.sqlName;
  }
  mapFromDriverValue(value2) {
    return typeof this.mapFrom === "function" ? this.mapFrom(value2) : value2;
  }
  mapToDriverValue(value2) {
    return typeof this.mapTo === "function" ? this.mapTo(value2) : value2;
  }
};
function customType(customTypeParams) {
  return (a, b) => {
    const { name, config } = getColumnNameAndConfig(a, b);
    return new PgCustomColumnBuilder(name, config, customTypeParams);
  };
}

// node_modules/drizzle-orm/pg-core/columns/date.common.js
var PgDateColumnBaseBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgDateColumnBaseBuilder";
  defaultNow() {
    return this.default(sql`now()`);
  }
};

// node_modules/drizzle-orm/pg-core/columns/date.js
var PgDateBuilder = class extends PgDateColumnBaseBuilder {
  static [entityKind] = "PgDateBuilder";
  constructor(name) {
    super(name, "date", "PgDate");
  }
  /** @internal */
  build(table) {
    return new PgDate(table, this.config);
  }
};
var PgDate = class extends PgColumn {
  static [entityKind] = "PgDate";
  getSQLType() {
    return "date";
  }
  mapFromDriverValue(value2) {
    if (typeof value2 === "string") return new Date(value2);
    return value2;
  }
  mapToDriverValue(value2) {
    return value2.toISOString();
  }
};
var PgDateStringBuilder = class extends PgDateColumnBaseBuilder {
  static [entityKind] = "PgDateStringBuilder";
  constructor(name) {
    super(name, "string", "PgDateString");
  }
  /** @internal */
  build(table) {
    return new PgDateString(
      table,
      this.config
    );
  }
};
var PgDateString = class extends PgColumn {
  static [entityKind] = "PgDateString";
  getSQLType() {
    return "date";
  }
  mapFromDriverValue(value2) {
    if (typeof value2 === "string") return value2;
    return value2.toISOString().slice(0, -14);
  }
};
function date(a, b) {
  const { name, config } = getColumnNameAndConfig(a, b);
  if (config?.mode === "date") {
    return new PgDateBuilder(name);
  }
  return new PgDateStringBuilder(name);
}

// node_modules/drizzle-orm/pg-core/columns/double-precision.js
var PgDoublePrecisionBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgDoublePrecisionBuilder";
  constructor(name) {
    super(name, "number", "PgDoublePrecision");
  }
  /** @internal */
  build(table) {
    return new PgDoublePrecision(
      table,
      this.config
    );
  }
};
var PgDoublePrecision = class extends PgColumn {
  static [entityKind] = "PgDoublePrecision";
  getSQLType() {
    return "double precision";
  }
  mapFromDriverValue(value2) {
    if (typeof value2 === "string") {
      return Number.parseFloat(value2);
    }
    return value2;
  }
};
function doublePrecision(name) {
  return new PgDoublePrecisionBuilder(name ?? "");
}

// node_modules/drizzle-orm/pg-core/columns/inet.js
var PgInetBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgInetBuilder";
  constructor(name) {
    super(name, "string", "PgInet");
  }
  /** @internal */
  build(table) {
    return new PgInet(table, this.config);
  }
};
var PgInet = class extends PgColumn {
  static [entityKind] = "PgInet";
  getSQLType() {
    return "inet";
  }
};
function inet(name) {
  return new PgInetBuilder(name ?? "");
}

// node_modules/drizzle-orm/pg-core/columns/integer.js
var PgIntegerBuilder = class extends PgIntColumnBaseBuilder {
  static [entityKind] = "PgIntegerBuilder";
  constructor(name) {
    super(name, "number", "PgInteger");
  }
  /** @internal */
  build(table) {
    return new PgInteger(table, this.config);
  }
};
var PgInteger = class extends PgColumn {
  static [entityKind] = "PgInteger";
  getSQLType() {
    return "integer";
  }
  mapFromDriverValue(value2) {
    if (typeof value2 === "string") {
      return Number.parseInt(value2);
    }
    return value2;
  }
};
function integer(name) {
  return new PgIntegerBuilder(name ?? "");
}

// node_modules/drizzle-orm/pg-core/columns/interval.js
var PgIntervalBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgIntervalBuilder";
  constructor(name, intervalConfig) {
    super(name, "string", "PgInterval");
    this.config.intervalConfig = intervalConfig;
  }
  /** @internal */
  build(table) {
    return new PgInterval(table, this.config);
  }
};
var PgInterval = class extends PgColumn {
  static [entityKind] = "PgInterval";
  fields = this.config.intervalConfig.fields;
  precision = this.config.intervalConfig.precision;
  getSQLType() {
    const fields = this.fields ? ` ${this.fields}` : "";
    const precision = this.precision ? `(${this.precision})` : "";
    return `interval${fields}${precision}`;
  }
};
function interval(a, b = {}) {
  const { name, config } = getColumnNameAndConfig(a, b);
  return new PgIntervalBuilder(name, config);
}

// node_modules/drizzle-orm/pg-core/columns/json.js
var PgJsonBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgJsonBuilder";
  constructor(name) {
    super(name, "json", "PgJson");
  }
  /** @internal */
  build(table) {
    return new PgJson(table, this.config);
  }
};
var PgJson = class extends PgColumn {
  static [entityKind] = "PgJson";
  constructor(table, config) {
    super(table, config);
  }
  getSQLType() {
    return "json";
  }
  mapToDriverValue(value2) {
    return JSON.stringify(value2);
  }
  mapFromDriverValue(value2) {
    if (typeof value2 === "string") {
      try {
        return JSON.parse(value2);
      } catch {
        return value2;
      }
    }
    return value2;
  }
};
function json(name) {
  return new PgJsonBuilder(name ?? "");
}

// node_modules/drizzle-orm/pg-core/columns/jsonb.js
var PgJsonbBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgJsonbBuilder";
  constructor(name) {
    super(name, "json", "PgJsonb");
  }
  /** @internal */
  build(table) {
    return new PgJsonb(table, this.config);
  }
};
var PgJsonb = class extends PgColumn {
  static [entityKind] = "PgJsonb";
  constructor(table, config) {
    super(table, config);
  }
  getSQLType() {
    return "jsonb";
  }
  mapToDriverValue(value2) {
    return JSON.stringify(value2);
  }
  mapFromDriverValue(value2) {
    if (typeof value2 === "string") {
      try {
        return JSON.parse(value2);
      } catch {
        return value2;
      }
    }
    return value2;
  }
};
function jsonb(name) {
  return new PgJsonbBuilder(name ?? "");
}

// node_modules/drizzle-orm/pg-core/columns/line.js
var PgLineBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgLineBuilder";
  constructor(name) {
    super(name, "array", "PgLine");
  }
  /** @internal */
  build(table) {
    return new PgLineTuple(
      table,
      this.config
    );
  }
};
var PgLineTuple = class extends PgColumn {
  static [entityKind] = "PgLine";
  getSQLType() {
    return "line";
  }
  mapFromDriverValue(value2) {
    const [a, b, c2] = value2.slice(1, -1).split(",");
    return [Number.parseFloat(a), Number.parseFloat(b), Number.parseFloat(c2)];
  }
  mapToDriverValue(value2) {
    return `{${value2[0]},${value2[1]},${value2[2]}}`;
  }
};
var PgLineABCBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgLineABCBuilder";
  constructor(name) {
    super(name, "json", "PgLineABC");
  }
  /** @internal */
  build(table) {
    return new PgLineABC(
      table,
      this.config
    );
  }
};
var PgLineABC = class extends PgColumn {
  static [entityKind] = "PgLineABC";
  getSQLType() {
    return "line";
  }
  mapFromDriverValue(value2) {
    const [a, b, c2] = value2.slice(1, -1).split(",");
    return { a: Number.parseFloat(a), b: Number.parseFloat(b), c: Number.parseFloat(c2) };
  }
  mapToDriverValue(value2) {
    return `{${value2.a},${value2.b},${value2.c}}`;
  }
};
function line(a, b) {
  const { name, config } = getColumnNameAndConfig(a, b);
  if (!config?.mode || config.mode === "tuple") {
    return new PgLineBuilder(name);
  }
  return new PgLineABCBuilder(name);
}

// node_modules/drizzle-orm/pg-core/columns/macaddr.js
var PgMacaddrBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgMacaddrBuilder";
  constructor(name) {
    super(name, "string", "PgMacaddr");
  }
  /** @internal */
  build(table) {
    return new PgMacaddr(table, this.config);
  }
};
var PgMacaddr = class extends PgColumn {
  static [entityKind] = "PgMacaddr";
  getSQLType() {
    return "macaddr";
  }
};
function macaddr(name) {
  return new PgMacaddrBuilder(name ?? "");
}

// node_modules/drizzle-orm/pg-core/columns/macaddr8.js
var PgMacaddr8Builder = class extends PgColumnBuilder {
  static [entityKind] = "PgMacaddr8Builder";
  constructor(name) {
    super(name, "string", "PgMacaddr8");
  }
  /** @internal */
  build(table) {
    return new PgMacaddr8(table, this.config);
  }
};
var PgMacaddr8 = class extends PgColumn {
  static [entityKind] = "PgMacaddr8";
  getSQLType() {
    return "macaddr8";
  }
};
function macaddr8(name) {
  return new PgMacaddr8Builder(name ?? "");
}

// node_modules/drizzle-orm/pg-core/columns/numeric.js
var PgNumericBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgNumericBuilder";
  constructor(name, precision, scale) {
    super(name, "string", "PgNumeric");
    this.config.precision = precision;
    this.config.scale = scale;
  }
  /** @internal */
  build(table) {
    return new PgNumeric(table, this.config);
  }
};
var PgNumeric = class extends PgColumn {
  static [entityKind] = "PgNumeric";
  precision;
  scale;
  constructor(table, config) {
    super(table, config);
    this.precision = config.precision;
    this.scale = config.scale;
  }
  mapFromDriverValue(value2) {
    if (typeof value2 === "string") return value2;
    return String(value2);
  }
  getSQLType() {
    if (this.precision !== void 0 && this.scale !== void 0) {
      return `numeric(${this.precision}, ${this.scale})`;
    } else if (this.precision === void 0) {
      return "numeric";
    } else {
      return `numeric(${this.precision})`;
    }
  }
};
var PgNumericNumberBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgNumericNumberBuilder";
  constructor(name, precision, scale) {
    super(name, "number", "PgNumericNumber");
    this.config.precision = precision;
    this.config.scale = scale;
  }
  /** @internal */
  build(table) {
    return new PgNumericNumber(
      table,
      this.config
    );
  }
};
var PgNumericNumber = class extends PgColumn {
  static [entityKind] = "PgNumericNumber";
  precision;
  scale;
  constructor(table, config) {
    super(table, config);
    this.precision = config.precision;
    this.scale = config.scale;
  }
  mapFromDriverValue(value2) {
    if (typeof value2 === "number") return value2;
    return Number(value2);
  }
  mapToDriverValue = String;
  getSQLType() {
    if (this.precision !== void 0 && this.scale !== void 0) {
      return `numeric(${this.precision}, ${this.scale})`;
    } else if (this.precision === void 0) {
      return "numeric";
    } else {
      return `numeric(${this.precision})`;
    }
  }
};
var PgNumericBigIntBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgNumericBigIntBuilder";
  constructor(name, precision, scale) {
    super(name, "bigint", "PgNumericBigInt");
    this.config.precision = precision;
    this.config.scale = scale;
  }
  /** @internal */
  build(table) {
    return new PgNumericBigInt(
      table,
      this.config
    );
  }
};
var PgNumericBigInt = class extends PgColumn {
  static [entityKind] = "PgNumericBigInt";
  precision;
  scale;
  constructor(table, config) {
    super(table, config);
    this.precision = config.precision;
    this.scale = config.scale;
  }
  mapFromDriverValue = BigInt;
  mapToDriverValue = String;
  getSQLType() {
    if (this.precision !== void 0 && this.scale !== void 0) {
      return `numeric(${this.precision}, ${this.scale})`;
    } else if (this.precision === void 0) {
      return "numeric";
    } else {
      return `numeric(${this.precision})`;
    }
  }
};
function numeric(a, b) {
  const { name, config } = getColumnNameAndConfig(a, b);
  const mode = config?.mode;
  return mode === "number" ? new PgNumericNumberBuilder(name, config?.precision, config?.scale) : mode === "bigint" ? new PgNumericBigIntBuilder(name, config?.precision, config?.scale) : new PgNumericBuilder(name, config?.precision, config?.scale);
}

// node_modules/drizzle-orm/pg-core/columns/point.js
var PgPointTupleBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgPointTupleBuilder";
  constructor(name) {
    super(name, "array", "PgPointTuple");
  }
  /** @internal */
  build(table) {
    return new PgPointTuple(
      table,
      this.config
    );
  }
};
var PgPointTuple = class extends PgColumn {
  static [entityKind] = "PgPointTuple";
  getSQLType() {
    return "point";
  }
  mapFromDriverValue(value2) {
    if (typeof value2 === "string") {
      const [x, y] = value2.slice(1, -1).split(",");
      return [Number.parseFloat(x), Number.parseFloat(y)];
    }
    return [value2.x, value2.y];
  }
  mapToDriverValue(value2) {
    return `(${value2[0]},${value2[1]})`;
  }
};
var PgPointObjectBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgPointObjectBuilder";
  constructor(name) {
    super(name, "json", "PgPointObject");
  }
  /** @internal */
  build(table) {
    return new PgPointObject(
      table,
      this.config
    );
  }
};
var PgPointObject = class extends PgColumn {
  static [entityKind] = "PgPointObject";
  getSQLType() {
    return "point";
  }
  mapFromDriverValue(value2) {
    if (typeof value2 === "string") {
      const [x, y] = value2.slice(1, -1).split(",");
      return { x: Number.parseFloat(x), y: Number.parseFloat(y) };
    }
    return value2;
  }
  mapToDriverValue(value2) {
    return `(${value2.x},${value2.y})`;
  }
};
function point(a, b) {
  const { name, config } = getColumnNameAndConfig(a, b);
  if (!config?.mode || config.mode === "tuple") {
    return new PgPointTupleBuilder(name);
  }
  return new PgPointObjectBuilder(name);
}

// node_modules/drizzle-orm/pg-core/columns/postgis_extension/utils.js
function hexToBytes(hex) {
  const bytes2 = [];
  for (let c2 = 0; c2 < hex.length; c2 += 2) {
    bytes2.push(Number.parseInt(hex.slice(c2, c2 + 2), 16));
  }
  return new Uint8Array(bytes2);
}
function bytesToFloat64(bytes2, offset) {
  const buffer = new ArrayBuffer(8);
  const view2 = new DataView(buffer);
  for (let i = 0; i < 8; i++) {
    view2.setUint8(i, bytes2[offset + i]);
  }
  return view2.getFloat64(0, true);
}
function parseEWKB(hex) {
  const bytes2 = hexToBytes(hex);
  let offset = 0;
  const byteOrder = bytes2[offset];
  offset += 1;
  const view2 = new DataView(bytes2.buffer);
  const geomType = view2.getUint32(offset, byteOrder === 1);
  offset += 4;
  let _srid;
  if (geomType & 536870912) {
    _srid = view2.getUint32(offset, byteOrder === 1);
    offset += 4;
  }
  if ((geomType & 65535) === 1) {
    const x = bytesToFloat64(bytes2, offset);
    offset += 8;
    const y = bytesToFloat64(bytes2, offset);
    offset += 8;
    return [x, y];
  }
  throw new Error("Unsupported geometry type");
}

// node_modules/drizzle-orm/pg-core/columns/postgis_extension/geometry.js
var PgGeometryBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgGeometryBuilder";
  constructor(name) {
    super(name, "array", "PgGeometry");
  }
  /** @internal */
  build(table) {
    return new PgGeometry(
      table,
      this.config
    );
  }
};
var PgGeometry = class extends PgColumn {
  static [entityKind] = "PgGeometry";
  getSQLType() {
    return "geometry(point)";
  }
  mapFromDriverValue(value2) {
    return parseEWKB(value2);
  }
  mapToDriverValue(value2) {
    return `point(${value2[0]} ${value2[1]})`;
  }
};
var PgGeometryObjectBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgGeometryObjectBuilder";
  constructor(name) {
    super(name, "json", "PgGeometryObject");
  }
  /** @internal */
  build(table) {
    return new PgGeometryObject(
      table,
      this.config
    );
  }
};
var PgGeometryObject = class extends PgColumn {
  static [entityKind] = "PgGeometryObject";
  getSQLType() {
    return "geometry(point)";
  }
  mapFromDriverValue(value2) {
    const parsed = parseEWKB(value2);
    return { x: parsed[0], y: parsed[1] };
  }
  mapToDriverValue(value2) {
    return `point(${value2.x} ${value2.y})`;
  }
};
function geometry(a, b) {
  const { name, config } = getColumnNameAndConfig(a, b);
  if (!config?.mode || config.mode === "tuple") {
    return new PgGeometryBuilder(name);
  }
  return new PgGeometryObjectBuilder(name);
}

// node_modules/drizzle-orm/pg-core/columns/real.js
var PgRealBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgRealBuilder";
  constructor(name, length) {
    super(name, "number", "PgReal");
    this.config.length = length;
  }
  /** @internal */
  build(table) {
    return new PgReal(table, this.config);
  }
};
var PgReal = class extends PgColumn {
  static [entityKind] = "PgReal";
  constructor(table, config) {
    super(table, config);
  }
  getSQLType() {
    return "real";
  }
  mapFromDriverValue = (value2) => {
    if (typeof value2 === "string") {
      return Number.parseFloat(value2);
    }
    return value2;
  };
};
function real(name) {
  return new PgRealBuilder(name ?? "");
}

// node_modules/drizzle-orm/pg-core/columns/serial.js
var PgSerialBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgSerialBuilder";
  constructor(name) {
    super(name, "number", "PgSerial");
    this.config.hasDefault = true;
    this.config.notNull = true;
  }
  /** @internal */
  build(table) {
    return new PgSerial(table, this.config);
  }
};
var PgSerial = class extends PgColumn {
  static [entityKind] = "PgSerial";
  getSQLType() {
    return "serial";
  }
};
function serial(name) {
  return new PgSerialBuilder(name ?? "");
}

// node_modules/drizzle-orm/pg-core/columns/smallint.js
var PgSmallIntBuilder = class extends PgIntColumnBaseBuilder {
  static [entityKind] = "PgSmallIntBuilder";
  constructor(name) {
    super(name, "number", "PgSmallInt");
  }
  /** @internal */
  build(table) {
    return new PgSmallInt(table, this.config);
  }
};
var PgSmallInt = class extends PgColumn {
  static [entityKind] = "PgSmallInt";
  getSQLType() {
    return "smallint";
  }
  mapFromDriverValue = (value2) => {
    if (typeof value2 === "string") {
      return Number(value2);
    }
    return value2;
  };
};
function smallint(name) {
  return new PgSmallIntBuilder(name ?? "");
}

// node_modules/drizzle-orm/pg-core/columns/smallserial.js
var PgSmallSerialBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgSmallSerialBuilder";
  constructor(name) {
    super(name, "number", "PgSmallSerial");
    this.config.hasDefault = true;
    this.config.notNull = true;
  }
  /** @internal */
  build(table) {
    return new PgSmallSerial(
      table,
      this.config
    );
  }
};
var PgSmallSerial = class extends PgColumn {
  static [entityKind] = "PgSmallSerial";
  getSQLType() {
    return "smallserial";
  }
};
function smallserial(name) {
  return new PgSmallSerialBuilder(name ?? "");
}

// node_modules/drizzle-orm/pg-core/columns/text.js
var PgTextBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgTextBuilder";
  constructor(name, config) {
    super(name, "string", "PgText");
    this.config.enumValues = config.enum;
  }
  /** @internal */
  build(table) {
    return new PgText(table, this.config);
  }
};
var PgText = class extends PgColumn {
  static [entityKind] = "PgText";
  enumValues = this.config.enumValues;
  getSQLType() {
    return "text";
  }
};
function text(a, b = {}) {
  const { name, config } = getColumnNameAndConfig(a, b);
  return new PgTextBuilder(name, config);
}

// node_modules/drizzle-orm/pg-core/columns/time.js
var PgTimeBuilder = class extends PgDateColumnBaseBuilder {
  constructor(name, withTimezone, precision) {
    super(name, "string", "PgTime");
    this.withTimezone = withTimezone;
    this.precision = precision;
    this.config.withTimezone = withTimezone;
    this.config.precision = precision;
  }
  static [entityKind] = "PgTimeBuilder";
  /** @internal */
  build(table) {
    return new PgTime(table, this.config);
  }
};
var PgTime = class extends PgColumn {
  static [entityKind] = "PgTime";
  withTimezone;
  precision;
  constructor(table, config) {
    super(table, config);
    this.withTimezone = config.withTimezone;
    this.precision = config.precision;
  }
  getSQLType() {
    const precision = this.precision === void 0 ? "" : `(${this.precision})`;
    return `time${precision}${this.withTimezone ? " with time zone" : ""}`;
  }
};
function time(a, b = {}) {
  const { name, config } = getColumnNameAndConfig(a, b);
  return new PgTimeBuilder(name, config.withTimezone ?? false, config.precision);
}

// node_modules/drizzle-orm/pg-core/columns/timestamp.js
var PgTimestampBuilder = class extends PgDateColumnBaseBuilder {
  static [entityKind] = "PgTimestampBuilder";
  constructor(name, withTimezone, precision) {
    super(name, "date", "PgTimestamp");
    this.config.withTimezone = withTimezone;
    this.config.precision = precision;
  }
  /** @internal */
  build(table) {
    return new PgTimestamp(table, this.config);
  }
};
var PgTimestamp = class extends PgColumn {
  static [entityKind] = "PgTimestamp";
  withTimezone;
  precision;
  constructor(table, config) {
    super(table, config);
    this.withTimezone = config.withTimezone;
    this.precision = config.precision;
  }
  getSQLType() {
    const precision = this.precision === void 0 ? "" : ` (${this.precision})`;
    return `timestamp${precision}${this.withTimezone ? " with time zone" : ""}`;
  }
  mapFromDriverValue(value2) {
    if (typeof value2 === "string") return new Date(this.withTimezone ? value2 : value2 + "+0000");
    return value2;
  }
  mapToDriverValue = (value2) => {
    return value2.toISOString();
  };
};
var PgTimestampStringBuilder = class extends PgDateColumnBaseBuilder {
  static [entityKind] = "PgTimestampStringBuilder";
  constructor(name, withTimezone, precision) {
    super(name, "string", "PgTimestampString");
    this.config.withTimezone = withTimezone;
    this.config.precision = precision;
  }
  /** @internal */
  build(table) {
    return new PgTimestampString(
      table,
      this.config
    );
  }
};
var PgTimestampString = class extends PgColumn {
  static [entityKind] = "PgTimestampString";
  withTimezone;
  precision;
  constructor(table, config) {
    super(table, config);
    this.withTimezone = config.withTimezone;
    this.precision = config.precision;
  }
  getSQLType() {
    const precision = this.precision === void 0 ? "" : `(${this.precision})`;
    return `timestamp${precision}${this.withTimezone ? " with time zone" : ""}`;
  }
  mapFromDriverValue(value2) {
    if (typeof value2 === "string") return value2;
    const shortened = value2.toISOString().slice(0, -1).replace("T", " ");
    if (this.withTimezone) {
      const offset = value2.getTimezoneOffset();
      const sign = offset <= 0 ? "+" : "-";
      return `${shortened}${sign}${Math.floor(Math.abs(offset) / 60).toString().padStart(2, "0")}`;
    }
    return shortened;
  }
};
function timestamp(a, b = {}) {
  const { name, config } = getColumnNameAndConfig(a, b);
  if (config?.mode === "string") {
    return new PgTimestampStringBuilder(name, config.withTimezone ?? false, config.precision);
  }
  return new PgTimestampBuilder(name, config?.withTimezone ?? false, config?.precision);
}

// node_modules/drizzle-orm/pg-core/columns/uuid.js
var PgUUIDBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgUUIDBuilder";
  constructor(name) {
    super(name, "string", "PgUUID");
  }
  /**
   * Adds `default gen_random_uuid()` to the column definition.
   */
  defaultRandom() {
    return this.default(sql`gen_random_uuid()`);
  }
  /** @internal */
  build(table) {
    return new PgUUID(table, this.config);
  }
};
var PgUUID = class extends PgColumn {
  static [entityKind] = "PgUUID";
  getSQLType() {
    return "uuid";
  }
};
function uuid(name) {
  return new PgUUIDBuilder(name ?? "");
}

// node_modules/drizzle-orm/pg-core/columns/varchar.js
var PgVarcharBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgVarcharBuilder";
  constructor(name, config) {
    super(name, "string", "PgVarchar");
    this.config.length = config.length;
    this.config.enumValues = config.enum;
  }
  /** @internal */
  build(table) {
    return new PgVarchar(
      table,
      this.config
    );
  }
};
var PgVarchar = class extends PgColumn {
  static [entityKind] = "PgVarchar";
  length = this.config.length;
  enumValues = this.config.enumValues;
  getSQLType() {
    return this.length === void 0 ? `varchar` : `varchar(${this.length})`;
  }
};
function varchar(a, b = {}) {
  const { name, config } = getColumnNameAndConfig(a, b);
  return new PgVarcharBuilder(name, config);
}

// node_modules/drizzle-orm/pg-core/columns/vector_extension/bit.js
var PgBinaryVectorBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgBinaryVectorBuilder";
  constructor(name, config) {
    super(name, "string", "PgBinaryVector");
    this.config.dimensions = config.dimensions;
  }
  /** @internal */
  build(table) {
    return new PgBinaryVector(
      table,
      this.config
    );
  }
};
var PgBinaryVector = class extends PgColumn {
  static [entityKind] = "PgBinaryVector";
  dimensions = this.config.dimensions;
  getSQLType() {
    return `bit(${this.dimensions})`;
  }
};
function bit(a, b) {
  const { name, config } = getColumnNameAndConfig(a, b);
  return new PgBinaryVectorBuilder(name, config);
}

// node_modules/drizzle-orm/pg-core/columns/vector_extension/halfvec.js
var PgHalfVectorBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgHalfVectorBuilder";
  constructor(name, config) {
    super(name, "array", "PgHalfVector");
    this.config.dimensions = config.dimensions;
  }
  /** @internal */
  build(table) {
    return new PgHalfVector(
      table,
      this.config
    );
  }
};
var PgHalfVector = class extends PgColumn {
  static [entityKind] = "PgHalfVector";
  dimensions = this.config.dimensions;
  getSQLType() {
    return `halfvec(${this.dimensions})`;
  }
  mapToDriverValue(value2) {
    return JSON.stringify(value2);
  }
  mapFromDriverValue(value2) {
    return value2.slice(1, -1).split(",").map((v) => Number.parseFloat(v));
  }
};
function halfvec(a, b) {
  const { name, config } = getColumnNameAndConfig(a, b);
  return new PgHalfVectorBuilder(name, config);
}

// node_modules/drizzle-orm/pg-core/columns/vector_extension/sparsevec.js
var PgSparseVectorBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgSparseVectorBuilder";
  constructor(name, config) {
    super(name, "string", "PgSparseVector");
    this.config.dimensions = config.dimensions;
  }
  /** @internal */
  build(table) {
    return new PgSparseVector(
      table,
      this.config
    );
  }
};
var PgSparseVector = class extends PgColumn {
  static [entityKind] = "PgSparseVector";
  dimensions = this.config.dimensions;
  getSQLType() {
    return `sparsevec(${this.dimensions})`;
  }
};
function sparsevec(a, b) {
  const { name, config } = getColumnNameAndConfig(a, b);
  return new PgSparseVectorBuilder(name, config);
}

// node_modules/drizzle-orm/pg-core/columns/vector_extension/vector.js
var PgVectorBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgVectorBuilder";
  constructor(name, config) {
    super(name, "array", "PgVector");
    this.config.dimensions = config.dimensions;
  }
  /** @internal */
  build(table) {
    return new PgVector(
      table,
      this.config
    );
  }
};
var PgVector = class extends PgColumn {
  static [entityKind] = "PgVector";
  dimensions = this.config.dimensions;
  getSQLType() {
    return `vector(${this.dimensions})`;
  }
  mapToDriverValue(value2) {
    return JSON.stringify(value2);
  }
  mapFromDriverValue(value2) {
    return value2.slice(1, -1).split(",").map((v) => Number.parseFloat(v));
  }
};
function vector(a, b) {
  const { name, config } = getColumnNameAndConfig(a, b);
  return new PgVectorBuilder(name, config);
}

// node_modules/drizzle-orm/pg-core/columns/all.js
function getPgColumnBuilders() {
  return {
    bigint,
    bigserial,
    boolean,
    char,
    cidr,
    customType,
    date,
    doublePrecision,
    inet,
    integer,
    interval,
    json,
    jsonb,
    line,
    macaddr,
    macaddr8,
    numeric,
    point,
    geometry,
    real,
    serial,
    smallint,
    smallserial,
    text,
    time,
    timestamp,
    uuid,
    varchar,
    bit,
    halfvec,
    sparsevec,
    vector
  };
}

// node_modules/drizzle-orm/pg-core/table.js
var InlineForeignKeys = /* @__PURE__ */ Symbol.for("drizzle:PgInlineForeignKeys");
var EnableRLS = /* @__PURE__ */ Symbol.for("drizzle:EnableRLS");
var PgTable = class extends Table {
  static [entityKind] = "PgTable";
  /** @internal */
  static Symbol = Object.assign({}, Table.Symbol, {
    InlineForeignKeys,
    EnableRLS
  });
  /**@internal */
  [InlineForeignKeys] = [];
  /** @internal */
  [EnableRLS] = false;
  /** @internal */
  [Table.Symbol.ExtraConfigBuilder] = void 0;
  /** @internal */
  [Table.Symbol.ExtraConfigColumns] = {};
};
function pgTableWithSchema(name, columns2, extraConfig, schema, baseName = name) {
  const rawTable = new PgTable(name, schema, baseName);
  const parsedColumns = typeof columns2 === "function" ? columns2(getPgColumnBuilders()) : columns2;
  const builtColumns = Object.fromEntries(
    Object.entries(parsedColumns).map(([name2, colBuilderBase]) => {
      const colBuilder = colBuilderBase;
      colBuilder.setName(name2);
      const column2 = colBuilder.build(rawTable);
      rawTable[InlineForeignKeys].push(...colBuilder.buildForeignKeys(column2, rawTable));
      return [name2, column2];
    })
  );
  const builtColumnsForExtraConfig = Object.fromEntries(
    Object.entries(parsedColumns).map(([name2, colBuilderBase]) => {
      const colBuilder = colBuilderBase;
      colBuilder.setName(name2);
      const column2 = colBuilder.buildExtraConfigColumn(rawTable);
      return [name2, column2];
    })
  );
  const table = Object.assign(rawTable, builtColumns);
  table[Table.Symbol.Columns] = builtColumns;
  table[Table.Symbol.ExtraConfigColumns] = builtColumnsForExtraConfig;
  if (extraConfig) {
    table[PgTable.Symbol.ExtraConfigBuilder] = extraConfig;
  }
  return Object.assign(table, {
    enableRLS: () => {
      table[PgTable.Symbol.EnableRLS] = true;
      return table;
    }
  });
}
var pgTable = (name, columns2, extraConfig) => {
  return pgTableWithSchema(name, columns2, extraConfig, void 0);
};

// node_modules/drizzle-orm/pg-core/primary-keys.js
var PrimaryKeyBuilder = class {
  static [entityKind] = "PgPrimaryKeyBuilder";
  /** @internal */
  columns;
  /** @internal */
  name;
  constructor(columns2, name) {
    this.columns = columns2;
    this.name = name;
  }
  /** @internal */
  build(table) {
    return new PrimaryKey(table, this.columns, this.name);
  }
};
var PrimaryKey = class {
  constructor(table, columns2, name) {
    this.table = table;
    this.columns = columns2;
    this.name = name;
  }
  static [entityKind] = "PgPrimaryKey";
  columns;
  name;
  getName() {
    return this.name ?? `${this.table[PgTable.Symbol.Name]}_${this.columns.map((column2) => column2.name).join("_")}_pk`;
  }
};

// node_modules/drizzle-orm/sql/expressions/conditions.js
function bindIfParam(value2, column2) {
  if (isDriverValueEncoder(column2) && !isSQLWrapper(value2) && !is(value2, Param) && !is(value2, Placeholder) && !is(value2, Column) && !is(value2, Table) && !is(value2, View)) {
    return new Param(value2, column2);
  }
  return value2;
}
var eq = (left, right) => {
  return sql`${left} = ${bindIfParam(right, left)}`;
};
var ne = (left, right) => {
  return sql`${left} <> ${bindIfParam(right, left)}`;
};
function and(...unfilteredConditions) {
  const conditions = unfilteredConditions.filter(
    (c2) => c2 !== void 0
  );
  if (conditions.length === 0) {
    return void 0;
  }
  if (conditions.length === 1) {
    return new SQL(conditions);
  }
  return new SQL([
    new StringChunk("("),
    sql.join(conditions, new StringChunk(" and ")),
    new StringChunk(")")
  ]);
}
function or(...unfilteredConditions) {
  const conditions = unfilteredConditions.filter(
    (c2) => c2 !== void 0
  );
  if (conditions.length === 0) {
    return void 0;
  }
  if (conditions.length === 1) {
    return new SQL(conditions);
  }
  return new SQL([
    new StringChunk("("),
    sql.join(conditions, new StringChunk(" or ")),
    new StringChunk(")")
  ]);
}
function not(condition) {
  return sql`not ${condition}`;
}
var gt = (left, right) => {
  return sql`${left} > ${bindIfParam(right, left)}`;
};
var gte = (left, right) => {
  return sql`${left} >= ${bindIfParam(right, left)}`;
};
var lt = (left, right) => {
  return sql`${left} < ${bindIfParam(right, left)}`;
};
var lte = (left, right) => {
  return sql`${left} <= ${bindIfParam(right, left)}`;
};
function inArray(column2, values2) {
  if (Array.isArray(values2)) {
    if (values2.length === 0) {
      return sql`false`;
    }
    return sql`${column2} in ${values2.map((v) => bindIfParam(v, column2))}`;
  }
  return sql`${column2} in ${bindIfParam(values2, column2)}`;
}
function notInArray(column2, values2) {
  if (Array.isArray(values2)) {
    if (values2.length === 0) {
      return sql`true`;
    }
    return sql`${column2} not in ${values2.map((v) => bindIfParam(v, column2))}`;
  }
  return sql`${column2} not in ${bindIfParam(values2, column2)}`;
}
function isNull(value2) {
  return sql`${value2} is null`;
}
function isNotNull(value2) {
  return sql`${value2} is not null`;
}
function exists(subquery) {
  return sql`exists ${subquery}`;
}
function notExists(subquery) {
  return sql`not exists ${subquery}`;
}
function between(column2, min, max2) {
  return sql`${column2} between ${bindIfParam(min, column2)} and ${bindIfParam(
    max2,
    column2
  )}`;
}
function notBetween(column2, min, max2) {
  return sql`${column2} not between ${bindIfParam(
    min,
    column2
  )} and ${bindIfParam(max2, column2)}`;
}
function like(column2, value2) {
  return sql`${column2} like ${value2}`;
}
function notLike(column2, value2) {
  return sql`${column2} not like ${value2}`;
}
function ilike(column2, value2) {
  return sql`${column2} ilike ${value2}`;
}
function notIlike(column2, value2) {
  return sql`${column2} not ilike ${value2}`;
}

// node_modules/drizzle-orm/sql/expressions/select.js
function asc(column2) {
  return sql`${column2} asc`;
}
function desc(column2) {
  return sql`${column2} desc`;
}

// node_modules/drizzle-orm/relations.js
var Relation = class {
  constructor(sourceTable, referencedTable, relationName) {
    this.sourceTable = sourceTable;
    this.referencedTable = referencedTable;
    this.relationName = relationName;
    this.referencedTableName = referencedTable[Table.Symbol.Name];
  }
  static [entityKind] = "Relation";
  referencedTableName;
  fieldName;
};
var Relations = class {
  constructor(table, config) {
    this.table = table;
    this.config = config;
  }
  static [entityKind] = "Relations";
};
var One = class _One extends Relation {
  constructor(sourceTable, referencedTable, config, isNullable) {
    super(sourceTable, referencedTable, config?.relationName);
    this.config = config;
    this.isNullable = isNullable;
  }
  static [entityKind] = "One";
  withFieldName(fieldName) {
    const relation = new _One(
      this.sourceTable,
      this.referencedTable,
      this.config,
      this.isNullable
    );
    relation.fieldName = fieldName;
    return relation;
  }
};
var Many = class _Many extends Relation {
  constructor(sourceTable, referencedTable, config) {
    super(sourceTable, referencedTable, config?.relationName);
    this.config = config;
  }
  static [entityKind] = "Many";
  withFieldName(fieldName) {
    const relation = new _Many(
      this.sourceTable,
      this.referencedTable,
      this.config
    );
    relation.fieldName = fieldName;
    return relation;
  }
};
function getOperators() {
  return {
    and,
    between,
    eq,
    exists,
    gt,
    gte,
    ilike,
    inArray,
    isNull,
    isNotNull,
    like,
    lt,
    lte,
    ne,
    not,
    notBetween,
    notExists,
    notLike,
    notIlike,
    notInArray,
    or,
    sql
  };
}
function getOrderByOperators() {
  return {
    sql,
    asc,
    desc
  };
}
function extractTablesRelationalConfig(schema, configHelpers) {
  if (Object.keys(schema).length === 1 && "default" in schema && !is(schema["default"], Table)) {
    schema = schema["default"];
  }
  const tableNamesMap = {};
  const relationsBuffer = {};
  const tablesConfig = {};
  for (const [key2, value2] of Object.entries(schema)) {
    if (is(value2, Table)) {
      const dbName = getTableUniqueName(value2);
      const bufferedRelations = relationsBuffer[dbName];
      tableNamesMap[dbName] = key2;
      tablesConfig[key2] = {
        tsName: key2,
        dbName: value2[Table.Symbol.Name],
        schema: value2[Table.Symbol.Schema],
        columns: value2[Table.Symbol.Columns],
        relations: bufferedRelations?.relations ?? {},
        primaryKey: bufferedRelations?.primaryKey ?? []
      };
      for (const column2 of Object.values(
        value2[Table.Symbol.Columns]
      )) {
        if (column2.primary) {
          tablesConfig[key2].primaryKey.push(column2);
        }
      }
      const extraConfig = value2[Table.Symbol.ExtraConfigBuilder]?.(value2[Table.Symbol.ExtraConfigColumns]);
      if (extraConfig) {
        for (const configEntry of Object.values(extraConfig)) {
          if (is(configEntry, PrimaryKeyBuilder)) {
            tablesConfig[key2].primaryKey.push(...configEntry.columns);
          }
        }
      }
    } else if (is(value2, Relations)) {
      const dbName = getTableUniqueName(value2.table);
      const tableName = tableNamesMap[dbName];
      const relations2 = value2.config(
        configHelpers(value2.table)
      );
      let primaryKey;
      for (const [relationName, relation] of Object.entries(relations2)) {
        if (tableName) {
          const tableConfig = tablesConfig[tableName];
          tableConfig.relations[relationName] = relation;
          if (primaryKey) {
            tableConfig.primaryKey.push(...primaryKey);
          }
        } else {
          if (!(dbName in relationsBuffer)) {
            relationsBuffer[dbName] = {
              relations: {},
              primaryKey
            };
          }
          relationsBuffer[dbName].relations[relationName] = relation;
        }
      }
    }
  }
  return { tables: tablesConfig, tableNamesMap };
}
function createOne(sourceTable) {
  return function one2(table, config) {
    return new One(
      sourceTable,
      table,
      config,
      config?.fields.reduce((res, f2) => res && f2.notNull, true) ?? false
    );
  };
}
function createMany(sourceTable) {
  return function many(referencedTable, config) {
    return new Many(sourceTable, referencedTable, config);
  };
}
function normalizeRelation(schema, tableNamesMap, relation) {
  if (is(relation, One) && relation.config) {
    return {
      fields: relation.config.fields,
      references: relation.config.references
    };
  }
  const referencedTableTsName = tableNamesMap[getTableUniqueName(relation.referencedTable)];
  if (!referencedTableTsName) {
    throw new Error(
      `Table "${relation.referencedTable[Table.Symbol.Name]}" not found in schema`
    );
  }
  const referencedTableConfig = schema[referencedTableTsName];
  if (!referencedTableConfig) {
    throw new Error(`Table "${referencedTableTsName}" not found in schema`);
  }
  const sourceTable = relation.sourceTable;
  const sourceTableTsName = tableNamesMap[getTableUniqueName(sourceTable)];
  if (!sourceTableTsName) {
    throw new Error(
      `Table "${sourceTable[Table.Symbol.Name]}" not found in schema`
    );
  }
  const reverseRelations = [];
  for (const referencedTableRelation of Object.values(
    referencedTableConfig.relations
  )) {
    if (relation.relationName && relation !== referencedTableRelation && referencedTableRelation.relationName === relation.relationName || !relation.relationName && referencedTableRelation.referencedTable === relation.sourceTable) {
      reverseRelations.push(referencedTableRelation);
    }
  }
  if (reverseRelations.length > 1) {
    throw relation.relationName ? new Error(
      `There are multiple relations with name "${relation.relationName}" in table "${referencedTableTsName}"`
    ) : new Error(
      `There are multiple relations between "${referencedTableTsName}" and "${relation.sourceTable[Table.Symbol.Name]}". Please specify relation name`
    );
  }
  if (reverseRelations[0] && is(reverseRelations[0], One) && reverseRelations[0].config) {
    return {
      fields: reverseRelations[0].config.references,
      references: reverseRelations[0].config.fields
    };
  }
  throw new Error(
    `There is not enough information to infer relation "${sourceTableTsName}.${relation.fieldName}"`
  );
}
function createTableRelationsHelpers(sourceTable) {
  return {
    one: createOne(sourceTable),
    many: createMany(sourceTable)
  };
}
function mapRelationalRow(tablesConfig, tableConfig, row, buildQueryResultSelection, mapColumnValue = (value2) => value2) {
  const result = {};
  for (const [
    selectionItemIndex,
    selectionItem
  ] of buildQueryResultSelection.entries()) {
    if (selectionItem.isJson) {
      const relation = tableConfig.relations[selectionItem.tsKey];
      const rawSubRows = row[selectionItemIndex];
      const subRows = typeof rawSubRows === "string" ? JSON.parse(rawSubRows) : rawSubRows;
      result[selectionItem.tsKey] = is(relation, One) ? subRows && mapRelationalRow(
        tablesConfig,
        tablesConfig[selectionItem.relationTableTsKey],
        subRows,
        selectionItem.selection,
        mapColumnValue
      ) : subRows.map(
        (subRow) => mapRelationalRow(
          tablesConfig,
          tablesConfig[selectionItem.relationTableTsKey],
          subRow,
          selectionItem.selection,
          mapColumnValue
        )
      );
    } else {
      const value2 = mapColumnValue(row[selectionItemIndex]);
      const field2 = selectionItem.field;
      let decoder;
      if (is(field2, Column)) {
        decoder = field2;
      } else if (is(field2, SQL)) {
        decoder = field2.decoder;
      } else {
        decoder = field2.sql.decoder;
      }
      result[selectionItem.tsKey] = value2 === null ? null : decoder.mapFromDriverValue(value2);
    }
  }
  return result;
}

// src/db/schema.ts
var schema_exports = {};
__export(schema_exports, {
  announcements: () => announcements,
  appRole: () => appRole,
  attendance: () => attendance,
  attendanceMethod: () => attendanceMethod,
  auditLog: () => auditLog,
  claimTokens: () => claimTokens,
  deskDisplays: () => deskDisplays,
  gymClosures: () => gymClosures,
  gymSettings: () => gymSettings,
  members: () => members,
  membershipFees: () => membershipFees,
  membershipFreezes: () => membershipFreezes,
  memberships: () => memberships,
  notificationChannel: () => notificationChannel,
  notificationStatus: () => notificationStatus,
  notifications: () => notifications,
  paymentMethod: () => paymentMethod,
  paymentVoids: () => paymentVoids,
  payments: () => payments,
  plans: () => plans,
  profiles: () => profiles,
  pushSubscriptions: () => pushSubscriptions,
  reminderStage: () => reminderStage
});

// node_modules/drizzle-orm/selection-proxy.js
var SelectionProxyHandler = class _SelectionProxyHandler {
  static [entityKind] = "SelectionProxyHandler";
  config;
  constructor(config) {
    this.config = { ...config };
  }
  get(subquery, prop) {
    if (prop === "_") {
      return {
        ...subquery["_"],
        selectedFields: new Proxy(
          subquery._.selectedFields,
          this
        )
      };
    }
    if (prop === ViewBaseConfig) {
      return {
        ...subquery[ViewBaseConfig],
        selectedFields: new Proxy(
          subquery[ViewBaseConfig].selectedFields,
          this
        )
      };
    }
    if (typeof prop === "symbol") {
      return subquery[prop];
    }
    const columns2 = is(subquery, Subquery) ? subquery._.selectedFields : is(subquery, View) ? subquery[ViewBaseConfig].selectedFields : subquery;
    const value2 = columns2[prop];
    if (is(value2, SQL.Aliased)) {
      if (this.config.sqlAliasedBehavior === "sql" && !value2.isSelectionField) {
        return value2.sql;
      }
      const newValue = value2.clone();
      newValue.isSelectionField = true;
      return newValue;
    }
    if (is(value2, SQL)) {
      if (this.config.sqlBehavior === "sql") {
        return value2;
      }
      throw new Error(
        `You tried to reference "${prop}" field from a subquery, which is a raw SQL field, but it doesn't have an alias declared. Please add an alias to the field using ".as('alias')" method.`
      );
    }
    if (is(value2, Column)) {
      if (this.config.alias) {
        return new Proxy(
          value2,
          new ColumnAliasProxyHandler(
            new Proxy(
              value2.table,
              new TableAliasProxyHandler(this.config.alias, this.config.replaceOriginalName ?? false)
            )
          )
        );
      }
      return value2;
    }
    if (typeof value2 !== "object" || value2 === null) {
      return value2;
    }
    return new Proxy(value2, new _SelectionProxyHandler(this.config));
  }
};

// node_modules/drizzle-orm/casing.js
function toSnakeCase(input) {
  const words = input.replace(/['\u2019]/g, "").match(/[\da-z]+|[A-Z]+(?![a-z])|[A-Z][\da-z]+/g) ?? [];
  return words.map((word) => word.toLowerCase()).join("_");
}
function toCamelCase(input) {
  const words = input.replace(/['\u2019]/g, "").match(/[\da-z]+|[A-Z]+(?![a-z])|[A-Z][\da-z]+/g) ?? [];
  return words.reduce((acc, word, i) => {
    const formattedWord = i === 0 ? word.toLowerCase() : `${word[0].toUpperCase()}${word.slice(1)}`;
    return acc + formattedWord;
  }, "");
}
function noopCase(input) {
  return input;
}
var CasingCache = class {
  static [entityKind] = "CasingCache";
  /** @internal */
  cache = {};
  cachedTables = {};
  convert;
  constructor(casing) {
    this.convert = casing === "snake_case" ? toSnakeCase : casing === "camelCase" ? toCamelCase : noopCase;
  }
  getColumnCasing(column2) {
    if (!column2.keyAsName) return column2.name;
    const schema = column2.table[Table.Symbol.Schema] ?? "public";
    const tableName = column2.table[Table.Symbol.OriginalName];
    const key2 = `${schema}.${tableName}.${column2.name}`;
    if (!this.cache[key2]) {
      this.cacheTable(column2.table);
    }
    return this.cache[key2];
  }
  cacheTable(table) {
    const schema = table[Table.Symbol.Schema] ?? "public";
    const tableName = table[Table.Symbol.OriginalName];
    const tableKey = `${schema}.${tableName}`;
    if (!this.cachedTables[tableKey]) {
      for (const column2 of Object.values(table[Table.Symbol.Columns])) {
        const columnKey = `${tableKey}.${column2.name}`;
        this.cache[columnKey] = this.convert(column2.name);
      }
      this.cachedTables[tableKey] = true;
    }
  }
  clearCache() {
    this.cache = {};
    this.cachedTables = {};
  }
};

// node_modules/drizzle-orm/pg-core/view-base.js
var PgViewBase = class extends View {
  static [entityKind] = "PgViewBase";
};

// node_modules/drizzle-orm/pg-core/dialect.js
var PgDialect = class {
  static [entityKind] = "PgDialect";
  /** @internal */
  casing;
  constructor(config) {
    this.casing = new CasingCache(config?.casing);
  }
  async migrate(migrations, session, config) {
    const migrationsTable = typeof config === "string" ? "__drizzle_migrations" : config.migrationsTable ?? "__drizzle_migrations";
    const migrationsSchema = typeof config === "string" ? "drizzle" : config.migrationsSchema ?? "drizzle";
    const migrationTableCreate = sql`
			CREATE TABLE IF NOT EXISTS ${sql.identifier(migrationsSchema)}.${sql.identifier(migrationsTable)} (
				id SERIAL PRIMARY KEY,
				hash text NOT NULL,
				created_at bigint
			)
		`;
    await session.execute(sql`CREATE SCHEMA IF NOT EXISTS ${sql.identifier(migrationsSchema)}`);
    await session.execute(migrationTableCreate);
    const dbMigrations = await session.all(
      sql`select id, hash, created_at from ${sql.identifier(migrationsSchema)}.${sql.identifier(migrationsTable)} order by created_at desc limit 1`
    );
    const lastDbMigration = dbMigrations[0];
    await session.transaction(async (tx) => {
      for await (const migration of migrations) {
        if (!lastDbMigration || Number(lastDbMigration.created_at) < migration.folderMillis) {
          for (const stmt of migration.sql) {
            await tx.execute(sql.raw(stmt));
          }
          await tx.execute(
            sql`insert into ${sql.identifier(migrationsSchema)}.${sql.identifier(migrationsTable)} ("hash", "created_at") values(${migration.hash}, ${migration.folderMillis})`
          );
        }
      }
    });
  }
  escapeName(name) {
    return `"${name.replace(/"/g, '""')}"`;
  }
  escapeParam(num) {
    return `$${num + 1}`;
  }
  escapeString(str) {
    return `'${str.replace(/'/g, "''")}'`;
  }
  buildWithCTE(queries) {
    if (!queries?.length) return void 0;
    const withSqlChunks = [sql`with `];
    for (const [i, w] of queries.entries()) {
      withSqlChunks.push(sql`${sql.identifier(w._.alias)} as (${w._.sql})`);
      if (i < queries.length - 1) {
        withSqlChunks.push(sql`, `);
      }
    }
    withSqlChunks.push(sql` `);
    return sql.join(withSqlChunks);
  }
  buildDeleteQuery({ table, where, returning, withList }) {
    const withSql = this.buildWithCTE(withList);
    const returningSql = returning ? sql` returning ${this.buildSelection(returning, { isSingleTable: true })}` : void 0;
    const whereSql = where ? sql` where ${where}` : void 0;
    return sql`${withSql}delete from ${table}${whereSql}${returningSql}`;
  }
  buildUpdateSet(table, set) {
    const tableColumns = table[Table.Symbol.Columns];
    const columnNames = Object.keys(tableColumns).filter(
      (colName) => set[colName] !== void 0 || tableColumns[colName]?.onUpdateFn !== void 0
    );
    const setSize = columnNames.length;
    return sql.join(columnNames.flatMap((colName, i) => {
      const col = tableColumns[colName];
      const onUpdateFnResult = col.onUpdateFn?.();
      const value2 = set[colName] ?? (is(onUpdateFnResult, SQL) ? onUpdateFnResult : sql.param(onUpdateFnResult, col));
      const res = sql`${sql.identifier(this.casing.getColumnCasing(col))} = ${value2}`;
      if (i < setSize - 1) {
        return [res, sql.raw(", ")];
      }
      return [res];
    }));
  }
  buildUpdateQuery({ table, set, where, returning, withList, from, joins }) {
    const withSql = this.buildWithCTE(withList);
    const tableName = table[PgTable.Symbol.Name];
    const tableSchema = table[PgTable.Symbol.Schema];
    const origTableName = table[PgTable.Symbol.OriginalName];
    const alias = tableName === origTableName ? void 0 : tableName;
    const tableSql = sql`${tableSchema ? sql`${sql.identifier(tableSchema)}.` : void 0}${sql.identifier(origTableName)}${alias && sql` ${sql.identifier(alias)}`}`;
    const setSql = this.buildUpdateSet(table, set);
    const fromSql = from && sql.join([sql.raw(" from "), this.buildFromTable(from)]);
    const joinsSql = this.buildJoins(joins);
    const returningSql = returning ? sql` returning ${this.buildSelection(returning, { isSingleTable: !from })}` : void 0;
    const whereSql = where ? sql` where ${where}` : void 0;
    return sql`${withSql}update ${tableSql} set ${setSql}${fromSql}${joinsSql}${whereSql}${returningSql}`;
  }
  /**
   * Builds selection SQL with provided fields/expressions
   *
   * Examples:
   *
   * `select <selection> from`
   *
   * `insert ... returning <selection>`
   *
   * If `isSingleTable` is true, then columns won't be prefixed with table name
   */
  buildSelection(fields, { isSingleTable = false } = {}) {
    const columnsLen = fields.length;
    const chunks = fields.flatMap(({ field: field2 }, i) => {
      const chunk = [];
      if (is(field2, SQL.Aliased) && field2.isSelectionField) {
        chunk.push(sql.identifier(field2.fieldAlias));
      } else if (is(field2, SQL.Aliased) || is(field2, SQL)) {
        const query2 = is(field2, SQL.Aliased) ? field2.sql : field2;
        if (isSingleTable) {
          chunk.push(
            new SQL(
              query2.queryChunks.map((c2) => {
                if (is(c2, PgColumn)) {
                  return sql.identifier(this.casing.getColumnCasing(c2));
                }
                return c2;
              })
            )
          );
        } else {
          chunk.push(query2);
        }
        if (is(field2, SQL.Aliased)) {
          chunk.push(sql` as ${sql.identifier(field2.fieldAlias)}`);
        }
      } else if (is(field2, Column)) {
        if (isSingleTable) {
          chunk.push(sql.identifier(this.casing.getColumnCasing(field2)));
        } else {
          chunk.push(field2);
        }
      } else if (is(field2, Subquery)) {
        const entries = Object.entries(field2._.selectedFields);
        if (entries.length === 1) {
          const entry = entries[0][1];
          const fieldDecoder = is(entry, SQL) ? entry.decoder : is(entry, Column) ? { mapFromDriverValue: (v) => entry.mapFromDriverValue(v) } : entry.sql.decoder;
          if (fieldDecoder) {
            field2._.sql.decoder = fieldDecoder;
          }
        }
        chunk.push(field2);
      }
      if (i < columnsLen - 1) {
        chunk.push(sql`, `);
      }
      return chunk;
    });
    return sql.join(chunks);
  }
  buildJoins(joins) {
    if (!joins || joins.length === 0) {
      return void 0;
    }
    const joinsArray = [];
    for (const [index, joinMeta] of joins.entries()) {
      if (index === 0) {
        joinsArray.push(sql` `);
      }
      const table = joinMeta.table;
      const lateralSql = joinMeta.lateral ? sql` lateral` : void 0;
      const onSql = joinMeta.on ? sql` on ${joinMeta.on}` : void 0;
      if (is(table, PgTable)) {
        const tableName = table[PgTable.Symbol.Name];
        const tableSchema = table[PgTable.Symbol.Schema];
        const origTableName = table[PgTable.Symbol.OriginalName];
        const alias = tableName === origTableName ? void 0 : joinMeta.alias;
        joinsArray.push(
          sql`${sql.raw(joinMeta.joinType)} join${lateralSql} ${tableSchema ? sql`${sql.identifier(tableSchema)}.` : void 0}${sql.identifier(origTableName)}${alias && sql` ${sql.identifier(alias)}`}${onSql}`
        );
      } else if (is(table, View)) {
        const viewName = table[ViewBaseConfig].name;
        const viewSchema = table[ViewBaseConfig].schema;
        const origViewName = table[ViewBaseConfig].originalName;
        const alias = viewName === origViewName ? void 0 : joinMeta.alias;
        joinsArray.push(
          sql`${sql.raw(joinMeta.joinType)} join${lateralSql} ${viewSchema ? sql`${sql.identifier(viewSchema)}.` : void 0}${sql.identifier(origViewName)}${alias && sql` ${sql.identifier(alias)}`}${onSql}`
        );
      } else {
        joinsArray.push(
          sql`${sql.raw(joinMeta.joinType)} join${lateralSql} ${table}${onSql}`
        );
      }
      if (index < joins.length - 1) {
        joinsArray.push(sql` `);
      }
    }
    return sql.join(joinsArray);
  }
  buildFromTable(table) {
    if (is(table, Table) && table[Table.Symbol.IsAlias]) {
      let fullName = sql`${sql.identifier(table[Table.Symbol.OriginalName])}`;
      if (table[Table.Symbol.Schema]) {
        fullName = sql`${sql.identifier(table[Table.Symbol.Schema])}.${fullName}`;
      }
      return sql`${fullName} ${sql.identifier(table[Table.Symbol.Name])}`;
    }
    return table;
  }
  buildSelectQuery({
    withList,
    fields,
    fieldsFlat,
    where,
    having,
    table,
    joins,
    orderBy,
    groupBy,
    limit: limit3,
    offset,
    lockingClause,
    distinct,
    setOperators
  }) {
    const fieldsList = fieldsFlat ?? orderSelectedFields(fields);
    for (const f2 of fieldsList) {
      if (is(f2.field, Column) && getTableName(f2.field.table) !== (is(table, Subquery) ? table._.alias : is(table, PgViewBase) ? table[ViewBaseConfig].name : is(table, SQL) ? void 0 : getTableName(table)) && !((table2) => joins?.some(
        ({ alias }) => alias === (table2[Table.Symbol.IsAlias] ? getTableName(table2) : table2[Table.Symbol.BaseName])
      ))(f2.field.table)) {
        const tableName = getTableName(f2.field.table);
        throw new Error(
          `Your "${f2.path.join("->")}" field references a column "${tableName}"."${f2.field.name}", but the table "${tableName}" is not part of the query! Did you forget to join it?`
        );
      }
    }
    const isSingleTable = !joins || joins.length === 0;
    const withSql = this.buildWithCTE(withList);
    let distinctSql;
    if (distinct) {
      distinctSql = distinct === true ? sql` distinct` : sql` distinct on (${sql.join(distinct.on, sql`, `)})`;
    }
    const selection = this.buildSelection(fieldsList, { isSingleTable });
    const tableSql = this.buildFromTable(table);
    const joinsSql = this.buildJoins(joins);
    const whereSql = where ? sql` where ${where}` : void 0;
    const havingSql = having ? sql` having ${having}` : void 0;
    let orderBySql;
    if (orderBy && orderBy.length > 0) {
      orderBySql = sql` order by ${sql.join(orderBy, sql`, `)}`;
    }
    let groupBySql;
    if (groupBy && groupBy.length > 0) {
      groupBySql = sql` group by ${sql.join(groupBy, sql`, `)}`;
    }
    const limitSql = typeof limit3 === "object" || typeof limit3 === "number" && limit3 >= 0 ? sql` limit ${limit3}` : void 0;
    const offsetSql = offset ? sql` offset ${offset}` : void 0;
    const lockingClauseSql = sql.empty();
    if (lockingClause) {
      const clauseSql = sql` for ${sql.raw(lockingClause.strength)}`;
      if (lockingClause.config.of) {
        clauseSql.append(
          sql` of ${sql.join(
            Array.isArray(lockingClause.config.of) ? lockingClause.config.of : [lockingClause.config.of],
            sql`, `
          )}`
        );
      }
      if (lockingClause.config.noWait) {
        clauseSql.append(sql` nowait`);
      } else if (lockingClause.config.skipLocked) {
        clauseSql.append(sql` skip locked`);
      }
      lockingClauseSql.append(clauseSql);
    }
    const finalQuery = sql`${withSql}select${distinctSql} ${selection} from ${tableSql}${joinsSql}${whereSql}${groupBySql}${havingSql}${orderBySql}${limitSql}${offsetSql}${lockingClauseSql}`;
    if (setOperators.length > 0) {
      return this.buildSetOperations(finalQuery, setOperators);
    }
    return finalQuery;
  }
  buildSetOperations(leftSelect, setOperators) {
    const [setOperator, ...rest] = setOperators;
    if (!setOperator) {
      throw new Error("Cannot pass undefined values to any set operator");
    }
    if (rest.length === 0) {
      return this.buildSetOperationQuery({ leftSelect, setOperator });
    }
    return this.buildSetOperations(
      this.buildSetOperationQuery({ leftSelect, setOperator }),
      rest
    );
  }
  buildSetOperationQuery({
    leftSelect,
    setOperator: { type, isAll, rightSelect, limit: limit3, orderBy, offset }
  }) {
    const leftChunk = sql`(${leftSelect.getSQL()}) `;
    const rightChunk = sql`(${rightSelect.getSQL()})`;
    let orderBySql;
    if (orderBy && orderBy.length > 0) {
      const orderByValues = [];
      for (const singleOrderBy of orderBy) {
        if (is(singleOrderBy, PgColumn)) {
          orderByValues.push(sql.identifier(singleOrderBy.name));
        } else if (is(singleOrderBy, SQL)) {
          for (let i = 0; i < singleOrderBy.queryChunks.length; i++) {
            const chunk = singleOrderBy.queryChunks[i];
            if (is(chunk, PgColumn)) {
              singleOrderBy.queryChunks[i] = sql.identifier(chunk.name);
            }
          }
          orderByValues.push(sql`${singleOrderBy}`);
        } else {
          orderByValues.push(sql`${singleOrderBy}`);
        }
      }
      orderBySql = sql` order by ${sql.join(orderByValues, sql`, `)} `;
    }
    const limitSql = typeof limit3 === "object" || typeof limit3 === "number" && limit3 >= 0 ? sql` limit ${limit3}` : void 0;
    const operatorChunk = sql.raw(`${type} ${isAll ? "all " : ""}`);
    const offsetSql = offset ? sql` offset ${offset}` : void 0;
    return sql`${leftChunk}${operatorChunk}${rightChunk}${orderBySql}${limitSql}${offsetSql}`;
  }
  buildInsertQuery({ table, values: valuesOrSelect, onConflict, returning, withList, select: select2, overridingSystemValue_ }) {
    const valuesSqlList = [];
    const columns2 = table[Table.Symbol.Columns];
    const colEntries = Object.entries(columns2).filter(([_, col]) => !col.shouldDisableInsert());
    const insertOrder = colEntries.map(
      ([, column2]) => sql.identifier(this.casing.getColumnCasing(column2))
    );
    if (select2) {
      const select22 = valuesOrSelect;
      if (is(select22, SQL)) {
        valuesSqlList.push(select22);
      } else {
        valuesSqlList.push(select22.getSQL());
      }
    } else {
      const values2 = valuesOrSelect;
      valuesSqlList.push(sql.raw("values "));
      for (const [valueIndex, value2] of values2.entries()) {
        const valueList = [];
        for (const [fieldName, col] of colEntries) {
          const colValue = value2[fieldName];
          if (colValue === void 0 || is(colValue, Param) && colValue.value === void 0) {
            if (col.defaultFn !== void 0) {
              const defaultFnResult = col.defaultFn();
              const defaultValue = is(defaultFnResult, SQL) ? defaultFnResult : sql.param(defaultFnResult, col);
              valueList.push(defaultValue);
            } else if (!col.default && col.onUpdateFn !== void 0) {
              const onUpdateFnResult = col.onUpdateFn();
              const newValue = is(onUpdateFnResult, SQL) ? onUpdateFnResult : sql.param(onUpdateFnResult, col);
              valueList.push(newValue);
            } else {
              valueList.push(sql`default`);
            }
          } else {
            valueList.push(colValue);
          }
        }
        valuesSqlList.push(valueList);
        if (valueIndex < values2.length - 1) {
          valuesSqlList.push(sql`, `);
        }
      }
    }
    const withSql = this.buildWithCTE(withList);
    const valuesSql = sql.join(valuesSqlList);
    const returningSql = returning ? sql` returning ${this.buildSelection(returning, { isSingleTable: true })}` : void 0;
    const onConflictSql = onConflict ? sql` on conflict ${onConflict}` : void 0;
    const overridingSql = overridingSystemValue_ === true ? sql`overriding system value ` : void 0;
    return sql`${withSql}insert into ${table} ${insertOrder} ${overridingSql}${valuesSql}${onConflictSql}${returningSql}`;
  }
  buildRefreshMaterializedViewQuery({ view: view2, concurrently, withNoData }) {
    const concurrentlySql = concurrently ? sql` concurrently` : void 0;
    const withNoDataSql = withNoData ? sql` with no data` : void 0;
    return sql`refresh materialized view${concurrentlySql} ${view2}${withNoDataSql}`;
  }
  prepareTyping(encoder2) {
    if (is(encoder2, PgJsonb) || is(encoder2, PgJson)) {
      return "json";
    } else if (is(encoder2, PgNumeric)) {
      return "decimal";
    } else if (is(encoder2, PgTime)) {
      return "time";
    } else if (is(encoder2, PgTimestamp) || is(encoder2, PgTimestampString)) {
      return "timestamp";
    } else if (is(encoder2, PgDate) || is(encoder2, PgDateString)) {
      return "date";
    } else if (is(encoder2, PgUUID)) {
      return "uuid";
    } else {
      return "none";
    }
  }
  sqlToQuery(sql2, invokeSource) {
    return sql2.toQuery({
      casing: this.casing,
      escapeName: this.escapeName,
      escapeParam: this.escapeParam,
      escapeString: this.escapeString,
      prepareTyping: this.prepareTyping,
      invokeSource
    });
  }
  // buildRelationalQueryWithPK({
  // 	fullSchema,
  // 	schema,
  // 	tableNamesMap,
  // 	table,
  // 	tableConfig,
  // 	queryConfig: config,
  // 	tableAlias,
  // 	isRoot = false,
  // 	joinOn,
  // }: {
  // 	fullSchema: Record<string, unknown>;
  // 	schema: TablesRelationalConfig;
  // 	tableNamesMap: Record<string, string>;
  // 	table: PgTable;
  // 	tableConfig: TableRelationalConfig;
  // 	queryConfig: true | DBQueryConfig<'many', true>;
  // 	tableAlias: string;
  // 	isRoot?: boolean;
  // 	joinOn?: SQL;
  // }): BuildRelationalQueryResult<PgTable, PgColumn> {
  // 	// For { "<relation>": true }, return a table with selection of all columns
  // 	if (config === true) {
  // 		const selectionEntries = Object.entries(tableConfig.columns);
  // 		const selection: BuildRelationalQueryResult<PgTable, PgColumn>['selection'] = selectionEntries.map((
  // 			[key, value],
  // 		) => ({
  // 			dbKey: value.name,
  // 			tsKey: key,
  // 			field: value as PgColumn,
  // 			relationTableTsKey: undefined,
  // 			isJson: false,
  // 			selection: [],
  // 		}));
  // 		return {
  // 			tableTsKey: tableConfig.tsName,
  // 			sql: table,
  // 			selection,
  // 		};
  // 	}
  // 	// let selection: BuildRelationalQueryResult<PgTable, PgColumn>['selection'] = [];
  // 	// let selectionForBuild = selection;
  // 	const aliasedColumns = Object.fromEntries(
  // 		Object.entries(tableConfig.columns).map(([key, value]) => [key, aliasedTableColumn(value, tableAlias)]),
  // 	);
  // 	const aliasedRelations = Object.fromEntries(
  // 		Object.entries(tableConfig.relations).map(([key, value]) => [key, aliasedRelation(value, tableAlias)]),
  // 	);
  // 	const aliasedFields = Object.assign({}, aliasedColumns, aliasedRelations);
  // 	let where, hasUserDefinedWhere;
  // 	if (config.where) {
  // 		const whereSql = typeof config.where === 'function' ? config.where(aliasedFields, operators) : config.where;
  // 		where = whereSql && mapColumnsInSQLToAlias(whereSql, tableAlias);
  // 		hasUserDefinedWhere = !!where;
  // 	}
  // 	where = and(joinOn, where);
  // 	// const fieldsSelection: { tsKey: string; value: PgColumn | SQL.Aliased; isExtra?: boolean }[] = [];
  // 	let joins: Join[] = [];
  // 	let selectedColumns: string[] = [];
  // 	// Figure out which columns to select
  // 	if (config.columns) {
  // 		let isIncludeMode = false;
  // 		for (const [field, value] of Object.entries(config.columns)) {
  // 			if (value === undefined) {
  // 				continue;
  // 			}
  // 			if (field in tableConfig.columns) {
  // 				if (!isIncludeMode && value === true) {
  // 					isIncludeMode = true;
  // 				}
  // 				selectedColumns.push(field);
  // 			}
  // 		}
  // 		if (selectedColumns.length > 0) {
  // 			selectedColumns = isIncludeMode
  // 				? selectedColumns.filter((c) => config.columns?.[c] === true)
  // 				: Object.keys(tableConfig.columns).filter((key) => !selectedColumns.includes(key));
  // 		}
  // 	} else {
  // 		// Select all columns if selection is not specified
  // 		selectedColumns = Object.keys(tableConfig.columns);
  // 	}
  // 	// for (const field of selectedColumns) {
  // 	// 	const column = tableConfig.columns[field]! as PgColumn;
  // 	// 	fieldsSelection.push({ tsKey: field, value: column });
  // 	// }
  // 	let initiallySelectedRelations: {
  // 		tsKey: string;
  // 		queryConfig: true | DBQueryConfig<'many', false>;
  // 		relation: Relation;
  // 	}[] = [];
  // 	// let selectedRelations: BuildRelationalQueryResult<PgTable, PgColumn>['selection'] = [];
  // 	// Figure out which relations to select
  // 	if (config.with) {
  // 		initiallySelectedRelations = Object.entries(config.with)
  // 			.filter((entry): entry is [typeof entry[0], NonNullable<typeof entry[1]>] => !!entry[1])
  // 			.map(([tsKey, queryConfig]) => ({ tsKey, queryConfig, relation: tableConfig.relations[tsKey]! }));
  // 	}
  // 	const manyRelations = initiallySelectedRelations.filter((r) =>
  // 		is(r.relation, Many)
  // 		&& (schema[tableNamesMap[r.relation.referencedTable[Table.Symbol.Name]]!]?.primaryKey.length ?? 0) > 0
  // 	);
  // 	// If this is the last Many relation (or there are no Many relations), we are on the innermost subquery level
  // 	const isInnermostQuery = manyRelations.length < 2;
  // 	const selectedExtras: {
  // 		tsKey: string;
  // 		value: SQL.Aliased;
  // 	}[] = [];
  // 	// Figure out which extras to select
  // 	if (isInnermostQuery && config.extras) {
  // 		const extras = typeof config.extras === 'function'
  // 			? config.extras(aliasedFields, { sql })
  // 			: config.extras;
  // 		for (const [tsKey, value] of Object.entries(extras)) {
  // 			selectedExtras.push({
  // 				tsKey,
  // 				value: mapColumnsInAliasedSQLToAlias(value, tableAlias),
  // 			});
  // 		}
  // 	}
  // 	// Transform `fieldsSelection` into `selection`
  // 	// `fieldsSelection` shouldn't be used after this point
  // 	// for (const { tsKey, value, isExtra } of fieldsSelection) {
  // 	// 	selection.push({
  // 	// 		dbKey: is(value, SQL.Aliased) ? value.fieldAlias : tableConfig.columns[tsKey]!.name,
  // 	// 		tsKey,
  // 	// 		field: is(value, Column) ? aliasedTableColumn(value, tableAlias) : value,
  // 	// 		relationTableTsKey: undefined,
  // 	// 		isJson: false,
  // 	// 		isExtra,
  // 	// 		selection: [],
  // 	// 	});
  // 	// }
  // 	let orderByOrig = typeof config.orderBy === 'function'
  // 		? config.orderBy(aliasedFields, orderByOperators)
  // 		: config.orderBy ?? [];
  // 	if (!Array.isArray(orderByOrig)) {
  // 		orderByOrig = [orderByOrig];
  // 	}
  // 	const orderBy = orderByOrig.map((orderByValue) => {
  // 		if (is(orderByValue, Column)) {
  // 			return aliasedTableColumn(orderByValue, tableAlias) as PgColumn;
  // 		}
  // 		return mapColumnsInSQLToAlias(orderByValue, tableAlias);
  // 	});
  // 	const limit = isInnermostQuery ? config.limit : undefined;
  // 	const offset = isInnermostQuery ? config.offset : undefined;
  // 	// For non-root queries without additional config except columns, return a table with selection
  // 	if (
  // 		!isRoot
  // 		&& initiallySelectedRelations.length === 0
  // 		&& selectedExtras.length === 0
  // 		&& !where
  // 		&& orderBy.length === 0
  // 		&& limit === undefined
  // 		&& offset === undefined
  // 	) {
  // 		return {
  // 			tableTsKey: tableConfig.tsName,
  // 			sql: table,
  // 			selection: selectedColumns.map((key) => ({
  // 				dbKey: tableConfig.columns[key]!.name,
  // 				tsKey: key,
  // 				field: tableConfig.columns[key] as PgColumn,
  // 				relationTableTsKey: undefined,
  // 				isJson: false,
  // 				selection: [],
  // 			})),
  // 		};
  // 	}
  // 	const selectedRelationsWithoutPK:
  // 	// Process all relations without primary keys, because they need to be joined differently and will all be on the same query level
  // 	for (
  // 		const {
  // 			tsKey: selectedRelationTsKey,
  // 			queryConfig: selectedRelationConfigValue,
  // 			relation,
  // 		} of initiallySelectedRelations
  // 	) {
  // 		const normalizedRelation = normalizeRelation(schema, tableNamesMap, relation);
  // 		const relationTableName = relation.referencedTable[Table.Symbol.Name];
  // 		const relationTableTsName = tableNamesMap[relationTableName]!;
  // 		const relationTable = schema[relationTableTsName]!;
  // 		if (relationTable.primaryKey.length > 0) {
  // 			continue;
  // 		}
  // 		const relationTableAlias = `${tableAlias}_${selectedRelationTsKey}`;
  // 		const joinOn = and(
  // 			...normalizedRelation.fields.map((field, i) =>
  // 				eq(
  // 					aliasedTableColumn(normalizedRelation.references[i]!, relationTableAlias),
  // 					aliasedTableColumn(field, tableAlias),
  // 				)
  // 			),
  // 		);
  // 		const builtRelation = this.buildRelationalQueryWithoutPK({
  // 			fullSchema,
  // 			schema,
  // 			tableNamesMap,
  // 			table: fullSchema[relationTableTsName] as PgTable,
  // 			tableConfig: schema[relationTableTsName]!,
  // 			queryConfig: selectedRelationConfigValue,
  // 			tableAlias: relationTableAlias,
  // 			joinOn,
  // 			nestedQueryRelation: relation,
  // 		});
  // 		const field = sql`${sql.identifier(relationTableAlias)}.${sql.identifier('data')}`.as(selectedRelationTsKey);
  // 		joins.push({
  // 			on: sql`true`,
  // 			table: new Subquery(builtRelation.sql as SQL, {}, relationTableAlias),
  // 			alias: relationTableAlias,
  // 			joinType: 'left',
  // 			lateral: true,
  // 		});
  // 		selectedRelations.push({
  // 			dbKey: selectedRelationTsKey,
  // 			tsKey: selectedRelationTsKey,
  // 			field,
  // 			relationTableTsKey: relationTableTsName,
  // 			isJson: true,
  // 			selection: builtRelation.selection,
  // 		});
  // 	}
  // 	const oneRelations = initiallySelectedRelations.filter((r): r is typeof r & { relation: One } =>
  // 		is(r.relation, One)
  // 	);
  // 	// Process all One relations with PKs, because they can all be joined on the same level
  // 	for (
  // 		const {
  // 			tsKey: selectedRelationTsKey,
  // 			queryConfig: selectedRelationConfigValue,
  // 			relation,
  // 		} of oneRelations
  // 	) {
  // 		const normalizedRelation = normalizeRelation(schema, tableNamesMap, relation);
  // 		const relationTableName = relation.referencedTable[Table.Symbol.Name];
  // 		const relationTableTsName = tableNamesMap[relationTableName]!;
  // 		const relationTableAlias = `${tableAlias}_${selectedRelationTsKey}`;
  // 		const relationTable = schema[relationTableTsName]!;
  // 		if (relationTable.primaryKey.length === 0) {
  // 			continue;
  // 		}
  // 		const joinOn = and(
  // 			...normalizedRelation.fields.map((field, i) =>
  // 				eq(
  // 					aliasedTableColumn(normalizedRelation.references[i]!, relationTableAlias),
  // 					aliasedTableColumn(field, tableAlias),
  // 				)
  // 			),
  // 		);
  // 		const builtRelation = this.buildRelationalQueryWithPK({
  // 			fullSchema,
  // 			schema,
  // 			tableNamesMap,
  // 			table: fullSchema[relationTableTsName] as PgTable,
  // 			tableConfig: schema[relationTableTsName]!,
  // 			queryConfig: selectedRelationConfigValue,
  // 			tableAlias: relationTableAlias,
  // 			joinOn,
  // 		});
  // 		const field = sql`case when ${sql.identifier(relationTableAlias)} is null then null else json_build_array(${
  // 			sql.join(
  // 				builtRelation.selection.map(({ field }) =>
  // 					is(field, SQL.Aliased)
  // 						? sql`${sql.identifier(relationTableAlias)}.${sql.identifier(field.fieldAlias)}`
  // 						: is(field, Column)
  // 						? aliasedTableColumn(field, relationTableAlias)
  // 						: field
  // 				),
  // 				sql`, `,
  // 			)
  // 		}) end`.as(selectedRelationTsKey);
  // 		const isLateralJoin = is(builtRelation.sql, SQL);
  // 		joins.push({
  // 			on: isLateralJoin ? sql`true` : joinOn,
  // 			table: is(builtRelation.sql, SQL)
  // 				? new Subquery(builtRelation.sql, {}, relationTableAlias)
  // 				: aliasedTable(builtRelation.sql, relationTableAlias),
  // 			alias: relationTableAlias,
  // 			joinType: 'left',
  // 			lateral: is(builtRelation.sql, SQL),
  // 		});
  // 		selectedRelations.push({
  // 			dbKey: selectedRelationTsKey,
  // 			tsKey: selectedRelationTsKey,
  // 			field,
  // 			relationTableTsKey: relationTableTsName,
  // 			isJson: true,
  // 			selection: builtRelation.selection,
  // 		});
  // 	}
  // 	let distinct: PgSelectConfig['distinct'];
  // 	let tableFrom: PgTable | Subquery = table;
  // 	// Process first Many relation - each one requires a nested subquery
  // 	const manyRelation = manyRelations[0];
  // 	if (manyRelation) {
  // 		const {
  // 			tsKey: selectedRelationTsKey,
  // 			queryConfig: selectedRelationQueryConfig,
  // 			relation,
  // 		} = manyRelation;
  // 		distinct = {
  // 			on: tableConfig.primaryKey.map((c) => aliasedTableColumn(c as PgColumn, tableAlias)),
  // 		};
  // 		const normalizedRelation = normalizeRelation(schema, tableNamesMap, relation);
  // 		const relationTableName = relation.referencedTable[Table.Symbol.Name];
  // 		const relationTableTsName = tableNamesMap[relationTableName]!;
  // 		const relationTableAlias = `${tableAlias}_${selectedRelationTsKey}`;
  // 		const joinOn = and(
  // 			...normalizedRelation.fields.map((field, i) =>
  // 				eq(
  // 					aliasedTableColumn(normalizedRelation.references[i]!, relationTableAlias),
  // 					aliasedTableColumn(field, tableAlias),
  // 				)
  // 			),
  // 		);
  // 		const builtRelationJoin = this.buildRelationalQueryWithPK({
  // 			fullSchema,
  // 			schema,
  // 			tableNamesMap,
  // 			table: fullSchema[relationTableTsName] as PgTable,
  // 			tableConfig: schema[relationTableTsName]!,
  // 			queryConfig: selectedRelationQueryConfig,
  // 			tableAlias: relationTableAlias,
  // 			joinOn,
  // 		});
  // 		const builtRelationSelectionField = sql`case when ${
  // 			sql.identifier(relationTableAlias)
  // 		} is null then '[]' else json_agg(json_build_array(${
  // 			sql.join(
  // 				builtRelationJoin.selection.map(({ field }) =>
  // 					is(field, SQL.Aliased)
  // 						? sql`${sql.identifier(relationTableAlias)}.${sql.identifier(field.fieldAlias)}`
  // 						: is(field, Column)
  // 						? aliasedTableColumn(field, relationTableAlias)
  // 						: field
  // 				),
  // 				sql`, `,
  // 			)
  // 		})) over (partition by ${sql.join(distinct.on, sql`, `)}) end`.as(selectedRelationTsKey);
  // 		const isLateralJoin = is(builtRelationJoin.sql, SQL);
  // 		joins.push({
  // 			on: isLateralJoin ? sql`true` : joinOn,
  // 			table: isLateralJoin
  // 				? new Subquery(builtRelationJoin.sql as SQL, {}, relationTableAlias)
  // 				: aliasedTable(builtRelationJoin.sql as PgTable, relationTableAlias),
  // 			alias: relationTableAlias,
  // 			joinType: 'left',
  // 			lateral: isLateralJoin,
  // 		});
  // 		// Build the "from" subquery with the remaining Many relations
  // 		const builtTableFrom = this.buildRelationalQueryWithPK({
  // 			fullSchema,
  // 			schema,
  // 			tableNamesMap,
  // 			table,
  // 			tableConfig,
  // 			queryConfig: {
  // 				...config,
  // 				where: undefined,
  // 				orderBy: undefined,
  // 				limit: undefined,
  // 				offset: undefined,
  // 				with: manyRelations.slice(1).reduce<NonNullable<typeof config['with']>>(
  // 					(result, { tsKey, queryConfig: configValue }) => {
  // 						result[tsKey] = configValue;
  // 						return result;
  // 					},
  // 					{},
  // 				),
  // 			},
  // 			tableAlias,
  // 		});
  // 		selectedRelations.push({
  // 			dbKey: selectedRelationTsKey,
  // 			tsKey: selectedRelationTsKey,
  // 			field: builtRelationSelectionField,
  // 			relationTableTsKey: relationTableTsName,
  // 			isJson: true,
  // 			selection: builtRelationJoin.selection,
  // 		});
  // 		// selection = builtTableFrom.selection.map((item) =>
  // 		// 	is(item.field, SQL.Aliased)
  // 		// 		? { ...item, field: sql`${sql.identifier(tableAlias)}.${sql.identifier(item.field.fieldAlias)}` }
  // 		// 		: item
  // 		// );
  // 		// selectionForBuild = [{
  // 		// 	dbKey: '*',
  // 		// 	tsKey: '*',
  // 		// 	field: sql`${sql.identifier(tableAlias)}.*`,
  // 		// 	selection: [],
  // 		// 	isJson: false,
  // 		// 	relationTableTsKey: undefined,
  // 		// }];
  // 		// const newSelectionItem: (typeof selection)[number] = {
  // 		// 	dbKey: selectedRelationTsKey,
  // 		// 	tsKey: selectedRelationTsKey,
  // 		// 	field,
  // 		// 	relationTableTsKey: relationTableTsName,
  // 		// 	isJson: true,
  // 		// 	selection: builtRelationJoin.selection,
  // 		// };
  // 		// selection.push(newSelectionItem);
  // 		// selectionForBuild.push(newSelectionItem);
  // 		tableFrom = is(builtTableFrom.sql, PgTable)
  // 			? builtTableFrom.sql
  // 			: new Subquery(builtTableFrom.sql, {}, tableAlias);
  // 	}
  // 	if (selectedColumns.length === 0 && selectedRelations.length === 0 && selectedExtras.length === 0) {
  // 		throw new DrizzleError(`No fields selected for table "${tableConfig.tsName}" ("${tableAlias}")`);
  // 	}
  // 	let selection: BuildRelationalQueryResult<PgTable, PgColumn>['selection'];
  // 	function prepareSelectedColumns() {
  // 		return selectedColumns.map((key) => ({
  // 			dbKey: tableConfig.columns[key]!.name,
  // 			tsKey: key,
  // 			field: tableConfig.columns[key] as PgColumn,
  // 			relationTableTsKey: undefined,
  // 			isJson: false,
  // 			selection: [],
  // 		}));
  // 	}
  // 	function prepareSelectedExtras() {
  // 		return selectedExtras.map((item) => ({
  // 			dbKey: item.value.fieldAlias,
  // 			tsKey: item.tsKey,
  // 			field: item.value,
  // 			relationTableTsKey: undefined,
  // 			isJson: false,
  // 			selection: [],
  // 		}));
  // 	}
  // 	if (isRoot) {
  // 		selection = [
  // 			...prepareSelectedColumns(),
  // 			...prepareSelectedExtras(),
  // 		];
  // 	}
  // 	if (hasUserDefinedWhere || orderBy.length > 0) {
  // 		tableFrom = new Subquery(
  // 			this.buildSelectQuery({
  // 				table: is(tableFrom, PgTable) ? aliasedTable(tableFrom, tableAlias) : tableFrom,
  // 				fields: {},
  // 				fieldsFlat: selectionForBuild.map(({ field }) => ({
  // 					path: [],
  // 					field: is(field, Column) ? aliasedTableColumn(field, tableAlias) : field,
  // 				})),
  // 				joins,
  // 				distinct,
  // 			}),
  // 			{},
  // 			tableAlias,
  // 		);
  // 		selectionForBuild = selection.map((item) =>
  // 			is(item.field, SQL.Aliased)
  // 				? { ...item, field: sql`${sql.identifier(tableAlias)}.${sql.identifier(item.field.fieldAlias)}` }
  // 				: item
  // 		);
  // 		joins = [];
  // 		distinct = undefined;
  // 	}
  // 	const result = this.buildSelectQuery({
  // 		table: is(tableFrom, PgTable) ? aliasedTable(tableFrom, tableAlias) : tableFrom,
  // 		fields: {},
  // 		fieldsFlat: selectionForBuild.map(({ field }) => ({
  // 			path: [],
  // 			field: is(field, Column) ? aliasedTableColumn(field, tableAlias) : field,
  // 		})),
  // 		where,
  // 		limit,
  // 		offset,
  // 		joins,
  // 		orderBy,
  // 		distinct,
  // 	});
  // 	return {
  // 		tableTsKey: tableConfig.tsName,
  // 		sql: result,
  // 		selection,
  // 	};
  // }
  buildRelationalQueryWithoutPK({
    fullSchema,
    schema,
    tableNamesMap,
    table,
    tableConfig,
    queryConfig: config,
    tableAlias,
    nestedQueryRelation,
    joinOn
  }) {
    let selection = [];
    let limit3, offset, orderBy = [], where;
    const joins = [];
    if (config === true) {
      const selectionEntries = Object.entries(tableConfig.columns);
      selection = selectionEntries.map(([key2, value2]) => ({
        dbKey: value2.name,
        tsKey: key2,
        field: aliasedTableColumn(value2, tableAlias),
        relationTableTsKey: void 0,
        isJson: false,
        selection: []
      }));
    } else {
      const aliasedColumns = Object.fromEntries(
        Object.entries(tableConfig.columns).map(([key2, value2]) => [key2, aliasedTableColumn(value2, tableAlias)])
      );
      if (config.where) {
        const whereSql = typeof config.where === "function" ? config.where(aliasedColumns, getOperators()) : config.where;
        where = whereSql && mapColumnsInSQLToAlias(whereSql, tableAlias);
      }
      const fieldsSelection = [];
      let selectedColumns = [];
      if (config.columns) {
        let isIncludeMode = false;
        for (const [field2, value2] of Object.entries(config.columns)) {
          if (value2 === void 0) {
            continue;
          }
          if (field2 in tableConfig.columns) {
            if (!isIncludeMode && value2 === true) {
              isIncludeMode = true;
            }
            selectedColumns.push(field2);
          }
        }
        if (selectedColumns.length > 0) {
          selectedColumns = isIncludeMode ? selectedColumns.filter((c2) => config.columns?.[c2] === true) : Object.keys(tableConfig.columns).filter((key2) => !selectedColumns.includes(key2));
        }
      } else {
        selectedColumns = Object.keys(tableConfig.columns);
      }
      for (const field2 of selectedColumns) {
        const column2 = tableConfig.columns[field2];
        fieldsSelection.push({ tsKey: field2, value: column2 });
      }
      let selectedRelations = [];
      if (config.with) {
        selectedRelations = Object.entries(config.with).filter((entry) => !!entry[1]).map(([tsKey, queryConfig]) => ({ tsKey, queryConfig, relation: tableConfig.relations[tsKey] }));
      }
      let extras;
      if (config.extras) {
        extras = typeof config.extras === "function" ? config.extras(aliasedColumns, { sql }) : config.extras;
        for (const [tsKey, value2] of Object.entries(extras)) {
          fieldsSelection.push({
            tsKey,
            value: mapColumnsInAliasedSQLToAlias(value2, tableAlias)
          });
        }
      }
      for (const { tsKey, value: value2 } of fieldsSelection) {
        selection.push({
          dbKey: is(value2, SQL.Aliased) ? value2.fieldAlias : tableConfig.columns[tsKey].name,
          tsKey,
          field: is(value2, Column) ? aliasedTableColumn(value2, tableAlias) : value2,
          relationTableTsKey: void 0,
          isJson: false,
          selection: []
        });
      }
      let orderByOrig = typeof config.orderBy === "function" ? config.orderBy(aliasedColumns, getOrderByOperators()) : config.orderBy ?? [];
      if (!Array.isArray(orderByOrig)) {
        orderByOrig = [orderByOrig];
      }
      orderBy = orderByOrig.map((orderByValue) => {
        if (is(orderByValue, Column)) {
          return aliasedTableColumn(orderByValue, tableAlias);
        }
        return mapColumnsInSQLToAlias(orderByValue, tableAlias);
      });
      limit3 = config.limit;
      offset = config.offset;
      for (const {
        tsKey: selectedRelationTsKey,
        queryConfig: selectedRelationConfigValue,
        relation
      } of selectedRelations) {
        const normalizedRelation = normalizeRelation(schema, tableNamesMap, relation);
        const relationTableName = getTableUniqueName(relation.referencedTable);
        const relationTableTsName = tableNamesMap[relationTableName];
        const relationTableAlias = `${tableAlias}_${selectedRelationTsKey}`;
        const joinOn2 = and(
          ...normalizedRelation.fields.map(
            (field22, i) => eq(
              aliasedTableColumn(normalizedRelation.references[i], relationTableAlias),
              aliasedTableColumn(field22, tableAlias)
            )
          )
        );
        const builtRelation = this.buildRelationalQueryWithoutPK({
          fullSchema,
          schema,
          tableNamesMap,
          table: fullSchema[relationTableTsName],
          tableConfig: schema[relationTableTsName],
          queryConfig: is(relation, One) ? selectedRelationConfigValue === true ? { limit: 1 } : { ...selectedRelationConfigValue, limit: 1 } : selectedRelationConfigValue,
          tableAlias: relationTableAlias,
          joinOn: joinOn2,
          nestedQueryRelation: relation
        });
        const field2 = sql`${sql.identifier(relationTableAlias)}.${sql.identifier("data")}`.as(selectedRelationTsKey);
        joins.push({
          on: sql`true`,
          table: new Subquery(builtRelation.sql, {}, relationTableAlias),
          alias: relationTableAlias,
          joinType: "left",
          lateral: true
        });
        selection.push({
          dbKey: selectedRelationTsKey,
          tsKey: selectedRelationTsKey,
          field: field2,
          relationTableTsKey: relationTableTsName,
          isJson: true,
          selection: builtRelation.selection
        });
      }
    }
    if (selection.length === 0) {
      throw new DrizzleError({ message: `No fields selected for table "${tableConfig.tsName}" ("${tableAlias}")` });
    }
    let result;
    where = and(joinOn, where);
    if (nestedQueryRelation) {
      let field2 = sql`json_build_array(${sql.join(
        selection.map(
          ({ field: field22, tsKey, isJson }) => isJson ? sql`${sql.identifier(`${tableAlias}_${tsKey}`)}.${sql.identifier("data")}` : is(field22, SQL.Aliased) ? field22.sql : field22
        ),
        sql`, `
      )})`;
      if (is(nestedQueryRelation, Many)) {
        field2 = sql`coalesce(json_agg(${field2}${orderBy.length > 0 ? sql` order by ${sql.join(orderBy, sql`, `)}` : void 0}), '[]'::json)`;
      }
      const nestedSelection = [{
        dbKey: "data",
        tsKey: "data",
        field: field2.as("data"),
        isJson: true,
        relationTableTsKey: tableConfig.tsName,
        selection
      }];
      const needsSubquery = limit3 !== void 0 || offset !== void 0 || orderBy.length > 0;
      if (needsSubquery) {
        result = this.buildSelectQuery({
          table: aliasedTable(table, tableAlias),
          fields: {},
          fieldsFlat: [{
            path: [],
            field: sql.raw("*")
          }],
          where,
          limit: limit3,
          offset,
          orderBy,
          setOperators: []
        });
        where = void 0;
        limit3 = void 0;
        offset = void 0;
        orderBy = [];
      } else {
        result = aliasedTable(table, tableAlias);
      }
      result = this.buildSelectQuery({
        table: is(result, PgTable) ? result : new Subquery(result, {}, tableAlias),
        fields: {},
        fieldsFlat: nestedSelection.map(({ field: field22 }) => ({
          path: [],
          field: is(field22, Column) ? aliasedTableColumn(field22, tableAlias) : field22
        })),
        joins,
        where,
        limit: limit3,
        offset,
        orderBy,
        setOperators: []
      });
    } else {
      result = this.buildSelectQuery({
        table: aliasedTable(table, tableAlias),
        fields: {},
        fieldsFlat: selection.map(({ field: field2 }) => ({
          path: [],
          field: is(field2, Column) ? aliasedTableColumn(field2, tableAlias) : field2
        })),
        joins,
        where,
        limit: limit3,
        offset,
        orderBy,
        setOperators: []
      });
    }
    return {
      tableTsKey: tableConfig.tsName,
      sql: result,
      selection
    };
  }
};

// node_modules/drizzle-orm/query-builders/query-builder.js
var TypedQueryBuilder = class {
  static [entityKind] = "TypedQueryBuilder";
  /** @internal */
  getSelectedFields() {
    return this._.selectedFields;
  }
};

// node_modules/drizzle-orm/pg-core/query-builders/select.js
var PgSelectBuilder = class {
  static [entityKind] = "PgSelectBuilder";
  fields;
  session;
  dialect;
  withList = [];
  distinct;
  constructor(config) {
    this.fields = config.fields;
    this.session = config.session;
    this.dialect = config.dialect;
    if (config.withList) {
      this.withList = config.withList;
    }
    this.distinct = config.distinct;
  }
  authToken;
  /** @internal */
  setToken(token) {
    this.authToken = token;
    return this;
  }
  /**
   * Specify the table, subquery, or other target that you're
   * building a select query against.
   *
   * {@link https://www.postgresql.org/docs/current/sql-select.html#SQL-FROM | Postgres from documentation}
   */
  from(source) {
    const isPartialSelect = !!this.fields;
    const src = source;
    let fields;
    if (this.fields) {
      fields = this.fields;
    } else if (is(src, Subquery)) {
      fields = Object.fromEntries(
        Object.keys(src._.selectedFields).map((key2) => [key2, src[key2]])
      );
    } else if (is(src, PgViewBase)) {
      fields = src[ViewBaseConfig].selectedFields;
    } else if (is(src, SQL)) {
      fields = {};
    } else {
      fields = getTableColumns(src);
    }
    return new PgSelectBase({
      table: src,
      fields,
      isPartialSelect,
      session: this.session,
      dialect: this.dialect,
      withList: this.withList,
      distinct: this.distinct
    }).setToken(this.authToken);
  }
};
var PgSelectQueryBuilderBase = class extends TypedQueryBuilder {
  static [entityKind] = "PgSelectQueryBuilder";
  _;
  config;
  joinsNotNullableMap;
  tableName;
  isPartialSelect;
  session;
  dialect;
  cacheConfig = void 0;
  usedTables = /* @__PURE__ */ new Set();
  constructor({ table, fields, isPartialSelect, session, dialect, withList, distinct }) {
    super();
    this.config = {
      withList,
      table,
      fields: { ...fields },
      distinct,
      setOperators: []
    };
    this.isPartialSelect = isPartialSelect;
    this.session = session;
    this.dialect = dialect;
    this._ = {
      selectedFields: fields,
      config: this.config
    };
    this.tableName = getTableLikeName(table);
    this.joinsNotNullableMap = typeof this.tableName === "string" ? { [this.tableName]: true } : {};
    for (const item of extractUsedTable(table)) this.usedTables.add(item);
  }
  /** @internal */
  getUsedTables() {
    return [...this.usedTables];
  }
  createJoin(joinType, lateral) {
    return (table, on) => {
      const baseTableName = this.tableName;
      const tableName = getTableLikeName(table);
      for (const item of extractUsedTable(table)) this.usedTables.add(item);
      if (typeof tableName === "string" && this.config.joins?.some((join) => join.alias === tableName)) {
        throw new Error(`Alias "${tableName}" is already used in this query`);
      }
      if (!this.isPartialSelect) {
        if (Object.keys(this.joinsNotNullableMap).length === 1 && typeof baseTableName === "string") {
          this.config.fields = {
            [baseTableName]: this.config.fields
          };
        }
        if (typeof tableName === "string" && !is(table, SQL)) {
          const selection = is(table, Subquery) ? table._.selectedFields : is(table, View) ? table[ViewBaseConfig].selectedFields : table[Table.Symbol.Columns];
          this.config.fields[tableName] = selection;
        }
      }
      if (typeof on === "function") {
        on = on(
          new Proxy(
            this.config.fields,
            new SelectionProxyHandler({ sqlAliasedBehavior: "sql", sqlBehavior: "sql" })
          )
        );
      }
      if (!this.config.joins) {
        this.config.joins = [];
      }
      this.config.joins.push({ on, table, joinType, alias: tableName, lateral });
      if (typeof tableName === "string") {
        switch (joinType) {
          case "left": {
            this.joinsNotNullableMap[tableName] = false;
            break;
          }
          case "right": {
            this.joinsNotNullableMap = Object.fromEntries(
              Object.entries(this.joinsNotNullableMap).map(([key2]) => [key2, false])
            );
            this.joinsNotNullableMap[tableName] = true;
            break;
          }
          case "cross":
          case "inner": {
            this.joinsNotNullableMap[tableName] = true;
            break;
          }
          case "full": {
            this.joinsNotNullableMap = Object.fromEntries(
              Object.entries(this.joinsNotNullableMap).map(([key2]) => [key2, false])
            );
            this.joinsNotNullableMap[tableName] = false;
            break;
          }
        }
      }
      return this;
    };
  }
  /**
   * Executes a `left join` operation by adding another table to the current query.
   *
   * Calling this method associates each row of the table with the corresponding row from the joined table, if a match is found. If no matching row exists, it sets all columns of the joined table to null.
   *
   * See docs: {@link https://orm.drizzle.team/docs/joins#left-join}
   *
   * @param table the table to join.
   * @param on the `on` clause.
   *
   * @example
   *
   * ```ts
   * // Select all users and their pets
   * const usersWithPets: { user: User; pets: Pet | null; }[] = await db.select()
   *   .from(users)
   *   .leftJoin(pets, eq(users.id, pets.ownerId))
   *
   * // Select userId and petId
   * const usersIdsAndPetIds: { userId: number; petId: number | null; }[] = await db.select({
   *   userId: users.id,
   *   petId: pets.id,
   * })
   *   .from(users)
   *   .leftJoin(pets, eq(users.id, pets.ownerId))
   * ```
   */
  leftJoin = this.createJoin("left", false);
  /**
   * Executes a `left join lateral` operation by adding subquery to the current query.
   *
   * A `lateral` join allows the right-hand expression to refer to columns from the left-hand side.
   *
   * Calling this method associates each row of the table with the corresponding row from the joined table, if a match is found. If no matching row exists, it sets all columns of the joined table to null.
   *
   * See docs: {@link https://orm.drizzle.team/docs/joins#left-join-lateral}
   *
   * @param table the subquery to join.
   * @param on the `on` clause.
   */
  leftJoinLateral = this.createJoin("left", true);
  /**
   * Executes a `right join` operation by adding another table to the current query.
   *
   * Calling this method associates each row of the joined table with the corresponding row from the main table, if a match is found. If no matching row exists, it sets all columns of the main table to null.
   *
   * See docs: {@link https://orm.drizzle.team/docs/joins#right-join}
   *
   * @param table the table to join.
   * @param on the `on` clause.
   *
   * @example
   *
   * ```ts
   * // Select all users and their pets
   * const usersWithPets: { user: User | null; pets: Pet; }[] = await db.select()
   *   .from(users)
   *   .rightJoin(pets, eq(users.id, pets.ownerId))
   *
   * // Select userId and petId
   * const usersIdsAndPetIds: { userId: number | null; petId: number; }[] = await db.select({
   *   userId: users.id,
   *   petId: pets.id,
   * })
   *   .from(users)
   *   .rightJoin(pets, eq(users.id, pets.ownerId))
   * ```
   */
  rightJoin = this.createJoin("right", false);
  /**
   * Executes an `inner join` operation, creating a new table by combining rows from two tables that have matching values.
   *
   * Calling this method retrieves rows that have corresponding entries in both joined tables. Rows without matching entries in either table are excluded, resulting in a table that includes only matching pairs.
   *
   * See docs: {@link https://orm.drizzle.team/docs/joins#inner-join}
   *
   * @param table the table to join.
   * @param on the `on` clause.
   *
   * @example
   *
   * ```ts
   * // Select all users and their pets
   * const usersWithPets: { user: User; pets: Pet; }[] = await db.select()
   *   .from(users)
   *   .innerJoin(pets, eq(users.id, pets.ownerId))
   *
   * // Select userId and petId
   * const usersIdsAndPetIds: { userId: number; petId: number; }[] = await db.select({
   *   userId: users.id,
   *   petId: pets.id,
   * })
   *   .from(users)
   *   .innerJoin(pets, eq(users.id, pets.ownerId))
   * ```
   */
  innerJoin = this.createJoin("inner", false);
  /**
   * Executes an `inner join lateral` operation, creating a new table by combining rows from two queries that have matching values.
   *
   * A `lateral` join allows the right-hand expression to refer to columns from the left-hand side.
   *
   * Calling this method retrieves rows that have corresponding entries in both joined tables. Rows without matching entries in either table are excluded, resulting in a table that includes only matching pairs.
   *
   * See docs: {@link https://orm.drizzle.team/docs/joins#inner-join-lateral}
   *
   * @param table the subquery to join.
   * @param on the `on` clause.
   */
  innerJoinLateral = this.createJoin("inner", true);
  /**
   * Executes a `full join` operation by combining rows from two tables into a new table.
   *
   * Calling this method retrieves all rows from both main and joined tables, merging rows with matching values and filling in `null` for non-matching columns.
   *
   * See docs: {@link https://orm.drizzle.team/docs/joins#full-join}
   *
   * @param table the table to join.
   * @param on the `on` clause.
   *
   * @example
   *
   * ```ts
   * // Select all users and their pets
   * const usersWithPets: { user: User | null; pets: Pet | null; }[] = await db.select()
   *   .from(users)
   *   .fullJoin(pets, eq(users.id, pets.ownerId))
   *
   * // Select userId and petId
   * const usersIdsAndPetIds: { userId: number | null; petId: number | null; }[] = await db.select({
   *   userId: users.id,
   *   petId: pets.id,
   * })
   *   .from(users)
   *   .fullJoin(pets, eq(users.id, pets.ownerId))
   * ```
   */
  fullJoin = this.createJoin("full", false);
  /**
   * Executes a `cross join` operation by combining rows from two tables into a new table.
   *
   * Calling this method retrieves all rows from both main and joined tables, merging all rows from each table.
   *
   * See docs: {@link https://orm.drizzle.team/docs/joins#cross-join}
   *
   * @param table the table to join.
   *
   * @example
   *
   * ```ts
   * // Select all users, each user with every pet
   * const usersWithPets: { user: User; pets: Pet; }[] = await db.select()
   *   .from(users)
   *   .crossJoin(pets)
   *
   * // Select userId and petId
   * const usersIdsAndPetIds: { userId: number; petId: number; }[] = await db.select({
   *   userId: users.id,
   *   petId: pets.id,
   * })
   *   .from(users)
   *   .crossJoin(pets)
   * ```
   */
  crossJoin = this.createJoin("cross", false);
  /**
   * Executes a `cross join lateral` operation by combining rows from two queries into a new table.
   *
   * A `lateral` join allows the right-hand expression to refer to columns from the left-hand side.
   *
   * Calling this method retrieves all rows from both main and joined queries, merging all rows from each query.
   *
   * See docs: {@link https://orm.drizzle.team/docs/joins#cross-join-lateral}
   *
   * @param table the query to join.
   */
  crossJoinLateral = this.createJoin("cross", true);
  createSetOperator(type, isAll) {
    return (rightSelection) => {
      const rightSelect = typeof rightSelection === "function" ? rightSelection(getPgSetOperators()) : rightSelection;
      if (!haveSameKeys(this.getSelectedFields(), rightSelect.getSelectedFields())) {
        throw new Error(
          "Set operator error (union / intersect / except): selected fields are not the same or are in a different order"
        );
      }
      this.config.setOperators.push({ type, isAll, rightSelect });
      return this;
    };
  }
  /**
   * Adds `union` set operator to the query.
   *
   * Calling this method will combine the result sets of the `select` statements and remove any duplicate rows that appear across them.
   *
   * See docs: {@link https://orm.drizzle.team/docs/set-operations#union}
   *
   * @example
   *
   * ```ts
   * // Select all unique names from customers and users tables
   * await db.select({ name: users.name })
   *   .from(users)
   *   .union(
   *     db.select({ name: customers.name }).from(customers)
   *   );
   * // or
   * import { union } from 'drizzle-orm/pg-core'
   *
   * await union(
   *   db.select({ name: users.name }).from(users),
   *   db.select({ name: customers.name }).from(customers)
   * );
   * ```
   */
  union = this.createSetOperator("union", false);
  /**
   * Adds `union all` set operator to the query.
   *
   * Calling this method will combine the result-set of the `select` statements and keep all duplicate rows that appear across them.
   *
   * See docs: {@link https://orm.drizzle.team/docs/set-operations#union-all}
   *
   * @example
   *
   * ```ts
   * // Select all transaction ids from both online and in-store sales
   * await db.select({ transaction: onlineSales.transactionId })
   *   .from(onlineSales)
   *   .unionAll(
   *     db.select({ transaction: inStoreSales.transactionId }).from(inStoreSales)
   *   );
   * // or
   * import { unionAll } from 'drizzle-orm/pg-core'
   *
   * await unionAll(
   *   db.select({ transaction: onlineSales.transactionId }).from(onlineSales),
   *   db.select({ transaction: inStoreSales.transactionId }).from(inStoreSales)
   * );
   * ```
   */
  unionAll = this.createSetOperator("union", true);
  /**
   * Adds `intersect` set operator to the query.
   *
   * Calling this method will retain only the rows that are present in both result sets and eliminate duplicates.
   *
   * See docs: {@link https://orm.drizzle.team/docs/set-operations#intersect}
   *
   * @example
   *
   * ```ts
   * // Select course names that are offered in both departments A and B
   * await db.select({ courseName: depA.courseName })
   *   .from(depA)
   *   .intersect(
   *     db.select({ courseName: depB.courseName }).from(depB)
   *   );
   * // or
   * import { intersect } from 'drizzle-orm/pg-core'
   *
   * await intersect(
   *   db.select({ courseName: depA.courseName }).from(depA),
   *   db.select({ courseName: depB.courseName }).from(depB)
   * );
   * ```
   */
  intersect = this.createSetOperator("intersect", false);
  /**
   * Adds `intersect all` set operator to the query.
   *
   * Calling this method will retain only the rows that are present in both result sets including all duplicates.
   *
   * See docs: {@link https://orm.drizzle.team/docs/set-operations#intersect-all}
   *
   * @example
   *
   * ```ts
   * // Select all products and quantities that are ordered by both regular and VIP customers
   * await db.select({
   *   productId: regularCustomerOrders.productId,
   *   quantityOrdered: regularCustomerOrders.quantityOrdered
   * })
   * .from(regularCustomerOrders)
   * .intersectAll(
   *   db.select({
   *     productId: vipCustomerOrders.productId,
   *     quantityOrdered: vipCustomerOrders.quantityOrdered
   *   })
   *   .from(vipCustomerOrders)
   * );
   * // or
   * import { intersectAll } from 'drizzle-orm/pg-core'
   *
   * await intersectAll(
   *   db.select({
   *     productId: regularCustomerOrders.productId,
   *     quantityOrdered: regularCustomerOrders.quantityOrdered
   *   })
   *   .from(regularCustomerOrders),
   *   db.select({
   *     productId: vipCustomerOrders.productId,
   *     quantityOrdered: vipCustomerOrders.quantityOrdered
   *   })
   *   .from(vipCustomerOrders)
   * );
   * ```
   */
  intersectAll = this.createSetOperator("intersect", true);
  /**
   * Adds `except` set operator to the query.
   *
   * Calling this method will retrieve all unique rows from the left query, except for the rows that are present in the result set of the right query.
   *
   * See docs: {@link https://orm.drizzle.team/docs/set-operations#except}
   *
   * @example
   *
   * ```ts
   * // Select all courses offered in department A but not in department B
   * await db.select({ courseName: depA.courseName })
   *   .from(depA)
   *   .except(
   *     db.select({ courseName: depB.courseName }).from(depB)
   *   );
   * // or
   * import { except } from 'drizzle-orm/pg-core'
   *
   * await except(
   *   db.select({ courseName: depA.courseName }).from(depA),
   *   db.select({ courseName: depB.courseName }).from(depB)
   * );
   * ```
   */
  except = this.createSetOperator("except", false);
  /**
   * Adds `except all` set operator to the query.
   *
   * Calling this method will retrieve all rows from the left query, except for the rows that are present in the result set of the right query.
   *
   * See docs: {@link https://orm.drizzle.team/docs/set-operations#except-all}
   *
   * @example
   *
   * ```ts
   * // Select all products that are ordered by regular customers but not by VIP customers
   * await db.select({
   *   productId: regularCustomerOrders.productId,
   *   quantityOrdered: regularCustomerOrders.quantityOrdered,
   * })
   * .from(regularCustomerOrders)
   * .exceptAll(
   *   db.select({
   *     productId: vipCustomerOrders.productId,
   *     quantityOrdered: vipCustomerOrders.quantityOrdered,
   *   })
   *   .from(vipCustomerOrders)
   * );
   * // or
   * import { exceptAll } from 'drizzle-orm/pg-core'
   *
   * await exceptAll(
   *   db.select({
   *     productId: regularCustomerOrders.productId,
   *     quantityOrdered: regularCustomerOrders.quantityOrdered
   *   })
   *   .from(regularCustomerOrders),
   *   db.select({
   *     productId: vipCustomerOrders.productId,
   *     quantityOrdered: vipCustomerOrders.quantityOrdered
   *   })
   *   .from(vipCustomerOrders)
   * );
   * ```
   */
  exceptAll = this.createSetOperator("except", true);
  /** @internal */
  addSetOperators(setOperators) {
    this.config.setOperators.push(...setOperators);
    return this;
  }
  /**
   * Adds a `where` clause to the query.
   *
   * Calling this method will select only those rows that fulfill a specified condition.
   *
   * See docs: {@link https://orm.drizzle.team/docs/select#filtering}
   *
   * @param where the `where` clause.
   *
   * @example
   * You can use conditional operators and `sql function` to filter the rows to be selected.
   *
   * ```ts
   * // Select all cars with green color
   * await db.select().from(cars).where(eq(cars.color, 'green'));
   * // or
   * await db.select().from(cars).where(sql`${cars.color} = 'green'`)
   * ```
   *
   * You can logically combine conditional operators with `and()` and `or()` operators:
   *
   * ```ts
   * // Select all BMW cars with a green color
   * await db.select().from(cars).where(and(eq(cars.color, 'green'), eq(cars.brand, 'BMW')));
   *
   * // Select all cars with the green or blue color
   * await db.select().from(cars).where(or(eq(cars.color, 'green'), eq(cars.color, 'blue')));
   * ```
   */
  where(where) {
    if (typeof where === "function") {
      where = where(
        new Proxy(
          this.config.fields,
          new SelectionProxyHandler({ sqlAliasedBehavior: "sql", sqlBehavior: "sql" })
        )
      );
    }
    this.config.where = where;
    return this;
  }
  /**
   * Adds a `having` clause to the query.
   *
   * Calling this method will select only those rows that fulfill a specified condition. It is typically used with aggregate functions to filter the aggregated data based on a specified condition.
   *
   * See docs: {@link https://orm.drizzle.team/docs/select#aggregations}
   *
   * @param having the `having` clause.
   *
   * @example
   *
   * ```ts
   * // Select all brands with more than one car
   * await db.select({
   * 	brand: cars.brand,
   * 	count: sql<number>`cast(count(${cars.id}) as int)`,
   * })
   *   .from(cars)
   *   .groupBy(cars.brand)
   *   .having(({ count }) => gt(count, 1));
   * ```
   */
  having(having) {
    if (typeof having === "function") {
      having = having(
        new Proxy(
          this.config.fields,
          new SelectionProxyHandler({ sqlAliasedBehavior: "sql", sqlBehavior: "sql" })
        )
      );
    }
    this.config.having = having;
    return this;
  }
  groupBy(...columns2) {
    if (typeof columns2[0] === "function") {
      const groupBy = columns2[0](
        new Proxy(
          this.config.fields,
          new SelectionProxyHandler({ sqlAliasedBehavior: "alias", sqlBehavior: "sql" })
        )
      );
      this.config.groupBy = Array.isArray(groupBy) ? groupBy : [groupBy];
    } else {
      this.config.groupBy = columns2;
    }
    return this;
  }
  orderBy(...columns2) {
    if (typeof columns2[0] === "function") {
      const orderBy = columns2[0](
        new Proxy(
          this.config.fields,
          new SelectionProxyHandler({ sqlAliasedBehavior: "alias", sqlBehavior: "sql" })
        )
      );
      const orderByArray = Array.isArray(orderBy) ? orderBy : [orderBy];
      if (this.config.setOperators.length > 0) {
        this.config.setOperators.at(-1).orderBy = orderByArray;
      } else {
        this.config.orderBy = orderByArray;
      }
    } else {
      const orderByArray = columns2;
      if (this.config.setOperators.length > 0) {
        this.config.setOperators.at(-1).orderBy = orderByArray;
      } else {
        this.config.orderBy = orderByArray;
      }
    }
    return this;
  }
  /**
   * Adds a `limit` clause to the query.
   *
   * Calling this method will set the maximum number of rows that will be returned by this query.
   *
   * See docs: {@link https://orm.drizzle.team/docs/select#limit--offset}
   *
   * @param limit the `limit` clause.
   *
   * @example
   *
   * ```ts
   * // Get the first 10 people from this query.
   * await db.select().from(people).limit(10);
   * ```
   */
  limit(limit3) {
    if (this.config.setOperators.length > 0) {
      this.config.setOperators.at(-1).limit = limit3;
    } else {
      this.config.limit = limit3;
    }
    return this;
  }
  /**
   * Adds an `offset` clause to the query.
   *
   * Calling this method will skip a number of rows when returning results from this query.
   *
   * See docs: {@link https://orm.drizzle.team/docs/select#limit--offset}
   *
   * @param offset the `offset` clause.
   *
   * @example
   *
   * ```ts
   * // Get the 10th-20th people from this query.
   * await db.select().from(people).offset(10).limit(10);
   * ```
   */
  offset(offset) {
    if (this.config.setOperators.length > 0) {
      this.config.setOperators.at(-1).offset = offset;
    } else {
      this.config.offset = offset;
    }
    return this;
  }
  /**
   * Adds a `for` clause to the query.
   *
   * Calling this method will specify a lock strength for this query that controls how strictly it acquires exclusive access to the rows being queried.
   *
   * See docs: {@link https://www.postgresql.org/docs/current/sql-select.html#SQL-FOR-UPDATE-SHARE}
   *
   * @param strength the lock strength.
   * @param config the lock configuration.
   */
  for(strength, config = {}) {
    this.config.lockingClause = { strength, config };
    return this;
  }
  /** @internal */
  getSQL() {
    return this.dialect.buildSelectQuery(this.config);
  }
  toSQL() {
    const { typings: _typings, ...rest } = this.dialect.sqlToQuery(this.getSQL());
    return rest;
  }
  as(alias) {
    const usedTables = [];
    usedTables.push(...extractUsedTable(this.config.table));
    if (this.config.joins) {
      for (const it of this.config.joins) usedTables.push(...extractUsedTable(it.table));
    }
    return new Proxy(
      new Subquery(this.getSQL(), this.config.fields, alias, false, [...new Set(usedTables)]),
      new SelectionProxyHandler({ alias, sqlAliasedBehavior: "alias", sqlBehavior: "error" })
    );
  }
  /** @internal */
  getSelectedFields() {
    return new Proxy(
      this.config.fields,
      new SelectionProxyHandler({ alias: this.tableName, sqlAliasedBehavior: "alias", sqlBehavior: "error" })
    );
  }
  $dynamic() {
    return this;
  }
  $withCache(config) {
    this.cacheConfig = config === void 0 ? { config: {}, enable: true, autoInvalidate: true } : config === false ? { enable: false } : { enable: true, autoInvalidate: true, ...config };
    return this;
  }
};
var PgSelectBase = class extends PgSelectQueryBuilderBase {
  static [entityKind] = "PgSelect";
  /** @internal */
  _prepare(name) {
    const { session, config, dialect, joinsNotNullableMap, authToken, cacheConfig, usedTables } = this;
    if (!session) {
      throw new Error("Cannot execute a query on a query builder. Please use a database instance instead.");
    }
    const { fields } = config;
    return tracer.startActiveSpan("drizzle.prepareQuery", () => {
      const fieldsList = orderSelectedFields(fields);
      const query2 = session.prepareQuery(dialect.sqlToQuery(this.getSQL()), fieldsList, name, true, void 0, {
        type: "select",
        tables: [...usedTables]
      }, cacheConfig);
      query2.joinsNotNullableMap = joinsNotNullableMap;
      return query2.setToken(authToken);
    });
  }
  /**
   * Create a prepared statement for this query. This allows
   * the database to remember this query for the given session
   * and call it by name, rather than specifying the full query.
   *
   * {@link https://www.postgresql.org/docs/current/sql-prepare.html | Postgres prepare documentation}
   */
  prepare(name) {
    return this._prepare(name);
  }
  authToken;
  /** @internal */
  setToken(token) {
    this.authToken = token;
    return this;
  }
  execute = (placeholderValues) => {
    return tracer.startActiveSpan("drizzle.operation", () => {
      return this._prepare().execute(placeholderValues, this.authToken);
    });
  };
};
applyMixins(PgSelectBase, [QueryPromise]);
function createSetOperator(type, isAll) {
  return (leftSelect, rightSelect, ...restSelects) => {
    const setOperators = [rightSelect, ...restSelects].map((select2) => ({
      type,
      isAll,
      rightSelect: select2
    }));
    for (const setOperator of setOperators) {
      if (!haveSameKeys(leftSelect.getSelectedFields(), setOperator.rightSelect.getSelectedFields())) {
        throw new Error(
          "Set operator error (union / intersect / except): selected fields are not the same or are in a different order"
        );
      }
    }
    return leftSelect.addSetOperators(setOperators);
  };
}
var getPgSetOperators = () => ({
  union,
  unionAll,
  intersect,
  intersectAll,
  except,
  exceptAll
});
var union = createSetOperator("union", false);
var unionAll = createSetOperator("union", true);
var intersect = createSetOperator("intersect", false);
var intersectAll = createSetOperator("intersect", true);
var except = createSetOperator("except", false);
var exceptAll = createSetOperator("except", true);

// node_modules/drizzle-orm/pg-core/query-builders/query-builder.js
var QueryBuilder = class {
  static [entityKind] = "PgQueryBuilder";
  dialect;
  dialectConfig;
  constructor(dialect) {
    this.dialect = is(dialect, PgDialect) ? dialect : void 0;
    this.dialectConfig = is(dialect, PgDialect) ? void 0 : dialect;
  }
  $with = (alias, selection) => {
    const queryBuilder = this;
    const as = (qb) => {
      if (typeof qb === "function") {
        qb = qb(queryBuilder);
      }
      return new Proxy(
        new WithSubquery(
          qb.getSQL(),
          selection ?? ("getSelectedFields" in qb ? qb.getSelectedFields() ?? {} : {}),
          alias,
          true
        ),
        new SelectionProxyHandler({ alias, sqlAliasedBehavior: "alias", sqlBehavior: "error" })
      );
    };
    return { as };
  };
  with(...queries) {
    const self = this;
    function select2(fields) {
      return new PgSelectBuilder({
        fields: fields ?? void 0,
        session: void 0,
        dialect: self.getDialect(),
        withList: queries
      });
    }
    function selectDistinct(fields) {
      return new PgSelectBuilder({
        fields: fields ?? void 0,
        session: void 0,
        dialect: self.getDialect(),
        distinct: true
      });
    }
    function selectDistinctOn(on, fields) {
      return new PgSelectBuilder({
        fields: fields ?? void 0,
        session: void 0,
        dialect: self.getDialect(),
        distinct: { on }
      });
    }
    return { select: select2, selectDistinct, selectDistinctOn };
  }
  select(fields) {
    return new PgSelectBuilder({
      fields: fields ?? void 0,
      session: void 0,
      dialect: this.getDialect()
    });
  }
  selectDistinct(fields) {
    return new PgSelectBuilder({
      fields: fields ?? void 0,
      session: void 0,
      dialect: this.getDialect(),
      distinct: true
    });
  }
  selectDistinctOn(on, fields) {
    return new PgSelectBuilder({
      fields: fields ?? void 0,
      session: void 0,
      dialect: this.getDialect(),
      distinct: { on }
    });
  }
  // Lazy load dialect to avoid circular dependency
  getDialect() {
    if (!this.dialect) {
      this.dialect = new PgDialect(this.dialectConfig);
    }
    return this.dialect;
  }
};

// node_modules/drizzle-orm/pg-core/utils.js
function extractUsedTable(table) {
  if (is(table, PgTable)) {
    return [table[Schema] ? `${table[Schema]}.${table[Table.Symbol.BaseName]}` : table[Table.Symbol.BaseName]];
  }
  if (is(table, Subquery)) {
    return table._.usedTables ?? [];
  }
  if (is(table, SQL)) {
    return table.usedTables ?? [];
  }
  return [];
}

// node_modules/drizzle-orm/pg-core/query-builders/delete.js
var PgDeleteBase = class extends QueryPromise {
  constructor(table, session, dialect, withList) {
    super();
    this.session = session;
    this.dialect = dialect;
    this.config = { table, withList };
  }
  static [entityKind] = "PgDelete";
  config;
  cacheConfig;
  /**
   * Adds a `where` clause to the query.
   *
   * Calling this method will delete only those rows that fulfill a specified condition.
   *
   * See docs: {@link https://orm.drizzle.team/docs/delete}
   *
   * @param where the `where` clause.
   *
   * @example
   * You can use conditional operators and `sql function` to filter the rows to be deleted.
   *
   * ```ts
   * // Delete all cars with green color
   * await db.delete(cars).where(eq(cars.color, 'green'));
   * // or
   * await db.delete(cars).where(sql`${cars.color} = 'green'`)
   * ```
   *
   * You can logically combine conditional operators with `and()` and `or()` operators:
   *
   * ```ts
   * // Delete all BMW cars with a green color
   * await db.delete(cars).where(and(eq(cars.color, 'green'), eq(cars.brand, 'BMW')));
   *
   * // Delete all cars with the green or blue color
   * await db.delete(cars).where(or(eq(cars.color, 'green'), eq(cars.color, 'blue')));
   * ```
   */
  where(where) {
    this.config.where = where;
    return this;
  }
  returning(fields = this.config.table[Table.Symbol.Columns]) {
    this.config.returningFields = fields;
    this.config.returning = orderSelectedFields(fields);
    return this;
  }
  /** @internal */
  getSQL() {
    return this.dialect.buildDeleteQuery(this.config);
  }
  toSQL() {
    const { typings: _typings, ...rest } = this.dialect.sqlToQuery(this.getSQL());
    return rest;
  }
  /** @internal */
  _prepare(name) {
    return tracer.startActiveSpan("drizzle.prepareQuery", () => {
      return this.session.prepareQuery(this.dialect.sqlToQuery(this.getSQL()), this.config.returning, name, true, void 0, {
        type: "delete",
        tables: extractUsedTable(this.config.table)
      }, this.cacheConfig);
    });
  }
  prepare(name) {
    return this._prepare(name);
  }
  authToken;
  /** @internal */
  setToken(token) {
    this.authToken = token;
    return this;
  }
  execute = (placeholderValues) => {
    return tracer.startActiveSpan("drizzle.operation", () => {
      return this._prepare().execute(placeholderValues, this.authToken);
    });
  };
  /** @internal */
  getSelectedFields() {
    return this.config.returningFields ? new Proxy(
      this.config.returningFields,
      new SelectionProxyHandler({
        alias: getTableName(this.config.table),
        sqlAliasedBehavior: "alias",
        sqlBehavior: "error"
      })
    ) : void 0;
  }
  $dynamic() {
    return this;
  }
};

// node_modules/drizzle-orm/pg-core/query-builders/insert.js
var PgInsertBuilder = class {
  constructor(table, session, dialect, withList, overridingSystemValue_) {
    this.table = table;
    this.session = session;
    this.dialect = dialect;
    this.withList = withList;
    this.overridingSystemValue_ = overridingSystemValue_;
  }
  static [entityKind] = "PgInsertBuilder";
  authToken;
  /** @internal */
  setToken(token) {
    this.authToken = token;
    return this;
  }
  overridingSystemValue() {
    this.overridingSystemValue_ = true;
    return this;
  }
  values(values2) {
    values2 = Array.isArray(values2) ? values2 : [values2];
    if (values2.length === 0) {
      throw new Error("values() must be called with at least one value");
    }
    const mappedValues = values2.map((entry) => {
      const result = {};
      const cols = this.table[Table.Symbol.Columns];
      for (const colKey of Object.keys(entry)) {
        const colValue = entry[colKey];
        result[colKey] = is(colValue, SQL) ? colValue : new Param(colValue, cols[colKey]);
      }
      return result;
    });
    return new PgInsertBase(
      this.table,
      mappedValues,
      this.session,
      this.dialect,
      this.withList,
      false,
      this.overridingSystemValue_
    ).setToken(this.authToken);
  }
  select(selectQuery) {
    const select2 = typeof selectQuery === "function" ? selectQuery(new QueryBuilder()) : selectQuery;
    if (!is(select2, SQL) && !haveSameKeys(this.table[Columns], select2._.selectedFields)) {
      throw new Error(
        "Insert select error: selected fields are not the same or are in a different order compared to the table definition"
      );
    }
    return new PgInsertBase(this.table, select2, this.session, this.dialect, this.withList, true);
  }
};
var PgInsertBase = class extends QueryPromise {
  constructor(table, values2, session, dialect, withList, select2, overridingSystemValue_) {
    super();
    this.session = session;
    this.dialect = dialect;
    this.config = { table, values: values2, withList, select: select2, overridingSystemValue_ };
  }
  static [entityKind] = "PgInsert";
  config;
  cacheConfig;
  returning(fields = this.config.table[Table.Symbol.Columns]) {
    this.config.returningFields = fields;
    this.config.returning = orderSelectedFields(fields);
    return this;
  }
  /**
   * Adds an `on conflict do nothing` clause to the query.
   *
   * Calling this method simply avoids inserting a row as its alternative action.
   *
   * See docs: {@link https://orm.drizzle.team/docs/insert#on-conflict-do-nothing}
   *
   * @param config The `target` and `where` clauses.
   *
   * @example
   * ```ts
   * // Insert one row and cancel the insert if there's a conflict
   * await db.insert(cars)
   *   .values({ id: 1, brand: 'BMW' })
   *   .onConflictDoNothing();
   *
   * // Explicitly specify conflict target
   * await db.insert(cars)
   *   .values({ id: 1, brand: 'BMW' })
   *   .onConflictDoNothing({ target: cars.id });
   * ```
   */
  onConflictDoNothing(config = {}) {
    if (config.target === void 0) {
      this.config.onConflict = sql`do nothing`;
    } else {
      let targetColumn = "";
      targetColumn = Array.isArray(config.target) ? config.target.map((it) => this.dialect.escapeName(this.dialect.casing.getColumnCasing(it))).join(",") : this.dialect.escapeName(this.dialect.casing.getColumnCasing(config.target));
      const whereSql = config.where ? sql` where ${config.where}` : void 0;
      this.config.onConflict = sql`(${sql.raw(targetColumn)})${whereSql} do nothing`;
    }
    return this;
  }
  /**
   * Adds an `on conflict do update` clause to the query.
   *
   * Calling this method will update the existing row that conflicts with the row proposed for insertion as its alternative action.
   *
   * See docs: {@link https://orm.drizzle.team/docs/insert#upserts-and-conflicts}
   *
   * @param config The `target`, `set` and `where` clauses.
   *
   * @example
   * ```ts
   * // Update the row if there's a conflict
   * await db.insert(cars)
   *   .values({ id: 1, brand: 'BMW' })
   *   .onConflictDoUpdate({
   *     target: cars.id,
   *     set: { brand: 'Porsche' }
   *   });
   *
   * // Upsert with 'where' clause
   * await db.insert(cars)
   *   .values({ id: 1, brand: 'BMW' })
   *   .onConflictDoUpdate({
   *     target: cars.id,
   *     set: { brand: 'newBMW' },
   *     targetWhere: sql`${cars.createdAt} > '2023-01-01'::date`,
   *   });
   * ```
   */
  onConflictDoUpdate(config) {
    if (config.where && (config.targetWhere || config.setWhere)) {
      throw new Error(
        'You cannot use both "where" and "targetWhere"/"setWhere" at the same time - "where" is deprecated, use "targetWhere" or "setWhere" instead.'
      );
    }
    const whereSql = config.where ? sql` where ${config.where}` : void 0;
    const targetWhereSql = config.targetWhere ? sql` where ${config.targetWhere}` : void 0;
    const setWhereSql = config.setWhere ? sql` where ${config.setWhere}` : void 0;
    const setSql = this.dialect.buildUpdateSet(this.config.table, mapUpdateSet(this.config.table, config.set));
    let targetColumn = "";
    targetColumn = Array.isArray(config.target) ? config.target.map((it) => this.dialect.escapeName(this.dialect.casing.getColumnCasing(it))).join(",") : this.dialect.escapeName(this.dialect.casing.getColumnCasing(config.target));
    this.config.onConflict = sql`(${sql.raw(targetColumn)})${targetWhereSql} do update set ${setSql}${whereSql}${setWhereSql}`;
    return this;
  }
  /** @internal */
  getSQL() {
    return this.dialect.buildInsertQuery(this.config);
  }
  toSQL() {
    const { typings: _typings, ...rest } = this.dialect.sqlToQuery(this.getSQL());
    return rest;
  }
  /** @internal */
  _prepare(name) {
    return tracer.startActiveSpan("drizzle.prepareQuery", () => {
      return this.session.prepareQuery(this.dialect.sqlToQuery(this.getSQL()), this.config.returning, name, true, void 0, {
        type: "insert",
        tables: extractUsedTable(this.config.table)
      }, this.cacheConfig);
    });
  }
  prepare(name) {
    return this._prepare(name);
  }
  authToken;
  /** @internal */
  setToken(token) {
    this.authToken = token;
    return this;
  }
  execute = (placeholderValues) => {
    return tracer.startActiveSpan("drizzle.operation", () => {
      return this._prepare().execute(placeholderValues, this.authToken);
    });
  };
  /** @internal */
  getSelectedFields() {
    return this.config.returningFields ? new Proxy(
      this.config.returningFields,
      new SelectionProxyHandler({
        alias: getTableName(this.config.table),
        sqlAliasedBehavior: "alias",
        sqlBehavior: "error"
      })
    ) : void 0;
  }
  $dynamic() {
    return this;
  }
};

// node_modules/drizzle-orm/pg-core/query-builders/refresh-materialized-view.js
var PgRefreshMaterializedView = class extends QueryPromise {
  constructor(view2, session, dialect) {
    super();
    this.session = session;
    this.dialect = dialect;
    this.config = { view: view2 };
  }
  static [entityKind] = "PgRefreshMaterializedView";
  config;
  concurrently() {
    if (this.config.withNoData !== void 0) {
      throw new Error("Cannot use concurrently and withNoData together");
    }
    this.config.concurrently = true;
    return this;
  }
  withNoData() {
    if (this.config.concurrently !== void 0) {
      throw new Error("Cannot use concurrently and withNoData together");
    }
    this.config.withNoData = true;
    return this;
  }
  /** @internal */
  getSQL() {
    return this.dialect.buildRefreshMaterializedViewQuery(this.config);
  }
  toSQL() {
    const { typings: _typings, ...rest } = this.dialect.sqlToQuery(this.getSQL());
    return rest;
  }
  /** @internal */
  _prepare(name) {
    return tracer.startActiveSpan("drizzle.prepareQuery", () => {
      return this.session.prepareQuery(this.dialect.sqlToQuery(this.getSQL()), void 0, name, true);
    });
  }
  prepare(name) {
    return this._prepare(name);
  }
  authToken;
  /** @internal */
  setToken(token) {
    this.authToken = token;
    return this;
  }
  execute = (placeholderValues) => {
    return tracer.startActiveSpan("drizzle.operation", () => {
      return this._prepare().execute(placeholderValues, this.authToken);
    });
  };
};

// node_modules/drizzle-orm/pg-core/query-builders/update.js
var PgUpdateBuilder = class {
  constructor(table, session, dialect, withList) {
    this.table = table;
    this.session = session;
    this.dialect = dialect;
    this.withList = withList;
  }
  static [entityKind] = "PgUpdateBuilder";
  authToken;
  setToken(token) {
    this.authToken = token;
    return this;
  }
  set(values2) {
    return new PgUpdateBase(
      this.table,
      mapUpdateSet(this.table, values2),
      this.session,
      this.dialect,
      this.withList
    ).setToken(this.authToken);
  }
};
var PgUpdateBase = class extends QueryPromise {
  constructor(table, set, session, dialect, withList) {
    super();
    this.session = session;
    this.dialect = dialect;
    this.config = { set, table, withList, joins: [] };
    this.tableName = getTableLikeName(table);
    this.joinsNotNullableMap = typeof this.tableName === "string" ? { [this.tableName]: true } : {};
  }
  static [entityKind] = "PgUpdate";
  config;
  tableName;
  joinsNotNullableMap;
  cacheConfig;
  from(source) {
    const src = source;
    const tableName = getTableLikeName(src);
    if (typeof tableName === "string") {
      this.joinsNotNullableMap[tableName] = true;
    }
    this.config.from = src;
    return this;
  }
  getTableLikeFields(table) {
    if (is(table, PgTable)) {
      return table[Table.Symbol.Columns];
    } else if (is(table, Subquery)) {
      return table._.selectedFields;
    }
    return table[ViewBaseConfig].selectedFields;
  }
  createJoin(joinType) {
    return (table, on) => {
      const tableName = getTableLikeName(table);
      if (typeof tableName === "string" && this.config.joins.some((join) => join.alias === tableName)) {
        throw new Error(`Alias "${tableName}" is already used in this query`);
      }
      if (typeof on === "function") {
        const from = this.config.from && !is(this.config.from, SQL) ? this.getTableLikeFields(this.config.from) : void 0;
        on = on(
          new Proxy(
            this.config.table[Table.Symbol.Columns],
            new SelectionProxyHandler({ sqlAliasedBehavior: "sql", sqlBehavior: "sql" })
          ),
          from && new Proxy(
            from,
            new SelectionProxyHandler({ sqlAliasedBehavior: "sql", sqlBehavior: "sql" })
          )
        );
      }
      this.config.joins.push({ on, table, joinType, alias: tableName });
      if (typeof tableName === "string") {
        switch (joinType) {
          case "left": {
            this.joinsNotNullableMap[tableName] = false;
            break;
          }
          case "right": {
            this.joinsNotNullableMap = Object.fromEntries(
              Object.entries(this.joinsNotNullableMap).map(([key2]) => [key2, false])
            );
            this.joinsNotNullableMap[tableName] = true;
            break;
          }
          case "inner": {
            this.joinsNotNullableMap[tableName] = true;
            break;
          }
          case "full": {
            this.joinsNotNullableMap = Object.fromEntries(
              Object.entries(this.joinsNotNullableMap).map(([key2]) => [key2, false])
            );
            this.joinsNotNullableMap[tableName] = false;
            break;
          }
        }
      }
      return this;
    };
  }
  leftJoin = this.createJoin("left");
  rightJoin = this.createJoin("right");
  innerJoin = this.createJoin("inner");
  fullJoin = this.createJoin("full");
  /**
   * Adds a 'where' clause to the query.
   *
   * Calling this method will update only those rows that fulfill a specified condition.
   *
   * See docs: {@link https://orm.drizzle.team/docs/update}
   *
   * @param where the 'where' clause.
   *
   * @example
   * You can use conditional operators and `sql function` to filter the rows to be updated.
   *
   * ```ts
   * // Update all cars with green color
   * await db.update(cars).set({ color: 'red' })
   *   .where(eq(cars.color, 'green'));
   * // or
   * await db.update(cars).set({ color: 'red' })
   *   .where(sql`${cars.color} = 'green'`)
   * ```
   *
   * You can logically combine conditional operators with `and()` and `or()` operators:
   *
   * ```ts
   * // Update all BMW cars with a green color
   * await db.update(cars).set({ color: 'red' })
   *   .where(and(eq(cars.color, 'green'), eq(cars.brand, 'BMW')));
   *
   * // Update all cars with the green or blue color
   * await db.update(cars).set({ color: 'red' })
   *   .where(or(eq(cars.color, 'green'), eq(cars.color, 'blue')));
   * ```
   */
  where(where) {
    this.config.where = where;
    return this;
  }
  returning(fields) {
    if (!fields) {
      fields = Object.assign({}, this.config.table[Table.Symbol.Columns]);
      if (this.config.from) {
        const tableName = getTableLikeName(this.config.from);
        if (typeof tableName === "string" && this.config.from && !is(this.config.from, SQL)) {
          const fromFields = this.getTableLikeFields(this.config.from);
          fields[tableName] = fromFields;
        }
        for (const join of this.config.joins) {
          const tableName2 = getTableLikeName(join.table);
          if (typeof tableName2 === "string" && !is(join.table, SQL)) {
            const fromFields = this.getTableLikeFields(join.table);
            fields[tableName2] = fromFields;
          }
        }
      }
    }
    this.config.returningFields = fields;
    this.config.returning = orderSelectedFields(fields);
    return this;
  }
  /** @internal */
  getSQL() {
    return this.dialect.buildUpdateQuery(this.config);
  }
  toSQL() {
    const { typings: _typings, ...rest } = this.dialect.sqlToQuery(this.getSQL());
    return rest;
  }
  /** @internal */
  _prepare(name) {
    const query2 = this.session.prepareQuery(this.dialect.sqlToQuery(this.getSQL()), this.config.returning, name, true, void 0, {
      type: "insert",
      tables: extractUsedTable(this.config.table)
    }, this.cacheConfig);
    query2.joinsNotNullableMap = this.joinsNotNullableMap;
    return query2;
  }
  prepare(name) {
    return this._prepare(name);
  }
  authToken;
  /** @internal */
  setToken(token) {
    this.authToken = token;
    return this;
  }
  execute = (placeholderValues) => {
    return this._prepare().execute(placeholderValues, this.authToken);
  };
  /** @internal */
  getSelectedFields() {
    return this.config.returningFields ? new Proxy(
      this.config.returningFields,
      new SelectionProxyHandler({
        alias: getTableName(this.config.table),
        sqlAliasedBehavior: "alias",
        sqlBehavior: "error"
      })
    ) : void 0;
  }
  $dynamic() {
    return this;
  }
};

// node_modules/drizzle-orm/pg-core/query-builders/count.js
var PgCountBuilder = class _PgCountBuilder extends SQL {
  constructor(params) {
    super(_PgCountBuilder.buildEmbeddedCount(params.source, params.filters).queryChunks);
    this.params = params;
    this.mapWith(Number);
    this.session = params.session;
    this.sql = _PgCountBuilder.buildCount(
      params.source,
      params.filters
    );
  }
  sql;
  token;
  static [entityKind] = "PgCountBuilder";
  [Symbol.toStringTag] = "PgCountBuilder";
  session;
  static buildEmbeddedCount(source, filters) {
    return sql`(select count(*) from ${source}${sql.raw(" where ").if(filters)}${filters})`;
  }
  static buildCount(source, filters) {
    return sql`select count(*) as count from ${source}${sql.raw(" where ").if(filters)}${filters};`;
  }
  /** @intrnal */
  setToken(token) {
    this.token = token;
    return this;
  }
  then(onfulfilled, onrejected) {
    return Promise.resolve(this.session.count(this.sql, this.token)).then(
      onfulfilled,
      onrejected
    );
  }
  catch(onRejected) {
    return this.then(void 0, onRejected);
  }
  finally(onFinally) {
    return this.then(
      (value2) => {
        onFinally?.();
        return value2;
      },
      (reason) => {
        onFinally?.();
        throw reason;
      }
    );
  }
};

// node_modules/drizzle-orm/pg-core/query-builders/query.js
var RelationalQueryBuilder = class {
  constructor(fullSchema, schema, tableNamesMap, table, tableConfig, dialect, session) {
    this.fullSchema = fullSchema;
    this.schema = schema;
    this.tableNamesMap = tableNamesMap;
    this.table = table;
    this.tableConfig = tableConfig;
    this.dialect = dialect;
    this.session = session;
  }
  static [entityKind] = "PgRelationalQueryBuilder";
  findMany(config) {
    return new PgRelationalQuery(
      this.fullSchema,
      this.schema,
      this.tableNamesMap,
      this.table,
      this.tableConfig,
      this.dialect,
      this.session,
      config ? config : {},
      "many"
    );
  }
  findFirst(config) {
    return new PgRelationalQuery(
      this.fullSchema,
      this.schema,
      this.tableNamesMap,
      this.table,
      this.tableConfig,
      this.dialect,
      this.session,
      config ? { ...config, limit: 1 } : { limit: 1 },
      "first"
    );
  }
};
var PgRelationalQuery = class extends QueryPromise {
  constructor(fullSchema, schema, tableNamesMap, table, tableConfig, dialect, session, config, mode) {
    super();
    this.fullSchema = fullSchema;
    this.schema = schema;
    this.tableNamesMap = tableNamesMap;
    this.table = table;
    this.tableConfig = tableConfig;
    this.dialect = dialect;
    this.session = session;
    this.config = config;
    this.mode = mode;
  }
  static [entityKind] = "PgRelationalQuery";
  /** @internal */
  _prepare(name) {
    return tracer.startActiveSpan("drizzle.prepareQuery", () => {
      const { query: query2, builtQuery } = this._toSQL();
      return this.session.prepareQuery(
        builtQuery,
        void 0,
        name,
        true,
        (rawRows, mapColumnValue) => {
          const rows = rawRows.map(
            (row) => mapRelationalRow(this.schema, this.tableConfig, row, query2.selection, mapColumnValue)
          );
          if (this.mode === "first") {
            return rows[0];
          }
          return rows;
        }
      );
    });
  }
  prepare(name) {
    return this._prepare(name);
  }
  _getQuery() {
    return this.dialect.buildRelationalQueryWithoutPK({
      fullSchema: this.fullSchema,
      schema: this.schema,
      tableNamesMap: this.tableNamesMap,
      table: this.table,
      tableConfig: this.tableConfig,
      queryConfig: this.config,
      tableAlias: this.tableConfig.tsName
    });
  }
  /** @internal */
  getSQL() {
    return this._getQuery().sql;
  }
  _toSQL() {
    const query2 = this._getQuery();
    const builtQuery = this.dialect.sqlToQuery(query2.sql);
    return { query: query2, builtQuery };
  }
  toSQL() {
    return this._toSQL().builtQuery;
  }
  authToken;
  /** @internal */
  setToken(token) {
    this.authToken = token;
    return this;
  }
  execute() {
    return tracer.startActiveSpan("drizzle.operation", () => {
      return this._prepare().execute(void 0, this.authToken);
    });
  }
};

// node_modules/drizzle-orm/pg-core/query-builders/raw.js
var PgRaw = class extends QueryPromise {
  constructor(execute2, sql2, query2, mapBatchResult) {
    super();
    this.execute = execute2;
    this.sql = sql2;
    this.query = query2;
    this.mapBatchResult = mapBatchResult;
  }
  static [entityKind] = "PgRaw";
  /** @internal */
  getSQL() {
    return this.sql;
  }
  getQuery() {
    return this.query;
  }
  mapResult(result, isFromBatch) {
    return isFromBatch ? this.mapBatchResult(result) : result;
  }
  _prepare() {
    return this;
  }
  /** @internal */
  isResponseInArrayMode() {
    return false;
  }
};

// node_modules/drizzle-orm/pg-core/db.js
var PgDatabase = class {
  constructor(dialect, session, schema) {
    this.dialect = dialect;
    this.session = session;
    this._ = schema ? {
      schema: schema.schema,
      fullSchema: schema.fullSchema,
      tableNamesMap: schema.tableNamesMap,
      session
    } : {
      schema: void 0,
      fullSchema: {},
      tableNamesMap: {},
      session
    };
    this.query = {};
    if (this._.schema) {
      for (const [tableName, columns2] of Object.entries(this._.schema)) {
        this.query[tableName] = new RelationalQueryBuilder(
          schema.fullSchema,
          this._.schema,
          this._.tableNamesMap,
          schema.fullSchema[tableName],
          columns2,
          dialect,
          session
        );
      }
    }
    this.$cache = { invalidate: async (_params) => {
    } };
  }
  static [entityKind] = "PgDatabase";
  query;
  /**
   * Creates a subquery that defines a temporary named result set as a CTE.
   *
   * It is useful for breaking down complex queries into simpler parts and for reusing the result set in subsequent parts of the query.
   *
   * See docs: {@link https://orm.drizzle.team/docs/select#with-clause}
   *
   * @param alias The alias for the subquery.
   *
   * Failure to provide an alias will result in a DrizzleTypeError, preventing the subquery from being referenced in other queries.
   *
   * @example
   *
   * ```ts
   * // Create a subquery with alias 'sq' and use it in the select query
   * const sq = db.$with('sq').as(db.select().from(users).where(eq(users.id, 42)));
   *
   * const result = await db.with(sq).select().from(sq);
   * ```
   *
   * To select arbitrary SQL values as fields in a CTE and reference them in other CTEs or in the main query, you need to add aliases to them:
   *
   * ```ts
   * // Select an arbitrary SQL value as a field in a CTE and reference it in the main query
   * const sq = db.$with('sq').as(db.select({
   *   name: sql<string>`upper(${users.name})`.as('name'),
   * })
   * .from(users));
   *
   * const result = await db.with(sq).select({ name: sq.name }).from(sq);
   * ```
   */
  $with = (alias, selection) => {
    const self = this;
    const as = (qb) => {
      if (typeof qb === "function") {
        qb = qb(new QueryBuilder(self.dialect));
      }
      return new Proxy(
        new WithSubquery(
          qb.getSQL(),
          selection ?? ("getSelectedFields" in qb ? qb.getSelectedFields() ?? {} : {}),
          alias,
          true
        ),
        new SelectionProxyHandler({ alias, sqlAliasedBehavior: "alias", sqlBehavior: "error" })
      );
    };
    return { as };
  };
  $count(source, filters) {
    return new PgCountBuilder({ source, filters, session: this.session });
  }
  $cache;
  /**
   * Incorporates a previously defined CTE (using `$with`) into the main query.
   *
   * This method allows the main query to reference a temporary named result set.
   *
   * See docs: {@link https://orm.drizzle.team/docs/select#with-clause}
   *
   * @param queries The CTEs to incorporate into the main query.
   *
   * @example
   *
   * ```ts
   * // Define a subquery 'sq' as a CTE using $with
   * const sq = db.$with('sq').as(db.select().from(users).where(eq(users.id, 42)));
   *
   * // Incorporate the CTE 'sq' into the main query and select from it
   * const result = await db.with(sq).select().from(sq);
   * ```
   */
  with(...queries) {
    const self = this;
    function select2(fields) {
      return new PgSelectBuilder({
        fields: fields ?? void 0,
        session: self.session,
        dialect: self.dialect,
        withList: queries
      });
    }
    function selectDistinct(fields) {
      return new PgSelectBuilder({
        fields: fields ?? void 0,
        session: self.session,
        dialect: self.dialect,
        withList: queries,
        distinct: true
      });
    }
    function selectDistinctOn(on, fields) {
      return new PgSelectBuilder({
        fields: fields ?? void 0,
        session: self.session,
        dialect: self.dialect,
        withList: queries,
        distinct: { on }
      });
    }
    function update2(table) {
      return new PgUpdateBuilder(table, self.session, self.dialect, queries);
    }
    function insert2(table) {
      return new PgInsertBuilder(table, self.session, self.dialect, queries);
    }
    function delete_(table) {
      return new PgDeleteBase(table, self.session, self.dialect, queries);
    }
    return { select: select2, selectDistinct, selectDistinctOn, update: update2, insert: insert2, delete: delete_ };
  }
  select(fields) {
    return new PgSelectBuilder({
      fields: fields ?? void 0,
      session: this.session,
      dialect: this.dialect
    });
  }
  selectDistinct(fields) {
    return new PgSelectBuilder({
      fields: fields ?? void 0,
      session: this.session,
      dialect: this.dialect,
      distinct: true
    });
  }
  selectDistinctOn(on, fields) {
    return new PgSelectBuilder({
      fields: fields ?? void 0,
      session: this.session,
      dialect: this.dialect,
      distinct: { on }
    });
  }
  /**
   * Creates an update query.
   *
   * Calling this method without `.where()` clause will update all rows in a table. The `.where()` clause specifies which rows should be updated.
   *
   * Use `.set()` method to specify which values to update.
   *
   * See docs: {@link https://orm.drizzle.team/docs/update}
   *
   * @param table The table to update.
   *
   * @example
   *
   * ```ts
   * // Update all rows in the 'cars' table
   * await db.update(cars).set({ color: 'red' });
   *
   * // Update rows with filters and conditions
   * await db.update(cars).set({ color: 'red' }).where(eq(cars.brand, 'BMW'));
   *
   * // Update with returning clause
   * const updatedCar: Car[] = await db.update(cars)
   *   .set({ color: 'red' })
   *   .where(eq(cars.id, 1))
   *   .returning();
   * ```
   */
  update(table) {
    return new PgUpdateBuilder(table, this.session, this.dialect);
  }
  /**
   * Creates an insert query.
   *
   * Calling this method will create new rows in a table. Use `.values()` method to specify which values to insert.
   *
   * See docs: {@link https://orm.drizzle.team/docs/insert}
   *
   * @param table The table to insert into.
   *
   * @example
   *
   * ```ts
   * // Insert one row
   * await db.insert(cars).values({ brand: 'BMW' });
   *
   * // Insert multiple rows
   * await db.insert(cars).values([{ brand: 'BMW' }, { brand: 'Porsche' }]);
   *
   * // Insert with returning clause
   * const insertedCar: Car[] = await db.insert(cars)
   *   .values({ brand: 'BMW' })
   *   .returning();
   * ```
   */
  insert(table) {
    return new PgInsertBuilder(table, this.session, this.dialect);
  }
  /**
   * Creates a delete query.
   *
   * Calling this method without `.where()` clause will delete all rows in a table. The `.where()` clause specifies which rows should be deleted.
   *
   * See docs: {@link https://orm.drizzle.team/docs/delete}
   *
   * @param table The table to delete from.
   *
   * @example
   *
   * ```ts
   * // Delete all rows in the 'cars' table
   * await db.delete(cars);
   *
   * // Delete rows with filters and conditions
   * await db.delete(cars).where(eq(cars.color, 'green'));
   *
   * // Delete with returning clause
   * const deletedCar: Car[] = await db.delete(cars)
   *   .where(eq(cars.id, 1))
   *   .returning();
   * ```
   */
  delete(table) {
    return new PgDeleteBase(table, this.session, this.dialect);
  }
  refreshMaterializedView(view2) {
    return new PgRefreshMaterializedView(view2, this.session, this.dialect);
  }
  authToken;
  execute(query2) {
    const sequel = typeof query2 === "string" ? sql.raw(query2) : query2.getSQL();
    const builtQuery = this.dialect.sqlToQuery(sequel);
    const prepared = this.session.prepareQuery(
      builtQuery,
      void 0,
      void 0,
      false
    );
    return new PgRaw(
      () => prepared.execute(void 0, this.authToken),
      sequel,
      builtQuery,
      (result) => prepared.mapResult(result, true)
    );
  }
  transaction(transaction2, config) {
    return this.session.transaction(transaction2, config);
  }
};

// node_modules/drizzle-orm/cache/core/cache.js
var Cache = class {
  static [entityKind] = "Cache";
};
var NoopCache = class extends Cache {
  strategy() {
    return "all";
  }
  static [entityKind] = "NoopCache";
  async get(_key) {
    return void 0;
  }
  async put(_hashedQuery, _response, _tables, _config) {
  }
  async onMutate(_params) {
  }
};
async function hashQuery(sql2, params) {
  const dataToHash = `${sql2}-${JSON.stringify(params)}`;
  const encoder2 = new TextEncoder();
  const data = encoder2.encode(dataToHash);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = [...new Uint8Array(hashBuffer)];
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return hashHex;
}

// node_modules/drizzle-orm/pg-core/session.js
var PgPreparedQuery = class {
  constructor(query2, cache, queryMetadata, cacheConfig) {
    this.query = query2;
    this.cache = cache;
    this.queryMetadata = queryMetadata;
    this.cacheConfig = cacheConfig;
    if (cache && cache.strategy() === "all" && cacheConfig === void 0) {
      this.cacheConfig = { enable: true, autoInvalidate: true };
    }
    if (!this.cacheConfig?.enable) {
      this.cacheConfig = void 0;
    }
  }
  authToken;
  getQuery() {
    return this.query;
  }
  mapResult(response, _isFromBatch) {
    return response;
  }
  /** @internal */
  setToken(token) {
    this.authToken = token;
    return this;
  }
  static [entityKind] = "PgPreparedQuery";
  /** @internal */
  joinsNotNullableMap;
  /** @internal */
  async queryWithCache(queryString, params, query2) {
    if (this.cache === void 0 || is(this.cache, NoopCache) || this.queryMetadata === void 0) {
      try {
        return await query2();
      } catch (e) {
        throw new DrizzleQueryError(queryString, params, e);
      }
    }
    if (this.cacheConfig && !this.cacheConfig.enable) {
      try {
        return await query2();
      } catch (e) {
        throw new DrizzleQueryError(queryString, params, e);
      }
    }
    if ((this.queryMetadata.type === "insert" || this.queryMetadata.type === "update" || this.queryMetadata.type === "delete") && this.queryMetadata.tables.length > 0) {
      try {
        const [res] = await Promise.all([
          query2(),
          this.cache.onMutate({ tables: this.queryMetadata.tables })
        ]);
        return res;
      } catch (e) {
        throw new DrizzleQueryError(queryString, params, e);
      }
    }
    if (!this.cacheConfig) {
      try {
        return await query2();
      } catch (e) {
        throw new DrizzleQueryError(queryString, params, e);
      }
    }
    if (this.queryMetadata.type === "select") {
      const fromCache = await this.cache.get(
        this.cacheConfig.tag ?? await hashQuery(queryString, params),
        this.queryMetadata.tables,
        this.cacheConfig.tag !== void 0,
        this.cacheConfig.autoInvalidate
      );
      if (fromCache === void 0) {
        let result;
        try {
          result = await query2();
        } catch (e) {
          throw new DrizzleQueryError(queryString, params, e);
        }
        await this.cache.put(
          this.cacheConfig.tag ?? await hashQuery(queryString, params),
          result,
          // make sure we send tables that were used in a query only if user wants to invalidate it on each write
          this.cacheConfig.autoInvalidate ? this.queryMetadata.tables : [],
          this.cacheConfig.tag !== void 0,
          this.cacheConfig.config
        );
        return result;
      }
      return fromCache;
    }
    try {
      return await query2();
    } catch (e) {
      throw new DrizzleQueryError(queryString, params, e);
    }
  }
};
var PgSession = class {
  constructor(dialect) {
    this.dialect = dialect;
  }
  static [entityKind] = "PgSession";
  /** @internal */
  execute(query2, token) {
    return tracer.startActiveSpan("drizzle.operation", () => {
      const prepared = tracer.startActiveSpan("drizzle.prepareQuery", () => {
        return this.prepareQuery(
          this.dialect.sqlToQuery(query2),
          void 0,
          void 0,
          false
        );
      });
      return prepared.setToken(token).execute(void 0, token);
    });
  }
  all(query2) {
    return this.prepareQuery(
      this.dialect.sqlToQuery(query2),
      void 0,
      void 0,
      false
    ).all();
  }
  /** @internal */
  async count(sql2, token) {
    const res = await this.execute(sql2, token);
    return Number(
      res[0]["count"]
    );
  }
};
var PgTransaction = class extends PgDatabase {
  constructor(dialect, session, schema, nestedIndex = 0) {
    super(dialect, session, schema);
    this.schema = schema;
    this.nestedIndex = nestedIndex;
  }
  static [entityKind] = "PgTransaction";
  rollback() {
    throw new TransactionRollbackError();
  }
  /** @internal */
  getTransactionConfigSQL(config) {
    const chunks = [];
    if (config.isolationLevel) {
      chunks.push(`isolation level ${config.isolationLevel}`);
    }
    if (config.accessMode) {
      chunks.push(config.accessMode);
    }
    if (typeof config.deferrable === "boolean") {
      chunks.push(config.deferrable ? "deferrable" : "not deferrable");
    }
    return sql.raw(chunks.join(" "));
  }
  setTransaction(config) {
    return this.session.execute(sql`set transaction ${this.getTransactionConfigSQL(config)}`);
  }
};

// src/db/schema.ts
var bytea = customType({ dataType: () => "bytea" });
var timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
};
var currentUser = sql`auth.uid()`;
var appRole = pgEnum("app_role", [
  "owner",
  "manager",
  "trainer",
  "member",
  "guest"
]);
var paymentMethod = pgEnum("payment_method", ["cash", "upi", "other"]);
var attendanceMethod = pgEnum("attendance_method", ["qr", "manual"]);
var reminderStage = pgEnum("reminder_stage", [
  "due_soon",
  "due_today",
  "overdue"
]);
var notificationChannel = pgEnum("notification_channel", [
  "push",
  "email",
  "whatsapp"
]);
var notificationStatus = pgEnum("notification_status", [
  "sending",
  "sent",
  "failed"
]);
var profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  fullName: text("full_name").notNull().default(""),
  email: text("email"),
  role: appRole("role").notNull().default("guest"),
  isActive: boolean("is_active").notNull().default(true),
  ...timestamps
});
var members = pgTable("members", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Assigned by the database from member_code_seq (IP-0001, IP-0002, …).
  memberCode: text("member_code").notNull().unique().default(
    sql`'IP-' || lpad(nextval('public.member_code_seq')::text, 4, '0')`
  ),
  fullName: text("full_name").notNull(),
  phone: text("phone").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  profileId: uuid("profile_id").references(() => profiles.id),
  reminderConsentAt: timestamp("reminder_consent_at", { withTimezone: true }),
  remindersMuted: boolean("reminders_muted").notNull().default(false),
  createdBy: uuid("created_by").default(currentUser),
  ...timestamps
});
var plans = pgTable("plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  durationMonths: smallint("duration_months").notNull(),
  // A default that pre-fills new memberships; members pay their own agreed fee.
  defaultFeePaise: integer("default_fee_paise").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  ...timestamps
});
var memberships = pgTable("memberships", {
  id: uuid("id").primaryKey().defaultRandom(),
  memberId: uuid("member_id").notNull().references(() => members.id),
  planId: uuid("plan_id").references(() => plans.id),
  startsOn: date("starts_on").notNull(),
  endedOn: date("ended_on"),
  // The first payment's day, which sets the monthly due day; null until the
  // first payment, meaning the joining day. Written only by database
  // triggers on payments and voids.
  billingStartsOn: date("billing_starts_on"),
  // Where staff moved the due date, oldest first; see the due_date_changes
  // migration. A change at period 0 replaces billingStartsOn.
  dueChanges: jsonb("due_changes").$type().notNull().default(sql`'[]'::jsonb`),
  createdBy: uuid("created_by").default(currentUser),
  ...timestamps
});
var membershipFees = pgTable("membership_fees", {
  id: uuid("id").primaryKey().defaultRandom(),
  membershipId: uuid("membership_id").notNull().references(() => memberships.id),
  feePaise: integer("fee_paise").notNull(),
  effectiveFrom: date("effective_from").notNull(),
  note: text("note"),
  setBy: uuid("set_by").notNull().default(currentUser),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});
var membershipFreezes = pgTable("membership_freezes", {
  id: uuid("id").primaryKey().defaultRandom(),
  membershipId: uuid("membership_id").notNull().references(() => memberships.id),
  startsOn: date("starts_on").notNull(),
  // Last frozen day; null means frozen until further notice.
  endsOn: date("ends_on"),
  note: text("note"),
  createdBy: uuid("created_by").notNull().default(currentUser),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});
var gymSettings = pgTable("gym_settings", {
  id: boolean("id").primaryKey().default(true),
  goneQuietDays: smallint("gone_quiet_days").notNull().default(30),
  printedQrEnabled: boolean("printed_qr_enabled").notNull().default(true),
  // Opening hours, published to members in bulletin.json
  // (src/bulletin/types.ts). Check-ins outside them are refused.
  weeklyHours: jsonb("weekly_hours").$type().notNull(),
  crowdCapacity: smallint("crowd_capacity").notNull().default(40),
  crowdMultiplier: numeric("crowd_multiplier", { precision: 3, scale: 2 }).notNull().default("1.00"),
  crowdFullMinutes: smallint("crowd_full_minutes").notNull().default(45),
  crowdGoneMinutes: smallint("crowd_gone_minutes").notNull().default(120),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});
var gymClosures = pgTable("gym_closures", {
  id: uuid("id").primaryKey().defaultRandom(),
  closesOn: date("closes_on").notNull().unique(),
  reason: text("reason").notNull().default(""),
  /** null: closed all day; otherwise the openings that still run. */
  hours: jsonb("hours").$type(),
  createdBy: uuid("created_by").notNull().default(currentUser),
  ...timestamps
});
var announcements = pgTable("announcements", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  body: text("body").notNull().default(""),
  pinned: boolean("pinned").notNull().default(false),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdBy: uuid("created_by").notNull().default(currentUser),
  ...timestamps
});
var payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  memberId: uuid("member_id").notNull().references(() => members.id),
  // Always the same member as memberId; a composite foreign key enforces it.
  membershipId: uuid("membership_id").notNull().references(() => memberships.id),
  // The first period this payment pays towards (0 = due on the joining day).
  // Money beyond that period's fee flows on to the next (brief §4.4).
  firstPeriod: smallint("first_period").notNull(),
  amountPaise: integer("amount_paise").notNull(),
  method: paymentMethod("method").notNull(),
  paidOn: date("paid_on").notNull(),
  receiptNumber: text("receipt_number"),
  slipPath: text("slip_path"),
  note: text("note"),
  replacesPaymentId: uuid("replaces_payment_id"),
  // Written only by the yearly close (private.close_year): one entry that
  // stands in for a membership's payments older than the cut-off. It counts
  // towards the ledger but is not money taken that day.
  carriedForward: boolean("carried_forward").notNull().default(false),
  recordedBy: uuid("recorded_by").notNull().default(currentUser),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});
var paymentVoids = pgTable("payment_voids", {
  paymentId: uuid("payment_id").primaryKey().references(() => payments.id),
  reason: text("reason").notNull(),
  voidedBy: uuid("voided_by").notNull().default(currentUser),
  voidedAt: timestamp("voided_at", { withTimezone: true }).notNull().defaultNow()
});
var attendance = pgTable("attendance", {
  id: uuid("id").primaryKey().defaultRandom(),
  memberId: uuid("member_id").notNull().references(() => members.id),
  checkedInAt: timestamp("checked_in_at", { withTimezone: true }).notNull().defaultNow(),
  // Filled in by the database: the gym's local day (Asia/Kolkata).
  gymDate: date("gym_date").notNull().default(sql`(now() at time zone 'Asia/Kolkata')::date`),
  method: attendanceMethod("method").notNull(),
  markedBy: uuid("marked_by").default(currentUser)
});
var claimTokens = pgTable("claim_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  memberId: uuid("member_id").notNull().references(() => members.id),
  tokenHash: bytea("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  usedBy: uuid("used_by"),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});
var deskDisplays = pgTable("desk_displays", {
  id: uuid("id").primaryKey().defaultRandom(),
  label: text("label").notNull(),
  tokenHash: bytea("token_hash").notNull(),
  createdBy: uuid("created_by").notNull().default(currentUser),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
});
var notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  memberId: uuid("member_id").notNull().references(() => members.id),
  // Always the same member as memberId; a composite foreign key enforces it.
  membershipId: uuid("membership_id").notNull().references(() => memberships.id),
  period: smallint("period").notNull(),
  stage: reminderStage("stage").notNull(),
  channel: notificationChannel("channel").notNull(),
  status: notificationStatus("status").notNull().default("sending"),
  dueOn: date("due_on").notNull(),
  amountPaise: integer("amount_paise").notNull(),
  error: text("error"),
  // Null when the daily job sent it.
  sentBy: uuid("sent_by").references(() => profiles.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true })
});
var pushSubscriptions = pgTable("push_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  profileId: uuid("profile_id").notNull().references(() => profiles.id),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});
var auditLog = pgTable("audit_log", {
  id: bigint("id", { mode: "number" }).primaryKey(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  actorId: uuid("actor_id"),
  tableName: text("table_name").notNull(),
  recordId: text("record_id").notNull(),
  action: text("action").notNull(),
  before: jsonb("before"),
  after: jsonb("after")
});

// src/notifications/channels/types.ts
async function describeFailure(response) {
  const text4 = (await response.text().catch(() => "")).slice(0, 200);
  return `${response.status} ${text4}`.trim().slice(0, 300);
}

// src/notifications/web-push.ts
var recordSize = 4096;
var encoder = new TextEncoder();
function base64UrlEncode(bytes2) {
  let binary = "";
  for (const byte of bytes2) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function base64UrlDecode(value2) {
  const base64 = value2.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
  return Uint8Array.from(binary, (char2) => char2.charCodeAt(0));
}
function concat(...parts2) {
  const out = new Uint8Array(parts2.reduce((sum, part2) => sum + part2.length, 0));
  let offset = 0;
  for (const part2 of parts2) {
    out.set(part2, offset);
    offset += part2.length;
  }
  return out;
}
async function hkdf(salt, ikm, info, length) {
  const key2 = await crypto.subtle.importKey("raw", ikm, "HKDF", false, [
    "deriveBits"
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info },
    key2,
    length * 8
  );
  return new Uint8Array(bits);
}
function p256Jwk(publicKey, privateKey) {
  if (publicKey.length !== 65 || publicKey[0] !== 4) {
    throw new Error("Expected an uncompressed P-256 public key");
  }
  return {
    kty: "EC",
    crv: "P-256",
    x: base64UrlEncode(publicKey.slice(1, 33)),
    y: base64UrlEncode(publicKey.slice(33, 65)),
    ...privateKey ? { d: base64UrlEncode(privateKey) } : {},
    ext: true
  };
}
async function encryptPayload(target, payload, options = {}) {
  const uaPublic = base64UrlDecode(target.p256dh);
  const authSecret = base64UrlDecode(target.auth);
  const salt = options.salt ?? crypto.getRandomValues(new Uint8Array(16));
  let serverPrivate;
  let serverPublic;
  if (options.serverKeys) {
    serverPrivate = await crypto.subtle.importKey(
      "jwk",
      p256Jwk(options.serverKeys.publicKey, options.serverKeys.privateKey),
      { name: "ECDH", namedCurve: "P-256" },
      false,
      ["deriveBits"]
    );
    serverPublic = options.serverKeys.publicKey;
  } else {
    const pair = await crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      true,
      ["deriveBits"]
    );
    serverPrivate = pair.privateKey;
    serverPublic = new Uint8Array(
      await crypto.subtle.exportKey("raw", pair.publicKey)
    );
  }
  const browserKey = await crypto.subtle.importKey(
    "raw",
    uaPublic,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );
  const ecdhSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: browserKey },
      serverPrivate,
      256
    )
  );
  const keyInfo = concat(
    encoder.encode("WebPush: info\0"),
    uaPublic,
    serverPublic
  );
  const ikm = await hkdf(authSecret, ecdhSecret, keyInfo, 32);
  const cek = await hkdf(
    salt,
    ikm,
    encoder.encode("Content-Encoding: aes128gcm\0"),
    16
  );
  const nonce = await hkdf(
    salt,
    ikm,
    encoder.encode("Content-Encoding: nonce\0"),
    12
  );
  const plaintext = concat(encoder.encode(payload), new Uint8Array([2]));
  if (plaintext.length + 16 > recordSize) {
    throw new Error("Push payload is too long for one record");
  }
  const aesKey = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, [
    "encrypt"
  ]);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce },
      aesKey,
      plaintext
    )
  );
  const header = new Uint8Array(16 + 4 + 1 + serverPublic.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, recordSize);
  header[20] = serverPublic.length;
  header.set(serverPublic, 21);
  return concat(header, ciphertext);
}
async function vapidToken(audience, keys, now2 = /* @__PURE__ */ new Date()) {
  const header = { typ: "JWT", alg: "ES256" };
  const claims = {
    aud: audience,
    exp: Math.floor(now2.getTime() / 1e3) + 12 * 60 * 60,
    sub: keys.subject
  };
  const unsigned = [header, claims].map((part2) => base64UrlEncode(encoder.encode(JSON.stringify(part2)))).join(".");
  const signingKey = await crypto.subtle.importKey(
    "jwk",
    p256Jwk(base64UrlDecode(keys.publicKey), base64UrlDecode(keys.privateKey)),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
  const signature2 = new Uint8Array(
    await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      signingKey,
      encoder.encode(unsigned)
    )
  );
  return `${unsigned}.${base64UrlEncode(signature2)}`;
}
async function buildPushRequest(target, payload, keys, ttlSeconds2) {
  const audience = new URL(target.endpoint).origin;
  const [body, token] = await Promise.all([
    encryptPayload(target, payload),
    vapidToken(audience, keys)
  ]);
  return {
    url: target.endpoint,
    init: {
      method: "POST",
      headers: {
        Authorization: `vapid t=${token}, k=${keys.publicKey}`,
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
        TTL: String(ttlSeconds2),
        Urgency: "normal"
      },
      body
    }
  };
}

// src/notifications/channels/push.ts
var ttlSeconds = 24 * 60 * 60;
async function deliverPush(targets, message, keys, fetchFn = fetch) {
  const payload = JSON.stringify(message);
  const results = await Promise.all(
    targets.map(async (target) => {
      try {
        const { url, init } = await buildPushRequest(
          target,
          payload,
          keys,
          ttlSeconds
        );
        const response = await fetchFn(url, init);
        if (response.ok) return { endpoint: target.endpoint, ok: true };
        return {
          endpoint: target.endpoint,
          ok: false,
          // 404 and 410 mean the browser unsubscribed or was reset.
          gone: response.status === 404 || response.status === 410,
          error: await describeFailure(response)
        };
      } catch (error2) {
        return {
          endpoint: target.endpoint,
          ok: false,
          error: error2 instanceof Error ? error2.message : "Push failed"
        };
      }
    })
  );
  const delivered = results.filter((result) => result.ok).length;
  const expiredEndpoints = results.filter((result) => "gone" in result && result.gone).map((result) => result.endpoint);
  if (delivered > 0) return { ok: true, delivered, expiredEndpoints };
  return {
    ok: false,
    delivered,
    error: results.find((result) => result.error)?.error ?? "Push failed",
    expiredEndpoints
  };
}

// node_modules/postgres/src/index.js
import os from "node:os";
import fs2 from "node:fs";

// node_modules/postgres/src/errors.js
var PostgresError = class extends Error {
  constructor(x) {
    super(typeof x === "string" ? x : x && x.message);
    this.name = this.constructor.name;
    x && typeof x === "object" && Object.assign(this, x);
  }
  toJSON() {
    return { ...this, message: this.message };
  }
};
var Errors = {
  connection,
  postgres,
  generic,
  notSupported
};
function connection(code, options, host, port) {
  const address = options.path || host, error2 = Object.assign(
    new Error("write " + code + " " + (options.path || host + ":" + port)),
    { code, errno: code, address },
    options.path ? {} : { port }
  );
  Error.captureStackTrace(error2, connection);
  return error2;
}
function postgres(x) {
  const error2 = new PostgresError(x);
  Error.captureStackTrace(error2, postgres);
  return error2;
}
function generic(code, message) {
  const error2 = Object.assign(new Error(code + ": " + message), { code });
  Error.captureStackTrace(error2, generic);
  return error2;
}
function notSupported(x) {
  const error2 = Object.assign(new Error(x + " (B) is not supported"), { code: "MESSAGE_NOT_SUPPORTED", name: x });
  Error.captureStackTrace(error2, notSupported);
  return error2;
}
var places = locations();
var ours = (line2) => places.some((here) => line2.includes(here) && !line2.slice(line2.indexOf(here) + here.length).split(":")[0].includes("/"));
function locations() {
  try {
    const url = new URL(".", import.meta.url);
    return url.protocol === "file:" ? [url.href, decodeURIComponent(url.pathname)] : [url.href];
  } catch (error2) {
    return [];
  }
}
function withOrigin(error2, origin) {
  origin && Object.defineProperty(error2, "stack", {
    value: [firstLine(error2), ...origin.split("\n").slice(1).filter((x) => !ours(x))].join("\n"),
    writable: true,
    configurable: true,
    enumerable: false
  });
  return error2;
}
function firstLine(error2) {
  return typeof error2.stack === "string" ? error2.stack.split("\n")[0] : (error2.name || "Error") + (error2.message ? ": " + error2.message : "");
}
function queryError(error2, q, debug) {
  if (!error2 || typeof error2 !== "object")
    error2 = new Error(error2);
  if (!q || "query" in error2)
    return error2;
  const built = q.built;
  Object.defineProperties(error2, {
    query: { value: built ? built.text : q.strings[0], enumerable: !!debug, configurable: true, writable: true },
    parameters: { value: built ? built.values : [], enumerable: !!debug, configurable: true, writable: true },
    args: { value: q.args, enumerable: !!debug, configurable: true, writable: true },
    types: { value: built ? built.oids : [], enumerable: !!debug, configurable: true, writable: true }
  });
  return withOrigin(error2, q.origin);
}

// node_modules/postgres/src/types.js
var number = (x) => +x;
var bool = (x) => x === "t";
var json2 = (x) => JSON.parse(x);
var string = (x) => x instanceof Date ? serializeDate(x) : Array.isArray(x) ? serializeArray(x, string) : literal(x) ? JSON.stringify(x) : "" + x;
var literal = (x) => x !== null && typeof x === "object" && (Object.getPrototypeOf(x) === Object.prototype || Object.getPrototypeOf(x) === null);
var arrays = {
  16: 1e3,
  17: 1001,
  18: 1002,
  19: 1003,
  20: 1016,
  21: 1005,
  22: 1006,
  23: 1007,
  24: 1008,
  25: 1009,
  26: 1028,
  27: 1010,
  28: 1011,
  29: 1012,
  30: 1013,
  114: 199,
  142: 143,
  600: 1017,
  601: 1018,
  602: 1019,
  603: 1020,
  604: 1027,
  628: 629,
  650: 651,
  700: 1021,
  701: 1022,
  718: 719,
  774: 775,
  790: 791,
  829: 1040,
  869: 1041,
  1033: 1034,
  1042: 1014,
  1043: 1015,
  1082: 1182,
  1083: 1183,
  1114: 1115,
  1184: 1185,
  1186: 1187,
  1266: 1270,
  1560: 1561,
  1562: 1563,
  1700: 1231,
  1790: 2201,
  2202: 2207,
  2203: 2208,
  2204: 2209,
  2205: 2210,
  2206: 2211,
  2249: 2287,
  2275: 1263,
  2950: 2951,
  2970: 2949,
  3220: 3221,
  3614: 3643,
  3615: 3645,
  3734: 3735,
  3769: 3770,
  3802: 3807,
  3904: 3905,
  3906: 3907,
  3908: 3909,
  3910: 3911,
  3912: 3913,
  3926: 3927,
  4072: 4073,
  4089: 4090,
  4096: 4097,
  5038: 5039,
  5069: 271
};
var types = {
  string: { to: 25, from: null, serialize: string },
  number: { to: 0, from: [21, 23, 26, 700, 701], serialize: string, parse: number },
  json: { to: 114, from: [114, 3802], serialize: (x) => JSON.stringify(x), parse: json2 },
  boolean: { to: 16, from: [16], serialize: (x) => x === true ? "t" : "f", parse: bool },
  date: { to: 1184, from: [1082, 1114, 1184], serialize: serializeDate, parse: null },
  bytea: { to: 17, from: [17], serialize: (x) => "\\x" + Buffer.from(x).toString("hex"), parse: (x) => Buffer.from(x.slice(2), "hex") }
};
var dates = { 1082: parseDate, 1114: parseTimestamp, 1184: parseTimestamptz };
var elementsOf = { 1e3: 16, 1005: 21, 1007: 23, 1016: 20 };
var readers = {
  16: binaryArray((x, i) => x[i] === 1),
  21: binaryArray((x, i) => (x[i] << 24 | x[i + 1] << 16) >> 16),
  23: binaryArray((x, i) => x[i] << 24 | x[i + 1] << 16 | x[i + 2] << 8 | x[i + 3]),
  20: binaryArray((x, i) => x.readBigInt64BE(i).toString())
};
function bytes(x, i, end) {
  return Buffer.from(x.subarray(i, end));
}
function binaryArray(read2) {
  return function(x, i) {
    const dims = int32(x, i);
    if (dims === 0)
      return [];
    const sizes = new Array(dims);
    for (let d2 = 0; d2 < dims; d2++)
      sizes[d2] = int32(x, i + 12 + d2 * 8);
    let at = i + 12 + dims * 8;
    return level(0);
    function level(d2) {
      const n = sizes[d2], xs = new Array(n);
      if (d2 < dims - 1) {
        for (let k = 0; k < n; k++)
          xs[k] = level(d2 + 1);
        return xs;
      }
      for (let k = 0; k < n; k++) {
        const length = int32(x, at);
        at += 4;
        if (length === -1) {
          xs[k] = null;
        } else {
          xs[k] = read2(x, at);
          at += length;
        }
      }
      return xs;
    }
  };
}
function int32(x, i) {
  return x[i] << 24 | x[i + 1] << 16 | x[i + 2] << 8 | x[i + 3];
}
function integer2(x, i, end) {
  const negative = x[i] === 45;
  let n = 0;
  for (negative && i++; i < end; i++)
    n = n * 10 + x[i] - 48;
  return negative ? -n : n;
}
function boolean2(x, i) {
  return x[i] === 116;
}
var latin1 = typeof Buffer.prototype.latin1Slice === "function" ? (x, start2, end) => x.latin1Slice(start2, end) : (x, start2, end) => x.toString("latin1", start2, end);
function digits(x, i, n) {
  let v = 0;
  for (const end = i + n; i < end; i++) {
    const d2 = x[i] - 48;
    if (d2 < 0 || d2 > 9)
      return -1;
    v = v * 10 + d2;
  }
  return v;
}
function clock(x, i, end, zoned) {
  const year = digits(x, i, 4);
  if (year < 1e3 || x[i + 4] !== 45 || x[i + 7] !== 45)
    return NaN;
  const month = digits(x, i + 5, 2), day = digits(x, i + 8, 2);
  if (end - i === 10)
    return zoned || month < 1 || day < 1 ? NaN : Date.UTC(year, month - 1, day);
  if (x[i + 10] !== 32 || x[i + 13] !== 58 || x[i + 16] !== 58)
    return NaN;
  const hour = digits(x, i + 11, 2), minute = digits(x, i + 14, 2), second = digits(x, i + 17, 2);
  let at = i + 19, ms = 0;
  if (x[at] === 46) {
    let scale = 100;
    for (at++; at < end && x[at] >= 48 && x[at] <= 57; at++) {
      ms += (x[at] - 48) * scale;
      scale = scale / 10 | 0;
    }
  }
  let offset = 0;
  if (zoned) {
    const sign = x[at];
    if (sign !== 43 && sign !== 45 || end - at !== 3 && (end - at !== 6 || x[at + 3] !== 58))
      return NaN;
    offset = digits(x, at + 1, 2) * 60 + (end - at === 6 ? digits(x, at + 4, 2) : 0);
    if (offset < 0 || digits(x, at + 1, 2) < 0 || end - at === 6 && digits(x, at + 4, 2) < 0)
      return NaN;
    sign === 45 && (offset = -offset);
    at = end;
  }
  if (at !== end || month < 1 || day < 1 || hour < 0 || minute < 0 || second < 0)
    return NaN;
  return Date.UTC(year, month - 1, day, hour, minute, second, ms) - offset * 6e4;
}
function timestamptz(x, i, end) {
  const t = clock(x, i, end, true);
  return Number.isNaN(t) ? parseTimestamptz(latin1(x, i, end)) : new Date(t);
}
function utcStamp(x, i, end) {
  const t = clock(x, i, end, false);
  return Number.isNaN(t) ? parseDate(latin1(x, i, end)) : new Date(t);
}
var shaped = (is2, serialize) => (x) => is2(x) ? serialize(x) : string(x);
var shapedTypes = {
  ...types,
  boolean: { ...types.boolean, serialize: shaped((x) => typeof x === "boolean", types.boolean.serialize) },
  date: { ...types.date, serialize: shaped((x) => x instanceof Date, types.date.serialize) },
  bytea: { ...types.bytea, serialize: shaped((x) => x instanceof Uint8Array, types.bytea.serialize) }
};
function Types(options = {}) {
  const parsers = {}, serializers = {}, elements = {}, undefinedValue = options.transform && options.transform.undefined;
  Object.entries(arrays).forEach(([oid, array]) => elements[array] = [+oid, +oid === 603 ? ";" : ","]);
  register(options.infer === false ? shapedTypes : types);
  Object.assign(parsers, dates);
  options.infer === false && (parsers[1114] = parseDate);
  const custom = Object.values(options.types || {}), named = custom.filter((x) => [x.to].concat(x.from || []).some((y) => typeof y === "string")), oids = {}, own3 = /* @__PURE__ */ new Set();
  register(custom.filter((x) => !named.includes(x)));
  custom.forEach((x) => [x.to].concat(x.from || []).forEach((oid) => own3.add(oid)));
  const keys = options.transform && options.transform.json && options.transform.column.to;
  keys && [114, 3802].forEach((oid) => own3.has(oid) || (serializers[oid] = renamed(serializers[oid], keys)));
  const bases = {};
  return {
    parser,
    decoder,
    known,
    unknown: unknown2,
    binary,
    serializer,
    load,
    infer,
    resolve,
    named: named.length > 0,
    plain: !custom.some((x) => x.serialize),
    parsers,
    serializers
  };
  function binary(oid) {
    if (own3.has(oid))
      return null;
    if (oid === 17)
      return parsers[17] === types.bytea.parse ? bytes : null;
    const element = elementsOf[oid];
    return element !== void 0 && !own3.has(element) && (element !== 20 || !(20 in parsers)) ? readers[element] : null;
  }
  function unknown2(oids2) {
    for (let i = 0; i < oids2.length; i++) {
      const oid = oids2[i];
      if (oid >= 16384 && !(oid in parsers) && !(oid in serializers) && !(oid in elements) && !(oid in bases))
        return true;
    }
    return false;
  }
  function known(oid) {
    return oid in serializers || oid in elements;
  }
  function resolve(type) {
    return typeof type === "string" ? oids[type] || 0 : type;
  }
  function decoder(oid, parse3) {
    return parse3 === number && (oid === 21 || oid === 23 || oid === 26) ? integer2 : parse3 === bool && oid === 16 ? boolean2 : parse3 === parseTimestamptz && oid === 1184 ? timestamptz : parse3 === parseDate && (oid === 1114 || oid === 1082) ? utcStamp : null;
  }
  function register(xs) {
    Object.values(xs).forEach((x) => {
      const from = [].concat(x.from || []);
      x.parse && from.forEach((oid) => parsers[oid] = x.parse);
      if (x.serialize) {
        serializers[x.to] = x.serialize;
        from.forEach((oid) => serializers[oid] = x.serialize);
      }
    });
  }
  function parser(oid) {
    if (oid in parsers)
      return parsers[oid];
    if (oid in bases)
      return parsers[oid] = parser(bases[oid]);
    if (oid in elements) {
      const [element, delimiter] = elements[oid], parse3 = parser(element);
      return parsers[oid] = (x) => parseArray(x, parse3 === identity ? null : parse3, delimiter);
    }
    return identity;
  }
  function serializer(oid) {
    if (oid in serializers)
      return serializers[oid];
    if (oid in bases)
      return serializers[oid] = serializer(bases[oid]);
    if (oid in elements) {
      const [element, delimiter] = elements[oid], serialize = serializer(element);
      return serializers[oid] = (xs) => Array.isArray(xs) ? serializeArray(xs, serialize, delimiter, undefinedValue) : serialize(xs);
    }
    return string;
  }
  function load(run2) {
    return Promise.all([fetched(run2), named.length && names(run2)]);
  }
  async function names(run2) {
    const wanted = [...new Set(named.flatMap((x) => [x.to].concat(x.from || [])).filter((x) => typeof x === "string"))], list = wanted.map((x) => "'" + x.split(".").pop().replace(/'/g, "''") + "'").join(","), rows = await run2(
      "select t.oid::int, t.typarray::int as array, t.typdelim as delimiter, t.typname as name, n.nspname as schema, pg_catalog.pg_type_is_visible(t.oid) as visible from pg_catalog.pg_type t join pg_catalog.pg_namespace n on n.oid = t.typnamespace where t.typname in (" + list + ")"
    ), missing = [];
    wanted.forEach((x) => {
      const [schema, name] = x.includes(".") ? x.split(".") : [null, x], row = rows.find((r) => r.name === name && (schema ? r.schema === schema : r.visible));
      row ? (oids[x] = row.oid, row.array && !(row.array in elements) && (elements[row.array] = [row.oid, row.delimiter])) : missing.push(x);
    });
    if (missing.length) {
      throw Errors.generic("TYPE_NOT_FOUND", missing.length > 1 ? "The types " + missing.join(", ") + " do not exist" : "The type " + missing[0] + " does not exist");
    }
    register(named.map((x) => ({ ...x, to: resolve(x.to), from: [].concat(x.from || []).map(resolve) })));
    named.forEach((x) => [x.to].concat(x.from || []).forEach((y) => own3.add(resolve(y))));
  }
  function fetched(run2) {
    return run2(
      "select oid::int, typelem::int as element, typdelim as delimiter, typbasetype::int as base, typtype as kind from pg_catalog.pg_type where typtype = 'd' or (typcategory = 'A' and oid >= 16384)"
    ).then((rows) => rows.forEach(({ oid, element, delimiter, base, kind }) => {
      if (oid in parsers || oid in serializers)
        return;
      kind === "d" ? bases[oid] = base : element && !(oid in elements) && (elements[oid] = [element, delimiter]);
    }));
  }
}
var identity = (x) => x;
identity.identity = true;
var Parameter = class {
  constructor(value2, type) {
    this.value = value2;
    this.type = type;
  }
};
function infer(x) {
  return x instanceof Parameter ? x.type : x instanceof Date ? 1184 : x instanceof Uint8Array ? 17 : x === true || x === false ? 16 : typeof x === "bigint" ? 20 : Array.isArray(x) ? arrays[infer(x[0])] || 0 : 0;
}
function parseArray(x, parse3, delimiter = ",") {
  let i = x[0] === "[" ? x.indexOf("=") + 1 : 0;
  return level();
  function level() {
    const xs = [];
    i++;
    while (i < x.length && x[i] !== "}") {
      if (x[i] === "{") {
        xs.push(level());
      } else if (x[i] === '"') {
        let s = "";
        for (i++; x[i] !== '"'; i++)
          s += x[i] === "\\" ? x[++i] : x[i];
        i++;
        xs.push(parse3 ? parse3(s) : s);
      } else {
        const start2 = i;
        while (x[i] !== delimiter && x[i] !== "}")
          i++;
        const s = x.slice(start2, i);
        xs.push(s === "NULL" ? null : parse3 ? parse3(s) : s);
      }
      x[i] === delimiter && i++;
    }
    i++;
    return xs;
  }
}
function serializeArray(xs, serialize = string, delimiter = ",", undefinedValue) {
  return "{" + xs.map((x) => {
    const typed = x instanceof Parameter;
    typed && (x = x.value);
    x === void 0 && (x = undefinedValue);
    if (x === void 0)
      throw Errors.generic("UNDEFINED_VALUE", "Undefined values are not allowed");
    return Array.isArray(x) && !typed ? serializeArray(x, serialize, delimiter, undefinedValue) : x === null ? "NULL" : '"' + ("" + serialize(x)).replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
  }).join(delimiter) + "}";
}
function serializeDate(x) {
  return x === Infinity ? "infinity" : x === -Infinity ? "-infinity" : (x instanceof Date ? x : new Date(x)).toISOString();
}
var timestamp2 = /^(\d{4,})-(\d\d)-(\d\d)(?: (\d\d):(\d\d):(\d\d)(?:\.(\d+))?)?(?:([+-])(\d\d)(?::(\d\d))?(?::(\d\d))?)?( BC)?$/;
function parts(x) {
  const m = x.match(timestamp2);
  if (!m)
    return null;
  const year = m[12] ? 1 - m[1] : +m[1], ms = m[7] ? +(m[7] + "00").slice(0, 3) : 0, offset = m[8] ? (m[8] === "-" ? -1 : 1) * ((m[9] * 60 + +(m[10] || 0)) * 60 + +(m[11] || 0)) * 1e3 : 0;
  return { year, month: m[2] - 1, day: +m[3], hour: +(m[4] || 0), minute: +(m[5] || 0), second: +(m[6] || 0), ms, offset };
}
function infinite(x) {
  return x === "infinity" ? Infinity : x === "-infinity" ? -Infinity : null;
}
function utc(x) {
  const date2 = new Date(Date.UTC(2e3, x.month, x.day, x.hour, x.minute, x.second, x.ms));
  date2.setUTCFullYear(x.year);
  return date2;
}
function plain(x) {
  const n = x.length;
  return x.charCodeAt(0) !== 48 && x.charCodeAt(n - 1) !== 67 && !(x.charCodeAt(n - 3) === 58 && x.charCodeAt(n - 6) === 58) && x.charCodeAt(0) !== 45 && x.charCodeAt(0) !== 105;
}
function parseTimestamptz(x) {
  if (plain(x))
    return new Date(x);
  const p2 = infinite(x) || parts(x);
  if (!p2)
    return new Date(x);
  if (typeof p2 === "number")
    return p2;
  const date2 = utc(p2);
  date2.setTime(date2.getTime() - p2.offset);
  return date2;
}
function parseDate(x) {
  const p2 = infinite(x) || parts(x);
  return !p2 ? new Date(x) : typeof p2 === "number" ? p2 : utc(p2);
}
function parseTimestamp(x) {
  const p2 = infinite(x) || parts(x);
  if (!p2 || typeof p2 === "number")
    return p2 || new Date(x);
  if (p2.year >= 100)
    return new Date(p2.year, p2.month, p2.day, p2.hour, p2.minute, p2.second, p2.ms);
  const date2 = new Date(2e3, 0, 1);
  date2.setFullYear(p2.year, p2.month, p2.day);
  date2.setHours(p2.hour, p2.minute, p2.second, p2.ms);
  return date2;
}
var toCamel = (x) => {
  let str = x.slice(0, 1);
  for (let i = 1; i < x.length; i++)
    str += x[i] === "_" && i < x.length - 1 ? x[++i].toUpperCase() : x[i];
  return str;
};
var toPascal = (x) => {
  let str = x.slice(0, 1).toUpperCase();
  for (let i = 1; i < x.length; i++)
    str += x[i] === "_" && i < x.length - 1 ? x[++i].toUpperCase() : x[i];
  return str;
};
var toKebab = (x) => x.replace(/_/g, "-");
var fromCamel = (x) => x.replace(/([A-Z])/g, "_$1").toLowerCase();
var fromPascal = (x) => (x.slice(0, 1) + x.slice(1).replace(/([A-Z])/g, "_$1")).toLowerCase();
var fromKebab = (x) => x.replace(/-/g, "_");
function renamed(serialize, fn) {
  return (x) => serialize(rename(x, fn));
}
function rename(x, fn) {
  if (Array.isArray(x))
    return x.map((x2) => rename(x2, fn));
  if (x === null || typeof x !== "object" || Object.getPrototypeOf(x) !== Object.prototype && Object.getPrototypeOf(x) !== null)
    return x;
  const out = {};
  for (const k in x)
    Object.hasOwn(x, k) && Object.defineProperty(out, fn(k), { value: rename(x[k], fn), enumerable: true, writable: true, configurable: true });
  return out;
}
function createJsonTransform(fn) {
  jsonTransform.keys = true;
  return jsonTransform;
  function jsonTransform(x, column2) {
    return typeof x === "object" && x !== null && (column2.type === 114 || column2.type === 3802) ? Array.isArray(x) ? x.map((x2) => jsonTransform(x2, column2)) : Object.entries(x).reduce((acc, [k, v]) => Object.assign(acc, { [fn(k)]: jsonTransform(v, column2) }), {}) : x;
  }
}
toCamel.column = { from: toCamel };
toCamel.value = { from: createJsonTransform(toCamel) };
fromCamel.column = { to: fromCamel };
var camel = { ...toCamel };
camel.column.to = fromCamel;
toPascal.column = { from: toPascal };
toPascal.value = { from: createJsonTransform(toPascal) };
fromPascal.column = { to: fromPascal };
var pascal = { ...toPascal };
pascal.column.to = fromPascal;
toKebab.column = { from: toKebab };
toKebab.value = { from: createJsonTransform(toKebab) };
fromKebab.column = { to: fromKebab };
var kebab = { ...toKebab };
kebab.column.to = fromKebab;

// node_modules/postgres/src/build.js
var isQuery = /* @__PURE__ */ Symbol("query");
var NotTagged = class {
  then() {
    notTagged();
  }
  catch() {
    notTagged();
  }
  finally() {
    notTagged();
  }
};
var Identifier = class extends NotTagged {
  constructor(value2) {
    super();
    this.value = value2;
  }
};
var Join = class {
  constructor(separator, items) {
    this.separator = separator;
    this.items = items;
  }
};
var joinStrings = Object.assign(["", ""], { raw: ["", ""] });
var Builder = class extends NotTagged {
  constructor(first, rest) {
    super();
    this.first = first;
    this.rest = rest;
  }
};
function build(query2, options) {
  const values2 = [], oids = [], o = { transform: options.transform, infer: options.infer !== false, resolve: options.resolve, values: values2, oids, dynamic: !query2.tagged };
  const text4 = query2.tagged ? stringify(query2, o) : (query2.args.forEach((x) => value(x, o)), "" + query2.strings[0]);
  if (values2.length >= 65534)
    throw Errors.generic("MAX_PARAMETERS_EXCEEDED", "Max number of parameters (65534) exceeded");
  const types2 = oids.join();
  return { strings: query2.strings, dynamic: o.dynamic, types: types2, text: text4, values: values2, oids };
}
function stringify(q, o) {
  let string2 = q.strings[0];
  for (let i = 1; i < q.strings.length; i++)
    string2 += part(string2, q.args[i - 1], o, q.strings[i]) + q.strings[i];
  return string2;
}
function part(before, x, o, after2 = "") {
  if (x instanceof Builder || x instanceof Identifier || isFragment(x) || Array.isArray(x) && isFragment(x[0]))
    o.dynamic = true;
  return isFragment(x) && x.strings === joinStrings ? joined(x.args[0], o, before, after2) : x instanceof Join ? joined(x, o, "", "") : x instanceof Builder ? helper(before, x, o) : isFragment(x) ? fragment(x, o) : x instanceof Identifier ? x.value : Array.isArray(x) && isFragment(x[0]) ? x.reduce((acc, x2) => acc + " " + fragment(x2, o), "") : value(x, o);
}
function joined(join, o, before, after2) {
  let text4 = "";
  join.items.forEach((item, i) => {
    i > 0 && (text4 = spaced(text4, fragment(join.separator, o)));
    text4 = spaced(text4, part("", item, o));
  });
  before && text4 && !/\s$/.test(before) && !/^\s/.test(text4) && (text4 = " " + text4);
  after2 && text4 && !/^\s/.test(after2) && !/\s$/.test(text4) && (text4 = text4 + " ");
  return text4;
}
function spaced(a, b) {
  return a && b && !/\s$/.test(a) && !/^\s/.test(b) ? a + " " + b : a + b;
}
function isFragment(x) {
  return !!x && x[isQuery] === true;
}
function fragment(q, o) {
  return q.tagged ? stringify(q, o) : q.strings[0];
}
function value(x, o) {
  let v = x instanceof Parameter ? x.value : x;
  if (v === void 0) {
    v = o.transform.undefined;
    if (v === void 0)
      throw Errors.generic("UNDEFINED_VALUE", "Undefined values are not allowed");
    x instanceof Parameter || (x = v);
  }
  o.values.push(v);
  o.oids.push(x instanceof Parameter ? o.resolve(x.type) : o.infer ? infer(x) : 0);
  return "$" + o.values.length;
}
var builders = {
  values,
  in: (...xs) => {
    const x = values(...xs);
    return x === "()" ? "(null)" : x;
  },
  select,
  update,
  insert,
  call
};
function call(first, rest, o) {
  if (first === null || typeof first !== "object" || Array.isArray(first) || isFragment(first))
    return select(first, rest, o);
  return columns(first, rest).map(
    (x) => escapeIdentifier(column(x, o)) + " => " + part("values", first[x], o)
  ).join(",");
}
var clauses = { in: "in", values: "values", select: "select", returning: "select", set: "update", distinct: "select" };
var stops = /* @__PURE__ */ new Set([
  "from",
  "where",
  "on",
  "to",
  "join",
  "group",
  "order",
  "by",
  "having",
  "limit",
  "offset",
  "union",
  "intersect",
  "except",
  "using",
  "and",
  "or",
  "when",
  "then",
  "else",
  "with",
  "table",
  "grant",
  "revoke",
  "delete",
  "update",
  "case",
  "not",
  "like",
  "ilike",
  "between",
  "is",
  "exists",
  "conflict",
  "do",
  "nothing",
  "window",
  "over",
  "partition",
  "filter",
  "lateral",
  "cross",
  "inner",
  "left",
  "right",
  "full",
  "outer",
  "natural",
  "into"
]);
function helper(before, x, o) {
  const kind = context(before);
  return kind ? builders[kind](x.first, x.rest, o) : identifiers(typeof x.first === "string" ? [x.first].concat(x.rest) : x.first, o);
}
function context(sql2) {
  const words = [];
  let i = sql2.length - 1, depth = 0;
  while (i >= 0) {
    const c2 = sql2[i];
    if (c2 === ")") {
      depth++;
      i--;
    } else if (c2 === "(") {
      if (depth === 0) {
        const word = previous(sql2, i - 1);
        if (words.length === 0)
          return word === "in" || word === "values" ? word : word && !clauses[word] && !stops.has(word) ? "call" : "select";
        return "select";
      }
      depth--;
      i--;
    } else if (c2 === "'" || c2 === '"') {
      const end = i;
      i--;
      while (i >= 0 && !(sql2[i] === c2 && sql2[i - 1] !== c2))
        sql2[i] === c2 ? i -= 2 : i--;
      i--;
      if (sql2[i] === ".")
        i--;
      else if (depth === 0 && c2 === '"' && sql2[end + 1] === "." && words.length)
        words[words.length - 1] = sql2.slice(i + 1, end + 1) + words[words.length - 1];
      else if (depth === 0 && c2 === '"')
        words.push(sql2.slice(i + 1, end + 1));
    } else if (/[a-z_0-9$]/i.test(c2)) {
      const end = i + 1;
      while (i >= 0 && /[a-z_0-9$.]/i.test(sql2[i]))
        i--;
      const word = depth === 0 && sql2.slice(i + 1, end).toLowerCase();
      if (word && clauses[word])
        return clauses[word];
      if (word === "into")
        return insert_into(words, sql2, i) ? "insert" : null;
      if (word && stops.has(word))
        return null;
      word && words.push(word);
    } else {
      i--;
    }
  }
  return null;
}
function previous(sql2, i) {
  while (i >= 0 && /\s/.test(sql2[i]))
    i--;
  if (sql2[i] === '"')
    return '"';
  const end = i + 1;
  while (i >= 0 && /[a-z_0-9$.]/i.test(sql2[i]))
    i--;
  return sql2.slice(i + 1, end).toLowerCase();
}
function insert_into(words, sql2, i) {
  const target = words.length === 1 || words.length === 3 && words[1] === "as";
  return target && previous(sql2, i) === "insert";
}
function valuesBuilder(first, columns2, o) {
  return first.map(
    (row) => "(" + columns2.map((x) => part("values", row[x], o)).join(",") + ")"
  ).join(",");
}
function values(first, rest, o) {
  const rows = Array.isArray(first) && first.length > 0 && first[0] !== null && typeof first[0] === "object" && !isFragment(first[0]), picked = columns(rows ? first[0] : first, rest);
  return valuesBuilder(rows ? first : [first], picked, o);
}
function update(first, rest, o) {
  const picked = columns(first, rest);
  picked.length || empty("update");
  return picked.map(
    (x) => escapeIdentifier(column(x, o)) + "=" + part("values", first[x], o)
  );
}
function insert(first, rest, o) {
  if (Array.isArray(first) && first.every((x) => typeof x === "string"))
    return "(" + escapeIdentifiers(first.concat(rest.flat()), o) + ")";
  const picked = columns(Array.isArray(first) ? first[0] || {} : first, rest);
  picked.length || empty("insert");
  return "(" + escapeIdentifiers(picked, o) + ")values" + valuesBuilder(Array.isArray(first) ? first : [first], picked, o);
}
function columns(first, rest) {
  return rest.length ? rest.flat() : Object.keys(first);
}
function empty(x) {
  throw Errors.generic("NO_COLUMNS", "The " + x + " helper got no columns");
}
function identifiers(first, o) {
  return Array.isArray(first) ? first.map((x) => member(x, o)).join(",") : member(first, o);
}
function member(x, o) {
  return isFragment(x) ? fragment(x, o) : x instanceof Identifier ? x.value : escapeIdentifier(column(x, o));
}
function select(first, rest, o) {
  typeof first === "string" && (first = [first].concat(rest));
  if (Array.isArray(first))
    return identifiers(first, o);
  return columns(first, rest).map((x) => {
    const v = first[x];
    return (isFragment(v) ? fragment(v, o) : v instanceof Identifier ? v.value : value(v, o)) + " as " + escapeIdentifier(column(x, o));
  }).join(",");
}
function column(x, o) {
  return o.transform.column.to ? o.transform.column.to(x) : x;
}
function escapeIdentifiers(xs, o) {
  return xs.map((x) => escapeIdentifier(column(x, o))).join(",");
}
function escapeIdentifier(x) {
  return '"' + x.replace(/"/g, '""').replace(/\./g, '"."') + '"';
}
function notTagged() {
  throw Errors.generic("NOT_TAGGED_CALL", "Query not called as a tagged template literal");
}

// node_modules/postgres/src/query.js
import util from "node:util";

// node_modules/postgres/src/diagnostics.js
import dc from "node:diagnostics_channel";
var channels = {
  query: tracing("postgres:query"),
  connect: tracing("postgres:connect"),
  transaction: tracing("postgres:transaction"),
  pool: plain2("postgres:pool"),
  notice: plain2("postgres:notice")
};
var done = /* @__PURE__ */ Symbol("done");
var now = () => performance.now();
var userName = (options) => typeof options.user === "function" ? null : options.user;
function active(t) {
  return !!t && (t.hasSubscribers !== void 0 ? t.hasSubscribers : t.start.hasSubscribers || t.end.hasSubscribers || t.asyncStart.hasSubscribers || t.asyncEnd.hasSubscribers || t.error.hasSubscribers);
}
function listened(channel) {
  return !!channel && channel.hasSubscribers;
}
function start(t, context4, fn) {
  return typeof t.start.runStores === "function" ? t.start.runStores(context4, run2) : (t.start.publish(context4), run2());
  function run2() {
    try {
      return fn();
    } finally {
      t.end.publish(context4);
    }
  }
}
function finish(t, context4, error2, result) {
  if (context4[done])
    return;
  context4[done] = true;
  if (error2) {
    context4.error = error2;
    t.error.publish(context4);
  } else {
    context4.result = result;
  }
  t.asyncStart.publish(context4);
  t.asyncEnd.publish(context4);
}
function tracing(name) {
  try {
    return typeof dc.tracingChannel === "function" ? dc.tracingChannel(name) : null;
  } catch (error2) {
    return null;
  }
}
function plain2(name) {
  try {
    return dc.channel(name);
  } catch (error2) {
    return null;
  }
}

// node_modules/postgres/src/result.js
var Result = class extends Array {
  #count = null;
  #state = null;
  #command = null;
  #columns = null;
  #statement = null;
  get count() {
    return this.#count;
  }
  set count(x) {
    this.#count = x;
  }
  get state() {
    return this.#state;
  }
  set state(x) {
    this.#state = x;
  }
  get command() {
    return this.#command;
  }
  set command(x) {
    this.#command = x;
  }
  get columns() {
    return this.#columns;
  }
  set columns(x) {
    this.#columns = x;
  }
  get statement() {
    const x = this.#statement;
    return x && x.kind ? this.#statement = statement(x) : x;
  }
  set statement(x) {
    this.#statement = x;
  }
  static get [Symbol.species]() {
    return Array;
  }
};
function statement(item) {
  const x = item.statement;
  return {
    name: x ? x.name : "",
    string: x ? x.text : item.text || "",
    types: item.params || item.entry && item.entry.oids || x && x.oids || [],
    columns: item.columns || []
  };
}

// node_modules/postgres/src/query.js
var origins = /* @__PURE__ */ new WeakMap();
var noop = () => {
};
var CLOSE = {};
var Query = class _Query extends Promise {
  constructor(strings, args, handler, options = {}) {
    let resolve, reject;
    super((a, b) => {
      resolve = a;
      reject = b;
    });
    this.fulfil = resolve;
    this.fail = reject;
    this[isQuery] = true;
    this.tagged = Array.isArray(strings.raw);
    this.strings = strings;
    this.args = args;
    this.handler = handler;
    this.options = options;
    this.state = null;
    this.source = null;
    this.active = false;
    this.executed = false;
    this.settled = false;
    this.built = null;
    this.trace = null;
    this.aborts = null;
    this.timer = null;
    this.timedOut = false;
    this.originError = handler.debug ? new Error() : null;
    this.tagged && !handler.debug && !origins.has(strings) && origins.set(strings, located());
  }
  static get [Symbol.species]() {
    return Promise;
  }
  join(items) {
    const kept = [...items].filter((x) => x !== false && x !== null && x !== void 0), joined2 = new _Query(joinStrings, [new Join(this, kept)], this.handler);
    Object.defineProperty(joined2, "length", { value: kept.length });
    return joined2;
  }
  resolve(x) {
    this.timer && untime(this);
    this.aborts && this.aborts();
    this.active = false;
    this.settled = true;
    this.trace && traced(this, null, x);
    this.fulfil(x);
  }
  reject(x) {
    this.timer && untime(this);
    this.timedOut && x && timedOut(x) && (x = late(this, x));
    this.aborts && this.aborts();
    this.active = false;
    this.settled = true;
    this.trace && traced(this, x);
    this.fail(x);
  }
  get origin() {
    return this.originError ? this.originError.stack : this.tagged && origins.get(this.strings) || "";
  }
  get statement() {
    return this.source && statement(this.source);
  }
  build() {
    return this.built || (this.built = build(this, this.handler.options));
  }
  get text() {
    return this.build().text;
  }
  get parameters() {
    return this.build().values;
  }
  [util.inspect.custom](depth, options, inspect) {
    if (!this.handler.debug)
      return "Query {}";
    let x;
    try {
      x = this.build();
    } catch (error2) {
      return "Query { " + error2.message + " }";
    }
    return "Query " + inspect({ text: x.text, parameters: x.values }, options);
  }
  cancel() {
    return this.handler.cancel ? this.handler.cancel(this) : Promise.resolve();
  }
  signal(signal) {
    if (!signal || this.settled)
      return this;
    if (signal.aborted)
      return this.cancel().catch(noop), this;
    const abort = () => this.cancel().catch(noop);
    signal.addEventListener("abort", abort, { once: true });
    this.aborts = () => (this.aborts = null, signal.removeEventListener("abort", abort));
    return this;
  }
  simple() {
    this.options.simple = true;
    this.options.prepare = false;
    return this;
  }
  async readable() {
    this.simple();
    this.streaming = true;
    return this;
  }
  async writable() {
    this.simple();
    this.streaming = true;
    return this;
  }
  cursor(rows = 1, fn) {
    this.options.simple = false;
    if (typeof rows === "function") {
      fn = rows;
      rows = 1;
    }
    this.cursorRows = rows;
    if (typeof fn === "function")
      return this.cursorFn = fn, this;
    let prev;
    return {
      [Symbol.asyncIterator]: () => ({
        next: () => {
          if (this.executed && !this.active)
            return { done: true };
          prev && prev();
          const promise = new Promise((resolve, reject) => {
            this.cursorFn = (value2) => {
              resolve({ value: value2, done: false });
              return new Promise((r) => prev = r);
            };
            this.resolve = (x) => (this.active = false, this.settled = true, this.trace && traced(this, null, x), resolve({ done: true }));
            this.reject = (x) => (this.active = false, this.settled = true, this.trace && traced(this, x), reject(x));
          });
          this.execute();
          return promise;
        },
        return() {
          prev && prev(CLOSE);
          return { done: true };
        }
      })
    };
  }
  describe() {
    this.options.simple = false;
    this.onlyDescribe = this.options.prepare = true;
    return this;
  }
  stream() {
    throw new Error(".stream has been renamed to .forEach");
  }
  forEach(fn) {
    this.forEachFn = fn;
    this.handle();
    return this;
  }
  raw() {
    this.isRaw = true;
    return this;
  }
  values() {
    this.isRaw = "values";
    return this;
  }
  parsers(parsers) {
    this.ownParsers = parsers || null;
    return this;
  }
  handle() {
    if (this.executed)
      return;
    this.executed = true;
    queueMicrotask(() => this.run());
  }
  run() {
    active(channels.query) ? start(channels.query, this.trace = context2(this), () => this.handler(this)) : this.handler(this);
  }
  execute() {
    this.handle();
    return this;
  }
  then(fulfilled, rejected) {
    this.handle();
    return super.then(fulfilled, rejected);
  }
  catch(rejected) {
    this.handle();
    return super.catch(rejected);
  }
  finally(fn) {
    this.handle();
    return super.finally(fn);
  }
};
function untime(q) {
  q.handler.options.timers.clearTimeout(q.timer);
  q.timer = null;
}
function timedOut(x) {
  return x.code === "57014" || x.code === "CONNECTION_DESTROYED" && !!x.cause && x.cause.code === "CANCEL_UNANSWERED";
}
function late(q, error2) {
  const x = Errors.generic("QUERY_TIMEOUT", "The query did not finish within query_timeout (" + q.handler.options.query_timeout + " seconds)");
  x.cause = error2.code === "CONNECTION_DESTROYED" ? error2.cause : error2;
  return queryError(x, q, q.handler.debug);
}
function context2(q) {
  const options = q.handler.options || {};
  let text4 = null;
  if (q.strings.length) {
    try {
      text4 = q.text;
    } catch (error2) {
      text4 = null;
    }
  }
  return {
    query: text4,
    parameters: void 0,
    database: options.database,
    user: userName(options),
    host: null,
    port: null,
    connection: null,
    statement: null,
    command: null,
    count: null,
    queued: now(),
    sent: null,
    firstByte: null,
    complete: null
  };
}
function traced(q, error2, result) {
  const x = q.trace;
  q.trace = null;
  x.complete = now();
  if (result && typeof result === "object" && "command" in result) {
    x.command = result.command;
    x.count = result.count;
  }
  finish(channels.query, x, error2, result);
}
function located() {
  const limit3 = Error.stackTraceLimit;
  Error.stackTraceLimit = 8;
  try {
    return trim(String(new Error().stack));
  } catch (error2) {
    return "";
  } finally {
    Error.stackTraceLimit = limit3;
  }
}
function trim(stack) {
  const lines = stack.split("\n"), i = lines.findIndex((x, i2) => i2 > 0 && !ours(x));
  return i === -1 ? stack : lines.slice(0, i + 1).join("\n");
}

// node_modules/postgres/src/startup.js
import crypto2 from "node:crypto";
import fs from "node:fs";

// node_modules/postgres/src/protocol.js
function Writer(size = 16384) {
  let b = Buffer.allocUnsafe(size), i = 0, at = 0;
  const w = {
    get length() {
      return i;
    },
    type(x) {
      fit(5);
      at = i;
      b[i] = x;
      i += 5;
      return w;
    },
    untyped() {
      fit(4);
      at = i;
      i += 4;
      return w;
    },
    end() {
      b.writeInt32BE(i - at - 1, at + 1);
      return w;
    },
    endUntyped() {
      b.writeInt32BE(i - at, at);
      return w;
    },
    str(x) {
      fit(x.length * 3 + 1);
      i += b.write(x, i);
      b[i++] = 0;
      return w;
    },
    bytes(x) {
      if (typeof x === "string") {
        fit(x.length * 3);
        i += b.write(x, i);
      } else {
        fit(x.length);
        b.set(x, i);
        i += x.length;
      }
      return w;
    },
    value(x) {
      if (x === null || x === void 0)
        return w.i32(-1);
      const n = i;
      i += 4;
      w.bytes(x);
      b.writeInt32BE(i - n - 4, n);
      return w;
    },
    u8(x) {
      fit(1);
      b[i++] = x;
      return w;
    },
    i16(x) {
      fit(2);
      b.writeInt16BE(x, i);
      i += 2;
      return w;
    },
    u16(x) {
      fit(2);
      b.writeUInt16BE(x, i);
      i += 2;
      return w;
    },
    i32(x) {
      fit(4);
      b.writeInt32BE(x, i);
      i += 4;
      return w;
    },
    truncate(n) {
      i = n;
      return w;
    },
    take() {
      const out = i < 4096 ? Buffer.from(b.subarray(0, i)) : b.subarray(0, i);
      i >= 4096 && (b = Buffer.allocUnsafe(size));
      i = at = 0;
      return out;
    }
  };
  return w;
  function fit(n) {
    if (b.length - i >= n)
      return;
    const prev = b;
    b = Buffer.allocUnsafe(Math.max(size, prev.length * 2, i + n));
    prev.copy(b, 0, 0, i);
  }
}
var own = Writer(1024);
var S = 83;
var H = 72;
var X = 88;
var c = 99;
var Q = 81;
var p = 112;
var d = 100;
var f = 102;
var D = 68;
var C = 67;
var E = 69;
var P = 80;
var B = 66;
var sync = (w) => w.type(S).end();
var flush = (w) => w.type(H).end();
var terminate = (w) => w.type(X).end();
var copyDone = (w) => w.type(c).end();
var sslRequest = (w) => w.untyped().i32(80877103).endUntyped();
var query = (w, text4) => w.type(Q).str(text4).end();
var password = (w, x) => w.type(p).str(x).end();
var saslResponse = (w, x) => w.type(p).bytes(x).end();
var copyData = (w, x) => w.type(d).bytes(x).end();
var copyFail = (w, x) => w.type(f).str(x).end();
var describe = (w, kind, name) => w.type(D).u8(kind.charCodeAt(0)).str(name).end();
var close = (w, kind, name) => w.type(C).u8(kind.charCodeAt(0)).str(name).end();
var execute = (w, portal, rows = 0) => w.type(E).str(portal).i32(rows).end();
var cancel = (w, pid, secret2) => w.untyped().i32(80877102).i32(pid).i32(secret2).endUntyped();
var Sync = one(sync);
var Flush = one(flush);
var Terminate = one(terminate);
var CopyDone = one(copyDone);
var SSLRequest = one(sslRequest);
var Query2 = one(query);
var Password = one(password);
var SASLResponse = one(saslResponse);
var CopyData = one(copyData);
var CopyFail = one(copyFail);
var Describe = one(describe);
var Close = one(close);
var Execute = one(execute);
var Cancel = one(cancel);
var Startup = one(startup);
var SASL = one(sasl);
var Parse = one(parse);
var Bind = one(bind);
var Run = one(run);
function one(fn) {
  return (...xs) => {
    try {
      fn(own, ...xs);
    } catch (error2) {
      own.truncate(0);
      throw error2;
    }
    return own.take();
  };
}
function startup(w, parameters) {
  w.untyped().i32(196608);
  for (const k in parameters)
    parameters[k] && w.str(unbroken(k, k)).str(unbroken(k, "" + parameters[k]));
  return w.u8(0).endUntyped();
}
function unbroken(k, x) {
  if (x.indexOf("\0") !== -1)
    throw Object.assign(new Error("The connection parameter " + k + " contains a NUL character"), { code: "NUL_CHARACTER" });
  return x;
}
function sasl(w, mechanism, initial) {
  return w.type(p).str(mechanism).i32(Buffer.byteLength(initial)).bytes(initial).end();
}
function parse(w, name, text4, oids = []) {
  w.type(P).str(name).str(text4).u16(oids.length);
  for (let j = 0; j < oids.length; j++)
    w.i32(oids[j] | 0);
  return w.end();
}
function bind(w, portal, name, values2 = [], formats = [], resultFormats = []) {
  w.type(B).str(portal).str(name).i16(formats.length);
  for (let j = 0; j < formats.length; j++)
    w.i16(formats[j]);
  w.u16(values2.length);
  for (let j = 0; j < values2.length; j++)
    w.value(values2[j]);
  w.i16(resultFormats.length);
  for (let j = 0; j < resultFormats.length; j++)
    w.i16(resultFormats[j]);
  return w.end();
}
function run(w, portal, name, values2, rows, flushing, formats) {
  bind(w, portal, name, values2, void 0, formats || void 0);
  execute(w, portal, rows);
  return flushing ? flush(w) : sync(w);
}
var largest = 1073741824;
function Frames(onframe, shared = false, onerror = null) {
  const chunks = [], owned = /* @__PURE__ */ new WeakSet();
  let data = null, owning = false, at = 0, part2 = null, filled = 0, paused = false, running = false, broken = false;
  return {
    push(x) {
      if (broken)
        return;
      chunks.push(shared && (paused || owning) ? own3(x) : x);
      run2();
    },
    get paused() {
      return paused;
    },
    owns(x) {
      return !shared || owned.has(x);
    },
    own(x) {
      owning = x;
      x && settle();
    },
    pause() {
      paused = true;
      settle();
    },
    resume() {
      paused = false;
      run2();
    }
  };
  function own3(x) {
    const copy2 = Buffer.from(x);
    owned.add(copy2);
    return copy2;
  }
  function settle() {
    if (!shared)
      return;
    data && at < data.length && !owned.has(data) && (data = own3(data.subarray(at)), at = 0);
    for (let i = 0; i < chunks.length; i++)
      owned.has(chunks[i]) || (chunks[i] = own3(chunks[i]));
  }
  function run2() {
    if (running)
      return;
    running = true;
    try {
      while (true) {
        if (broken || paused || !(data && at < data.length || next()))
          break;
        part2 ? fill() : frame();
      }
    } finally {
      running = false;
    }
  }
  function invalid(length) {
    if (length >= 4 && length <= largest)
      return false;
    broken = true;
    chunks.length = 0;
    data = part2 = null;
    at = filled = 0;
    const error2 = Object.assign(new Error("The server sent a message with an invalid length (" + length + ")"), { code: "PROTOCOL_ERROR" });
    onerror && onerror(error2);
    return true;
  }
  function next() {
    data = chunks.shift() || null;
    at = 0;
    return data !== null;
  }
  function frame() {
    const left = data.length - at;
    if (left < 5)
      return start2(5);
    const length = data.readInt32BE(at + 1);
    if (invalid(length))
      return;
    const end = at + 1 + length;
    if (end > data.length)
      return start2(end - at);
    const begin = at;
    at = end;
    onframe(data[begin], data, begin, end);
  }
  function start2(length) {
    part2 = Buffer.allocUnsafe(length);
    shared && owned.add(part2);
    filled = data.copy(part2, 0, at);
    at = data.length;
  }
  function fill() {
    const n = data.copy(part2, filled, at, at + part2.length - filled);
    filled += n;
    at += n;
    if (filled < part2.length)
      return;
    if (part2.length === 5) {
      const head = part2, length = head.readInt32BE(1);
      if (invalid(length))
        return;
      part2 = Buffer.allocUnsafe(1 + length);
      shared && owned.add(part2);
      filled = head.copy(part2);
      return filled === part2.length && done2();
    }
    done2();
  }
  function done2() {
    const x = part2;
    part2 = null;
    onframe(x[0], x, 0, x.length);
  }
}
var errorFields = {
  83: "severity_local",
  86: "severity",
  67: "code",
  77: "message",
  68: "detail",
  72: "hint",
  80: "position",
  112: "internal_position",
  113: "internal_query",
  87: "where",
  115: "schema_name",
  116: "table_name",
  99: "column_name",
  100: "data_type_name",
  110: "constraint_name",
  70: "file",
  76: "line",
  82: "routine"
};
function error(x, start2, end) {
  const fields = {};
  for (let i = start2 + 5; i < end - 1; ) {
    const zero = x.indexOf(0, i + 1);
    fields[errorFields[x[i]] || String.fromCharCode(x[i])] = x.toString("utf8", i + 1, zero);
    i = zero + 1;
  }
  fields.severity || (fields.severity = fields.severity_local);
  return fields;
}
var text2 = typeof Buffer.prototype.utf8Slice === "function" ? (x, start2, end) => x.utf8Slice(start2, end) : (x, start2, end) => x.toString("utf8", start2, end);
var u32 = (x, i) => (x[i] << 24 | x[i + 1] << 16 | x[i + 2] << 8 | x[i + 3]) >>> 0;
var u16 = (x, i) => x[i] << 8 | x[i + 1];
var field = (name, table, number2, type) => ({ name, table, number: number2, type });
function rowDescription(x, start2, end, make = field) {
  const columns2 = new Array(x[start2 + 5] << 8 | x[start2 + 6]);
  for (let i = start2 + 7, j = 0; j < columns2.length; j++) {
    let zero = i;
    while (x[zero] !== 0)
      zero++;
    columns2[j] = make(text2(x, i, zero), u32(x, zero + 1), u16(x, zero + 5), u32(x, zero + 7));
    i = zero + 19;
  }
  return columns2;
}
function parameterDescription(x, start2) {
  const oids = new Array(x.readUInt16BE(start2 + 5));
  for (let j = 0; j < oids.length; j++)
    oids[j] = x.readUInt32BE(start2 + 7 + j * 4);
  return oids;
}
function commandComplete(x, start2, end) {
  const first = start2 + 5;
  let e = end - 1, count = null;
  while (true) {
    let s = e - 1;
    while (s >= first && x[s] >= 48 && x[s] <= 57)
      s--;
    if (s === e - 1 || s < first || x[s] !== 32)
      break;
    count === null && (count = +text2(x, s + 1, e));
    e = s;
  }
  return { command: text2(x, first, e), count };
}
function readyForQuery(x, start2) {
  return String.fromCharCode(x[start2 + 5]);
}
function notification(x, start2) {
  const zero = x.indexOf(0, start2 + 9);
  return {
    pid: x.readInt32BE(start2 + 5),
    channel: x.toString("utf8", start2 + 9, zero),
    payload: x.toString("utf8", zero + 1, x.indexOf(0, zero + 1))
  };
}
function parameterStatus(x, start2) {
  const zero = x.indexOf(0, start2 + 5);
  return [x.toString("utf8", start2 + 5, zero), x.toString("utf8", zero + 1, x.indexOf(0, zero + 1))];
}
function backendKeyData(x, start2) {
  return { pid: x.readInt32BE(start2 + 5), secret: x.readInt32BE(start2 + 9) };
}

// node_modules/postgres/src/socket.js
import net from "node:net";
import tls from "node:tls";
var noop2 = () => {
};
var agent = globalThis.navigator && globalThis.navigator.userAgent || "";
var workers = agent.startsWith("Cloudflare-Workers");
var onreadSafe = !agent || agent.startsWith("Node.js") || agent.startsWith("Bun") || agent.startsWith("Deno");
var node = !agent || agent.startsWith("Node.js");
var contexts = /* @__PURE__ */ new WeakMap();
async function Socket(options, host, port, track = noop2) {
  const raw = options.socket ? await options.socket(options, host, port) : await connect(options, host, port, track);
  return wrap(raw, host);
}
function secureOptions(ssl) {
  return ssl === "require" || ssl === "allow" || ssl === "prefer" ? workers ? {} : { rejectUnauthorized: false } : typeof ssl === "object" ? context3(ssl) : {};
}
function context3(ssl) {
  if (!node || ssl.secureContext || !ssl.ca)
    return ssl;
  const values2 = { ...ssl };
  let last = contexts.get(ssl);
  last && same(values2, last.values) || contexts.set(ssl, last = { values: values2, secureContext: tls.createSecureContext(values2) });
  return { ...values2, secureContext: last.secureContext };
}
function same(a, b) {
  return [...Object.keys(a), ...Object.keys(b)].every((k) => a[k] === b[k]);
}
var secured = (options) => !!options.ssl && options.ssl !== "disable";
var direct = (options) => secured(options) && options.sslnegotiation === "direct";
function connect(options, host, port, track) {
  return new Promise((resolve, reject) => {
    const tlsNow = direct(options), plain3 = !secured(options), reads = (plain3 || tlsNow) && onreadSafe && options.onread !== false && {
      buffer: Buffer.allocUnsafe(65536),
      callback: (n, b) => socket.ondata(b.subarray(0, n))
    }, target = options.path ? { path: options.path } : { port, host }, socket = tlsNow ? tls.connect({
      ...target,
      servername: net.isIP(host || "") || options.path ? void 0 : host,
      ...secureOptions(options.ssl),
      ALPNProtocols: ["postgresql"],
      ...reads ? { onread: reads } : {}
    }) : net.connect({ ...target, ...reads ? { onread: reads } : {} });
    track(socket);
    socket.shared = !!reads;
    socket.secure = tlsNow;
    socket.ondata = noop2;
    socket.once("error", reject);
    socket.once(tlsNow ? "secureConnect" : "connect", () => {
      socket.off("error", reject);
      socket.setNoDelay(true);
      resolve(socket);
    });
  });
}
function wrap(socket, host) {
  let closed = false, failure = null;
  socket.shared && (socket.ondata = data);
  const x = {
    ondata: noop2,
    ondrain: noop2,
    onclose: noop2,
    get raw() {
      return socket;
    },
    get closed() {
      return closed;
    },
    get shared() {
      return !!socket.shared;
    },
    get negotiated() {
      return !!socket.secure || !!socket.negotiated;
    },
    get serial() {
      return !!socket.serial;
    },
    certificate() {
      const x2 = typeof socket.getPeerCertificate === "function" && socket.getPeerCertificate();
      return x2 && x2.raw || null;
    },
    write: (data2) => !closed && socket.write(data2),
    upgrade,
    pause: () => socket.pause(),
    resume: () => socket.resume(),
    ref: () => socket.ref && socket.ref(),
    unref: () => socket.unref && socket.unref(),
    end(data2) {
      closed || (data2 ? socket.end(data2) : socket.end());
    },
    destroy(error3) {
      error3 && !failure && (failure = error3);
      socket.destroy();
    },
    keepAlive(seconds) {
      seconds && socket.setKeepAlive && socket.setKeepAlive(true, 1e3 * seconds);
    }
  };
  listen();
  return x;
  function listen() {
    socket.on("data", data);
    socket.on("drain", drain);
    socket.on("error", error2);
    socket.on("close", close2);
  }
  function unlisten() {
    socket.off("data", data);
    socket.off("drain", drain);
    socket.off("error", error2);
    socket.off("close", close2);
  }
  function data(buffer) {
    x.ondata(buffer);
  }
  function drain() {
    x.ondrain();
  }
  function error2(err) {
    failure || (failure = err);
    socket.destroy();
    close2();
  }
  function close2() {
    if (closed)
      return;
    closed = true;
    x.onclose(failure);
  }
  function upgrade(options = {}) {
    return new Promise((resolve, reject) => {
      unlisten();
      const secure = tls.connect({
        socket,
        host: host || void 0,
        servername: net.isIP(host || "") ? void 0 : host,
        ...options
      });
      const fail = (err) => {
        secure.off("secureConnect", ready);
        reject(err);
      };
      function ready() {
        secure.off("error", fail);
        socket = secure;
        listen();
        resolve(x);
      }
      secure.once("secureConnect", ready);
      secure.once("error", fail);
    });
  }
}

// node_modules/postgres/src/startup.js
var noop3 = () => {
};
var R = 82;
var S2 = 83;
var K = 75;
var E2 = 69;
var N = 78;
var D2 = 68;
var Z = 90;
async function open(options, signal = { aborted: false, sockets: /* @__PURE__ */ new Set() }, first = 0) {
  const hosts2 = options.path ? [null] : options.host, wanted = options.target_session_attrs, passes = wanted === "prefer-standby" ? ["standby", "any"] : [wanted || "any"];
  let last;
  for (const want of passes) {
    for (let n = 0; n < hosts2.length; n++) {
      const i = (first + n) % hosts2.length, host = hosts2[i], port = options.port[i] || options.port[0], [failed, error2, ready] = await traced2(options, host, port, signal).then((x) => [false, null, x], (x) => [true, x]);
      if (!failed && fits(want, ready.attributes))
        return ready.index = i, ready;
      failed || ready.socket.end(Terminate());
      last = failed ? error2 : Errors.connection("CONNECTION_DESTROYED", options, host, port);
      if (signal.aborted)
        throw last;
    }
  }
  throw last;
}
function traced2(options, host, port, signal) {
  if (!active(channels.connect))
    return attempt(options, host, port, signal);
  const context4 = {
    host: options.path ? null : host,
    port: options.path ? null : port,
    path: options.path || null,
    database: options.database,
    user: userName(options),
    ssl: secured(options),
    sslnegotiation: options.sslnegotiation || "postgres"
  };
  let promise;
  start(channels.connect, context4, () => promise = attempt(options, host, port, signal));
  return promise.then((ready) => {
    finish(channels.connect, context4, null, {
      pid: ready.backend.pid,
      status: ready.status,
      readOnly: ready.attributes.readOnly,
      standby: ready.attributes.standby
    });
    return ready;
  }, (error2) => {
    finish(channels.connect, context4, error2);
    throw error2;
  });
}
function fits(want, { readOnly, standby }) {
  return want === "any" || want === "read-write" && !readOnly || want === "read-only" && readOnly || want === "primary" && !standby || want === "standby" && standby;
}
function attempt(options, host, port, signal) {
  const { setTimeout: setTimeout2, clearTimeout: clearTimeout2 } = options.timers, fail = (code) => Errors.connection(code, options, host, port);
  return new Promise((resolve, reject) => {
    const timer = options.connect_timeout && setTimeout2(() => done2(true, fail("CONNECT_TIMEOUT")), options.connect_timeout * 1e3);
    let socket = null, raw = null, settled = false;
    session().then((x) => done2(false, null, x), (e) => done2(true, e));
    function done2(failed, error2, ready) {
      if (settled)
        return;
      settled = true;
      timer && clearTimeout2(timer);
      socket && signal.sockets.delete(socket);
      signal.aborted && !failed && (failed = true, error2 = fail("CONNECTION_DESTROYED"));
      if (failed) {
        socket ? socket.destroy() : raw && raw.destroy();
        return reject(error2);
      }
      ready.socket.onclose = () => {
      };
      resolve(ready);
    }
    async function session() {
      socket = await Socket(options, host, port, (x) => raw = x);
      if (settled || signal.aborted)
        return socket.destroy(), done2(true, fail("CONNECTION_DESTROYED"));
      signal.sockets.add(socket);
      socket.onclose = (error2) => done2(true, signal.aborted ? fail("CONNECTION_DESTROYED") : error2 && error2.code ? error2 : fail("CONNECTION_CLOSED"));
      socket.keepAlive(options.keep_alive);
      await negotiate(socket, options);
      const user = typeof options.user === "function" ? await options.user() : options.user;
      return startup2(user, options.database || user);
    }
    function startup2(user, database) {
      return new Promise((resolve2, reject2) => {
        const stored = () => pgpass(options.passfile, options.path ? "localhost" : host, port, database, user) || "", auth = Auth({ user, pass: options.pass || stored, binding: options.channel_binding, socket }), parameters = {}, backend = { pid: null, secret: null }, frames = Frames(frame, false, (error2) => (reject2(error2), socket.destroy())), rows = [];
        let probing = false, status = null, authing = Promise.resolve();
        socket.ondata = (x) => frames.push(x);
        socket.write(Startup({ user, database, client_encoding: "UTF8", ...options.connection }));
        function frame(type, x, start2, end) {
          try {
            type === R ? authenticate(Buffer.from(x.subarray(start2, end))) : type === S2 ? (([k, v]) => parameters[k] = v)(parameterStatus(x, start2)) : type === K ? Object.assign(backend, backendKeyData(x, start2)) : type === E2 ? reject2(Errors.postgres(error(x, start2, end))) : type === N ? notice(error(x, start2, end)) : type === D2 ? rows.push(x.toString("utf8", start2 + 11, start2 + 11 + x.readInt32BE(start2 + 7))) : type === Z && settled2(readyForQuery(x, start2), Buffer.from(x.subarray(end)));
          } catch (error2) {
            reject2(error2);
          }
        }
        function notice(x) {
          try {
            options.onnotice ? options.onnotice(x) : options.onnotice === false || console.log(x);
          } catch (error2) {
            noop3(error2);
          }
        }
        function authenticate(x) {
          authing = authing.then(() => auth(x)).then((reply) => reply && socket.write(reply));
          authing.catch((error2) => (reject2(error2), socket.destroy()));
        }
        function settled2(x, rest) {
          authing.then(() => ready(x, rest), () => {
          });
        }
        function ready(x, rest) {
          if (!auth.authenticated)
            return reject2(Errors.generic("AUTHENTICATION_INCOMPLETE", "The server was ready before it accepted the authentication"));
          status = x;
          const known = "in_hot_standby" in parameters && "default_transaction_read_only" in parameters;
          if (options.target_session_attrs && !known && !probing) {
            probing = true;
            return socket.write(Query2("show transaction_read_only; select pg_catalog.pg_is_in_recovery()"));
          }
          frames.pause();
          socket.ondata = () => {
          };
          socket.pause();
          resolve2({
            socket,
            rest,
            backend,
            parameters,
            status,
            attributes: {
              readOnly: (known ? parameters.default_transaction_read_only : rows[0]) === "on",
              standby: known ? parameters.in_hot_standby === "on" : rows[1] === "t"
            },
            host,
            port,
            cancel: () => cancel2(options, host, port, backend)
          });
        }
      });
    }
  });
}
async function negotiate(socket, options) {
  if (!secured(options) || socket.negotiated)
    return;
  const ssl = options.ssl, tls2 = secureOptions(ssl);
  if (options.sslnegotiation === "direct")
    return socket.upgrade({ ...tls2, ALPNProtocols: ["postgresql"] });
  const answer = new Promise((r) => socket.ondata = (x) => r(x[0]));
  socket.write(SSLRequest());
  if (await answer === S2)
    return socket.upgrade(tls2);
  if (ssl !== "prefer" && ssl !== "allow")
    throw Errors.generic("SSL_NOT_SUPPORTED", "The server does not support SSL connections");
}
function cancel2(options, host, port, { pid, secret: secret2 }) {
  const { setTimeout: setTimeout2, clearTimeout: clearTimeout2 } = options.timers;
  return new Promise((resolve, reject) => {
    let socket = null, raw = null, written = false, settled = false;
    const limit3 = options.cancel_timeout || options.connect_timeout, timer = limit3 && setTimeout2(() => done2(!written && Errors.connection("CONNECT_TIMEOUT", options, host, port)), limit3 * 1e3);
    Socket(options, host, port, (x) => raw = x).then(async (x) => {
      socket = x;
      if (settled)
        return socket.destroy();
      await negotiate(socket, options);
      socket.onclose = () => done2();
      written = true;
      socket.end(Cancel(pid, secret2));
    }).catch(done2);
    function done2(error2) {
      if (settled)
        return;
      settled = true;
      timer && clearTimeout2(timer);
      socket ? socket.destroy() : raw && raw.destroy();
      error2 ? reject(error2) : resolve();
    }
  });
}
var salted = /* @__PURE__ */ new Map();
function Auth({ user, pass, binding: binding2 = "prefer", socket }) {
  let nonce, signature2, verified = true, bound = false, header = "n,,";
  respond.authenticated = false;
  return respond;
  async function respond(x) {
    const type = x.readInt32BE(5);
    if ((type === 3 || type === 5) && binding2 === "require")
      throw unbound("the server asked for " + (type === 3 ? "a cleartext" : "an MD5") + " password");
    return type === 0 ? ok() : type === 3 ? Password(await password2()) : type === 5 ? Password("md5" + md5(Buffer.concat([Buffer.from(md5(await password2() + user)), x.subarray(9, 13)]))) : type === 10 ? start2(x) : type === 11 ? proceed(x, await password2()) : type === 12 ? finish2(x) : unsupported(type);
  }
  function start2(x) {
    const offered = x.toString("utf8", 9).split("\0"), certificate = binding2 !== "disable" && socket && socket.certificate && socket.certificate(), hash = certificate && endpoint(certificate), plus = !!hash && offered.includes("SCRAM-SHA-256-PLUS");
    if (binding2 === "require" && !plus)
      throw unbound(offered.includes("SCRAM-SHA-256-PLUS") ? "the server certificate could not be hashed for it" : "the server did not offer it");
    if (!plus && !offered.includes("SCRAM-SHA-256"))
      throw Errors.generic("SASL_MECHANISM_NOT_SUPPORTED", "The server offered no supported SASL mechanism");
    header = plus ? "p=tls-server-end-point,," : hash ? "y,," : "n,,";
    bound = plus ? hash : false;
    nonce = crypto2.randomBytes(18).toString("base64");
    verified = false;
    return SASL(plus ? "SCRAM-SHA-256-PLUS" : "SCRAM-SHA-256", header + "n=*,r=" + nonce);
  }
  function proceed(x, pass2) {
    const res = x.toString("utf8", 9).split(",").reduce((acc, x2) => (acc[x2[0]] = x2.slice(2), acc), {}), key2 = sha256(pass2 + "\0" + res.s + "\0" + res.i).toString("base64");
    if (!res.r.startsWith(nonce))
      throw Errors.generic("SASL_NONCE_MISMATCH", "The server nonce does not start with the client nonce");
    if (!salted.has(key2)) {
      salted.size >= 64 && salted.delete(salted.keys().next().value);
      salted.set(key2, crypto2.pbkdf2Sync(pass2, Buffer.from(res.s, "base64"), +res.i, 32, "sha256"));
    }
    const saltedPassword = salted.get(key2), clientKey = hmac(saltedPassword, "Client Key"), channel = (bound ? Buffer.concat([Buffer.from(header), bound]) : Buffer.from(header)).toString("base64"), auth = "n=*,r=" + nonce + ",r=" + res.r + ",s=" + res.s + ",i=" + res.i + ",c=" + channel + ",r=" + res.r;
    signature2 = hmac(hmac(saltedPassword, "Server Key"), auth).toString("base64");
    return SASLResponse("c=" + channel + ",r=" + res.r + ",p=" + xor(clientKey, hmac(sha256(clientKey), auth)).toString("base64"));
  }
  function finish2(x) {
    if (!signature2 || x.toString("utf8", 9).split("\0", 1)[0].slice(2) !== signature2)
      throw Errors.generic("SASL_SIGNATURE_MISMATCH", "The server did not return the correct signature");
    verified = true;
    return null;
  }
  function ok() {
    if (!verified)
      throw Errors.generic("SASL_SIGNATURE_MISMATCH", "The server ended SCRAM authentication without proving it knows the password");
    if (binding2 === "require" && !bound)
      throw unbound("the server authenticated without it");
    respond.authenticated = true;
    return null;
  }
  function unsupported(type) {
    throw Errors.generic("AUTH_TYPE_NOT_IMPLEMENTED", "Authentication type " + type + " is not supported");
  }
  function password2() {
    return Promise.resolve(typeof pass === "function" ? pass() : pass);
  }
}
function unbound(reason) {
  return Errors.generic("CHANNEL_BINDING_REQUIRED", "channel_binding is require, but " + reason);
}
var signatures = {
  "2a864886f70d010104": "sha256",
  "2a864886f70d010105": "sha256",
  "2a864886f70d01010e": "sha224",
  "2a864886f70d01010b": "sha256",
  "2a864886f70d01010c": "sha384",
  "2a864886f70d01010d": "sha512",
  "2a8648ce3d0401": "sha256",
  "2a8648ce3d040301": "sha224",
  "2a8648ce3d040302": "sha256",
  "2a8648ce3d040303": "sha384",
  "2a8648ce3d040304": "sha512",
  "2a8648ce380403": "sha256",
  "608648016503040302": "sha256"
};
var digests = {
  "2b0e03021a": "sha256",
  "608648016503040201": "sha256",
  "608648016503040202": "sha384",
  "608648016503040203": "sha512",
  "608648016503040204": "sha224"
};
function endpoint(certificate) {
  try {
    const x = Buffer.from(certificate), algorithm = signature(x);
    return algorithm ? crypto2.createHash(algorithm).update(x).digest() : null;
  } catch (_) {
    return null;
  }
}
function signature(x) {
  const certificate = der(x, 0), tbs = der(x, certificate.body), algorithm = der(x, tbs.end), oid = der(x, algorithm.body), name = x[oid.start] === 6 && x.toString("hex", oid.body, oid.end);
  if (name !== "2a864886f70d01010a")
    return signatures[name];
  if (oid.end >= algorithm.end)
    return "sha256";
  const params = der(x, oid.end), first = params.body < params.end && der(x, params.body);
  if (!first || x[first.start] !== 160)
    return "sha256";
  const hash = der(x, der(x, first.body).body);
  return digests[x.toString("hex", hash.body, hash.end)];
}
function der(x, start2) {
  let length = x[start2 + 1], body = start2 + 2;
  if (length & 128) {
    const n = length & 127;
    length = 0;
    for (let i = 0; i < n; i++)
      length = length * 256 + x[body + i];
    body += n;
  }
  if (body + length > x.length)
    throw new Error("Truncated certificate");
  return { start: start2, body, end: body + length };
}
function md5(x) {
  return crypto2.createHash("md5").update(x).digest("hex");
}
function hmac(key2, x) {
  return crypto2.createHmac("sha256", key2).update(x).digest();
}
function sha256(x) {
  return crypto2.createHash("sha256").update(x).digest();
}
function xor(a, b) {
  const x = Buffer.allocUnsafe(a.length);
  for (let i = 0; i < a.length; i++)
    x[i] = a[i] ^ b[i];
  return x;
}
function pgpass(file, host, port, database, user) {
  if (!file)
    return null;
  let text4;
  try {
    const stat = fs.statSync(file);
    if (!stat.isFile() || process.platform !== "win32" && stat.mode & 63)
      return null;
    text4 = fs.readFileSync(file, "utf8");
  } catch (_) {
    return null;
  }
  const wanted = [host, String(port), database, user];
  for (const line2 of text4.split(/\r?\n/)) {
    const fields = line2 && line2[0] !== "#" ? split(line2) : [];
    if (fields.length === 5 && wanted.every((x, i) => fields[i] === "*" || fields[i] === x))
      return fields[4];
  }
  return null;
}
function split(line2) {
  const fields = [];
  let field2 = "";
  for (let i = 0; i < line2.length; i++) {
    const c2 = line2[i];
    if (c2 === "\\" && i + 1 < line2.length)
      field2 += line2[++i];
    else if (c2 === ":" && fields.length < 4)
      fields.push(field2), field2 = "";
    else
      field2 += c2;
  }
  fields.push(field2);
  return fields;
}

// node_modules/postgres/src/connection.js
import Stream from "node:stream";
var slow = 100;
var notable = 5;
var text3 = text2;
var noop4 = () => {
};
var ending = /^\s*(commit|end|abort|rollback(?!\s+to\b)|prepare\s+transaction)\b/i;
var limit = 1e3;
var refused = "postgres.js: query could not be built";
var skip = /* @__PURE__ */ Symbol("skip");
var held = /* @__PURE__ */ Symbol("held");
var unknown = 100;
var states = /* @__PURE__ */ new WeakMap();
var after = 16;
var variety = 16;
var ids = 1;
var compiles = true;
function Connection(ready, options, events) {
  const { socket } = ready, timers = options.timers, defer = timers.nextTick || process.nextTick, { transform } = options, sent = [], pending = [], running = /* @__PURE__ */ new Set(), open2 = /* @__PURE__ */ new Set(), prepared = /* @__PURE__ */ new Map(), out = Writer(), frames = Frames(frame, socket.shared, (error2) => (connection2.fatal = error2, socket.destroy()));
  let blocker = null, stash = null, heard = timers.now(), rolling = false, fence = null, drained = null, status = ready.status, flushing = false, closed = null, closing = null, portals = 0, traced3 = 0, epoch2 = 0, headSince = 0, notables = 0;
  const connection2 = {
    id: ids++,
    host: ready.host,
    port: ready.port,
    backend: ready.backend,
    parameters: ready.parameters,
    prepared,
    lease: null,
    get status() {
      return status;
    },
    get inflight() {
      return sent.length + pending.length;
    },
    get exclusive() {
      return !!blocker && exclusive(blocker);
    },
    get copying() {
      return !!blocker && blocker.streaming && blocker.open;
    },
    get closed() {
      return closed;
    },
    get closing() {
      return !!closing;
    },
    send,
    batch,
    simple,
    describe: describe2,
    local,
    cancel: cancel3,
    close: close2,
    destroy,
    go,
    ref: () => socket.ref(),
    unref: () => socket.unref(),
    backlog,
    heavy,
    get notable() {
      return notables > 0;
    }
  };
  socket.ondata = (x) => (heard = timers.now(), frames.push(x));
  socket.ondrain = ondrain;
  socket.onclose = onclose;
  ready.rest && ready.rest.length && frames.push(ready.rest);
  socket.resume();
  return connection2;
  function ondrain() {
    const x = drained;
    drained = null;
    x && x();
  }
  function schedule(now2) {
    if (now2 || out.length >= 65536)
      return flush2();
    flushing || (flushing = true, defer(flush2));
    return true;
  }
  function flush2() {
    flushing = false;
    if (closed)
      return out.take(), true;
    return out.length ? socket.write(out.take()) : true;
  }
  function holds(x) {
    return x.describing || x.described && socket.serial && !x.nosync && !x.done || x.gate && x.learn && !x.error || !!x.error && !x.done || x.flushing && !x.synced || x.streaming && x.open || x.alone && !x.done;
  }
  function exclusive(x) {
    return x.flushing || x.streaming || x.alone;
  }
  function refresh() {
    blocker && !holds(blocker) && (blocker = null);
    release();
  }
  function queue(x) {
    if (closed)
      return settleError(x, copy(closed));
    if (blocker && blocker.streaming && blocker.open)
      return settleError(x, Errors.generic("COPY_IN_PROGRESS", "You cannot execute queries during copy"));
    x.query && (x.query.state = connection2.backend);
    if (fence)
      pending.splice(pending.indexOf(fence), 0, x);
    else if (x.ends && open2.size)
      pending.push(fence = x);
    else if (blocker || pending.length)
      pending.push(x);
    else
      return write(x), schedule();
    release();
  }
  function release() {
    while (!blocker && pending.length && pending[0] !== fence)
      write(pending.shift());
    schedule();
  }
  function write(x) {
    if (x.kind === "local" && sent.length === 0)
      return queueMicrotask(() => settle(x));
    const mark = out.length;
    let result;
    try {
      result = x.write(x);
    } catch (error2) {
      x.own = error2;
      result = skip;
    }
    if (result === held) {
      out.truncate(mark);
      x.loose = false;
      blocker = sent.find((y) => y.gate && holds(y)) || null;
      blocker && blocker.nosync && !blocker.flushed && (blocker.flushed = true, flush(out), schedule());
      return pending.unshift(x);
    }
    if (result === skip) {
      out.truncate(mark);
      x.fresh = null;
      x.parses = [];
      x.portal = "";
      x.describing = x.synced = x.flushing = x.open = false;
      if (x.batch) {
        x.entry = null;
        parse(out, "", refused);
        x.parses = [""];
        abort(x);
      } else if (!x.own || x.kind === "step" || !connection2.lease) {
        x.kind = "local";
        x.cost >= notable && notables--;
        x.cost = void 0;
        return sent.length === 0 ? queueMicrotask(() => settle(x)) : sent.push(x);
      } else {
        x.kind = "simple";
        x.text = refused;
        x.results = [];
        x.entry = null;
        sync2(x, true);
      }
    }
    x.fresh && register(x.fresh);
    x.portal && x.kind === "query" && open2.add(x);
    x.query && (x.query.active = sent.length === 0);
    x.ends && epoch2++;
    x.epoch = epoch2;
    options.scheduler && sent.length === 0 && (headSince = timers.now());
    sent.push(x);
    holds(x) && (blocker = x);
    x.trace && wrote(x);
  }
  function sync2(x, refuse) {
    if (x.synced)
      return;
    x.synced = true;
    refuse ? query(out, refused) : sync(out);
    schedule();
  }
  function register(entry) {
    const current = prepared.get(entry.name);
    current && prepared.delete(entry.name);
    prepared.set(entry.name, entry);
    entry.owner.entry = entry;
    entry.owner.fresh = null;
    if (prepared.size <= limit)
      return;
    for (const [name, x] of prepared) {
      if (x.state !== "parsing") {
        prepared.delete(name);
        close(out, "S", name);
        return;
      }
    }
  }
  function drop(entry) {
    prepared.get(entry.name) === entry && prepared.delete(entry.name);
  }
  function send(query2) {
    const { statement: statement2 } = query2.wire, x = Exchange("query", query2, connection2.lease, extended);
    x.statement = statement2;
    x.ends = statement2.ends === void 0 ? statement2.ends = ending.test(statement2.text) : statement2.ends;
    options.scheduler && cost(x);
    queue(x);
  }
  function batch(query2, parts2) {
    const b = {
      query: query2,
      parts: parts2,
      results: new Array(parts2.length),
      settled: new Array(parts2.length).fill(false),
      left: parts2.length,
      error: null,
      index: -1,
      aborted: null
    };
    parts2.forEach((part3, i) => {
      part3.resolve = (result) => batched(b, i, null, result);
      part3.reject = (error2) => batched(b, i, error2);
      if (b.aborted)
        return batched(b, i, skipped(b.aborted, i));
      const x = Exchange("query", part3, connection2.lease, extended);
      x.statement = part3.wire.statement;
      x.ends = x.statement.ends === void 0 ? x.statement.ends = ending.test(x.statement.text) : x.statement.ends;
      x.batch = b;
      x.nosync = i < parts2.length - 1;
      options.scheduler && cost(x);
      queue(x);
    });
  }
  function batched(b, i, error2, result) {
    if (b.settled[i])
      return;
    b.settled[i] = true;
    b.left--;
    error2 ? (b.error === null || i < b.index && !error2.skipped) && (b.error = error2, b.index = i) : b.results[i] = result;
    if (b.left)
      return;
    const { query: query2, parts: parts2, results } = b;
    if (b.error) {
      b.error.index = b.index;
      parts2.forEach((part3, j) => {
        Query.prototype.reject.call(part3, j === b.index ? b.error : skipped(b.error, b.index));
        part3.catch(noop4);
      });
      return query2.reject(b.error);
    }
    parts2.forEach((part3, j) => Query.prototype.resolve.call(part3, results[j]));
    query2.resolve(results);
  }
  function skipped(error2, index) {
    const x = copy(error2);
    x.index = index;
    x.skipped = true;
    return x;
  }
  function part2(x) {
    sent.shift();
    options.scheduler && timed(x);
    x.done = true;
    x.open = false;
    x.trace && traced3--;
    blocker === x && (blocker = null);
    settle(x);
    const next = sent[0];
    if (next && next.query) {
      next.query.active = true;
      next.cancel && turn(next);
    }
    release();
  }
  function abort(x) {
    if (x.aborted)
      return;
    x.aborted = true;
    const b = x.batch, error2 = x.own || x.error;
    b.aborted = error2;
    let synced = !x.nosync && x.synced;
    const at = sent.indexOf(x);
    for (let i = at === -1 ? sent.length : at + 1; i < sent.length; ) {
      const y = sent[i];
      if (y.batch === b) {
        sent.splice(i, 1);
        synced = synced || !y.nosync && y.synced;
        drop2(y);
        blocker === y && (blocker = null);
      } else {
        i++;
      }
    }
    for (let i = 0; i < pending.length; ) {
      const y = pending[i];
      y.batch === b ? (pending.splice(i, 1), drop2(y)) : i++;
    }
    synced || sync(out);
    x.nosync = false;
    x.synced = true;
    schedule();
    function drop2(y) {
      y.entry && y.entry.owner === y && y.entry.state === "parsing" && (y.entry.state = "stale");
      y.done = true;
      y.trace && traced3--;
      y.cost >= notable && notables--;
      settleError(y, skipped(error2, b.parts.indexOf(y.query)));
    }
  }
  function cost(x) {
    const { query: query2 } = x;
    query2.cost && !query2.cursorFn && !query2.streaming && (x.cost = query2.cost.est === void 0 ? unknown : query2.cost.est);
    x.cost >= notable && notables++;
  }
  function timed(x) {
    const t = timers.now();
    if (x.cost !== void 0) {
      x.cost >= notable && notables--;
      const sample = t - headSince, c2 = x.query.cost;
      c2.est = c2.est === void 0 || sample > c2.est ? sample : c2.est + (sample - c2.est) * 0.1;
      events.ontimed && events.ontimed(sample, t);
    }
    headSince = t;
  }
  function backlog(t) {
    let w = 0;
    for (let i = 0; i < sent.length; i++) {
      const e = sent[i].cost || 0;
      if (i === 0) {
        const elapsed = t - headSince;
        w += elapsed < e ? e - elapsed : elapsed;
      } else {
        w += e;
      }
    }
    for (let i = 0; i < pending.length; i++)
      w += pending[i].cost || 0;
    return w;
  }
  function heavy() {
    for (let i = 0; i < sent.length; i++) {
      if (sent[i].cost >= slow)
        return true;
    }
    for (let i = 0; i < pending.length; i++) {
      if (pending[i].cost >= slow)
        return true;
    }
    return false;
  }
  function extended(x) {
    const { query: query2 } = x, { built } = query2.wire, statement2 = x.statement, name = statement2.name, current = name ? prepared.get(name) : null;
    if (query2.cursorFn) {
      x.rows = query2.cursorRows;
      x.portal = transaction2() ? "c" + portals++ : "";
      x.flushing = !x.portal;
    }
    x.streaming = x.open = !!query2.streaming;
    if (current && current.state === "parsing" && current.oids === null && current.owner && !current.owner.error) {
      if (!current.owner.loose)
        throw Errors.generic("STATEMENT_PENDING", "A statement was used before its description arrived");
      current.owner.gate = true;
      return held;
    }
    if (current && current !== x.previous && usable(current, statement2)) {
      const b = query2.isRaw === true || query2.ownParsers ? null : binaries(current);
      x.entry = current;
      x.columns = b ? b.columns : current.columns;
      x.formats = b ? b.formats : null;
      x.values = serialize(current.oids, built, current);
      return run2(x, name);
    }
    if (x.retried) {
      x.verify = true;
      parse(out, "", statement2.text, built.oids);
      describe(out, "S", "");
      flush(out);
      x.describing = true;
      return;
    }
    const typed = !inferred(built);
    name && (x.fresh = Entry(name, x, typed ? built.oids : null));
    current && close(out, "S", name);
    parse3(x, name, statement2.text, built.oids);
    describe(out, "S", name);
    if (!typed && !loose(x, built)) {
      flush(out);
      x.describing = true;
      return;
    }
    x.learn = true;
    x.values = typed ? serialize(built.oids, built, x.fresh || {}) : untyped(built);
    run2(x, name);
  }
  function binaries(entry) {
    if (entry.binaryOf === entry.columns)
      return entry.binary;
    const columns2 = entry.columns, formats = new Array(columns2.length);
    let binary = null;
    for (let i = 0; i < columns2.length; i++) {
      const decode2 = events.binary(columns2[i].type);
      formats[i] = decode2 ? 1 : 0;
      decode2 && ((binary || (binary = columns2.slice()))[i] = { ...columns2[i], decode: decode2 });
    }
    entry.binaryOf = columns2;
    return entry.binary = binary && { columns: binary, formats };
  }
  function loose(x, built) {
    if (!events.plain || x.query.cursorFn || x.streaming)
      return false;
    const { oids, values: values2 } = built;
    for (let i = 0; i < oids.length; i++) {
      if (!oids[i] && values2[i] !== null && !(typeof values2[i] === "number" && isFinite(values2[i])))
        return false;
    }
    return x.loose = true;
  }
  function untyped(built) {
    const { oids, values: values2 } = built, out2 = new Array(values2.length);
    for (let i = 0; i < values2.length; i++)
      out2[i] = values2[i] === null ? null : oids[i] ? events.serializer(oids[i])(values2[i]) : "" + values2[i];
    return out2;
  }
  function parse3(x, name, text4, oids) {
    parse(out, name, text4, oids);
    x.parses.push(name);
  }
  function run2(x, name) {
    const mark = out.length;
    try {
      x.nosync ? (bind(out, x.portal, name, x.values, void 0, x.formats || void 0), execute(out, x.portal, x.rows)) : run(out, x.portal, name, x.values, x.rows, x.flushing, x.formats);
    } catch (error2) {
      out.truncate(mark);
      throw error2;
    }
    x.flushing || (x.synced = true);
    const oids = x.entry ? x.entry.oids : x.params || (x.loose ? null : x.query.wire.built.oids);
    oids ? debug(x.statement.text, x.values, oids) : x.later = true;
  }
  function logged(item, oids) {
    item.later && oids && (item.later = false, debug(item.statement.text, item.values, oids));
  }
  function usable(entry, statement2) {
    return entry.oids !== null && (entry.state === "parsing" || entry.state === "ready" && entry.version === statement2.version);
  }
  function learned(entry, statement2) {
    const shape = entry.oids.join() + ":" + entry.columns.map((x) => x.type).join();
    if (statement2.shape !== shape) {
      statement2.shape === void 0 || statement2.version++;
      statement2.shape = shape;
    }
    entry.version = statement2.version;
  }
  function inferred(built) {
    for (let i = 0; i < built.oids.length; i++) {
      if (!built.oids[i])
        return true;
    }
    return false;
  }
  function serialize(oids, built, cache) {
    const serializers = cache.serializers || (cache.serializers = oids.map(events.serializer)), values2 = built.values, out2 = new Array(values2.length);
    for (let i = 0; i < values2.length; i++) {
      out2[i] = values2[i] === null ? null : serializers[i](values2[i]);
      out2[i] === null || out2[i] === void 0 || typeof out2[i] === "string" || out2[i] instanceof Uint8Array || Buffer.byteLength(out2[i]);
    }
    return out2;
  }
  function transaction2() {
    return !!connection2.lease && connection2.lease.kind === "transaction";
  }
  function described(x) {
    x.describing = false;
    x.described = true;
    const { built } = x.query.wire, name = x.statement.name, params = x.params || [], columns2 = x.columns || [];
    try {
      if (x.verify) {
        const previous2 = x.previous;
        if (previous2 && same2(previous2, params, columns2)) {
          if (x.original) {
            x.own = x.original;
            return sync2(x);
          }
        } else if (previous2) {
          stale(previous2);
          x.statement.version++;
        }
        x.values = serialize(params, built, {});
        return run2(x, "");
      }
      const entry = x.entry;
      entry && (entry.oids = params, entry.columns = columns2, learned(entry, x.statement));
      x.values = serialize(params, built, entry || {});
      run2(x, name);
    } catch (error2) {
      x.own = error2;
      x.batch ? (parse(out, "", refused), x.parses.push(""), abort(x)) : sync2(x, !!connection2.lease);
    }
  }
  function same2(entry, params, columns2) {
    const a = entry.oids || [], b = entry.columns;
    return !!b && a.length === params.length && params.every((x, i) => x === a[i]) && b.length === columns2.length && columns2.every((x, i) => x.type === b[i].type);
  }
  function describe2(statement2, oids, query2) {
    return new Promise((resolve, reject) => {
      const x = Exchange("describe", null, connection2.lease, (x2) => {
        parse(out, "", statement2.text, oids);
        describe(out, "S", "");
        sync2(x2);
      });
      x.for = query2 || null;
      x.resolve = resolve;
      x.reject = reject;
      queue(x);
    });
  }
  function simple(query2, sql2) {
    const x = Exchange("simple", query2, connection2.lease, (x2) => {
      debug(sql2, [], []);
      query(out, sql2);
      x2.synced = true;
    });
    x.text = sql2;
    x.results = [];
    x.ends = ending.test(sql2);
    x.streaming = x.open = !!query2.streaming;
    options.scheduler && cost(x);
    queue(x);
  }
  function local(query2, error2) {
    queue(Exchange("query", query2, connection2.lease, () => {
      throw error2;
    }));
  }
  function cancel3(query2) {
    if (query2.parts)
      return cancelBatch(query2);
    if (stash && sent[0] && sent[0].query === query2) {
      sent[0].own = Errors.generic("57014", "canceling statement due to user request");
      go();
      return Promise.resolve();
    }
    if (running.has(query2) || sent[0] && sent[0].query === query2 && sent[0].awaiting)
      return query2.aborted = Errors.generic("57014", "canceling statement due to user request"), Promise.resolve();
    const i = pending.findIndex((x2) => x2.query === query2 || x2.for === query2);
    if (i !== -1) {
      const [x2] = pending.splice(i, 1);
      x2 === fence && (fence = null);
      x2.cost >= notable && notables--;
      settleError(x2, Errors.generic("57014", "canceling statement due to user request"));
      release();
      return Promise.resolve();
    }
    const x = sent.find((x2) => x2.query === query2 || x2.for === query2);
    if (!x)
      return Promise.resolve();
    if (x === sent[0] && x.completed)
      return expect(x), Promise.resolve();
    if (x === sent[0] && (query2.active || x.for))
      return cancelling(x);
    quiet(x);
    return new Promise((resolve, reject) => x.cancel = { resolve, reject });
  }
  function turn(x) {
    x.silence && (timers.clearTimeout(x.silence), x.silence = null);
    const go2 = () => {
      x.silence = null;
      if (closed || x.done || sent[0] !== x)
        return x.cancel.resolve();
      if (x.completed)
        return expect(x), x.cancel.resolve();
      cancelling(x).then(x.cancel.resolve, x.cancel.reject);
    };
    x.query && x.query.timedOut && options.query_timeout ? x.silence = timers.setTimeout(go2, options.query_timeout * 1e3) : defer(go2);
  }
  function quiet(x) {
    if (!options.cancel_timeout || x.silence)
      return;
    const ms = options.cancel_timeout * 1e3, check = () => {
      x.silence = null;
      const query2 = x.query || x.for;
      if (closed || x.done || !query2 || query2.settled)
        return;
      const idle2 = timers.now() - heard;
      idle2 >= ms ? destroy(Errors.generic("CANCEL_UNANSWERED", "The server sent nothing within cancel_timeout (" + options.cancel_timeout + " seconds) while a canceled query waited, so whether it ran is unknown")) : x.silence = timers.setTimeout(check, ms - idle2);
    };
    x.silence = timers.setTimeout(check, ms);
  }
  function cancelling(x) {
    expect(x);
    return ready.cancel();
  }
  function expect(x) {
    options.cancel_timeout && !x.unanswered && (x.unanswered = timers.setTimeout(() => unanswered(x), options.cancel_timeout * 1e3));
  }
  function unanswered(x) {
    x.unanswered = null;
    const query2 = x.batch ? x.batch.query : x.query || x.for;
    if (closed || x.done && !x.batch || !query2 || query2.settled)
      return;
    destroy(Errors.generic(
      "CANCEL_UNANSWERED",
      "The server did not answer within cancel_timeout (" + options.cancel_timeout + " seconds) after a query was canceled, so whether it ran is unknown"
    ));
  }
  function answered(x) {
    x.silence && (timers.clearTimeout(x.silence), x.silence = null);
    x.unanswered && (!x.batch || x.batch.query.settled) && (timers.clearTimeout(x.unanswered), x.unanswered = null);
  }
  function cancelBatch(query2) {
    const x = sent.find((x2) => x2.batch && x2.batch.query === query2);
    if (x)
      return x === sent[0] ? cancelling(x) : new Promise((resolve, reject) => x.cancel = { resolve, reject });
    const first2 = pending.find((x2) => x2.batch && x2.batch.query === query2);
    if (first2) {
      first2.own = Errors.generic("57014", "canceling statement due to user request");
      first2.write = () => {
        throw first2.own;
      };
    }
    return Promise.resolve();
  }
  function close2() {
    closing || (closing = new Promise((r) => {
      connection2.onended = r;
      idle() && terminate2();
    }));
    return closing;
  }
  function idle() {
    return sent.length === 0 && pending.length === 0;
  }
  function terminate2() {
    if (closed)
      return connection2.onended && connection2.onended();
    flush2();
    socket.end(Terminate());
  }
  function destroy(error2) {
    closing || (closing = Promise.resolve());
    socket.destroy(error2);
  }
  function onclose(error2) {
    if (closed)
      return;
    out.take();
    blocker = null;
    fence = null;
    notables = 0;
    const head = sent[0], failed2 = head && head.error && head.error.severity === "FATAL" ? head.error : null, fatal = connection2.fatal || failed2;
    connection2.uncertain = !!(fatal && head && head.ends);
    closed = Errors.connection(closing ? "CONNECTION_DESTROYED" : "CONNECTION_CLOSED", options, ready.host, ready.port);
    closed.cause = fatal || error2 || void 0;
    sent.concat(pending).forEach((x) => x.cancel && x.cancel.resolve());
    sent.splice(0).forEach((x) => {
      x.stream && x.stream.destroy(closed);
      x.own ? settle(x) : failed2 ? settleError(x, x === head ? failed2 : copy(failed2)) : settleError(x, copy(closed));
    });
    pending.splice(0).forEach((x) => x.own ? settle(x) : settleError(x, copy(closed)));
    running.forEach((query2) => query2.settled || query2.reject(decorate(query2, copy(closed))));
    running.clear();
    open2.clear();
    connection2.onended && connection2.onended();
    events.onclose(connection2, closed);
  }
  function decorate(query2, error2) {
    return queryError(error2, query2, options.debug);
  }
  function settleError(x, error2) {
    answered(x);
    x.kind === "describe" ? x.reject(error2) : x.query && !x.query.settled && x.query.reject(decorate(x.query, error2));
  }
  function debug(text4, values2, oids) {
    typeof options.debug === "function" && options.debug(connection2.id, text4, values2, oids);
  }
  function wrote(x) {
    const trace = x.trace;
    traced3++;
    trace.query = x.text || x.statement.text;
    trace.statement = x.statement ? x.statement.name : "";
    trace.parameters = options.debug ? x.query.parameters : void 0;
    trace.connection = connection2.id;
    trace.host = connection2.host;
    trace.port = connection2.port;
    trace.sent = now();
  }
  function first() {
    const x = sent[0];
    x && x.trace && x.trace.firstByte === null && (x.trace.firstByte = now());
  }
  function frame(type, x, start2, end) {
    if (!events.typed && stash === null && (type === 84 || type === 116) && events.unknown(type === 84 ? rowDescription(x, start2, end, oidOf) : parameterDescription(x, start2))) {
      stash = { type, x: Buffer.from(x.subarray(start2, end)) };
      frames.pause();
      return events.need(connection2);
    }
    dispatch(type, x, start2, end);
  }
  function go() {
    if (!stash)
      return;
    const { type, x } = stash;
    dispatch(type, x, 0, x.length);
    stash = null;
    frames.resume();
  }
  function dispatch(type, x, start2, end) {
    traced3 && first();
    try {
      type === 68 ? DataRow(x, start2) : type === 100 ? CopyData2(x, start2, end) : type === 90 ? ReadyForQuery(x, start2) : type === 67 ? CommandComplete(x, start2, end) : type === 50 ? BindComplete() : type === 49 ? ParseComplete() : type === 51 ? null : type === 116 ? ParameterDescription(x, start2) : type === 84 ? RowDescription(x, start2) : type === 110 ? NoData() : type === 69 ? ErrorResponse(x, start2, end) : type === 115 ? PortalSuspended() : type === 73 ? EmptyQueryResponse() : type === 65 ? NotificationResponse(x, start2) : type === 78 ? NoticeResponse(x, start2, end) : type === 83 ? ParameterStatus(x, start2) : type === 71 ? CopyInResponse() : type === 72 ? CopyOutResponse() : type === 87 ? CopyBothResponse() : type === 99 ? CopyDone2() : type === 86 ? unsupported("FunctionCallResponse") : type === 118 ? unsupported("NegotiateProtocolVersion") : null;
    } catch (error2) {
      const x2 = sent[0];
      x2 ? fail(x2, error2) : destroy(error2);
    }
    blocker && !holds(blocker) && (blocker = null, release());
    out.length && schedule();
  }
  function fail(x, error2) {
    x.error = x.error || error2;
    x.describing = false;
    x.open = false;
    x.batch ? abort(x) : sync2(x);
  }
  function unsupported(x) {
    sent[0] && fail(sent[0], Errors.notSupported(x));
  }
  function ParseComplete() {
    const x = sent[0], name = x.parses.shift();
    name && x.entry && x.entry.name === name && x.entry.owner === x && x.entry.state === "parsing" && (x.entry.state = "ready");
  }
  function BindComplete() {
    const x = sent[0];
    x.bound = true;
    if (!x.columns && x.entry) {
      x.columns = x.entry.columns;
      x.result.columns = x.columns;
    }
  }
  function ParameterDescription(x, start2) {
    const item = sent[0];
    item.params = parameterDescription(x, start2);
    item.loose && item.entry && item.entry.owner === item && item.entry.oids === null && (item.entry.oids = item.params);
    logged(item, item.params);
  }
  function RowDescription(x, start2) {
    received(sent[0], rowDescription(x, start2, 0, column2));
  }
  function NoData() {
    received(sent[0], []);
  }
  function received(x, columns2) {
    if (x.kind === "simple" && x.result.command !== null) {
      x.results.push(x.result);
      x.result = new Result();
    }
    x.columns = columns2;
    x.result.columns = columns2;
    if (x.learn) {
      x.learn = false;
      x.entry && x.entry.owner === x && (x.entry.columns = columns2, learned(x.entry, x.statement));
    }
    x.describing && described(x);
  }
  function column2(name, table, number2, type) {
    const parser = events.parser(type);
    return {
      name: transform.column.from ? transform.column.from(name) : name,
      parser: parser.identity ? null : parser,
      decode: events.decoder(type, parser),
      table,
      number: number2,
      type
    };
  }
  function DataRow(x, start2) {
    const item = sent[0], { query: query2 } = item, raw = query2.isRaw, from = raw !== true ? transform.value.from : null, shape = item.shaped === item.columns ? item.reader : (item.shaped = item.columns, item.reader = query2.ownParsers && raw !== true ? Parsed(item.columns, query2.ownParsers) : Rows(item.columns)), columns2 = shape.columns, fast = raw !== true && read(shape, !!raw, text3, from), n = columns2.length, result = item.result;
    let row;
    if (fast) {
      row = fast(x, start2 + 7);
    } else {
      row = raw ? new Array(n) : {};
      let i = start2 + 7;
      for (let j = 0; j < n; j++) {
        const length = x[i] << 24 | x[i + 1] << 16 | x[i + 2] << 8 | x[i + 3], column3 = columns2[j];
        i += 4;
        let value2 = null;
        if (length !== -1) {
          value2 = raw === true ? Buffer.from(x.subarray(i, i + length)) : column3.decode ? column3.decode(x, i, i + length) : column3.parser ? column3.parser(text3(x, i, i + length)) : text3(x, i, i + length);
          i += length;
        }
        from && (value2 = from(value2, column3));
        raw ? row[j] = value2 : column3.name === "__proto__" ? own2(row, column3.name, value2) : row[column3.name] = value2;
      }
    }
    const out2 = transform.row.from ? transform.row.from(row) : row;
    query2.forEachFn ? query2.forEachFn(out2, result) : result[result.length] = out2;
  }
  function CommandComplete(x, start2, end) {
    const item = sent[0], { command, count } = commandComplete(x, start2, end), result = item.result;
    result.command = command;
    result.count = count;
    result.state = connection2.backend;
    result.statement = item;
    item.query && (item.query.source = item);
    item.kind === "simple" || (result.columns = result.columns || item.columns);
    item.final && (item.stream && Object.assign(item.stream, { count, command }), item.final(), item.final = null);
    item.kind !== "simple" && (item.completed = true);
    if (item.kind === "simple") {
      item.results.push(item.result);
      item.result = new Result();
      return;
    }
    if (item.rows) {
      item.finished = true;
      item.flushing && sync2(item);
      if (result.count || result.length)
        (item.last = new Promise((r) => r(item.query.cursorFn(result)))).catch(noop4);
    }
    item.nosync && !item.error && part2(item);
  }
  function unsafe(item) {
    const error2 = () => Errors.generic("UNSAFE_TRANSACTION", "Only use sql.begin, sql.reserved or max: 1");
    rolling = true;
    item.own = error2();
    sent.forEach((x) => x.kind !== "local" && (x.own = error2()));
    pending.unshift(Exchange("internal", null, null, (x) => (query(out, "rollback"), x.synced = true)));
  }
  function EmptyQueryResponse() {
    const item = sent[0];
    item.kind === "simple" && (item.results.push(item.result), item.result = new Result());
    item.nosync && !item.error && part2(item);
  }
  async function PortalSuspended() {
    const item = sent[0];
    if (!item.flushing)
      return item.suspended = true;
    try {
      item.awaiting = true;
      const next = await item.query.cursorFn(item.result);
      item.awaiting = false;
      item.result = new Result();
      if (closed || item.synced || sent[0] !== item)
        return;
      if (item.query.aborted)
        throw item.query.aborted;
      next === CLOSE ? (close(out, "P", ""), sync2(item)) : (execute(out, "", item.rows), flush(out), schedule());
    } catch (error2) {
      item.awaiting = false;
      if (closed || item.synced || sent[0] !== item)
        return;
      fail(item, error2);
    }
    refresh();
  }
  function ErrorResponse(x, start2, end) {
    const item = sent[0], error2 = Errors.postgres(error(x, start2, end));
    if (!item)
      return connection2.fatal = error2;
    item.stream && item.stream.destroy(error2);
    item.final && (item.final(error2), item.final = null);
    fail(item, error2);
  }
  function ReadyForQuery(x, start2) {
    status = readyForQuery(x, start2);
    frames.own(false);
    const item = sent.shift();
    options.scheduler && timed(item);
    item.done = true;
    item.open = false;
    item.trace && traced3--;
    item.kind === "internal" && (rolling = false);
    status !== "I" && !rolling && !item.lease && !connection2.lease && options.max !== 1 && unsafe(item);
    blocker === item && (blocker = null);
    settle(item);
    item.entry && item.entry.owner === item && (item.entry.owner = null);
    while (sent.length && sent[0].kind === "local")
      settle(sent.shift());
    release();
    const next = sent[0];
    if (next && next.query) {
      next.query.active = true;
      next.cancel && turn(next);
    }
    closing && idle() && terminate2();
    events.onready(connection2);
  }
  function settle(x) {
    answered(x);
    settling(x);
    x.batch && answered(x);
  }
  function settling(x) {
    if (x.kind === "internal")
      return;
    if (x.kind === "describe") {
      return x.error ? x.reject(x.error) : x.resolve({ params: x.params || [], columns: x.columns });
    }
    const { query: query2 } = x, cursor = x.origin || (x.portal ? x : null);
    cursor && (x.own || x.error || !x.suspended) && unfence(cursor);
    if (x.own)
      return query2.reject(decorate(query2, x.own));
    if (x.error)
      return failed(x);
    if (x.suspended)
      return suspended(x);
    x.last ? x.last.then(() => query2.settled || finish2(x), (error2) => query2.settled || query2.reject(decorate(query2, error2))) : query2.settled || finish2(x);
  }
  function unfence(cursor) {
    if (!open2.delete(cursor) || open2.size || !fence)
      return;
    fence = null;
    release();
  }
  function failed(x) {
    const entry = x.kind === "query" ? x.entry : null;
    const parsing = x.fresh || entry && entry.owner === x && entry.state === "parsing";
    if (x.error.code === "42P05" && x.kind === "query" && x.statement.name && parsing) {
      entry && drop(entry);
      x.statement.name += "_";
      return retryable(x) ? again(x, null) : settleError(x, x.error);
    }
    if (!entry)
      return settleError(x, x.error);
    if (entry.owner === x && entry.state === "parsing")
      return drop(entry), settleError(x, x.error);
    if (x.error.code === "26000") {
      drop(entry);
      return retryable(x) ? again(x, null) : settleError(x, x.error);
    }
    if (x.bound)
      return settleError(x, x.error);
    if (retryable(x))
      return again(x, x.error);
    stale(entry);
    settleError(x, x.error);
  }
  function stale(entry) {
    prepared.get(entry.name) === entry && (entry.state = "stale");
  }
  function retryable(x) {
    return !x.retried && !x.batch && !x.cancel && !x.query.cancelled && !x.query.cursorFn && !x.streaming && x.lease === connection2.lease && status === "I" && !closing && (sent.length === 0 || !x.lease && options.max !== 1);
  }
  function again(x, original) {
    const retry = Exchange("query", x.query, x.lease, extended);
    retry.statement = x.statement;
    retry.ends = x.ends;
    retry.retried = true;
    retry.original = original;
    retry.previous = x.entry;
    retry.trace = x.trace;
    retry.cost = x.cost;
    if (sent.length)
      return queue(retry);
    pending.unshift(retry);
    release();
  }
  function suspended(x) {
    const cursor = x.origin || x, { query: query2 } = x;
    running.add(query2);
    new Promise((r) => r(query2.cursorFn(x.result))).then((next) => {
      running.delete(query2);
      if (query2.settled)
        return unfence(cursor);
      queue(step(cursor, next === CLOSE || !!query2.aborted, query2.aborted || null));
    }, (error2) => {
      running.delete(query2);
      if (query2.settled)
        return unfence(cursor);
      queue(step(cursor, true, error2));
    });
  }
  function step(cursor, end, failure) {
    const x = Exchange("step", cursor.query, cursor.lease, stepped);
    x.origin = cursor;
    x.statement = cursor.statement;
    x.entry = cursor.entry;
    x.columns = cursor.columns;
    x.portal = cursor.portal;
    x.rows = cursor.rows;
    x.end = end;
    x.failure = failure;
    return x;
  }
  function stepped(x) {
    const cursor = x.origin;
    if (connection2.lease !== cursor.lease || cursor.epoch !== epoch2) {
      if (x.failure)
        throw x.failure;
      if (!x.end)
        throw outlived();
      return skip;
    }
    x.own = x.failure;
    x.end ? close(out, "P", x.portal) : execute(out, x.portal, x.rows);
    sync2(x);
  }
  function outlived() {
    return Errors.generic("UNSAFE_TRANSACTION", "The cursor outlived its transaction");
  }
  function finish2(x) {
    const { query: query2 } = x;
    if (x.kind === "simple") {
      x.result.command !== null && x.results.push(x.result);
      const results = x.results;
      return query2.resolve(results.length > 1 ? results : results[0] || x.result);
    }
    query2.resolve(x.result);
  }
  function NotificationResponse(x, start2) {
    const { pid, channel, payload } = notification(x, start2);
    events.onnotify && guard(events.onnotify, channel, payload, pid);
  }
  function guard(fn, ...xs) {
    try {
      fn(...xs);
    } catch (error2) {
      noop4(error2);
    }
  }
  function NoticeResponse(x, start2, end) {
    const notice = error(x, start2, end);
    listened(channels.notice) && channels.notice.publish({
      notice,
      connection: connection2.id,
      host: connection2.host,
      port: connection2.port,
      database: options.database
    });
    options.onnotice ? guard(options.onnotice, notice) : options.onnotice === false || console.log(notice);
  }
  function ParameterStatus(x, start2) {
    const [k, v] = parameterStatus(x, start2);
    connection2.parameters[k] = v;
    events.onparameter && guard(events.onparameter, k, v);
  }
  function writeData(chunk, callback) {
    copyData(out, chunk);
    flush2() ? callback() : drained = callback;
  }
  function writable(item) {
    return {
      autoDestroy: true,
      write(chunk, encoding, callback) {
        writeData(chunk, callback);
      },
      destroy(error2, callback) {
        callback(error2);
        item.stream = null;
        if (!item.copied && !closed && !item.error) {
          copyFail(out, (error2 || "The COPY stream was destroyed") + "");
          item.copied = true;
          item.open = false;
          schedule(true);
          refresh();
        }
      },
      final(callback) {
        copyDone(out);
        item.copied = true;
        item.open = false;
        item.final = callback;
        schedule(true);
        refresh();
      }
    };
  }
  function CopyInResponse() {
    const item = sent[0];
    item.stream = new Stream.Writable(writable(item));
    item.query.resolve(item.stream);
  }
  function readable(item) {
    return () => {
      item.wanted = true;
      if (!frames.paused)
        return;
      frames.resume();
      frames.paused || socket.resume();
    };
  }
  function abandoned(item) {
    return (error2, callback) => {
      callback(error2);
      if (!item.stream)
        return;
      item.stream = null;
      if (frames.paused) {
        frames.resume();
        frames.paused || socket.resume();
      }
    };
  }
  function CopyOutResponse() {
    const item = sent[0];
    item.stream = new Stream.Readable({ read: readable(item), destroy: abandoned(item) });
    item.open = false;
    frames.own(true);
    item.query.resolve(item.stream);
  }
  function CopyBothResponse() {
    const item = sent[0];
    item.stream = new Stream.Duplex({ ...writable(item), read: readable(item) });
    frames.own(true);
    item.query.resolve(item.stream);
  }
  function CopyData2(x, start2, end) {
    const item = sent[0];
    if (!item.stream)
      return;
    item.wanted = false;
    if (!item.stream.push(frames.owns(x) ? x.subarray(start2 + 5, end) : Buffer.from(x.subarray(start2 + 5, end))) && !item.wanted) {
      frames.pause();
      socket.pause();
    }
  }
  function CopyDone2() {
    frames.own(false);
    const item = sent[0];
    item.stream && item.stream.push(null);
    item.stream = null;
  }
}
function oidOf(name, table, number2, type) {
  return type;
}
function copy(error2) {
  const x = Object.create(Object.getPrototypeOf(error2), Object.getOwnPropertyDescriptors(error2));
  Object.defineProperty(x, "stack", { value: error2.stack, writable: true, configurable: true });
  ["query", "parameters", "args", "types"].forEach((k) => delete x[k]);
  return x;
}
function key(name) {
  const x = JSON.stringify(String(name));
  return name === "__proto__" ? "[" + x + "]" : x;
}
function own2(row, name, value2) {
  Object.defineProperty(row, name, { value: value2, writable: true, enumerable: true, configurable: true });
}
function Exchange(kind, query2, lease, write) {
  return {
    kind,
    query: query2,
    lease,
    write,
    trace: query2 && query2.trace || null,
    statement: null,
    text: "",
    entry: null,
    fresh: null,
    previous: null,
    parses: [],
    values: null,
    params: null,
    columns: null,
    shaped: null,
    reader: null,
    result: new Result(),
    results: null,
    origin: null,
    portal: "",
    rows: 0,
    end: false,
    failure: null,
    flushing: false,
    streaming: false,
    open: false,
    alone: !!(query2 && query2.alone),
    describing: false,
    learn: false,
    batch: null,
    nosync: false,
    aborted: false,
    flushed: false,
    loose: false,
    gate: false,
    later: false,
    formats: null,
    verify: false,
    synced: false,
    bound: false,
    suspended: false,
    finished: false,
    done: false,
    ends: false,
    epoch: 0,
    retried: false,
    original: null,
    error: null,
    own: null,
    cancel: null,
    unanswered: null,
    silence: null,
    completed: false,
    for: null,
    stream: null,
    copied: false,
    wanted: false,
    final: null,
    resolve: null,
    reject: null,
    cost: void 0
  };
}
function Entry(name, owner, oids) {
  return { name, owner, oids, columns: null, serializers: null, binary: null, binaryOf: null, state: "parsing", version: -1 };
}
function Rows(columns2) {
  let state = states.get(columns2);
  if (state === void 0) {
    state = {
      columns: columns2,
      seen: 0,
      object: null,
      array: null,
      variants: null,
      compilable: compiles && columns2.length <= 512 && !columns2.some((x) => String(x.name) === "__proto__")
    };
    states.set(columns2, state);
  }
  return state;
}
function Parsed(columns2, parsers) {
  const state = Rows(columns2), list = columns2.map(
    typeof parsers === "function" ? (c2) => parsers(c2) || null : (c2) => c2.type in parsers ? parsers[c2.type] || null : c2.parser
  );
  if (list.every((x, i) => x === columns2[i].parser))
    return state;
  const variants = state.variants || (state.variants = []), found = variants.find((v) => v.list.every((x, i) => x === list[i]));
  if (found)
    return found.state;
  const variant = { list, state: Rows(columns2.map((c2, i) => list[i] === c2.parser ? c2 : { ...c2, parser: list[i], decode: null })) };
  variants.length === variety && variants.shift();
  variants.push(variant);
  return variant.state;
}
function read(state, array, text4, from) {
  const key2 = array ? "array" : "object";
  if (state[key2] !== null)
    return state[key2];
  if (!state.compilable || ++state.seen < after)
    return null;
  try {
    return state[key2] = compile(state.columns, array, text4, from);
  } catch (_) {
    compiles = state.compilable = false;
    return null;
  }
}
function compile(columns2, array, text4, from) {
  const locals = [], body = ["let l = 0"], at = "x, i, i + l";
  columns2.forEach((c2, j) => {
    c2.decode ? locals.push("d" + j + " = c[" + j + "].decode") : c2.parser && locals.push("p" + j + " = c[" + j + "].parser");
    const value2 = c2.decode ? "d" + j + "(" + at + ")" : c2.parser ? "p" + j + "(text(" + at + "))" : "text(" + at + ")";
    body.push(
      "l = (x[i] << 24) | (x[i + 1] << 16) | (x[i + 2] << 8) | x[i + 3]",
      "i += 4",
      "let v" + j + " = null",
      "l !== -1 && (v" + j + " = " + value2 + ", i += l)",
      from ? "v" + j + " = from(v" + j + ", c[" + j + "])" : ""
    );
  });
  body.push(
    array ? "return [" + columns2.map((c2, j) => "v" + j).join(",") + "]" : "return {" + columns2.map((c2, j) => key(c2.name) + ":v" + j).join(",") + "}"
  );
  return new Function(
    "c",
    "text",
    "from",
    // eslint-disable-line
    (locals.length ? "const " + locals.join(", ") + "\n" : "") + "return function row(x, i) {\n" + body.filter(Boolean).join("\n") + "\n}"
  )(columns2, text4, from);
}

// node_modules/postgres/src/pool.js
var begins = /\bbegin\b/i;
var noop5 = () => {
};
var starts = /\bstart\b/gi;
var transaction = /^transaction\b/i;
function Pool(options, types2) {
  const { setTimeout: setTimeout2, clearTimeout: clearTimeout2, now: now2 } = options.timers, statements = Statements(options.scheduler), connections = /* @__PURE__ */ new Set(), waiting = Queue(), events = {
    parser: types2.parser,
    decoder: types2.decoder,
    binary: types2.binary,
    serializer: types2.serializer,
    plain: types2.plain,
    onready,
    onclose,
    onnotify: options.onnotify,
    onparameter,
    ontimed,
    typed: options.fetch_types === false,
    unknown: (oids) => !typesLoaded && types2.unknown(oids),
    need
  }, work = { fast: 0, slow: 0, at: 0 };
  const signal = { aborted: false, sockets: /* @__PURE__ */ new Set() }, replacing = [], eager = types2.named || !!options.eager_types, paused = /* @__PURE__ */ new Set();
  let opening = 0, ending2 = null, used = false, endTimer = null, retries = 0, failingSince = null, nextAttempt = 0, retryTimer = null, typesLoaded = options.fetch_types === false, typesError = null, typesFailed = 0, failure = null, typesLoading = false, retryTypes = null, typeRetries = 0, typesFailing = null;
  const pool = {
    query: query2,
    lease,
    cancel: cancel3,
    end,
    close: close2,
    get stats() {
      return {
        connections: connections.size,
        opening,
        idle: [...connections].filter((x) => x.inflight === 0 && !x.lease).length,
        leased: [...connections].filter((x) => x.lease).length,
        waiting: waiting.length
      };
    }
  };
  return pool;
  function query2(q, lease2) {
    options.query_timeout && !q.timer && !q.settled && !q.cursorFn && !q.streaming && deadline(q);
    if (ending2 && !lease2)
      return q.reject(queryError(Errors.connection("CONNECTION_ENDED", options, options.host[0], options.port[0]), q, options.debug));
    if (q.parts)
      return batch(q, lease2);
    let built;
    try {
      built = q.build();
    } catch (error2) {
      return unbuilt(q, error2, lease2);
    }
    const free = !lease2 && options.max !== 1;
    if (q.options.simple && !built.values.length) {
      const known = (free || options.scheduler) && statements.known(built.text);
      q.alone = free && alone(known);
      options.scheduler && (q.cost = known);
      return place({ q, simple: built.text, exclusive: !!q.streaming || q.alone }, lease2);
    }
    if (q.onlyDescribe)
      return describeOnly(q, built, lease2);
    const statement2 = statements.get(built, options.prepare && q.options.prepare !== false);
    q.alone = free && alone(statement2.live ? statement2 : statements.known(built.text));
    q.wire = { statement: statement2, built };
    options.scheduler && (q.cost = statement2.cost);
    place({ q, statement: statement2, typed: !typesLoaded && unknown2(built.oids), exclusive: !!q.cursorFn || !!q.streaming || q.alone }, lease2);
  }
  function unknown2(oids) {
    for (let i = 0; i < oids.length; i++) {
      if (oids[i] && !types2.known(oids[i]))
        return true;
    }
    return false;
  }
  function deadline(q) {
    q.timer = setTimeout2(() => {
      q.timer = null;
      q.settled || (q.timedOut = true, cancel3(q).catch(noop5));
    }, options.query_timeout * 1e3);
  }
  function batch(q, lease2) {
    const parts2 = q.parts;
    if (!parts2.length)
      return q.resolve([]);
    for (let i = 0; i < parts2.length; i++) {
      try {
        parts2[i].build();
      } catch (error2) {
        error2 && typeof error2 === "object" && (error2.index = i);
        return unbuilt(q, error2, lease2);
      }
    }
    parts2.forEach((x) => {
      const built = x.built;
      x.wire = { statement: statements.get(built, options.prepare && x.options.prepare !== false), built };
    });
    const run3 = (c2) => (q.connection = c2, c2.batch(q, parts2), q.onwrite && q.onwrite());
    place({ q, run: run3, typed: !typesLoaded && parts2.some((x) => unknown2(x.built.oids)) }, lease2);
  }
  function describeOnly(q, built, lease2) {
    const statement2 = { name: "", text: built.text, oids: built.oids, columns: null }, run3 = (c2) => (q.connection = c2, c2.describe(statement2, built.oids, q).then(
      ({ params, columns: columns2 }) => q.resolve({ string: built.text, types: params, name: "", columns: columns2 }),
      (error2) => q.reject(queryError(error2, q, options.debug))
    ), q.onwrite && q.onwrite());
    lease2 ? run3(lease2.connection) : place({ run: run3, q, reject: (error2) => q.reject(queryError(error2, q, options.debug)) });
  }
  function unbuilt(q, error2, lease2) {
    error2 = queryError(error2, q, options.debug);
    if (!lease2 || lease2.released || lease2.connection.closed)
      return q.reject(error2);
    q.connection = lease2.connection;
    lease2.connection.local(q, error2);
    q.onwrite && q.onwrite();
  }
  function place(job, lease2) {
    used = true;
    const missing = !lease2 && retype();
    if (missing)
      return reject(job, missing);
    if (job.q && job.q.cancelled)
      return job.q.reject(queryError(Errors.generic("57014", "canceling statement due to user request"), job.q, options.debug));
    if (lease2) {
      return lease2.connection.closed ? job.q.reject(queryError(lease2.connection.closed, job.q, options.debug)) : lease2.released ? job.q.reject(queryError(ended(lease2), job.q, options.debug)) : run2(lease2.connection, job);
    }
    if (signal.aborted)
      return reject(job, Errors.connection("CONNECTION_DESTROYED", options, options.host[0], options.port[0]));
    if (failingFast())
      return reject(job, copy2(failure.error));
    const c2 = waiting.length === 0 && pick(job);
    if (c2)
      return run2(c2, job);
    waiting.push(wait(job));
    drain();
  }
  function wait(job) {
    if (!options.queue_timeout)
      return job;
    job.timer = setTimeout2(() => {
      job.timer = null;
      waiting.remove((x) => x === job) && reject(job, Errors.generic(
        "QUEUE_TIMEOUT",
        "Waited more than " + options.queue_timeout + " seconds for a connection"
      ));
    }, options.queue_timeout * 1e3);
    typeof job.timer.unref === "function" && job.timer.unref();
    return job;
  }
  function started(job) {
    job.timer && (clearTimeout2(job.timer), job.timer = null);
  }
  function run2(c2, job) {
    started(job);
    hold(c2);
    if (job.run)
      return job.run(c2);
    job.q.connection = c2;
    job.simple !== void 0 ? c2.simple(job.q, job.simple) : c2.send(job.q);
    job.q.onwrite && job.q.onwrite();
  }
  function drain() {
    while (waiting.length) {
      const job = waiting.peek(), c2 = pick(job);
      if (!c2 && !copying(job))
        break;
      waiting.shift();
      !c2 ? reject(job, Errors.generic("COPY_IN_PROGRESS", "You cannot execute queries during copy")) : job.lease ? grant(c2, job) : run2(c2, job);
    }
    waiting.length && listened(channels.pool) && event("wait", null, { waiting: waiting.length });
    grow();
  }
  function plain3(job) {
    return !!job.q && !job.lease && !job.exclusive && !job.run;
  }
  function copying(job) {
    if (!job.q || connections.size + opening < options.max || connections.size === 0)
      return false;
    for (const c2 of connections) {
      if (!c2.copying)
        return false;
    }
    return true;
  }
  function quiet(c2) {
    return c2.inflight === 0 || !!c2.typing && !c2.typing.settled && c2.inflight === 1;
  }
  function usable(c2) {
    return !c2.closed && !c2.closing && !c2.lease && !c2.releasing && !c2.retiring && !c2.exclusive && !c2.loading;
  }
  function pick(job) {
    const statement2 = job.statement, any = !statement2 || !statement2.name;
    if (!typesLoaded && (eager ? job.lease || job.typed : job.typed))
      return eager || need(), null;
    let best = null, soon = false;
    for (const c2 of connections) {
      c2.loading && !c2.closed && (soon = true);
      const free = usable(c2);
      if (free && quiet(c2)) {
        if (any || c2.prepared.has(statement2.name))
          return c2;
        best = best && quiet(best) ? best : c2;
      } else if (free && !job.lease && !job.exclusive && c2.inflight < options.max_pipeline && (!best || c2.inflight < best.inflight)) {
        best = c2;
      }
    }
    if (best && quiet(best))
      return best;
    if (soon || connections.size + opening < options.max && !failingSince)
      return null;
    best && options.scheduler && job.q && needed(job) && (best = scheduled(job) || best);
    return best && opening && best.inflight >= Math.ceil(waiting.length / (opening + 1)) ? null : best;
  }
  function needed(job) {
    if (!job.q.cost || job.q.cost.est === void 0 || job.q.cost.est >= notable)
      return true;
    for (const c2 of connections) {
      if (c2.notable)
        return true;
    }
    return false;
  }
  function scheduled(job) {
    const t = now2(), e = job.q.cost ? job.q.cost.est : void 0;
    if (e === void 0 || e < slow)
      return soonest(t, Infinity, false);
    let heavy = 0;
    for (const c2 of connections)
      c2.inflight && c2.heavy() && heavy++;
    decay(t);
    const reserve = Math.max(1, Math.min(Math.ceil(work.fast / 2e3 * 1.5) + 1, connections.size - Math.ceil(work.slow / 2e3)));
    return heavy < connections.size - reserve ? soonest(t, Infinity, false) : soonest(t, 2 * e, true) || soonest(t, Infinity, false);
  }
  function soonest(t, most, heavy) {
    let best = null, value2 = Infinity, ties = 0;
    for (const c2 of connections) {
      const v = usable(c2) && c2.inflight < options.max_pipeline && (!heavy || c2.heavy()) ? c2.backlog(t) : Infinity;
      if (v <= most && v < value2)
        best = c2, value2 = v, ties = 1;
      else if (v <= most && v === value2 && v !== Infinity && Math.random() * ++ties < 1)
        best = c2;
    }
    return best;
  }
  function ontimed(sample, t) {
    decay(t);
    sample < slow ? work.fast += sample : work.slow += sample;
  }
  function decay(t) {
    const d2 = Math.exp((work.at - t) / 2e3);
    work.fast *= d2;
    work.slow *= d2;
    work.at = t;
  }
  function grow() {
    if (ending2 && waiting.length === 0)
      return;
    if (failingSince !== null) {
      if (opening || !waiting.length || retryTimer || [...connections].some((x) => x.loading))
        return;
      const wait2 = nextAttempt - now2();
      return wait2 > 0 ? retryTimer = setTimeout2(() => (retryTimer = null, grow()), wait2) : connect3();
    }
    let loading = 0;
    for (const c2 of connections)
      c2.loading && loading++;
    const wanted = Math.max(
      Math.min(waiting.length - opening - loading, options.max - connections.size - opening),
      used && !ending2 ? Math.min(options.min, options.max) - connections.size - opening : 0
    );
    for (let i = 0; i < wanted; i++)
      connect3();
  }
  function connect3() {
    opening++;
    retryTimer && (clearTimeout2(retryTimer), retryTimer = null);
    (options.open || open)(options, signal, replacing.length ? replacing.shift() : 0).then(opened, failed);
  }
  function copy2(error2) {
    if (!error2 || typeof error2 !== "object")
      return error2;
    const x = Object.create(Object.getPrototypeOf(error2), Object.getOwnPropertyDescriptors(error2));
    Object.defineProperty(x, "stack", { value: error2.stack, writable: true, configurable: true });
    ["query", "parameters", "args", "types"].forEach((k) => delete x[k]);
    return x;
  }
  function failingFast() {
    return !!failure && retries > 1 && opening === 0 && now2() < nextAttempt && stuck();
  }
  function stuck() {
    for (const c2 of connections) {
      if (!c2.lease)
        return false;
    }
    return true;
  }
  function opened(ready) {
    opening--;
    if (signal.aborted || ending2 && waiting.length === 0) {
      ready.socket.destroy();
      return finishing();
    }
    Object.entries(ready.parameters).forEach(([k, v]) => onparameter(k, v));
    const c2 = Connection(ready, options, events);
    c2.index = ready.index || 0;
    connections.add(c2);
    lifetime(c2);
    listened(channels.pool) && event("open", c2);
    typesLoaded || !eager || (typesLoading ? c2.loading = true : loadTypes(c2));
    c2.loading || c2.typing || eager && typesLoading || recovered();
    drain();
  }
  function recovered() {
    retries = 0;
    failingSince = null;
    failure = null;
  }
  function need(c2) {
    c2 && paused.add(c2);
    if (typesLoaded)
      return resume();
    if (typesLoading)
      return;
    typesLoading = true;
    const idle2 = [...connections].find((x) => !paused.has(x) && usable(x) && x.inflight === 0);
    idle2 ? fetched(types2.load(runner(idle2))) : (options.open || open)(options, signal, 0).then((ready) => {
      const c3 = Connection(ready, options, { ...events, onready: () => {
      }, onclose: () => {
      }, onparameter: () => {
      }, ontimed: () => {
      }, need: () => {
      } });
      fetched(types2.load(runner(c3)).finally(() => c3.close()));
    }, (error2) => fetched(Promise.reject(error2)));
  }
  function fetched(loading) {
    let failure2 = null;
    loading.then(() => typesLoaded = true, (error2) => error2 instanceof PostgresError ? typesLoaded = true : failure2 = error2).then(() => {
      typesLoading = false;
      events.typed = typesLoaded;
      if (typesLoaded) {
        typeRetries = 0;
        typesFailing = null;
        return resume();
      }
      typesFailing === null && (typesFailing = now2());
      typeRetries++;
      if (options.connect_timeout && now2() - typesFailing >= options.connect_timeout * 1e3) {
        typeRetries = 0;
        typesFailing = null;
        return [...paused].forEach((x) => {
          paused.delete(x);
          x.destroy(failure2 || Errors.connection("CONNECTION_CLOSED", options, x.host, x.port));
        });
      }
      const wait2 = 1e3 * (typeof options.backoff === "function" ? options.backoff(typeRetries) : options.backoff);
      paused.size && (retryTypes = setTimeout2(() => (retryTypes = null, need()), wait2));
    });
  }
  function resume() {
    const xs = [...paused];
    paused.clear();
    xs.forEach((x) => x.closed || x.go());
    drain();
  }
  function runner(c2) {
    return (text4) => new Promise((resolve, reject2) => {
      const q = new Query([text4], [], Object.assign(() => {
      }, { options }), { simple: true });
      q.executed = true;
      q.then(resolve, reject2);
      bound(c2, q);
      c2.simple(q, text4);
    });
  }
  function bound(c2, q) {
    if (!options.query_timeout)
      return;
    const timer = setTimeout2(() => q.settled || c2.cancel(q).catch(noop5), options.query_timeout * 1e3);
    q.then(() => clearTimeout2(timer), () => clearTimeout2(timer));
  }
  function retype() {
    if (!typesError)
      return null;
    if (now2() - typesFailed < 1e3)
      return copy2(typesError);
    typesError = null;
    connections.forEach((x) => x.loading = true);
    [...connections].some((x) => !x.closed && (loadTypes(x), true));
    return null;
  }
  function loadTypes(c2) {
    hold(c2);
    typesLoading = true;
    c2.loading = types2.named;
    c2.typing = null;
    types2.load((text4) => new Promise((resolve, reject2) => {
      const q = new Query([text4], [], Object.assign(() => {
      }, { options }), { simple: true });
      q.executed = true;
      q.then(resolve, reject2);
      types2.named || (c2.typing = q);
      bound(c2, q);
      c2.simple(q, text4);
    })).then(
      () => typesLoaded = true,
      (error2) => error2 instanceof PostgresError ? typesLoaded = true : error2 && error2.code === "TYPE_NOT_FOUND" && (typesError = error2, typesFailed = now2())
    ).then(() => {
      typesLoading = false;
      events.typed = typesLoaded;
      c2.typing = null;
      connections.forEach((x) => x.loading = !typesLoaded && !typesError);
      (typesLoaded || typesError) && recovered();
      typesError ? waiting.take().forEach((job) => reject(job, copy2(typesError))) : typesLoaded || [...connections].some((x) => !x.closed && !x.typing && (loadTypes(x), true));
      drain();
    });
  }
  function failed(error2) {
    opening--;
    if (signal.aborted)
      return finishing();
    attempted(error2);
    ending2 ? finishing() : grow();
  }
  function attempted(error2) {
    failingSince === null && (failingSince = now2());
    retries++;
    nextAttempt = now2() + 1e3 * (typeof options.backoff === "function" ? options.backoff(retries) : options.backoff);
    const transient = !!error2 && (error2.code === "CONNECTION_CLOSED" || error2.code === "53300"), expired = options.connect_timeout && now2() - failingSince >= options.connect_timeout * 1e3;
    failure = !transient || expired ? { error: error2 } : null;
    stuck() && opening === 0 && (failure || ending2) && waiting.take().forEach((job, i) => reject(job, i ? copy2(error2) : error2));
  }
  function reject(job, error2) {
    started(job);
    job.lease ? job.reject(error2) : job.q ? job.q.reject(queryError(error2, job.q, options.debug)) : job.reject(error2);
  }
  function lifetime(c2) {
    const life = typeof options.max_lifetime === "function" ? options.max_lifetime() : options.max_lifetime;
    life && (c2.lifeTimer = unref(setTimeout2(() => {
      c2.retiring = true;
      c2.inflight === 0 && !c2.lease && c2.close();
    }, life * 1e3)));
    idle(c2);
  }
  function event(name, c2, extra) {
    channels.pool.publish({
      event: name,
      connection: c2 ? c2.id : null,
      host: c2 ? c2.host : null,
      port: c2 ? c2.port : null,
      database: options.database,
      stats: pool.stats,
      ...extra
    });
  }
  function idle(c2) {
    listened(channels.pool) && event("idle", c2);
    if (c2.inflight || c2.lease)
      return;
    options.unref_sockets && !c2.loading && waiting.length === 0 && c2.unref();
    if (!options.idle_timeout)
      return;
    c2.idleSince = now2();
    c2.idleTimer || (c2.idleTimer = unref(setTimeout2(() => idled(c2), options.idle_timeout * 1e3)));
  }
  function hold(c2) {
    options.unref_sockets && c2.ref();
  }
  function unref(timer) {
    options.unref_sockets && timer && typeof timer.unref === "function" && timer.unref();
    return timer;
  }
  function idled(c2) {
    c2.idleTimer = null;
    if (c2.inflight || c2.lease || c2.closed)
      return;
    if (connections.size <= options.min)
      return;
    const left = options.idle_timeout * 1e3 - (now2() - c2.idleSince);
    left >= 1 ? c2.idleTimer = unref(setTimeout2(() => idled(c2), left)) : c2.close();
  }
  function onready(c2) {
    if (c2.releasing) {
      if (c2.inflight)
        return;
      c2.releasing = false;
      if (c2.status !== "I")
        return c2.close();
    }
    if (c2.inflight === 0 && !c2.lease && (c2.retiring || ending2 && waiting.length === 0))
      return c2.close();
    idle(c2);
    while (waiting.length > connections.size + opening && usable(c2) && c2.inflight < options.max_pipeline && plain3(waiting.peek()))
      run2(c2, waiting.shift());
    waiting.length && !c2.lease && c2.inflight < options.max_pipeline && drain();
    ending2 && waiting.length === 0 && finishing();
  }
  function onclose(c2, error2) {
    connections.delete(c2);
    (c2.loading || c2.typing) && !signal.aborted && attempted(copy2(error2));
    paused.delete(c2);
    ending2 || replacing.push((c2.index + 1) % (options.path ? 1 : options.host.length));
    replacing.length > options.max && replacing.shift();
    c2.retired && c2.retired.forEach((r) => r());
    c2.idleTimer && clearTimeout2(c2.idleTimer);
    c2.lifeTimer && clearTimeout2(c2.lifeTimer);
    c2.lease && c2.lease.onclose && c2.lease.onclose(
      error2.cause && error2.cause.severity === "FATAL" && !c2.uncertain ? error2.cause : error2.code === "CONNECTION_DESTROYED" ? Errors.connection("CONNECTION_CLOSED", options, c2.host, c2.port) : error2
    );
    options.onclose && options.onclose(c2.id);
    listened(channels.pool) && event("close", c2, { error: error2 });
    connections.size === 0 && opening === 0 && statements.clear();
    drain();
    ending2 && finishing();
  }
  function onparameter(k, v) {
    options.parameters[k] !== v && (options.parameters[k] = v, options.onparameter && options.onparameter(k, v));
  }
  async function lease(kind) {
    used = true;
    await 1;
    if (ending2)
      throw Errors.connection("CONNECTION_ENDED", options, options.host[0], options.port[0]);
    if (failingFast())
      throw copy2(failure.error);
    const missing = retype();
    if (missing)
      throw missing;
    return new Promise((resolve, reject2) => {
      waiting.push(wait({ lease: true, kind, resolve, reject: reject2, queued: listened(channels.pool) ? now2() : 0 }));
      drain();
    });
  }
  function grant(c2, job) {
    started(job);
    hold(c2);
    c2.idleTimer && (clearTimeout2(c2.idleTimer), c2.idleTimer = null);
    let chain = Promise.resolve(), released = false, lost;
    const closed = new Promise((_, reject2) => lost = reject2);
    closed.catch(() => {
    });
    const x = {
      kind: job.kind,
      error: null,
      connection: c2,
      closed,
      get released() {
        return released;
      },
      send(q) {
        if (c2.closed)
          return q.reject(queryError(c2.closed, q, options.debug));
        if (released)
          return q.reject(queryError(ended(x), q, options.debug));
        chain = chain.then(() => new Promise((resolve) => {
          q.onwrite = resolve;
          q.then(resolve, resolve);
          query2(q, x);
        }));
      },
      release() {
        if (released)
          return;
        released = true;
        c2.lease === x && (c2.lease = null);
        listened(channels.pool) && event("release", c2, { kind: job.kind });
        if (c2.closed)
          return;
        if (c2.inflight)
          return c2.releasing = true;
        c2.status === "I" ? onready(c2) : c2.close();
      },
      onclose(error2) {
        x.error = error2;
        lost(error2);
      }
    };
    c2.lease = x;
    listened(channels.pool) && event("lease", c2, { kind: job.kind, waited: job.queued ? now2() - job.queued : 0 });
    job.resolve(x);
  }
  function ended(lease2) {
    return Errors.generic("UNSAFE_TRANSACTION", "The " + lease2.kind + " has ended");
  }
  function cancel3(q) {
    if (waiting.remove((x) => x.q === q && (started(x), true))) {
      q.reject(queryError(Errors.generic("57014", "canceling statement due to user request"), q, options.debug));
      return Promise.resolve();
    }
    if (q.connection)
      return q.connection.cancel(q);
    q.cancelled = true;
    return Promise.resolve();
  }
  function end({ timeout = null } = {}) {
    if (ending2)
      return ending2;
    ending2 = new Promise((resolve) => {
      pool.ended = resolve;
      timeout !== null && (endTimer = setTimeout2(destroy, timeout * 1e3));
      retryTimer && (clearTimeout2(retryTimer), retryTimer = null);
      Promise.resolve().then(finishing);
    });
    return ending2;
  }
  function finishing() {
    if (!pool.ended)
      return;
    if (waiting.length === 0)
      connections.forEach((c2) => c2.inflight === 0 && !c2.lease && c2.close());
    if (connections.size === 0 && opening === 0 && waiting.length) {
      const error2 = Errors.connection("CONNECTION_ENDED", options, options.host[0], options.port[0]);
      waiting.take().forEach((job) => reject(job, error2));
    }
    if (connections.size === 0 && (opening === 0 || signal.aborted) && waiting.length === 0) {
      endTimer && clearTimeout2(endTimer);
      retryTimer && clearTimeout2(retryTimer);
      retryTypes && clearTimeout2(retryTypes);
      const resolve = pool.ended;
      pool.ended = null;
      resolve();
    }
  }
  function destroy() {
    endTimer = null;
    signal.aborted = true;
    signal.sockets.forEach((x) => x.destroy());
    const error2 = Errors.connection("CONNECTION_DESTROYED", options, options.host[0], options.port[0]);
    waiting.take().forEach((job) => reject(job, error2));
    connections.forEach((c2) => c2.destroy());
    connections.size === 0 && finishing();
  }
  function close2() {
    used = false;
    return Promise.all([...connections].map(
      (c2) => c2.lease ? new Promise((r) => (c2.retiring = true, (c2.retired || (c2.retired = [])).push(r))) : c2.close()
    ));
  }
}
function Queue() {
  let xs = [], head = 0;
  return {
    get length() {
      return xs.length - head;
    },
    push: (x) => xs.push(x),
    peek: () => xs[head],
    shift() {
      const x = xs[head];
      xs[head++] = void 0;
      head === xs.length ? (xs = [], head = 0) : head > 1024 && head * 2 > xs.length && (xs = xs.slice(head), head = 0);
      return x;
    },
    take() {
      const all = xs.slice(head);
      xs = [];
      head = 0;
      return all;
    },
    remove(fn) {
      for (let i = head; i < xs.length; i++) {
        if (fn(xs[i]))
          return xs.splice(i, 1), true;
      }
      return false;
    }
  };
}
var limit2 = 2e3;
function alone(x) {
  return x.alone === void 0 ? x.alone = opens(x.text) : x.alone;
}
function opens(text4) {
  if (begins.test(text4))
    return true;
  starts.lastIndex = 0;
  let match;
  while (match = starts.exec(text4)) {
    const from = match.index + 5;
    let i = from;
    while (true) {
      while (i < text4.length && /\s/.test(text4[i]))
        i++;
      if (text4[i] !== "/" || text4[i + 1] !== "*")
        break;
      const end = text4.indexOf("*/", i + 2);
      if (end === -1)
        return false;
      i = end + 2;
    }
    if (i > from && transaction.test(text4.slice(i, i + 12)))
      return true;
    starts.lastIndex = Math.max(starts.lastIndex, i);
  }
  return false;
}
function Statements(scheduler) {
  const prefix = Math.random().toString(36).slice(2, 10), map = /* @__PURE__ */ new Map(), templates = /* @__PURE__ */ new WeakMap();
  let counter = 1, clock2 = 0;
  const texts = /* @__PURE__ */ new Map();
  return { get, clear, known };
  function known(text4) {
    let x = texts.get(text4);
    if (x)
      return x;
    texts.set(text4, x = { text: text4, est: void 0, alone: void 0 });
    texts.size > limit2 && texts.delete(texts.keys().next().value);
    return x;
  }
  function get(built, prepare) {
    if (!prepare)
      return unnamed(built.text);
    const tagged = !built.dynamic && (templates.get(built.strings) || set(built.strings)), cached = tagged && tagged.get(built.types);
    if (cached && cached.live)
      return cached.used = clock2++, cached;
    const key2 = built.types + "\0" + built.text;
    let statement2 = map.get(key2);
    statement2 ? statement2.used = clock2++ : statement2 = add(key2, built.text);
    tagged && tagged.set(built.types, statement2);
    return statement2;
  }
  function unnamed(text4) {
    return {
      key: null,
      live: false,
      name: "",
      text: text4,
      ends: void 0,
      shape: void 0,
      version: 0,
      used: 0,
      cost: scheduler ? known(text4) : null
    };
  }
  function add(key2, text4) {
    const statement2 = {
      key: key2,
      live: true,
      name: prefix + counter++,
      text: text4,
      ends: void 0,
      shape: void 0,
      version: 0,
      used: clock2++,
      cost: { est: void 0 },
      alone: void 0
    };
    map.set(key2, statement2);
    map.size > limit2 && evict();
    return statement2;
  }
  function evict() {
    let oldest = null;
    for (const x of map.values())
      (!oldest || x.used < oldest.used) && (oldest = x);
    oldest.live = false;
    map.delete(oldest.key);
  }
  function set(strings) {
    const x = /* @__PURE__ */ new Map();
    templates.set(strings, x);
    return x;
  }
  function clear() {
    map.forEach((x) => x.live = false);
    map.clear();
  }
}

// node_modules/postgres/src/subscribe.js
var noop6 = () => {
};
var statusInterval = 1e4;
var epoch = BigInt(Date.UTC(2e3, 0, 1)) * 1000n;
var lsnToString = (x) => (x >> 32n).toString(16).toUpperCase() + "/" + (x & 0xFFFFFFFFn).toString(16).toUpperCase();
function Subscribe(postgres2, options) {
  const subscribers = /* @__PURE__ */ new Map(), persistent = !!options.slot, slot = options.slot || "postgresjs_" + Math.random().toString(36).slice(2), state = {}, timers = options.timers;
  let connection2, current = null, ended = false, retries = 0;
  const sql2 = subscribe.sql = postgres2({
    ...options,
    query_timeout: 0,
    transform: { column: {}, value: {}, row: {} },
    max: 1,
    idle_timeout: null,
    max_lifetime: null,
    connection: {
      ...options.connection,
      replication: "database"
    },
    onclose: () => {
      current && current.stop();
      current = null;
      state.pid = state.secret = void 0;
      ended || restart();
    },
    no_subscribe: true,
    eager_types: true
  });
  const end = sql2.end, close2 = sql2.close;
  sql2.end = async () => {
    ended = true;
    current && await current.finish();
    return end();
  };
  sql2.close = async () => {
    current && await current.finish();
    return close2();
  };
  return subscribe;
  async function subscribe(event, fn, onsubscribe = noop6, onerror) {
    event = parseEvent(event);
    connection2 || (connection2 = init());
    const subscriber = { fn, onsubscribe, onerror };
    const fns = subscribers.has(event) ? subscribers.get(event).add(subscriber) : subscribers.set(event, /* @__PURE__ */ new Set([subscriber])).get(event);
    const unsubscribe = () => {
      fns.delete(subscriber);
      fns.size === 0 && subscribers.delete(event);
    };
    return connection2.then(() => {
      onsubscribe();
      return { unsubscribe, state, sql: sql2 };
    }, (error2) => {
      unsubscribe();
      connection2 = null;
      throw error2;
    });
  }
  function restart() {
    const delay = Math.min(100 * 2 ** retries++, 1e4);
    connection2 = new Promise((r) => timers.setTimeout(r, retries === 1 ? 0 : delay)).then(() => ended || init()).then(
      (x) => {
        retries = 0;
        ended || subscribers.forEach((event) => event.forEach(({ onsubscribe }) => onsubscribe()));
        return x;
      },
      (error2) => {
        report(error2);
        ended || restart();
      }
    );
    connection2.catch(noop6);
  }
  async function init() {
    if (!options.publications)
      throw new Error("Missing publication names");
    await sql2.unsafe(`CREATE_REPLICATION_SLOT ${slot}${persistent ? "" : " TEMPORARY"} LOGICAL pgoutput NOEXPORT_SNAPSHOT`).catch((error2) => {
      if (!persistent || error2.code !== "42710")
        throw error2;
    });
    const query2 = sql2.unsafe(`START_REPLICATION SLOT ${slot} LOGICAL 0/0 (proto_version '1', publication_names '${options.publications}')`);
    query2.catch(noop6);
    const stream = await query2.writable();
    current = Stream3(stream);
    state.pid = query2.state && query2.state.pid;
    state.secret = query2.state && query2.state.secret;
    return current;
  }
  function Stream3(stream) {
    const relations = {};
    let acked = 0n, received = 0n, transaction2 = null, queue = null, failed = false, stopped = false, timer = timers.setTimeout(tick, statusInterval), soon = null;
    stream.on("data", data);
    stream.on("error", (error2) => failed || report(error2));
    stream.on("close", () => {
      const unexpected = !stopped;
      stop();
      unexpected && close2();
    });
    return { stop, finish: finish2 };
    function data(x) {
      if (x[0] === 119) {
        received = max(received, x.readBigUInt64BE(9));
        parse2(x.subarray(25), relations, sql2.options.parsers, message, options.transform);
      } else if (x[0] === 107) {
        received = max(received, x.readBigUInt64BE(1));
        idle() && (acked = max(acked, received));
        x[17] && status();
      }
    }
    function message(kind, x, info) {
      if (kind === "begin")
        return transaction2 = { lsn: x.lsn, end: null, time: x.time, xid: x.xid };
      if (kind === "commit") {
        const done2 = transaction2;
        done2.end = x.end;
        transaction2 = null;
        return run2(() => commit(done2));
      }
      const at = transaction2 || {};
      info.lsn = at.lsn && lsnToString(at.lsn);
      info.time = at.time;
      info.xid = at.xid;
      run2(() => handle(x, info));
    }
    function run2(fn) {
      if (failed || stopped)
        return;
      if (queue) {
        queue = queue.then(() => failed || stopped ? null : fn());
        return;
      }
      const result = fn();
      if (result && typeof result.then === "function") {
        queue = result;
        stream.pause();
        drain();
      }
    }
    function drain() {
      const at = queue;
      at.then(() => {
        if (queue !== at)
          return queue && drain();
        queue = null;
        stopped || failed || stream.resume();
      }, noop6);
    }
    function commit(done2) {
      acked = max(acked, done2.end);
      persistent && !soon && (soon = timers.setImmediate(() => (soon = null, status())));
    }
    function handle(row, info) {
      const path = info.relation.schema + "." + info.relation.table, key2 = row && info.relation.keys.length ? "=" + info.relation.keys.map((x) => row[x.name]) : "", pending = [];
      call2(pending, "*", row, info);
      call2(pending, "*:" + path, row, info);
      key2 && call2(pending, "*:" + path + key2, row, info);
      call2(pending, info.command, row, info);
      call2(pending, info.command + ":" + path, row, info);
      key2 && call2(pending, info.command + ":" + path + key2, row, info);
      return pending.length ? Promise.all(pending) : null;
    }
    function call2(pending, event, row, info) {
      subscribers.has(event) && subscribers.get(event).forEach((subscriber) => {
        let result;
        try {
          result = subscriber.fn(row, info, event);
        } catch (error2) {
          return fail(error2, subscriber);
        }
        result && typeof result.then === "function" && pending.push(result.catch((error2) => fail(error2, subscriber)));
      });
    }
    function fail(error2, subscriber) {
      report(error2, subscriber);
      if (!persistent || failed)
        return;
      failed = true;
      queue = null;
      stop();
      stream.destroy(new Error("A subscriber failed, so the transaction is delivered again"));
      close2();
    }
    function idle() {
      return !transaction2 && !queue;
    }
    function tick() {
      timer = null;
      if (stopped)
        return;
      status();
      timer = timers.setTimeout(tick, statusInterval);
    }
    function status() {
      if (stopped || stream.destroyed || !stream.writable)
        return;
      const x = Buffer.alloc(34);
      x[0] = 114;
      x.writeBigUInt64BE(acked, 1);
      x.writeBigUInt64BE(acked, 9);
      x.writeBigUInt64BE(acked, 17);
      x.writeBigInt64BE(BigInt(Date.now()) * 1000n - epoch, 25);
      stream.write(x);
    }
    async function finish2() {
      queue && await queue.catch(noop6);
      if (!failed) {
        idle() && (acked = max(acked, received));
        status();
      }
      stop();
      stream.destroyed || await new Promise((r) => (stream.once("close", r), stream.end()));
    }
    function stop() {
      if (stopped)
        return;
      stopped = true;
      timer && timers.clearTimeout(timer);
      soon && timers.clearImmediate(soon);
      timer = soon = null;
    }
  }
  function report(error2, subscriber) {
    const handlers = subscriber ? [subscriber.onerror] : [...subscribers.values()].flatMap((x) => [...x].map((x2) => x2.onerror));
    const listeners = handlers.filter(Boolean);
    listeners.length ? listeners.forEach((fn) => fn(error2)) : console.error("postgres.js: logical replication error", error2);
  }
}
function max(a, b) {
  return a > b ? a : b;
}
function Time(x) {
  return new Date(Date.UTC(2e3, 0, 1) + Number(x / 1000n));
}
function parse2(x, relations, parsers, message, transform) {
  const type = x[0];
  if (type === 82) {
    let i = 1;
    const r = relations[x.readUInt32BE(i)] = {
      schema: x.toString("utf8", i += 4, i = x.indexOf(0, i)) || "pg_catalog",
      table: x.toString("utf8", i + 1, i = x.indexOf(0, i + 1)),
      columns: Array(x.readUInt16BE(i += 2)),
      keys: []
    };
    i += 2;
    let columnIndex = 0, column2;
    while (i < x.length) {
      column2 = r.columns[columnIndex++] = {
        key: x[i++],
        name: transform.column.from ? transform.column.from(x.toString("utf8", i, i = x.indexOf(0, i))) : x.toString("utf8", i, i = x.indexOf(0, i)),
        type: x.readUInt32BE(i += 1),
        parser: parsers[x.readUInt32BE(i)],
        atttypmod: x.readUInt32BE(i += 4)
      };
      column2.key && r.keys.push(column2);
      i += 4;
    }
  } else if (type === 66) {
    message("begin", { lsn: x.readBigUInt64BE(1), time: Time(x.readBigInt64BE(9)), xid: x.readUInt32BE(17) });
  } else if (type === 67) {
    message("commit", { lsn: x.readBigUInt64BE(2), end: x.readBigUInt64BE(10) });
  } else if (type === 73) {
    const relation = relations[x.readUInt32BE(1)];
    message("change", tuples(x, relation.columns, 8, transform).row, { command: "insert", relation });
  } else if (type === 68) {
    let i = 1;
    const relation = relations[x.readUInt32BE(i)];
    i += 4;
    const key2 = x[i] === 75;
    message(
      "change",
      key2 || x[i] === 79 ? tuples(x, relation.columns, i += 3, transform).row : null,
      { command: "delete", relation, key: key2 }
    );
  } else if (type === 85) {
    let i = 1;
    const relation = relations[x.readUInt32BE(i)];
    i += 4;
    const key2 = x[i] === 75;
    const xs = key2 || x[i] === 79 ? tuples(x, relation.columns, i += 3, transform) : null;
    xs && (i = xs.i);
    const { row } = tuples(x, relation.columns, i + 3, transform);
    message("change", row, { command: "update", relation, key: key2, old: xs && xs.row });
  } else if (type === 84) {
    const count = x.readUInt32BE(1), flags = x[5];
    for (let i = 0; i < count; i++) {
      message("change", null, {
        command: "truncate",
        relation: relations[x.readUInt32BE(6 + i * 4)],
        cascade: (flags & 1) === 1,
        restartIdentity: (flags & 2) === 2
      });
    }
  }
}
function tuples(x, columns2, xi, transform) {
  let type, column2, value2;
  const row = {};
  for (let i = 0; i < columns2.length; i++) {
    type = x[xi++];
    column2 = columns2[i];
    value2 = type === 110 ? null : type === 117 ? void 0 : column2.parser(x.toString("utf8", xi + 4, xi += 4 + x.readUInt32BE(xi)));
    value2 = transform.value.from ? transform.value.from(value2, column2) : value2;
    column2.name === "__proto__" ? own2(row, column2.name, value2) : row[column2.name] = value2;
  }
  return { i: xi, row: transform.row.from ? transform.row.from(row) : row };
}
function parseEvent(x) {
  const [, command, path, key2] = x.match(/^(\*|insert|update|delete|truncate)?:?([^.]+?\.?[^=]+)?=?(.+)?/i);
  return (command || "*") + (path ? ":" + (path.indexOf(".") === -1 ? "public." + path : path) : "") + (key2 ? "=" + key2 : "");
}

// node_modules/postgres/src/large.js
import Stream2 from "node:stream";
function largeObject(sql2, oid, mode = 131072 | 262144) {
  return new Promise(async (resolve, reject) => {
    await sql2.begin(async (sql3) => {
      let finish2;
      !oid && ([{ oid }] = await sql3`select lo_creat(-1) as oid`);
      const [{ fd }] = await sql3`select lo_open(${oid}, ${mode}) as fd`;
      const lo = {
        writable,
        readable,
        close: () => sql3`select lo_close(${fd})`.then(finish2),
        tell: () => sql3`select lo_tell64(${fd})`,
        read: (x) => sql3`select loread(${fd}, ${x}) as data`,
        write: (x) => sql3`select lowrite(${fd}, ${x})`,
        truncate: (x) => sql3`select lo_truncate64(${fd}, ${x})`,
        seek: (x, whence = 0) => sql3`select lo_lseek64(${fd}, ${x}, ${whence})`,
        size: () => sql3`
          select
            lo_lseek64(${fd}, location, 0) as position,
            seek.size
          from (
            select
              lo_lseek64($1, 0, 2) as size,
              tell.location
            from (select lo_tell64($1) as location) tell
          ) seek
        `
      };
      resolve(lo);
      return new Promise(async (r) => finish2 = r);
      async function readable({
        highWaterMark = 2048 * 8,
        start: start2 = 0,
        end = Infinity
      } = {}) {
        let max2 = end - start2;
        start2 && await lo.seek(start2);
        return new Stream2.Readable({
          highWaterMark,
          async read(size) {
            const l = Math.min(size, max2);
            max2 -= l;
            const [{ data }] = await lo.read(l);
            data.length && this.push(data);
            if (data.length < l || max2 === 0)
              this.push(null);
          }
        });
      }
      async function writable({
        highWaterMark = 2048 * 8,
        start: start2 = 0
      } = {}) {
        start2 && await lo.seek(start2);
        return new Stream2.Writable({
          highWaterMark,
          write(chunk, encoding, callback) {
            lo.write(chunk).then(() => callback(), callback);
          }
        });
      }
    }).catch(reject);
  });
}

// node_modules/postgres/src/index.js
Object.assign(Postgres, {
  PostgresError,
  toPascal,
  pascal,
  toCamel,
  camel,
  toKebab,
  kebab,
  fromPascal,
  fromCamel,
  fromKebab,
  BigInt: {
    to: 20,
    from: [20],
    parse: (x) => BigInt(x),
    serialize: (x) => x.toString()
  }
});
var src_default = Postgres;
function Postgres(a, b) {
  const options = parseOptions(a, b), types2 = options.shared_types || Types(options), pool = Pool(options, types2), subscribe = options.no_subscribe || Subscribe(Postgres, { ...options, shared_types: types2 }), listener = Listen(options);
  if (types2.named && options.fetch_types === false)
    throw Errors.generic("TYPE_NOT_FOUND", "Custom types given by name need fetch_types to look them up");
  options.resolve = types2.resolve;
  options.parsers = view(types2.parsers, types2.parser);
  options.serializers = view(types2.serializers, types2.serializer);
  const sql2 = Sql(handler);
  Object.defineProperties(sql2, {
    parameters: { get: () => options.parameters, enumerable: true },
    stats: { get: () => pool.stats, enumerable: true }
  });
  Object.assign(sql2, {
    largeObject: largeObject.bind(null, sql2),
    subscribe,
    CLOSE,
    END: CLOSE,
    PostgresError,
    options,
    reserve,
    listen: listener.listen,
    begin,
    close: close2,
    end
  });
  Symbol.asyncDispose && (sql2[Symbol.asyncDispose] = () => end());
  return sql2;
  function handler(q) {
    pool.query(q);
  }
  function Sql(handler2) {
    handler2.debug = options.debug;
    handler2.options = options;
    handler2.cancel = handler2.cancel || pool.cancel;
    const typed = (value2, type) => new Parameter(value2, type);
    Object.entries(options.types).forEach(([name, type]) => typed[name] = (x) => new Parameter(x, type.to));
    Object.assign(sql3, {
      types: typed,
      typed,
      unsafe,
      identifier: (...parts2) => {
        if (!parts2.length)
          throw Errors.generic("NO_PARTS", "sql.identifier needs at least one part");
        return new Identifier(parts2.map(identifier).join("."));
      },
      batch,
      notify,
      array,
      json: json4,
      file
    });
    return sql3;
    function sql3(strings, ...args) {
      return strings && Array.isArray(strings.raw) ? new Query(strings, args, handler2) : typeof strings === "string" && !args.length ? new Identifier(escapeIdentifier(options.transform.column.to ? options.transform.column.to(strings) : strings)) : new Builder(strings, args);
    }
    function unsafe(string2, args = [], options2 = {}) {
      arguments.length === 2 && !Array.isArray(args) && (options2 = args, args = []);
      return new Query([string2], args, handler2, {
        prepare: false,
        ...options2,
        simple: "simple" in options2 ? options2.simple : args.length === 0
      });
    }
    function batch(queries) {
      if (!Array.isArray(queries))
        throw Errors.generic("BATCH_NOT_ARRAY", "sql.batch takes an array of queries");
      queries.forEach((x, i) => {
        if (!(x instanceof Query))
          throw Errors.generic("BATCH_NOT_QUERY", "Item " + i + " of the batch is not a query");
        if (x.executed)
          throw Errors.generic("BATCH_EXECUTED", "Item " + i + " of the batch has already run");
        if (x.cursorFn || x.cursorRows || x.streaming || x.forEachFn || x.onlyDescribe)
          throw Errors.generic("BATCH_UNSUPPORTED", "Item " + i + " of the batch is a cursor, stream, forEach or describe");
      });
      const q = new Query([], [], handler2, {});
      q.parts = queries;
      queries.forEach((x) => (x.executed = true, x.cancel = () => q.cancel()));
      return q;
    }
    async function notify(channel, payload) {
      return await sql3`select pg_notify(${channel}, ${"" + payload})`;
    }
    function file(path, args = [], options2 = {}) {
      arguments.length === 2 && !Array.isArray(args) && (options2 = args, args = []);
      const fileHandler = (query2) => fs2.readFile(path, "utf8", (err, string2) => {
        if (err)
          return query2.reject(err);
        query2.strings = [string2];
        handler2(query2);
      });
      Object.assign(fileHandler, handler2);
      return new Query([], args, fileHandler, {
        ...options2,
        simple: "simple" in options2 ? options2.simple : args.length === 0
      });
    }
  }
  function json4(x) {
    return new Parameter(x, 3802);
  }
  function array() {
    throw Errors.generic("ARRAY_REMOVED", "sql.array() is removed in v4, pass the array as it is");
  }
  async function reserve() {
    const lease = await pool.lease("reserve"), reserved = Sql(Object.assign((q) => lease.send(q), { cancel: pool.cancel }));
    reserved.release = () => lease.release();
    Symbol.dispose && (reserved[Symbol.dispose] = reserved.release);
    Symbol.asyncDispose && (reserved[Symbol.asyncDispose] = async () => reserved.release());
    return reserved;
  }
  function begin(mode, fn) {
    !fn && (fn = mode, mode = "");
    if (!active(channels.transaction))
      return transaction2(mode, fn, null);
    const context4 = {
      mode,
      database: options.database,
      user: userName(options),
      connection: null,
      host: null,
      port: null,
      outcome: null
    };
    let promise;
    start(channels.transaction, context4, () => promise = transaction2(mode, fn, context4));
    return promise.then(
      (result) => (finish(channels.transaction, context4, null, result), result),
      (error2) => {
        finish(channels.transaction, context4, error2);
        throw error2;
      }
    );
  }
  async function transaction2(mode, fn, context4) {
    const lease = await pool.lease("transaction");
    let savepoints = 0, prepare = null;
    context4 && Object.assign(context4, {
      connection: lease.connection.id,
      host: lease.connection.host,
      port: lease.connection.port
    });
    try {
      await control(lease, "begin " + mode.replace(/[^a-z ]/ig, ""));
      const done2 = scope(fn);
      done2.catch(() => {
      });
      return await Promise.race([done2, lease.closed]);
    } finally {
      lease.release();
    }
    async function scope(fn2, name, inside, above = () => false, outer = () => false) {
      let uncaught, result, rolled = null, after2 = null, ending2 = false;
      if (above())
        throw rolledBack();
      const stopped = () => !!rolled || above(), over = () => ending2 || outer(), scoped = Sql(Object.assign((q) => {
        if (stopped())
          return q.reject(after2 || (after2 = rolledBack()));
        if (over())
          return q.reject(Errors.generic("UNSAFE_TRANSACTION", "The transaction has ended"));
        q.catch((e) => uncaught || (uncaught = e));
        lease.send(q);
      }, { cancel: pool.cancel }));
      scoped.savepoint = savepoint;
      scoped.begin = nested;
      scoped.rollback = () => rolled || (rolled = control(lease, name ? "rollback to " + identifier(name) : "rollback").then(() => {
      }));
      scoped.prepare = (x) => {
        if (inside)
          throw Errors.generic("NESTED_TRANSACTION_MODE", "A nested transaction can not be prepared, only the outermost one");
        prepare = x.replace(/[^a-z0-9$\-_. ]/gi, "");
      };
      name && await control(lease, "savepoint " + identifier(name));
      try {
        result = await new Promise((resolve, reject) => {
          const x = fn2(scoped);
          Promise.resolve(Array.isArray(x) ? Promise.all(x) : x).then(resolve, reject);
        });
        if (uncaught && !stopped())
          throw uncaught;
        if (lease.connection.closed)
          throw lease.error || lease.connection.closed;
      } catch (error2) {
        ending2 = true;
        context4 && !name && (context4.outcome = "rollback");
        stopped() ? rolled && await rolled.catch(() => {
        }) : lease.connection.closed || await control(lease, name ? "rollback to " + identifier(name) : "rollback");
        throw error2 instanceof PostgresError && error2.code === "25P02" && uncaught || error2;
      }
      if (stopped()) {
        rolled && await rolled;
        context4 && !name && (context4.outcome = "rollback");
        if (after2)
          throw after2;
        return result;
      }
      if (!name) {
        ending2 = true;
        const done2 = await control(lease, prepare ? "prepare transaction '" + prepare.replace(/'/g, "''") + "'" : "commit");
        context4 && (context4.outcome = prepare ? "prepare" : done2.command === "COMMIT" ? "commit" : "rollback");
        if (!prepare && done2.command !== "COMMIT")
          throw Errors.generic("TRANSACTION_ROLLED_BACK", "The server rolled back the transaction instead of committing it");
      }
      return result;
      function savepoint(name2, fn3) {
        if (name2 && Array.isArray(name2.raw))
          return savepoint((sql3) => sql3.apply(sql3, arguments));
        arguments.length === 1 && (fn3 = name2, name2 = null);
        return scope(fn3, "s" + savepoints++ + (name2 ? "_" + name2 : ""), false, stopped, over);
      }
      async function nested(inner, fn3) {
        !fn3 && (fn3 = inner, inner = "");
        if (normal(inner) && normal(inner) !== normal(mode))
          throw Errors.generic("NESTED_TRANSACTION_MODE", "A nested transaction runs in a savepoint, which can not change the transaction mode");
        return scope(fn3, "s" + savepoints++, true, stopped, over);
      }
    }
  }
  function rolledBack() {
    return Errors.generic("TRANSACTION_ROLLED_BACK", "The query was not sent, the transaction was rolled back with sql.rollback()");
  }
  function normal(x) {
    return (x || "").toLowerCase().replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim();
  }
  function identifier(x) {
    return '"' + x.replace(/"/g, '""') + '"';
  }
  function control(lease, text4) {
    const q = new Query([text4], [], Object.assign((q2) => lease.send(q2), { options, cancel: pool.cancel }), { simple: true });
    return q.execute();
  }
  async function end(options2) {
    await Promise.all([
      listener.end(),
      subscribe.sql ? subscribe.sql.end({ timeout: 0 }) : null
    ]);
    return pool.end(options2);
  }
  function close2() {
    return pool.close();
  }
}
function Listen(options) {
  const channels2 = /* @__PURE__ */ new Map();
  let sql2 = null, closing = null, alive = null;
  return {
    listen,
    end: () => {
      release();
      channels2.forEach((channel) => channel.timer && options.timers.clearTimeout(channel.timer));
      return closing || (sql2 ? closing = sql2.end({ timeout: 0 }) : Promise.resolve());
    }
  };
  function connection2() {
    return sql2 || (sql2 = Postgres({
      ...options,
      query_timeout: 0,
      max: 1,
      idle_timeout: null,
      max_lifetime: null,
      unref_sockets: true,
      fetch_types: false,
      no_subscribe: true,
      onclose() {
        if (closing)
          return;
        channels2.forEach((channel, name) => relisten(channel, name));
      },
      onnotify(channel, payload) {
        channels2.has(channel) && [...channels2.get(channel).listeners].forEach((l) => l.fn(payload));
      }
    }));
  }
  function relisten(channel, name, retries = 0) {
    channel.timer = null;
    channel.result = start2(name);
    channel.result.then((result) => {
      Object.assign(channel.state, result.state);
      channel.listeners.forEach((l) => l.onlisten && l.onlisten());
    }, () => {
      if (closing || channels2.get(name) !== channel)
        return;
      retries++;
      const seconds = typeof options.backoff === "function" ? options.backoff(retries) : options.backoff;
      channel.timer = options.timers.setTimeout(() => !closing && channels2.get(name) === channel && relisten(channel, name, retries), seconds * 1e3);
    });
  }
  function hold() {
    alive || (alive = setInterval(() => {
    }, 1 << 30));
  }
  function release() {
    alive && (clearInterval(alive), alive = null);
  }
  function start2(name) {
    const x = connection2();
    return x`listen ${x.identifier(name)}`;
  }
  async function listen(name, fn, onlisten) {
    const listener = { fn, onlisten };
    if (!channels2.has(name))
      channels2.set(name, { listeners: /* @__PURE__ */ new Set(), result: start2(name), state: {} });
    const channel = channels2.get(name);
    channel.listeners.add(listener);
    hold();
    let result;
    try {
      result = await channel.result;
    } catch (error2) {
      channel.listeners.delete(listener);
      channel.listeners.size || channels2.delete(name);
      channels2.size || release();
      throw error2;
    }
    Object.assign(channel.state, result.state);
    listener.onlisten && listener.onlisten();
    return { state: channel.state, unlisten };
    async function unlisten() {
      if (!channel.listeners.delete(listener) || channel.listeners.size)
        return;
      channels2.get(name) === channel && channels2.delete(name);
      channels2.size || release();
      const x = sql2;
      if (closing || !x)
        return;
      await x`unlisten ${x.identifier(name)}`.catch((e) => {
        if (!/^CONNECTION_/.test(e.code))
          throw e;
      });
    }
  }
}
function parseOptions(a, b) {
  if (a && a.shared)
    return a;
  const env = process.env, o = (!a || typeof a === "string" ? b : a) || {}, url = parseUrl(a), query2 = [...url.url.searchParams].reduce((a2, [b2, c2]) => (a2[b2] = c2, a2), {}), targets = hosts(o, query2, url, env), port = o.port || query2.port || env.PGPORT || 5432, user = o.user || o.username || url.url.username || env.PGUSERNAME || env.PGUSER || osUsername();
  o.no_prepare && (o.prepare = false);
  query2.sslmode && (query2.ssl = query2.sslmode, delete query2.sslmode);
  "timeout" in o && (console.log("The timeout option is deprecated, use idle_timeout instead"), o.idle_timeout = o.timeout);
  const files = certificates(query2);
  const ints = [
    "idle_timeout",
    "connect_timeout",
    "max_lifetime",
    "max_pipeline",
    "backoff",
    "keep_alive",
    "min",
    "queue_timeout",
    "query_timeout",
    "cancel_timeout"
  ];
  const defaults = {
    max: globalThis.Cloudflare ? 3 : 10,
    min: 0,
    ssl: false,
    sslnegotiation: null,
    channel_binding: "prefer",
    idle_timeout: null,
    connect_timeout: 30,
    queue_timeout: 0,
    query_timeout: 0,
    cancel_timeout: 5,
    max_lifetime,
    max_pipeline: 100,
    scheduler: true,
    backoff,
    keep_alive: 60,
    prepare: true,
    debug: false,
    fetch_types: true,
    infer: false,
    publications: "alltables",
    slot: null,
    target_session_attrs: null
  };
  const options = {
    host: targets.map((x) => x[0]),
    port: Array.isArray(port) ? port : targets.map((x) => o.port || query2.port ? +port : x[1] || +port),
    path: o.path || targets[0][0].indexOf("/") > -1 && targets[0][0] + "/.s.PGSQL." + (targets[0][1] || port),
    database: o.database || o.db || (url.url.pathname || "").slice(1) || env.PGDATABASE || (typeof user === "function" ? null : user),
    user,
    pass: o.pass || o.password || url.url.password || env.PGPASSWORD || "",
    ...Object.entries(defaults).reduce(
      (acc, [k, d2]) => {
        const value2 = k in o && o[k] !== void 0 ? o[k] : k in query2 ? query2[k] === "disable" || query2[k] === "false" ? false : query2[k] : k === "ssl" && env.PGSSLMODE || env["PG" + k.toUpperCase()] || d2;
        acc[k] = typeof value2 === "string" && ints.includes(k) ? +value2 : value2;
        return acc;
      },
      {}
    ),
    connection: {
      application_name: env.PGAPPNAME || "postgres.js",
      ...o.connection,
      ...Object.entries(query2).reduce((acc, [k, v]) => (k in defaults || k === "host" || k === "port" || (acc[k] = v), acc), {})
    },
    types: o.types || {},
    target_session_attrs: tsa(o, url.url, env),
    channel_binding: binding(o, url.url, env),
    onnotice: o.onnotice,
    onnotify: o.onnotify,
    onclose: o.onclose,
    onparameter: o.onparameter,
    socket: o.socket,
    onread: o.onread !== false,
    open: o.open,
    no_subscribe: o.no_subscribe,
    unref_sockets: !!o.unref_sockets,
    passfile: passfile(env),
    shared_types: o.shared_types,
    eager_types: !!o.eager_types,
    transform: parseTransform(o.transform || { undefined: void 0 }),
    parameters: {},
    shared: { retries: 0 },
    timers: o.timers || {
      setTimeout,
      clearTimeout,
      setImmediate,
      clearImmediate,
      now: () => performance.now()
    }
  };
  options.ssl = withCertificates(options.ssl, files);
  options.infer = options.infer === true || options.infer === "true";
  options.max === 1 && (options.scheduler = false);
  return options;
}
function certificates(query2) {
  const { sslrootcert, sslcert, sslkey } = query2, files = {};
  delete query2.sslrootcert;
  delete query2.sslcert;
  delete query2.sslkey;
  sslrootcert === "system" && (query2.ssl = "verify-full");
  sslrootcert && sslrootcert !== "system" && (files.ca = fs2.readFileSync(sslrootcert));
  sslcert && (files.cert = fs2.readFileSync(sslcert));
  sslkey && (files.key = fs2.readFileSync(sslkey));
  Object.keys(files).length && !query2.ssl && (query2.ssl = process.env.PGSSLMODE || process.env.PGSSL || "require");
  return files;
}
function withCertificates(ssl, files) {
  if (!ssl || ssl === "disable" || !Object.keys(files).length)
    return ssl;
  return typeof ssl === "object" ? { ...files, ...ssl } : ssl === true || ssl === "true" || ssl === "verify-full" ? files : files.ca ? { ...files, checkServerIdentity: () => void 0 } : { ...files, rejectUnauthorized: false };
}
function tsa(o, url, env) {
  const x = o.target_session_attrs || url.searchParams.get("target_session_attrs") || env.PGTARGETSESSIONATTRS;
  if (!x || ["read-write", "read-only", "primary", "standby", "prefer-standby"].includes(x))
    return x;
  throw new Error("target_session_attrs " + x + " is not supported");
}
function binding(o, url, env) {
  const x = o.channel_binding || url.searchParams.get("channel_binding") || env.PGCHANNELBINDING || "prefer";
  if (["disable", "prefer", "require"].includes(x))
    return x;
  throw new Error("channel_binding " + x + " is not supported");
}
function backoff(retries) {
  return (0.5 + Math.random() / 2) * Math.min(3 ** retries / 100, 20);
}
function max_lifetime() {
  return 60 * (30 + Math.random() * 30);
}
function parseTransform(x) {
  const value2 = typeof x.value === "function" ? x.value : x.value && x.value.from;
  return {
    undefined: x.undefined,
    json: x.json === true || (x.json === false ? false : void 0),
    column: {
      from: typeof x.column === "function" ? x.column : x.column && x.column.from,
      to: x.column && x.column.to
    },
    value: {
      from: x.json === false && value2 && value2.keys ? void 0 : value2,
      to: x.value && x.value.to
    },
    row: {
      from: typeof x.row === "function" ? x.row : x.row && x.row.from,
      to: x.row && x.row.to
    }
  };
}
function parseUrl(url) {
  if (!url || typeof url !== "string")
    return { url: { searchParams: /* @__PURE__ */ new Map() }, targets: [] };
  const rest = url.slice(url.indexOf("://") + 3), end = rest.search(/[/?]/), authority = end === -1 ? rest : rest.slice(0, end), at = authority.lastIndexOf("@"), userinfo = at === -1 ? "" : authority.slice(0, at), colon = userinfo.indexOf(":"), tail = new URL("postgres://x" + (end === -1 ? "" : rest.slice(end)));
  return {
    url: {
      username: decode(colon === -1 ? userinfo : userinfo.slice(0, colon)),
      password: colon === -1 ? "" : decode(userinfo.slice(colon + 1)),
      pathname: decode(tail.pathname),
      searchParams: tail.searchParams
    },
    targets: authority.slice(at + 1) ? split2(authority.slice(at + 1), decode) : []
  };
}
function decode(x) {
  try {
    return decodeURIComponent(x);
  } catch (_) {
    return x;
  }
}
function hosts(o, query2, url, env) {
  const given = o.hostname || o.host || query2.host;
  if (given)
    return Array.isArray(given) ? given.map((x) => [x, null]) : split2(given);
  if (url.targets.some(([x]) => x))
    return url.targets;
  return split2(env.PGHOST || "localhost").map(([x, p2], i) => [x, p2 || url.targets[i] && url.targets[i][1] || null]);
}
function split2(x, decoded = (x2) => x2) {
  return x.split(",").filter(Boolean).map((x2) => {
    const m = x2.match(/^\[([^\]]*)\](?::(\d*))?$/) || x2.match(/^([^:]*)(?::(\d*))?$/) || [x2, x2];
    return [decoded(m[1]), m[2] ? +m[2] : null];
  });
}
function passfile(env) {
  try {
    return env.PGPASSFILE || (process.platform === "win32" ? (env.APPDATA || "") + "\\postgresql\\pgpass.conf" : os.homedir() + "/.pgpass");
  } catch (_) {
    return null;
  }
}
function osUsername() {
  try {
    return os.userInfo().username;
  } catch (_) {
    return process.env.USERNAME || process.env.USER || process.env.LOGNAME;
  }
}
function view(known, get) {
  return new Proxy(known, {
    get: (x, oid) => typeof oid === "symbol" ? x[oid] : get(+oid)
  });
}

// node_modules/drizzle-orm/postgres-js/session.js
var PostgresJsPreparedQuery = class extends PgPreparedQuery {
  constructor(client, queryString, params, logger, cache, queryMetadata, cacheConfig, fields, _isResponseInArrayMode, prepare, customResultMapper) {
    super({ sql: queryString, params }, cache, queryMetadata, cacheConfig);
    this.client = client;
    this.queryString = queryString;
    this.params = params;
    this.logger = logger;
    this.fields = fields;
    this._isResponseInArrayMode = _isResponseInArrayMode;
    this.prepare = prepare;
    this.customResultMapper = customResultMapper;
  }
  static [entityKind] = "PostgresJsPreparedQuery";
  async execute(placeholderValues = {}) {
    return tracer.startActiveSpan("drizzle.execute", async (span) => {
      const params = fillPlaceholders(this.params, placeholderValues);
      span?.setAttributes({
        "drizzle.query.text": this.queryString,
        "drizzle.query.params": JSON.stringify(params)
      });
      this.logger.logQuery(this.queryString, params);
      const { fields, queryString: query2, client, joinsNotNullableMap, customResultMapper } = this;
      if (!fields && !customResultMapper) {
        return tracer.startActiveSpan("drizzle.driver.execute", () => {
          return this.queryWithCache(query2, params, async () => {
            return await client.unsafe(query2, params, {
              prepare: this.prepare
            });
          });
        });
      }
      const rows = await tracer.startActiveSpan("drizzle.driver.execute", () => {
        span?.setAttributes({
          "drizzle.query.text": query2,
          "drizzle.query.params": JSON.stringify(params)
        });
        return this.queryWithCache(query2, params, async () => {
          return await client.unsafe(query2, params, {
            prepare: this.prepare
          }).values();
        });
      });
      return tracer.startActiveSpan("drizzle.mapResponse", () => {
        return customResultMapper ? customResultMapper(rows) : rows.map((row) => mapResultRow(fields, row, joinsNotNullableMap));
      });
    });
  }
  all(placeholderValues = {}) {
    return tracer.startActiveSpan("drizzle.execute", async (span) => {
      const params = fillPlaceholders(this.params, placeholderValues);
      span?.setAttributes({
        "drizzle.query.text": this.queryString,
        "drizzle.query.params": JSON.stringify(params)
      });
      this.logger.logQuery(this.queryString, params);
      return tracer.startActiveSpan("drizzle.driver.execute", () => {
        span?.setAttributes({
          "drizzle.query.text": this.queryString,
          "drizzle.query.params": JSON.stringify(params)
        });
        return this.queryWithCache(this.queryString, params, async () => {
          return this.client.unsafe(this.queryString, params, {
            prepare: this.prepare
          });
        });
      });
    });
  }
  /** @internal */
  isResponseInArrayMode() {
    return this._isResponseInArrayMode;
  }
};
var PostgresJsSession = class _PostgresJsSession extends PgSession {
  constructor(client, dialect, schema, options = {}) {
    super(dialect);
    this.client = client;
    this.schema = schema;
    this.options = options;
    this.logger = options.logger ?? new NoopLogger();
    this.cache = options.cache ?? new NoopCache();
  }
  static [entityKind] = "PostgresJsSession";
  logger;
  cache;
  prepareQuery(query2, fields, name, isResponseInArrayMode, customResultMapper, queryMetadata, cacheConfig) {
    return new PostgresJsPreparedQuery(
      this.client,
      query2.sql,
      query2.params,
      this.logger,
      this.cache,
      queryMetadata,
      cacheConfig,
      fields,
      isResponseInArrayMode,
      name !== void 0,
      customResultMapper
    );
  }
  query(query2, params) {
    this.logger.logQuery(query2, params);
    return this.client.unsafe(query2, params).values();
  }
  queryObjects(query2, params) {
    return this.client.unsafe(query2, params);
  }
  transaction(transaction2, config) {
    return this.client.begin(async (client) => {
      const session = new _PostgresJsSession(
        client,
        this.dialect,
        this.schema,
        this.options
      );
      const tx = new PostgresJsTransaction(this.dialect, session, this.schema);
      if (config) {
        await tx.setTransaction(config);
      }
      return transaction2(tx);
    });
  }
};
var PostgresJsTransaction = class _PostgresJsTransaction extends PgTransaction {
  constructor(dialect, session, schema, nestedIndex = 0) {
    super(dialect, session, schema, nestedIndex);
    this.session = session;
  }
  static [entityKind] = "PostgresJsTransaction";
  transaction(transaction2) {
    return this.session.client.savepoint((client) => {
      const session = new PostgresJsSession(
        client,
        this.dialect,
        this.schema,
        this.session.options
      );
      const tx = new _PostgresJsTransaction(this.dialect, session, this.schema);
      return transaction2(tx);
    });
  }
};

// node_modules/drizzle-orm/postgres-js/driver.js
var PostgresJsDatabase = class extends PgDatabase {
  static [entityKind] = "PostgresJsDatabase";
};
function construct(client, config = {}) {
  const transparentParser = (val) => val;
  for (const type of ["1184", "1082", "1083", "1114", "1182", "1185", "1115", "1231"]) {
    client.options.parsers[type] = transparentParser;
    client.options.serializers[type] = transparentParser;
  }
  client.options.serializers["114"] = transparentParser;
  client.options.serializers["3802"] = transparentParser;
  const dialect = new PgDialect({ casing: config.casing });
  let logger;
  if (config.logger === true) {
    logger = new DefaultLogger();
  } else if (config.logger !== false) {
    logger = config.logger;
  }
  let schema;
  if (config.schema) {
    const tablesConfig = extractTablesRelationalConfig(
      config.schema,
      createTableRelationsHelpers
    );
    schema = {
      fullSchema: config.schema,
      schema: tablesConfig.tables,
      tableNamesMap: tablesConfig.tableNamesMap
    };
  }
  const session = new PostgresJsSession(client, dialect, schema, { logger, cache: config.cache });
  const db = new PostgresJsDatabase(dialect, session, schema);
  db.$client = client;
  db.$cache = config.cache;
  if (db.$cache) {
    db.$cache["invalidate"] = config.cache?.onMutate;
  }
  return db;
}
function drizzle(...params) {
  if (typeof params[0] === "string") {
    const instance = src_default(params[0]);
    return construct(instance, params[1]);
  }
  if (isConfig(params[0])) {
    const { connection: connection2, client, ...drizzleConfig } = params[0];
    if (client) return construct(client, drizzleConfig);
    if (typeof connection2 === "object" && connection2.url !== void 0) {
      const { url, ...config } = connection2;
      const instance2 = src_default(url, config);
      return construct(instance2, drizzleConfig);
    }
    const instance = src_default(connection2);
    return construct(instance, drizzleConfig);
  }
  return construct(params[0], params[1]);
}
((drizzle2) => {
  function mock(config) {
    return construct({
      options: {
        parsers: {},
        serializers: {}
      }
    }, config);
  }
  drizzle2.mock = mock;
})(drizzle || (drizzle = {}));

// src/lib/dates.ts
var firstFastYear = 1e3;
var lastFastYear = 9999;
function civilToEpochDay(year, month, day) {
  const y = month <= 2 ? year - 1 : year;
  const era = Math.floor(y / 400);
  const yearOfEra = y - era * 400;
  const dayOfYear = Math.floor((153 * (month > 2 ? month - 3 : month + 9) + 2) / 5) + day - 1;
  const dayOfEra = yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear;
  return era * 146097 + dayOfEra - 719468;
}
var firstFastDay = civilToEpochDay(firstFastYear, 1, 1);
var lastFastDay = civilToEpochDay(lastFastYear, 12, 31);
var kolkataDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});
var displayDate = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC"
});
var displayDayMonth = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  timeZone: "UTC"
});
var displayDateTime = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Kolkata"
});
var displayTime = new Intl.DateTimeFormat("en-IN", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Kolkata"
});
var displayMonth = new Intl.DateTimeFormat("en-IN", {
  month: "long",
  year: "numeric",
  timeZone: "UTC"
});

// src/lib/money.ts
var rupees = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0
});
var rupeesWithPaise = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

// supabase/functions-src/env.ts
var serve = (handler) => Deno.serve(handler);
function secret(name) {
  return Deno.env.get(name) || void 0;
}
function siteUrl() {
  return secret("SITE_URL") ?? "https://iron-paradise.ayanmukherjee-official01.workers.dev";
}
function vapidKeys() {
  const publicKey = secret("VAPID_PUBLIC_KEY");
  const privateKey = secret("VAPID_PRIVATE_KEY");
  if (!publicKey || !privateKey) return null;
  return {
    publicKey,
    privateKey,
    subject: secret("VAPID_SUBJECT") ?? siteUrl()
  };
}
function connect2() {
  const url = secret("SUPABASE_DB_URL");
  if (!url) throw new Error("SUPABASE_DB_URL is missing");
  const client = src_default(url, { prepare: false, max: 1, fetch_types: false });
  return {
    db: drizzle(client, { schema: schema_exports }),
    close: () => client.end({ timeout: 5 })
  };
}
function json3(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "private, no-store",
      ...headers
    }
  });
}

// supabase/functions-src/send-test-push.ts
function cors(request) {
  const origin = request.headers.get("origin");
  const allowed = [
    new URL(siteUrl()).origin,
    "http://localhost:5173",
    "http://localhost:4173"
  ];
  return origin && allowed.includes(origin) ? {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin"
  } : { Vary: "Origin" };
}
async function userId(request) {
  const authorization = request.headers.get("authorization");
  const url = secret("SUPABASE_URL");
  const key2 = secret("SUPABASE_ANON_KEY");
  if (!authorization || !url || !key2) return null;
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { Authorization: authorization, apikey: key2 }
  });
  if (!response.ok) return null;
  const user = await response.json();
  return typeof user.id === "string" ? user.id : null;
}
var lastTest = /* @__PURE__ */ new Map();
serve(async (request) => {
  const headers = cors(request);
  if (request.method === "OPTIONS")
    return new Response(null, { status: 204, headers });
  if (request.method !== "POST")
    return json3({ ok: false, message: "POST only" }, 405, headers);
  const reply = (ok, message) => json3({ ok, message }, 200, headers);
  const keys = vapidKeys();
  if (!keys)
    return reply(false, "Push notifications aren't set up on the server.");
  const id = await userId(request);
  if (!id) return reply(false, "Your session ended. Sign in again.");
  const now2 = Date.now();
  if (now2 - (lastTest.get(id) ?? 0) < 6e4) {
    return reply(false, "That's a lot of tests. Try again in a minute.");
  }
  lastTest.set(id, now2);
  const { db, close: close2 } = connect2();
  try {
    const targets = await db.select({
      endpoint: pushSubscriptions.endpoint,
      p256dh: pushSubscriptions.p256dh,
      auth: pushSubscriptions.auth
    }).from(pushSubscriptions).where(eq(pushSubscriptions.profileId, id));
    if (targets.length === 0) {
      return reply(false, "Turn on notifications on this phone first.");
    }
    const delivery = await deliverPush(
      targets,
      {
        title: "Test notification",
        body: "Notifications work on this phone. Fee reminders will look like this.",
        url: "/app",
        tag: "test"
      },
      keys
    );
    if (delivery.expiredEndpoints?.length) {
      await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.endpoint, delivery.expiredEndpoints));
    }
    if (!delivery.ok) {
      return reply(
        false,
        "The push service didn't accept it. Turn notifications off and on again, then retry."
      );
    }
    return reply(
      true,
      delivery.delivered === 1 ? "Sent. It should pop up in a few seconds." : `Sent to ${delivery.delivered} devices. It should pop up in a few seconds.`
    );
  } finally {
    await close2();
  }
});
