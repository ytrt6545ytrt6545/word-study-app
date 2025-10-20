import { describe, expect, it, vi } from "vitest";

vi.mock("@react-native-async-storage/async-storage", () => {
  const store = new Map<string, string>();
  return {
    default: {
      getItem: vi.fn(async (key: string) => store.get(key) ?? null),
      setItem: vi.fn(async (key: string, value: string) => {
        store.set(key, value);
      }),
      removeItem: vi.fn(async (key: string) => {
        store.delete(key);
      }),
    },
  };
});

import {
  applyOrderToTree,
  buildTagTree,
  normalizeTagPath,
  pathStartsWith,
  TAG_DELIM,
  buildOrderedTagTree,
  saveTagOrder,
  loadTagOrder,
} from "../utils/storage";

describe("標籤路徑處理", () => {
  it("normalizeTagPath 會修剪空白並限制層級", () => {
    expect(normalizeTagPath(`  A ${TAG_DELIM} B  `)).toBe("A > B");
    expect(normalizeTagPath("單層")).toBe("單層");
    expect(normalizeTagPath("")).toBeNull();
    expect(normalizeTagPath(`A ${TAG_DELIM} B ${TAG_DELIM} C ${TAG_DELIM} D`)).toBeNull();
  });

  it("pathStartsWith 可判斷階層開頭是否相符", () => {
    expect(pathStartsWith("A > B > C", "A > B")).toBe(true);
    expect(pathStartsWith("A > B", "A > B")).toBe(true);
    expect(pathStartsWith("A > B", "A > B > C")).toBe(false);
    expect(pathStartsWith("A > B", "C")).toBe(false);
  });
});

describe("標籤樹建構", () => {
  it("buildTagTree 會忽略系統標籤並建立巢狀節點", () => {
    const tree = buildTagTree(["學科 > 數學", "學科 > 英文", "複習", ""]);
    expect(tree).toHaveLength(1);
    expect(tree[0].name).toBe("學科");
    expect(tree[0].children?.map((n) => n.name)).toEqual(["數學", "英文"]);
  });

  it("applyOrderToTree 會依照儲存的順序重新排序", () => {
    const tree = buildTagTree(["語言 > 英文", "語言 > 日文", "語言 > 韓文"]);
    const withOrder = applyOrderToTree(tree, "", { "": ["語言"], "語言": ["韓文", "英文"] });
    const children = withOrder[0].children ?? [];
    expect(children.map((c) => c.name)).toEqual(["韓文", "英文", "日文"]);
  });
});

describe("標籤順序儲存", () => {
  it("saveTagOrder 與 loadTagOrder 可以互相對應", async () => {
    const snapshot = { "": ["語言"], "語言": ["英文", "日文"] };
    await saveTagOrder(snapshot);
    expect(await loadTagOrder()).toEqual(snapshot);
  });

  it("buildOrderedTagTree 會套用儲存的順序", async () => {
    await saveTagOrder({ "": ["語言"], "語言": ["韓文", "英文"] });
    const tree = await buildOrderedTagTree(["語言 > 英文", "語言 > 韓文", "語言 > 法文"]);
    const names = tree[0].children?.map((n) => n.name);
    expect(names).toEqual(["韓文", "英文", "法文"]);
  });
});
