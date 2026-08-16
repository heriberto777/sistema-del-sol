import { calcularRecibo } from './calculo-nomina';

describe('calcularRecibo', () => {
  it('mensual, salario bajo el tope de TSS: aplica las tasas planas sobre el bruto completo', () => {
    const recibo = calcularRecibo(35000, 1);

    expect(recibo.salarioBruto).toBe(35000);
    expect(recibo.sfsEmpleado).toBeCloseTo(1064, 2);
    expect(recibo.afpEmpleado).toBeCloseTo(1004.5, 2);
    expect(recibo.sfsEmpleador).toBeCloseTo(2481.5, 2);
    expect(recibo.afpEmpleador).toBeCloseTo(2485, 2);
    expect(recibo.infotep).toBeCloseTo(350, 2);
    // cotizable ISR = 35000 - 1064 - 1004.5 = 32,931.5/mes -> anual 395,178 (exento)
    expect(recibo.isr).toBe(0);
    expect(recibo.salarioNeto).toBeCloseTo(32931.5, 2);
  });

  it('quincenal: prorratea (factor 0.5) todos los montos ya calculados sobre el salario mensual completo', () => {
    const mensual = calcularRecibo(35000, 1);
    const quincenal = calcularRecibo(35000, 0.5);

    expect(quincenal.salarioBruto).toBeCloseTo(mensual.salarioBruto / 2, 5);
    expect(quincenal.sfsEmpleado).toBeCloseTo(mensual.sfsEmpleado / 2, 5);
    expect(quincenal.salarioNeto).toBeCloseTo(mensual.salarioNeto / 2, 5);
  });

  it('respeta el tope de cotización de SFS/AFP cuando el salario lo supera', () => {
    const recibo = calcularRecibo(300000, 1);

    // tope SFS = 232,230 -> 232230 * 0.0304
    expect(recibo.sfsEmpleado).toBeCloseTo(232230 * 0.0304, 2);
    // 300,000 < tope AFP (464,460) -> se cotiza sobre el bruto completo
    expect(recibo.afpEmpleado).toBeCloseTo(300000 * 0.0287, 2);
  });

  it('otrasDeducciones se resta del neto sin afectar los cálculos de TSS/ISR', () => {
    const sinDeduccion = calcularRecibo(35000, 1);
    const conDeduccion = calcularRecibo(35000, 1, 500);

    expect(conDeduccion.otrasDeducciones).toBe(500);
    expect(conDeduccion.salarioNeto).toBeCloseTo(sinDeduccion.salarioNeto - 500, 5);
    expect(conDeduccion.sfsEmpleado).toBeCloseTo(sinDeduccion.sfsEmpleado, 5);
  });
});
