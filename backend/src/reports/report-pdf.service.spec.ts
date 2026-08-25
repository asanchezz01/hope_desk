import {
  ReportPdfService,
  hexOrFallback,
  lighten,
  logoDrawnHeight,
} from './report-pdf.service';
import { ReportBrandColors } from './reports.service';

/** Identidade de uma empresa fictícia, fora do verde padrão de propósito. */
const ROXO: ReportBrandColors = {
  primaryColor: '#6b4cc9',
  secondaryColor: '#2f2158',
  accentColor: '#e0a23c',
  infoColor: '#1f5fe0',
  dangerColor: '#b03a3a',
};

/** `resolveColors` é privado; o teste é do comportamento, não da visibilidade. */
function resolve(brand: ReportBrandColors) {
  const service = new ReportPdfService();
  return (
    service as unknown as {
      resolveColors(brand: ReportBrandColors): Record<string, string>;
    }
  ).resolveColors(brand);
}

describe('hexOrFallback', () => {
  it('aceita hexadecimal de 6 dígitos, com ou sem espaços', () => {
    expect(hexOrFallback('#0d7f57', '#000000')).toBe('#0d7f57');
    expect(hexOrFallback('  #0D7F57  ', '#000000')).toBe('#0D7F57');
  });

  it('cai no padrão diante de qualquer outra coisa', () => {
    // O DTO valida o formato na gravação, mas linha antiga — ou escrita direto
    // no banco — pode trazer lixo, e `fillColor` LANÇA com valor que não
    // entende: seria um 500 no relatório inteiro por causa de uma cor.
    for (const invalido of [
      '',
      '   ',
      'verde',
      '#fff',
      '#0d7f5',
      '#0d7f57ff',
      undefined,
    ]) {
      expect(hexOrFallback(invalido, '#0d7f57')).toBe('#0d7f57');
    }
  });
});

describe('lighten', () => {
  it('0 devolve a cor, 1 devolve branco', () => {
    expect(lighten('#0d7f57', 0)).toBe('#0d7f57');
    expect(lighten('#0d7f57', 1)).toBe('#ffffff');
  });

  it('clareia mantendo a hue', () => {
    // #6b4cc9 a 92% de branco: o roxo continua roxo, bem claro.
    const claro = lighten('#6b4cc9', 0.92);
    expect(claro).toMatch(/^#[0-9a-f]{6}$/);
    const [r, g, b] = [1, 3, 5].map((offset) =>
      parseInt(claro.slice(offset, offset + 2), 16),
    );
    // Azul acima de vermelho acima de verde — a ordem dos canais do roxo.
    expect(b).toBeGreaterThan(r);
    expect(r).toBeGreaterThan(g);
    expect(Math.min(r, g, b)).toBeGreaterThan(220);
  });

  it('sempre devolve dois dígitos por canal', () => {
    // Canal que resulta < 16 precisa do zero à esquerda; sem ele o hexadecimal
    // sai com 5 caracteres e o PDFKit rejeita.
    expect(lighten('#000000', 0)).toBe('#000000');
  });
});

describe('resolveColors', () => {
  it('pinta a marca com as cores da identidade visual', () => {
    const colors = resolve(ROXO);
    expect(colors.primary).toBe('#6b4cc9');
    expect(colors.secondary).toBe('#2f2158');
    expect(colors.accent).toBe('#e0a23c');
  });

  it('deriva a tarja de atividades da cor principal', () => {
    // Fixar a tarja deixaria uma faixa verde num relatório de marca roxa.
    expect(resolve(ROXO).activity).toBe(lighten('#6b4cc9', 0.92));
  });

  it('mantém os neutros de papel, que não são da marca', () => {
    const colors = resolve(ROXO);
    expect(colors.text).toBe('#0c192a');
    expect(colors.muted).toBe('#576d84');
    expect(colors.line).toBe('#dce5ec');
    expect(colors.zebra).toBe('#f5f8fa');
    expect(colors.summary).toBe('#eef3f8');
  });

  it('cor inválida na identidade não derruba o relatório', () => {
    const colors = resolve({ ...ROXO, primaryColor: 'roxo', accentColor: '' });
    expect(colors.primary).toBe('#0d7f57');
    expect(colors.accent).toBe('#a2600b');
    // A tarja acompanha o valor que sobrou de pé, não o lixo.
    expect(colors.activity).toBe(lighten('#0d7f57', 0.92));
  });
});

describe('logoDrawnHeight', () => {
  // A caixa é 180 x 90 — metade da que era usada antes (360 x 180).
  it('encolhe uma imagem grande até caber, sem deformar', () => {
    // 800 x 400 (2:1) cabe pela largura: 180/800 = 0,225 -> 90 de altura.
    expect(logoDrawnHeight(800, 400)).toBeCloseTo(90, 6);
    // 400 x 800 (1:2) cabe pela altura: 90/800 = 0,1125 -> 45 de largura.
    expect(logoDrawnHeight(400, 800)).toBeCloseTo(90, 6);
  });

  it('devolve a altura REAL, não a da caixa', () => {
    // Logo deitada de 4:1: encaixa pela largura e ocupa 45pt de altura.
    // Devolver 90 aqui abriria 45pt de ar entre a marca e o título.
    expect(logoDrawnHeight(800, 200)).toBeCloseTo(45, 6);
  });

  it('mantém a proporção original em qualquer formato', () => {
    for (const [width, height] of [
      [800, 400],
      [1000, 120],
      [120, 1000],
      [500, 500],
    ]) {
      const drawn = logoDrawnHeight(width, height);
      const scale = drawn / height;
      // A mesma escala aplicada à largura também tem de caber na caixa.
      expect(width * scale).toBeLessThanOrEqual(180 + 1e-9);
      expect(drawn).toBeLessThanOrEqual(90 + 1e-9);
    }
  });
});
