import { BadRequestException } from '@nestjs/common';
import { normalizeHourlyRate } from './parameters.service';

describe('normalizeHourlyRate', () => {
  it.each([
    ['150', '150.00'],
    ['150,75', '150.75'],
    ['0', '0.00'],
  ])('normaliza %s para %s', (input, expected) => {
    expect(normalizeHourlyRate(input)).toBe(expected);
  });

  it.each(['', '-1', 'abc', '1,2,3'])('rejeita valor/hora inválido: %s', (input) => {
    expect(() => normalizeHourlyRate(input)).toThrow(BadRequestException);
  });
});
