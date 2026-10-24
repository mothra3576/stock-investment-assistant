import sample from "./sample.json";
import { parseStockFile } from "./import";
import type { StockDataProvider } from "./types";
export const sampleStockProvider: StockDataProvider = {
  async load() {
    return parseStockFile(JSON.stringify(sample), "json");
  },
};
export class FileStockDataProvider implements StockDataProvider {
  constructor(
    private text: string,
    private format: "json" | "csv",
  ) {}
  async load() {
    return parseStockFile(this.text, this.format);
  }
}
