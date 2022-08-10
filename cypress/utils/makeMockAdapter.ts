import { PartialLocation, QueryParamAdapter, QueryParamAdapterComponent } from 'use-query-params';

export function makeMockAdapter(currentLocation: PartialLocation): QueryParamAdapterComponent {
  const adapter: QueryParamAdapter = {
    replace: (newLocation) => Object.assign(currentLocation, newLocation),
    push: (newLocation) => Object.assign(currentLocation, newLocation),
    get location() {
      return currentLocation;
    }
  };

  const Adapter = ({ children }: any) => children(adapter);
  Adapter.adapter = adapter;

  return Adapter;
}
