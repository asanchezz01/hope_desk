import { BadRequestException } from '@nestjs/common';
import { normalizeHourlyRate, resolveParameterValue } from './parameters.service';

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

describe('resolveParameterValue', () => {
  it('chave nunca gravada cai no default', () => {
    expect(resolveParameterValue('header_title', undefined)).toBe('Hope Desk');
    expect(resolveParameterValue('company_name', undefined)).toBe('Hope Desk');
    expect(resolveParameterValue('report_logo', undefined)).toBe('');
  });

  it('devolve o valor gravado, sem espaços nas pontas', () => {
    expect(resolveParameterValue('header_title', '  Acme  ')).toBe('Acme');
  });

  it('vazio GRAVADO no título do cabeçalho significa "só a logo"', () => {
    // A regressão que isto tranca: cair no default aqui faria "Hope Desk"
    // reaparecer sozinho depois de a pessoa limpar o campo e salvar.
    expect(resolveParameterValue('header_title', '')).toBe('');
    expect(resolveParameterValue('header_title', '   ')).toBe('');
  });

  it('vazio nas demais chaves continua caindo no default', () => {
    // Nome e endereço saem no cabeçalho de todo relatório; não podem sumir
    // porque alguém apagou o campo.
    expect(resolveParameterValue('company_name', '')).toBe('Hope Desk');
    expect(resolveParameterValue('monthly_hours_allowance', '')).toBe('16');
  });
});
