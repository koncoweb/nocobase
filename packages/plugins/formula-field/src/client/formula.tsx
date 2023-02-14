import { i18n, IField, interfacesProperties } from '@nocobase/client';
import evaluators, { Evaluator } from '@nocobase/evaluators/client';
import { Registry } from '@nocobase/utils/client';

import { NAMESPACE } from './locale';



const { defaultProps, operators } = interfacesProperties;

export const formula: IField = {
  name: 'formula',
  type: 'object',
  group: 'advanced',
  order: 1,
  title: `{{t("Formula", { ns: "${NAMESPACE}" })}}`,
  description: '{{t("Compute a value based on the other fields using mathjs")}}',
  sortable: true,
  default: {
    type: 'formula',
    // name,
    uiSchema: {
      type: 'number',
      // title,
      'x-disabled': true,
      'x-component': 'Formula.Result',
      'x-component-props': {
        stringMode: true,
        step: '1',
      },
    },
  },
  properties: {
    ...defaultProps,
    dataType: {
      type: 'string',
      title: '{{t("Storage type")}}',
      'x-decorator': 'FormItem',
      'x-component': 'Select',
      'x-disabled': '{{ !createOnly }}',
      enum: [
        { value: 'boolean', label: 'Boolean' },
        { value: 'integer', label: 'Integer' },
        { value: 'bigInt', label: 'Big integer' },
        { value: 'double', label: 'Double' },
        { value: 'decimal', label: 'Decimal' },
        { value: 'string', label: 'String' },
        { value: 'date', label: 'Datetime' },
      ],
      required: true,
      default: 'double',
    },
    'uiSchema.x-component-props.step': {
      type: 'string',
      title: '{{t("Precision")}}',
      'x-component': 'Select',
      'x-decorator': 'FormItem',
      required: true,
      default: '0',
      enum: [
        { value: '0', label: '1' },
        { value: '0.1', label: '1.0' },
        { value: '0.01', label: '1.00' },
        { value: '0.001', label: '1.000' },
        { value: '0.0001', label: '1.0000' },
        { value: '0.00001', label: '1.00000' },
      ],
      'x-reactions': [
        {
          dependencies: ['dataType'],
          fulfill: {
            state: {
              display: '{{["double", "decimal"].includes($deps[0]) ? "visible" : "none"}}',
            },
          },
        },
      ],
    },
    engine: {
      type: 'string',
      title: `{{t("Formula engine", { ns: "${NAMESPACE}" })}}`,
      'x-decorator': 'FormItem',
      'x-component': 'Radio.Group',
      enum: Array.from((evaluators as Registry<Evaluator>).getEntities()).reduce((result: any[], [value, options]) => result.concat({ value, ...options }), []),
      required: true,
      default: 'math.js',
    },
    expression: {
      type: 'string',
      title: `{{t("Expression", { ns: "${NAMESPACE}" })}}`,
      required: true,
      'x-component': 'Formula.Expression',
      'x-decorator': 'FormItem',
      'x-component-props': {
        supports: [
          'checkbox',

          'number',
          'percent',
          'integer',
          'number',
          'percent',

          'input',
          'textarea',
          'email',
          'phone',

          'datetime',
          'createdAt',
          'updatedAt',

          'radioGroup',
          'checkboxGroup',
          'select',
          'multipleSelect',

          // 'json'
        ],
        useCurrentFields: '{{ useCurrentFields }}',
        // evaluate(exp: string) {
        //   const { values } = useForm();
        //   const { evaluate } = evaluators.get(values.engine);
        //   return evaluate(exp);
        // }
      },
      'x-reactions': {
        dependencies: ['engine'],
        fulfill: {
          schema: {
            description: '{{renderExpressionDescription($deps[0])}}',
          }
        }
      },
      ['x-validator'](value, rules, { form }) {
        const { values } = form;
        const { evaluate } = (evaluators as Registry<Evaluator>).get(values.engine);
        const exp = value.trim().replace(/\{\{([^{}]+)\}\}/g, '1');
        try {
          evaluate(exp);
          return '';
        } catch (e) {
          return i18n.t('Expression syntax error');
        }
      }
    },
  },
  filterable: {
    operators: operators.number,
  },
};
