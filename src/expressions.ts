import {
  ColorSpecification,
  ExpressionInputType,
  ExpressionSpecification,
  InterpolationSpecification,
} from '@maptiler/sdk'

export const expressions = {

  case(cases: CaseExpression[], defaultValue: Expression): ExpressionSpecification {
    if (cases.length === 0) {
      throw new Error('At least one case is required')
    }
    return [
      'case',
      cases[0][0], cases[0][1],
      ...cases.slice(1).flat(),
      defaultValue as ExpressionInputType,
    ]
  },

  if(condition: boolean | ExpressionSpecification, then: Expression, otherwise: Expression): ExpressionSpecification {
    return [
      'case',
      condition, then,
      otherwise,
    ]
  },

  switch(expr: Expression, cases: SwitchCaseExpression[], defaultValue: Expression): ExpressionSpecification {
    return this.case(
      cases.map(([value, output]) => [['==', expr, value], output]),
      defaultValue
    )
  },

  interpolate(spec: InterpolationSpecification, input: number | ExpressionSpecification, ...stops: Array<[number, number | ColorSpecification | ExpressionSpecification]>): ExpressionSpecification {
    return [
      'interpolate',
      spec,
      input,
      stops[0][0],
      stops[0][1],
      ...stops.slice(1).flat(),
    ]
  },

  id(): ExpressionSpecification {
    return ['id']
  },

  get(name: string): ExpressionSpecification {
    return ['get', name]
  },

  featureState(name: string): ExpressionSpecification {
    return ['feature-state', name]
  },

  binary(op: BinaryOperator, a: Expression, b: Expression): ExpressionSpecification {
    return binary(op)(a, b)
  },

  eq:  binary('=='),
  neq: binary('!='),
  gt:  binary('>'),
  gte: binary('>='),
  lt:  binary('<'),
  lte: binary('<='),

  literal(value: unknown): ExpressionSpecification {
    return ['literal', value]
  },

}

function binary(op: BinaryOperator): (a: Expression, b: Expression) => ExpressionSpecification {
  return (a, b) => [op, a, b]
}

export type CaseExpression = [condition: boolean | ExpressionSpecification, output: Expression]
export type SwitchCaseExpression = [value: Expression, output: Expression]
export type BinaryOperator = '==' | '!=' | '>' | '>=' | '<' | '<='

type Expression = ExpressionSpecification | ExpressionInputType