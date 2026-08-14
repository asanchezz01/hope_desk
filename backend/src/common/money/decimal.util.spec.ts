import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  formatBrl,
  formatPtBr,
  parseDecimalInput,
  sumDecimals,
  toCanonicalString,
  toDecimalView,
} from './decimal.util';

describe('decimal.util', () => {
  describe('parseDecimalInput', () => {
    it('aceita ponto decimal', () => {
      expect(parseDecimalInput('1234.56', 'valor').toFixed(2)).toBe('1234.56');
    });

    it('aceita vírgula decimal, como o legado', () => {
      expect(parseDecimalInput('1234,56', 'valor').toFixed(2)).toBe('1234.56');
    });

    it('aceita número', () => {
      expect(parseDecimalInput(10.5, 'valor').toFixed(2)).toBe('10.50');
    });

    it('aceita Decimal e devolve o mesmo valor', () => {
      const decimal = new Prisma.Decimal('99.99');
      expect(parseDecimalInput(decimal, 'valor')).toBe(decimal);
    });

    it('aceita zero', () => {
      expect(parseDecimalInput('0', 'valor').toFixed(2)).toBe('0.00');
    });

    it('preserva precisão além de 2 casas na entrada', () => {
      expect(parseDecimalInput('1.005', 'valor').toString()).toBe('1.005');
    });

    it.each([
      ['vazio', ''],
      ['só espaços', '   '],
      ['texto', 'abc'],
      ['moeda', 'R$ 10,00'],
      ['separador de milhar ambíguo', '1.234,56'],
      ['dois separadores', '1,2,3'],
      ['notação científica', '1e5'],
    ])('rejeita entrada inválida: %s', (_label, input) => {
      expect(() => parseDecimalInput(input, 'valor')).toThrow(BadRequestException);
    });

    it('rejeita valor negativo', () => {
      expect(() => parseDecimalInput('-1', 'valor')).toThrow(/não pode ser negativo/);
      expect(() => parseDecimalInput('-0,01', 'valor')).toThrow(
        /não pode ser negativo/,
      );
    });

    it('cita o nome do campo na mensagem', () => {
      expect(() => parseDecimalInput('abc', 'horas pagas')).toThrow(/horas pagas/);
    });
  });

  describe('formatPtBr', () => {
    it.each([
      ['0', '0,00'],
      ['1', '1,00'],
      ['10.5', '10,50'],
      ['1234.56', '1.234,56'],
      ['1000', '1.000,00'],
      ['999999.99', '999.999,99'],
      ['1234567.89', '1.234.567,89'],
      ['100', '100,00'],
    ])('formata %s como %s', (input, expected) => {
      expect(formatPtBr(input)).toBe(expected);
    });

    it('arredonda para 2 casas na apresentação', () => {
      expect(formatPtBr('1.005')).toBe('1,01');
      expect(formatPtBr('1.004')).toBe('1,00');
    });

    it('respeita escala customizada', () => {
      expect(formatPtBr('10.25', 1)).toBe('10,3');
      expect(formatPtBr('1234', 0)).toBe('1.234');
    });

    it('formata negativo com o sinal antes do separador de milhar', () => {
      expect(formatPtBr('-1234.56')).toBe('-1.234,56');
    });
  });

  describe('formatBrl', () => {
    it('inclui o símbolo da moeda', () => {
      expect(formatBrl('1234.56')).toBe('R$ 1.234,56');
      expect(formatBrl('0')).toBe('R$ 0,00');
    });
  });

  describe('toCanonicalString', () => {
    it('usa ponto decimal e escala fixa', () => {
      expect(toCanonicalString('1234.5')).toBe('1234.50');
      expect(toCanonicalString('0')).toBe('0.00');
    });
  });

  describe('sumDecimals', () => {
    it('soma sem erro de ponto flutuante', () => {
      // 0.1 + 0.2 em float daria 0.30000000000000004.
      expect(sumDecimals(['0.1', '0.2']).toFixed(2)).toBe('0.30');
    });

    it('soma uma lista longa exatamente', () => {
      const values = Array.from({ length: 100 }, () => '0.01');
      expect(sumDecimals(values).toFixed(2)).toBe('1.00');
    });

    it('devolve zero para lista vazia', () => {
      expect(sumDecimals([]).toFixed(2)).toBe('0.00');
    });

    it('soma Decimals vindos do Prisma', () => {
      const values = [new Prisma.Decimal('1234.56'), new Prisma.Decimal('0.44')];
      expect(sumDecimals(values).toFixed(2)).toBe('1235.00');
    });
  });

  describe('toDecimalView', () => {
    it('devolve valor exato e apresentação', () => {
      expect(toDecimalView('1234.56')).toEqual({
        value: '1234.56',
        formatted: '1.234,56',
      });
    });

    it('o campo value é sempre parseável de volta sem perda', () => {
      const view = toDecimalView('1234.56');
      expect(parseDecimalInput(view.value, 'valor').toFixed(2)).toBe('1234.56');
    });
  });
});
