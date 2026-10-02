import { DomainError } from '../../../../../src/shared/errors';

type JsonSchema = Record<string, unknown>;

const ROOT_RULE_NAME = 'root';
const SPACE_RULE_NAME = 'space';
const SPACE_RULE = String.raw`| " " | "\n"{1,2} [ \t]{0,20}`;
const PRIMITIVE_RULES: Readonly<Record<string, string>> = {
    boolean: String.raw`("true" | "false") space`,
    'decimal-part': String.raw`[0-9]{1,16}`,
    'integral-part': String.raw`[0] | [1-9] [0-9]{0,15}`,
    number: String.raw`("-"? integral-part) ("." decimal-part)? ([eE] [-+]? integral-part)? space`,
    integer: String.raw`("-"? integral-part) space`,
    value: String.raw`object | array | string | number | boolean | null`,
    object: String.raw`"{" space ( string ":" space value ("," space string ":" space value)* )? "}" space`,
    array: String.raw`"[" space ( value ("," space value)* )? "]" space`,
    char: String.raw`[^"\\\x7F\x00-\x1F] | [\\] (["\\bfnrt] | "u" [0-9a-fA-F]{4})`,
    string: String.raw`"\"" char* "\"" space`,
    null: String.raw`"null" space`,
};
const PRIMITIVE_DEPENDENCIES: Readonly<Record<string, readonly string[]>> = {
    number: ['integral-part', 'decimal-part'],
    integer: ['integral-part'],
    value: ['object', 'array', 'string', 'number', 'boolean', 'null'],
    object: ['string', 'value'],
    array: ['value'],
    string: ['char'],
};
const RESERVED_RULE_NAMES: ReadonlySet<string> = new Set([ROOT_RULE_NAME, SPACE_RULE_NAME, ...Object.keys(PRIMITIVE_RULES)]);
const INVALID_RULE_CHARACTERS = /[^a-zA-Z0-9-]+/gu;
const LITERAL_ESCAPE_PATTERN = /[\\"\r\n\t]/gu;
const LITERAL_ESCAPES: Readonly<Record<string, string>> = {
    '\\': String.raw`\\`,
    '"': String.raw`\"`,
    '\r': String.raw`\r`,
    '\n': String.raw`\n`,
    '\t': String.raw`\t`,
};
const REPETITION_SEPARATOR = '"," space';

function isJsonSchema(value: unknown): value is JsonSchema {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readCount(schema: JsonSchema, key: string): number | null {
    const value = schema[key];
    return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
}

function formatLiteral(literal: string): string {
    return `"${literal.replace(LITERAL_ESCAPE_PATTERN, (character) => LITERAL_ESCAPES[character])}"`;
}

function buildRepetition(itemRule: string, minItems: number, maxItems: number | null, separatorRule: string | null): string {
    if (maxItems === 0) {
        return '';
    }
    if (minItems === 0 && maxItems === 1) {
        return `${itemRule}?`;
    }
    if (separatorRule === null) {
        if (minItems === 1 && maxItems === null) {
            return `${itemRule}+`;
        }
        if (minItems === 0 && maxItems === null) {
            return `${itemRule}*`;
        }
        return `${itemRule}{${minItems},${maxItems === null ? '' : maxItems}}`;
    }
    const repeated = `${itemRule} ${buildRepetition(`(${separatorRule} ${itemRule})`, minItems > 0 ? minItems - 1 : 0, maxItems === null ? null : maxItems - 1, null)}`;
    return minItems === 0 ? `(${repeated})?` : repeated;
}

class JsonSchemaGrammarBuilder {
    private readonly rules = new Map<string, string>([[SPACE_RULE_NAME, SPACE_RULE]]);

    build(schema: JsonSchema): string {
        this.visit(schema, '');
        return [...this.rules.entries()]
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([name, rule]) => `${name} ::= ${rule}`)
            .join('\n');
    }

    private addRule(name: string, rule: string): string {
        const escapedName = name.replace(INVALID_RULE_CHARACTERS, '-');
        const existing = this.rules.get(escapedName);
        if (existing === undefined || existing === rule) {
            this.rules.set(escapedName, rule);
            return escapedName;
        }
        let suffix = 0;
        while (this.rules.has(`${escapedName}${suffix}`) && this.rules.get(`${escapedName}${suffix}`) !== rule) {
            suffix += 1;
        }
        const key = `${escapedName}${suffix}`;
        this.rules.set(key, rule);
        return key;
    }

    private addPrimitive(name: string, primitive: string): string {
        const key = this.addRule(name, PRIMITIVE_RULES[primitive]);
        for (const dependency of PRIMITIVE_DEPENDENCIES[primitive] ?? []) {
            if (!this.rules.has(dependency)) {
                this.addPrimitive(dependency, dependency);
            }
        }
        return key;
    }

    private visit(schema: JsonSchema, name: string): string {
        const ruleName = RESERVED_RULE_NAMES.has(name) ? `${name}-` : name.length === 0 ? ROOT_RULE_NAME : name;
        const schemaType = schema.type;
        if ('const' in schema) {
            return this.addRule(ruleName, `${formatLiteral(JSON.stringify(schema.const))} space`);
        }
        if (Array.isArray(schema.enum)) {
            return this.addRule(ruleName, `(${schema.enum.map((value) => formatLiteral(JSON.stringify(value))).join(' | ')}) space`);
        }
        const alternatives = Array.isArray(schema.anyOf) ? schema.anyOf : Array.isArray(schema.oneOf) ? schema.oneOf : null;
        if (alternatives !== null) {
            return this.addRule(ruleName, alternatives
                .map((alternative, index) => this.visit(this.requireSchema(alternative, ruleName), `${name}${name.length === 0 ? 'alternative-' : '-'}${index}`))
                .join(' | '));
        }
        if (Array.isArray(schemaType)) {
            return this.addRule(ruleName, schemaType
                .map((type) => this.visit({ ...schema, type }, `${name}${name.length === 0 ? '' : '-'}${String(type)}`))
                .join(' | '));
        }
        if (schemaType === 'object' && isJsonSchema(schema.properties)) {
            return this.addRule(ruleName, this.buildObjectRule(schema.properties, schema.required, schema.additionalProperties, name));
        }
        if (schemaType === 'object' || (schemaType === undefined && Object.keys(schema).length === 0)) {
            return this.addRule(ruleName, this.addPrimitive('object', 'object'));
        }
        if (schemaType === 'array') {
            const items = schema.items === undefined ? {} : this.requireSchema(schema.items, ruleName);
            const itemRule = this.visit(items, `${name}${name.length === 0 ? '' : '-'}item`);
            const minItems = readCount(schema, 'minItems') ?? 0;
            const maxItems = readCount(schema, 'maxItems');
            return this.addRule(ruleName, `"[" space ${buildRepetition(itemRule, minItems, maxItems, REPETITION_SEPARATOR)} "]" space`);
        }
        if (schemaType === 'string' && (readCount(schema, 'minLength') !== null || readCount(schema, 'maxLength') !== null)) {
            const characterRule = this.addPrimitive('char', 'char');
            return this.addRule(ruleName, `"\\"" ${buildRepetition(characterRule, readCount(schema, 'minLength') ?? 0, readCount(schema, 'maxLength'), null)} "\\"" space`);
        }
        if (typeof schemaType === 'string' && schemaType in PRIMITIVE_RULES) {
            return this.addPrimitive(ruleName === ROOT_RULE_NAME ? ROOT_RULE_NAME : schemaType, schemaType);
        }
        throw new DomainError('validation', `json_schema:${name.length === 0 ? ROOT_RULE_NAME : name}:${String(schemaType)}`);
    }

    private buildObjectRule(properties: JsonSchema, requiredValue: unknown, additionalProperties: unknown, name: string): string {
        const required = new Set(Array.isArray(requiredValue) ? requiredValue.filter((key): key is string => typeof key === 'string') : []);
        const propertyNames = Object.keys(properties);
        const keyValueRules = new Map(propertyNames.map((propertyName) => {
            const propertySchema = this.requireSchema(properties[propertyName], propertyName);
            const valueRule = this.visit(propertySchema, `${name}${name.length === 0 ? '' : '-'}${propertyName}`);
            return [propertyName, this.addRule(`${name}${name.length === 0 ? '' : '-'}${propertyName}-kv`, `${formatLiteral(JSON.stringify(propertyName))} space ":" space ${valueRule}`)];
        }));
        const optionalNames = propertyNames.filter((propertyName) => !required.has(propertyName));
        if (additionalProperties === true || isJsonSchema(additionalProperties)) {
            const valueRule = isJsonSchema(additionalProperties)
                ? this.visit(additionalProperties, `${name}${name.length === 0 ? '' : '-'}additional`)
                : this.addPrimitive('value', 'value');
            const keyRule = this.addPrimitive('string', 'string');
            keyValueRules.set('*', this.addRule(`${name}${name.length === 0 ? '' : '-'}additional-kv`, `${keyRule} ":" space ${valueRule}`));
            optionalNames.push('*');
        }
        const requiredRules = propertyNames.filter((propertyName) => required.has(propertyName)).map((propertyName) => keyValueRules.get(propertyName) ?? '');
        const recursiveReferences = (names: readonly string[], firstIsOptional: boolean): string => {
            const [first, ...rest] = names;
            const keyValueRule = keyValueRules.get(first) ?? '';
            const commaReference = `( "," space ${keyValueRule} )`;
            const head = firstIsOptional
                ? `${commaReference}${first === '*' ? '*' : '?'}`
                : `${keyValueRule}${first === '*' ? ` ${commaReference}*` : ''}`;
            return rest.length === 0
                ? head
                : `${head} ${this.addRule(`${name}${name.length === 0 ? '' : '-'}${keyValueRule}-rest`, recursiveReferences(rest, true))}`;
        };
        let rule = `"{" space ${requiredRules.join(' "," space ')}`;
        if (optionalNames.length > 0) {
            const optionalAlternatives = optionalNames.map((_, index) => recursiveReferences(optionalNames.slice(index), false)).join(' | ');
            rule += requiredRules.length > 0 ? ` ( "," space ( ${optionalAlternatives} ) )?` : ` ( ${optionalAlternatives} )?`;
        }
        return `${rule} "}" space`;
    }

    private requireSchema(value: unknown, name: string): JsonSchema {
        if (typeof value === 'boolean') {
            return value ? {} : { enum: [] };
        }
        if (!isJsonSchema(value)) {
            throw new DomainError('validation', `json_schema:${name}`);
        }
        return value;
    }
}

export function buildJsonSchemaGrammar(schema: Record<string, unknown>): string {
    return new JsonSchemaGrammarBuilder().build(schema);
}
