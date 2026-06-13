const fs = require("fs");
const path = require("path");

const TYPE_KEY = "__json_type__";

const serializeValue = (value) => {
  if (value instanceof Date) {
    return { [TYPE_KEY]: "Date", value: value.toISOString() };
  }

  if (value instanceof Map) {
    return { [TYPE_KEY]: "Map", value: Array.from(value.entries()) };
  }

  if (value instanceof Set) {
    return { [TYPE_KEY]: "Set", value: Array.from(value.values()) };
  }

  if (typeof value === "bigint") {
    return { [TYPE_KEY]: "BigInt", value: value.toString() };
  }

  if (Buffer.isBuffer(value)) {
    return { [TYPE_KEY]: "Buffer", value: value.toString("base64") };
  }

  if (typeof value === "undefined") {
    return { [TYPE_KEY]: "Undefined" };
  }

  return value;
};

const deserializeValue = (value) => {
  if (!value || typeof value !== "object") {
    return value;
  }

  const marker = value[TYPE_KEY];
  if (!marker) {
    return value;
  }

  switch (marker) {
    case "Date":
      return new Date(value.value);
    case "Map":
      return new Map(Array.isArray(value.value) ? value.value : []);
    case "Set":
      return new Set(Array.isArray(value.value) ? value.value : []);
    case "BigInt":
      return BigInt(value.value);
    case "Buffer":
      return Buffer.from(String(value.value || ""), "base64");
    case "Undefined":
      return undefined;
    default:
      return value;
  }
};

const replacer = (_key, value) => serializeValue(value);
const reviver = (_key, value) => deserializeValue(value);

/**
 * Ensure the parent directory exists for a target file path.
 * @param {string} filePath
 */
const ensureDirForFile = (filePath) => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

/**
 * Read JSON content from a file; returns defaultValue on missing or invalid JSON.
 * @param {string} filePath
 * @param {*} [defaultValue=null]
 * @returns {*}
 */
const readJson = (filePath, defaultValue = null) => {
  try {
    if (!fs.existsSync(filePath)) {
      return defaultValue;
    }

    const content = fs.readFileSync(filePath, "utf-8");
    if (!content.trim()) {
      return defaultValue;
    }

    return JSON.parse(content);
  } catch (error) {
    console.error("读取JSON失败:", error.message);
    return defaultValue;
  }
};

/**
 * Write JSON to a file atomically (via temp file + rename).
 * @param {string} filePath
 * @param {*} data
 */
const writeJson = (filePath, data) => {
  ensureDirForFile(filePath);

  const payload = JSON.stringify(data, null, 2);
  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, payload);
  fs.renameSync(tempPath, filePath);
};

/**
 * Update JSON by passing current value to updater, then write back.
 * @param {string} filePath
 * @param {function(*): *} updater
 * @param {*} [defaultValue={}]
 * @returns {*}
 */
const updateJson = (filePath, updater, defaultValue = {}) => {
  const current = readJson(filePath, defaultValue);
  const next = typeof updater === "function" ? updater(current) : current;
  writeJson(filePath, next);
  return next;
};

/**
 * Read JSON with type-aware deserialization (Date/Map/Set/BigInt/Buffer/undefined).
 * @param {string} filePath
 * @param {*} [defaultValue=null]
 * @returns {*}
 */
const readJsonSerialized = (filePath, defaultValue = null) => {
  try {
    if (!fs.existsSync(filePath)) {
      return defaultValue;
    }

    const content = fs.readFileSync(filePath, "utf-8");
    if (!content.trim()) {
      return defaultValue;
    }

    return JSON.parse(content, reviver);
  } catch (error) {
    console.error("读取JSON失败:", error.message);
    return defaultValue;
  }
};

/**
 * Write JSON with type-aware serialization (Date/Map/Set/BigInt/Buffer/undefined).
 * @param {string} filePath
 * @param {*} data
 */
const writeJsonSerialized = (filePath, data) => {
  ensureDirForFile(filePath);

  const payload = JSON.stringify(data, replacer, 2);
  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, payload);
  fs.renameSync(tempPath, filePath);
};

/**
 * Update JSON with type-aware serialization and deserialization.
 * @param {string} filePath
 * @param {function(*): *} updater
 * @param {*} [defaultValue={}]
 * @returns {*}
 */
const updateJsonSerialized = (filePath, updater, defaultValue = {}) => {
  const current = readJsonSerialized(filePath, defaultValue);
  const next = typeof updater === "function" ? updater(current) : current;
  writeJsonSerialized(filePath, next);
  return next;
};

/**
 * Check if a file exists at the path.
 * @param {string} filePath
 * @returns {boolean}
 */
const fileExists = (filePath) => fs.existsSync(filePath);

module.exports = {
  ensureDirForFile,
  readJson,
  writeJson,
  updateJson,
  readJsonSerialized,
  writeJsonSerialized,
  updateJsonSerialized,
  fileExists,
};
