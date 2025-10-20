// Web-only polyfills for libraries that still rely on legacy ReactDOM APIs.
// React 19 移除了預設匯出以及部分舊 API，本檔將常用的 findDOMNode 補回，
// 以維持第三方元件（例如 @react-native-community/slider）的相容性。

if (typeof window !== "undefined") {
  try {
    // Import the ESM namespace; ReactDOM 在 React 19 起不再提供 default 匯出。
    const ReactDOM = require("react-dom") as Record<string, any>;
    if (ReactDOM) {
      const legacy = ReactDOM.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;

      // 取得 findDOMNode：可能位於命名匯出或內部 legacy 區塊。
      const resolvedFindDOMNode =
        ReactDOM.findDOMNode ??
        legacy?.ReactDOMLegacy?.findDOMNode ??
        legacy?.ReactDOMComponentTree?.getNodeFromInstance;

      if (typeof resolvedFindDOMNode === "function") {
        if (!ReactDOM.findDOMNode) {
          ReactDOM.findDOMNode = resolvedFindDOMNode;
        }
        // 某些套件以 default 匯出存取，補上指向。
        if (!ReactDOM.default) {
          ReactDOM.default = ReactDOM;
        }
        if (ReactDOM.default && !ReactDOM.default.findDOMNode) {
          ReactDOM.default.findDOMNode = resolvedFindDOMNode;
        }
      }
    }
  } catch (error) {
    // Polyfill 失敗不應阻擋主程式執行；請在 console 中檢查細節。
    console.warn("[polyfills] ReactDOM findDOMNode shim failed", error);
  }
}
