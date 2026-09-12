import { TravelProviderService } from './travel-provider.service';
import { DuffelAdapter } from './duffel.adapter';

describe('TravelProviderService', () => {
  let service: TravelProviderService;
  let duffelAdapter: DuffelAdapter;
  const ENV_ORIGINAL = { ...process.env };

  beforeEach(() => {
    duffelAdapter = new DuffelAdapter();
    service = new TravelProviderService(duffelAdapter);
  });

  afterEach(() => {
    process.env = { ...ENV_ORIGINAL };
  });

  it('usa Duffel por defecto sin TRAVEL_PROVIDER_ACTIVO', () => {
    delete process.env.TRAVEL_PROVIDER_ACTIVO;
    expect(service.activo).toBe(duffelAdapter);
  });

  it('cae a Duffel si el valor no es reconocido (todavía el único proveedor real)', () => {
    process.env.TRAVEL_PROVIDER_ACTIVO = 'amadeus';
    expect(service.activo).toBe(duffelAdapter);
  });
});
