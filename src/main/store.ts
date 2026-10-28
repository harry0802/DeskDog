// 存檔讀寫：%APPDATA%/DeskDog 下的 JSON 檔。
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

/** 先寫暫存檔再改名，寫到一半關機也不會留下半個檔案。 */
export function writeJson(file: string, data: unknown): void {
  mkdirSync(dirname(file), { recursive: true });
  const temp = `${file}.tmp`;
  writeFileSync(temp, JSON.stringify(data, null, 2));
  renameSync(temp, file);
}

/** 讀不到或損壞時為 undefined；欄位由核心檢查。 */
export function readJson(file: string): unknown {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return undefined;
  }
}
