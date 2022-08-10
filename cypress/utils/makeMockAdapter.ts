import { PartialLocation, QueryParamAdapter, QueryParamAdapterComponent } from 'use-query-params';

export function makeMockAdapter(currentLocation: PartialLocation): QueryParamAdapterComponent {
  const adapter: QueryParamAdapter = {
    replace: () => {},
    push: () => {},
    get location() {
      return currentLocation;
    }
  };

  const Adapter = ({ children }: any) => children(adapter);
  Adapter.adapter = adapter;

  return Adapter;
}
