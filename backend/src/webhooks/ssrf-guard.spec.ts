import { validarUrlWebhook } from './ssrf-guard';

jest.mock('dns/promises', () => ({
  lookup: jest.fn(),
}));

import { lookup } from 'dns/promises';

const lookupMock = lookup as jest.Mock;

describe('validarUrlWebhook', () => {
  afterEach(() => jest.clearAllMocks());

  it('rechaza protocolos distintos de http/https', async () => {
    await expect(validarUrlWebhook('ftp://8.8.8.8/hook')).rejects.toThrow('http o https');
  });

  it('rechaza localhost', async () => {
    await expect(validarUrlWebhook('http://localhost:3000/hook')).rejects.toThrow('localhost');
  });

  it('rechaza una IP literal privada (10.x)', async () => {
    await expect(validarUrlWebhook('http://10.0.0.5/hook')).rejects.toThrow('privada');
  });

  it('rechaza una IP literal de loopback (127.x)', async () => {
    await expect(validarUrlWebhook('http://127.0.0.1/hook')).rejects.toThrow('privada');
  });

  it('rechaza una IP literal en el rango 192.168.x', async () => {
    await expect(validarUrlWebhook('http://192.168.1.10/hook')).rejects.toThrow('privada');
  });

  it('rechaza un rango 172.16-31.x (RFC1918) pero no un 172.x fuera de ese rango', async () => {
    await expect(validarUrlWebhook('http://172.20.0.5/hook')).rejects.toThrow('privada');
    lookupMock.mockResolvedValue({ address: '172.64.0.1' });
    await expect(validarUrlWebhook('http://cdn.example.com/hook')).resolves.toBeUndefined();
  });

  it('acepta una IP literal pública', async () => {
    await expect(validarUrlWebhook('https://8.8.8.8/hook')).resolves.toBeUndefined();
  });

  it('resuelve un hostname vía DNS y rechaza si apunta a una IP privada', async () => {
    lookupMock.mockResolvedValue({ address: '10.1.2.3' });
    await expect(validarUrlWebhook('http://intranet.corp.local/hook')).rejects.toThrow('privada');
    expect(lookupMock).toHaveBeenCalledWith('intranet.corp.local');
  });

  it('resuelve un hostname vía DNS y acepta si apunta a una IP pública', async () => {
    lookupMock.mockResolvedValue({ address: '93.184.216.34' });
    await expect(validarUrlWebhook('https://n8n.midominio.com/hook')).resolves.toBeUndefined();
  });
});
