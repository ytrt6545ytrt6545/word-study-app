import AsyncStorage from "@react-native-async-storage/async-storage";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { applyBackupPayload, buildBackupPayload } from "../utils/backup";

const articleMocks = vi.hoisted(() => ({
  loadArticles: vi.fn(async () => fallbackArticles()),
  saveArticles: vi.fn(async () => {}),
  loadArticleTags: vi.fn(async () => fallbackArticleTags()),
  saveArticleTags: vi.fn(async () => {}),
  loadArticleTagOrder: vi.fn(async () => fallbackArticleTagOrder()),
  saveArticleTagOrder: vi.fn(async () => {}),
}));

const storageMocks = vi.hoisted(() => ({
  loadWords: vi.fn(async () => []),
  saveWords: vi.fn(async () => {}),
  loadTags: vi.fn(async () => []),
  saveTags: vi.fn(async () => {}),
}));

vi.mock("@react-native-async-storage/async-storage", () => {
  const store = new Map<string, string>();
  return {
    default: {
      async getItem(key: string) {
        return store.has(key) ? store.get(key)! : null;
      },
      async setItem(key: string, value: string) {
        store.set(key, value);
      },
      async removeItem(key: string) {
        store.delete(key);
      },
      async multiGet(keys: string[]) {
        return keys.map((key) => [key, store.has(key) ? store.get(key)! : null]);
      },
      async multiSet(entries: [string, string][]) {
        entries.forEach(([key, value]) => store.set(key, value));
      },
      async multiRemove(keys: string[]) {
        keys.forEach((key) => store.delete(key));
      },
      __reset: () => store.clear(),
    },
  };
});

vi.mock("../utils/articles", () => articleMocks);

vi.mock("../utils/storage", () => storageMocks);

vi.mock("expo-file-system", () => ({
  StorageAccessFramework: {
    requestDirectoryPermissionsAsync: vi.fn(),
    createFileAsync: vi.fn(),
    writeAsStringAsync: vi.fn(),
  },
  EncodingType: { UTF8: "utf8" },
  cacheDirectory: null,
  documentDirectory: null,
  readAsStringAsync: vi.fn(),
  writeAsStringAsync: vi.fn(),
}));

vi.mock("expo-document-picker", () => ({
  getDocumentAsync: vi.fn(),
}));

vi.mock("expo-sharing", () => ({
  isAvailableAsync: vi.fn(async () => false),
  shareAsync: vi.fn(),
}));

vi.mock("react-native", () => ({
  Platform: { OS: "web" },
}));

describe("backup helpers for article payload", () => {
  beforeEach(() => {
    (AsyncStorage as any).__reset();
    vi.clearAllMocks();
    articleMocks.loadArticles.mockImplementation(async () => fallbackArticles());
    articleMocks.saveArticles.mockImplementation(async () => {});
    articleMocks.loadArticleTags.mockImplementation(async () => fallbackArticleTags());
    articleMocks.saveArticleTags.mockImplementation(async () => {});
    articleMocks.loadArticleTagOrder.mockImplementation(async () => fallbackArticleTagOrder());
    articleMocks.saveArticleTagOrder.mockImplementation(async () => {});
  });

  it("includes article keys in backup payload", async () => {
    await AsyncStorage.setItem("@halo_articles", JSON.stringify([{ id: "a1" }]));
    await AsyncStorage.setItem("@halo_article_tags", JSON.stringify(["Topic"]));
    await AsyncStorage.setItem("@halo_article_tag_order", JSON.stringify({ "": ["Topic"] }));

    const data = await buildBackupPayload();

    expect(data.payload["@halo_articles"]).toBe(JSON.stringify([{ id: "a1" }]));
    expect(data.payload["@halo_article_tags"]).toBe(JSON.stringify(["Topic"]));
    expect(data.payload["@halo_article_tag_order"]).toBe(JSON.stringify({ "": ["Topic"] }));
    expect(data.schemaVersion).toBe(1);
  });

  it("falls back to normalized article data when payload is malformed", async () => {
    await applyBackupPayload({
      payload: {
        "@halo_articles": { wrong: true },
        "@halo_article_tags": 42,
        "@halo_article_tag_order": null,
      },
    });

    expect(articleMocks.loadArticles).toHaveBeenCalledTimes(1);
    expect(articleMocks.saveArticles).toHaveBeenCalledWith(fallbackArticles());
    expect(articleMocks.loadArticleTags).toHaveBeenCalledTimes(1);
    expect(articleMocks.saveArticleTags).toHaveBeenCalledWith(fallbackArticleTags());
    expect(articleMocks.loadArticleTagOrder).toHaveBeenCalledTimes(1);
    expect(articleMocks.saveArticleTagOrder).toHaveBeenCalledWith(fallbackArticleTagOrder());
  });

  it("applies article payload when backup data is valid JSON", async () => {
    const articles = [{ id: "a1", title: "From backup" }];
    const tags = ["Category"];
    const order = { "": ["Category"] };

    await applyBackupPayload({
      payload: {
        "@halo_articles": JSON.stringify(articles),
        "@halo_article_tags": JSON.stringify(tags),
        "@halo_article_tag_order": JSON.stringify(order),
      },
    });

    expect(articleMocks.saveArticles).toHaveBeenCalledWith(articles);
    expect(articleMocks.saveArticleTags).toHaveBeenCalledWith(tags);
    expect(articleMocks.saveArticleTagOrder).toHaveBeenCalledWith(order);
    expect(articleMocks.loadArticles).not.toHaveBeenCalled();
  });
});

function fallbackArticles() {
  return [
    {
      id: "fallback-id",
      title: "Fallback",
      sourceType: "manual",
      sourceRef: null,
      rawText: "",
      summary: null,
      tags: [],
      status: "new",
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
      highlights: [],
    },
  ];
}

function fallbackArticleTags() {
  return ["Fallback"];
}

function fallbackArticleTagOrder() {
  return { "": ["Fallback"] };
}
