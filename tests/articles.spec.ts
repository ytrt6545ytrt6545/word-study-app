import AsyncStorage from "@react-native-async-storage/async-storage";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  addArticleHighlight,
  createArticle,
  deleteArticle,
  getArticleById,
  loadArticleTagOrder,
  loadArticleTags,
  loadArticles,
  removeArticleHighlight,
  saveArticleTagOrder,
  saveArticleTags,
  updateArticle,
  updateArticleHighlight,
} from "../utils/articles";

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
      async multiRemove(keys: string[]) {
        keys.forEach((key) => store.delete(key));
      },
      __reset: () => store.clear(),
    },
  };
});

const resetStorage = async () => {
  await (AsyncStorage as any).__reset();
};

describe("articles storage helpers", () => {
  beforeEach(async () => {
    vi.useRealTimers();
    await resetStorage();
  });

  it("returns empty array when no articles stored", async () => {
    const articles = await loadArticles();
    expect(articles).toEqual([]);
  });

  it("creates article with defaults and normalizes fields", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-01T00:00:00Z"));
    const created = await createArticle({
      title: "  Sample Title ",
      rawText: "line 1\nline 2",
      tags: ["Topic>Sub", " ", "Topic"],
      summary: "",
    });

    expect(created.title).toBe("Sample Title");
    expect(created.status).toBe("new");
    expect(created.summary).toBeNull();
    expect(created.tags).toEqual(["Topic", "Topic > Sub"]);
    expect(created.createdAt).toBe("2025-01-01T00:00:00.000Z");
    expect(created.updatedAt).toBe("2025-01-01T00:00:00.000Z");
    expect(created.highlights).toEqual([]);

    const stored = await loadArticles();
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe(created.id);
  });

  it("updates article and refreshes updatedAt timestamp", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-01T00:00:00Z"));
    const base = await createArticle({ title: "Alpha", rawText: "content" });

    vi.setSystemTime(new Date("2025-02-01T12:00:00Z"));
    const updated = await updateArticle(base.id, {
      summary: "Done",
      status: "processed",
      tags: ["Projects>Alpha"],
    });

    expect(updated).not.toBeNull();
    expect(updated?.status).toBe("processed");
    expect(updated?.summary).toBe("Done");
    expect(updated?.tags).toEqual(["Projects", "Projects > Alpha"]);
    expect(updated?.createdAt).toBe("2025-01-01T00:00:00.000Z");
    expect(updated?.updatedAt).toBe("2025-02-01T12:00:00.000Z");
  });

  it("deletes article by id", async () => {
    const created = await createArticle({ title: "Delete me", rawText: "" });
    const removed = await deleteArticle(created.id);
    expect(removed).toBe(true);
    const articles = await loadArticles();
    expect(articles).toHaveLength(0);
  });

  it("retrieves article by id", async () => {
    const created = await createArticle({ title: "Find me", rawText: "content here", tags: ["Topic"] });
    const fetched = await getArticleById(created.id);
    expect(fetched).not.toBeNull();
    expect(fetched?.id).toBe(created.id);
    expect(fetched?.rawText).toBe("content here");
    const missing = await getArticleById("does-not-exist");
    expect(missing).toBeNull();
  });

  it("returns null when updating missing article", async () => {
    const result = await updateArticle("missing", { title: "x" });
    expect(result).toBeNull();
  });

  it("handles article highlight lifecycle", async () => {
    const article = await createArticle({ title: "Highlights", rawText: "body" });

    const withHighlight = await addArticleHighlight(article.id, {
      text: "Important part",
      note: "check",
      linkedWords: ["apple", "apple", "cat "],
    });
    expect(withHighlight?.highlights).toHaveLength(1);
    const highlight = withHighlight?.highlights[0];
    expect(highlight?.linkedWords).toEqual(["apple", "cat"]);

    const updated = await updateArticleHighlight(article.id, highlight!.id, {
      note: "updated note",
      linkedWords: ["zebra"],
    });
    expect(updated?.highlights[0].note).toBe("updated note");
    expect(updated?.highlights[0].linkedWords).toEqual(["zebra"]);

    const removed = await removeArticleHighlight(article.id, highlight!.id);
    expect(removed?.highlights).toHaveLength(0);
  });

  it("normalizes and persists article tags", async () => {
    const result = await saveArticleTags([" Science ", "Science>Biology", "science"]);
    expect(result).toEqual(["Science", "Science > Biology"]);

    const loaded = await loadArticleTags();
    expect(loaded).toEqual(["Science", "Science > Biology"]);
  });

  it("saves and loads article tag order", async () => {
    const order = {
      "": ["Science", "Languages"],
      Science: ["Biology"],
    };
    await saveArticleTagOrder(order);
    const loaded = await loadArticleTagOrder();
    expect(loaded).toEqual({
      "": ["Science", "Languages"],
      Science: ["Biology"],
    });
  });

  it("ignores highlight update when highlight not found", async () => {
    const article = await createArticle({ title: "No highlight", rawText: "t" });
    const result = await updateArticleHighlight(article.id, "xyz", { note: "noop" });
    expect(result).toBeNull();
  });

  it("returns null when removing highlight that does not exist", async () => {
    const article = await createArticle({ title: "No highlight", rawText: "t" });
    const result = await removeArticleHighlight(article.id, "xyz");
    expect(result).toBeNull();
  });
});
