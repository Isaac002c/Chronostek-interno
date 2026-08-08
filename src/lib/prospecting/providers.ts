import type { ProspectInput } from "./repository";

export type ProspectingQuery = {
  segment?: string;
  city?: string;
  state?: string;
  limit: number;
};

export interface ProspectingProvider {
  readonly name: string;
  search(query: ProspectingQuery): Promise<ProspectInput[]>;
}

export class ManualProspectingProvider implements ProspectingProvider {
  readonly name: string = "manual";
  constructor(private readonly records: ProspectInput[]) {}
  async search(query: ProspectingQuery): Promise<ProspectInput[]> {
    return this.records
      .filter((item) => !query.segment || item.segment?.toLowerCase().includes(query.segment.toLowerCase()))
      .filter((item) => !query.city || item.city?.toLowerCase() === query.city.toLowerCase())
      .filter((item) => !query.state || item.state?.toLowerCase() === query.state.toLowerCase())
      .slice(0, Math.max(1, Math.min(100, query.limit)));
  }
}

export class CsvImportProspectingProvider extends ManualProspectingProvider {
  readonly name: string = "csv_import";
}
