window.__ModuleLoader__.load({
  id: "dsh-totem",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
var __create = Object.create;
var __getProtoOf = Object.getPrototypeOf;
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __hasOwnProp = Object.prototype.hasOwnProperty;
function __accessProp(key) {
  return this[key];
}
var __toESMCache_node;
var __toESMCache_esm;
var __toESM = (mod, isNodeMode, target) => {
  var canCache = mod != null && typeof mod === "object";
  if (canCache) {
    var cache = isNodeMode ? __toESMCache_node ??= new WeakMap : __toESMCache_esm ??= new WeakMap;
    var cached = cache.get(mod);
    if (cached)
      return cached;
  }
  target = mod != null ? __create(__getProtoOf(mod)) : {};
  const to = isNodeMode || !mod || !mod.__esModule || !__hasOwnProp.call(mod, "default") ? __defProp(target, "default", { value: mod, enumerable: true }) : target;
  if (mod && typeof mod === "object" || typeof mod === "function") {
    for (let key of __getOwnPropNames(mod))
      if (!__hasOwnProp.call(to, key))
        __defProp(to, key, {
          get: __accessProp.bind(mod, key),
          enumerable: true
        });
  }
  if (canCache)
    cache.set(mod, to);
  return to;
};
var __toCommonJS = (from) => {
  var entry = (__moduleCache ??= new WeakMap).get(from), desc;
  if (entry)
    return entry;
  entry = __defProp({}, "__esModule", { value: true });
  if (from && typeof from === "object" || typeof from === "function") {
    for (var key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(entry, key))
        __defProp(entry, key, {
          get: __accessProp.bind(from, key),
          enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
        });
  }
  __moduleCache.set(from, entry);
  return entry;
};
var __moduleCache;
var __commonJS = (cb, mod) => () => (mod || cb((mod = { exports: {} }).exports, mod), mod.exports);
var __returnValue = (v) => v;
function __exportSetter(name, newValue) {
  this[name] = __returnValue.bind(null, newValue);
}
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: __exportSetter.bind(all, name)
    });
};

// node_modules/@sindresorhus/is/dist/index.js
var require_dist = __commonJS(function(exports2, module2) {
  Object.defineProperty(exports2, "__esModule", { value: true });
  var typedArrayTypeNames = [
    "Int8Array",
    "Uint8Array",
    "Uint8ClampedArray",
    "Int16Array",
    "Uint16Array",
    "Int32Array",
    "Uint32Array",
    "Float32Array",
    "Float64Array",
    "BigInt64Array",
    "BigUint64Array"
  ];
  function isTypedArrayName(name) {
    return typedArrayTypeNames.includes(name);
  }
  var objectTypeNames = [
    "Function",
    "Generator",
    "AsyncGenerator",
    "GeneratorFunction",
    "AsyncGeneratorFunction",
    "AsyncFunction",
    "Observable",
    "Array",
    "Buffer",
    "Blob",
    "Object",
    "RegExp",
    "Date",
    "Error",
    "Map",
    "Set",
    "WeakMap",
    "WeakSet",
    "ArrayBuffer",
    "SharedArrayBuffer",
    "DataView",
    "Promise",
    "URL",
    "FormData",
    "URLSearchParams",
    "HTMLElement",
    ...typedArrayTypeNames
  ];
  function isObjectTypeName(name) {
    return objectTypeNames.includes(name);
  }
  var primitiveTypeNames = [
    "null",
    "undefined",
    "string",
    "number",
    "bigint",
    "boolean",
    "symbol"
  ];
  function isPrimitiveTypeName(name) {
    return primitiveTypeNames.includes(name);
  }
  function isOfType(type) {
    return (value) => typeof value === type;
  }
  var { toString } = Object.prototype;
  var getObjectType = (value) => {
    const objectTypeName = toString.call(value).slice(8, -1);
    if (/HTML\w+Element/.test(objectTypeName) && is.domElement(value)) {
      return "HTMLElement";
    }
    if (isObjectTypeName(objectTypeName)) {
      return objectTypeName;
    }
    return;
  };
  var isObjectOfType = (type) => (value) => getObjectType(value) === type;
  function is(value) {
    if (value === null) {
      return "null";
    }
    switch (typeof value) {
      case "undefined":
        return "undefined";
      case "string":
        return "string";
      case "number":
        return "number";
      case "boolean":
        return "boolean";
      case "function":
        return "Function";
      case "bigint":
        return "bigint";
      case "symbol":
        return "symbol";
      default:
    }
    if (is.observable(value)) {
      return "Observable";
    }
    if (is.array(value)) {
      return "Array";
    }
    if (is.buffer(value)) {
      return "Buffer";
    }
    const tagType = getObjectType(value);
    if (tagType) {
      return tagType;
    }
    if (value instanceof String || value instanceof Boolean || value instanceof Number) {
      throw new TypeError("Please don't use object wrappers for primitive types");
    }
    return "Object";
  }
  is.undefined = isOfType("undefined");
  is.string = isOfType("string");
  var isNumberType = isOfType("number");
  is.number = (value) => isNumberType(value) && !is.nan(value);
  is.bigint = isOfType("bigint");
  is.function_ = isOfType("function");
  is.null_ = (value) => value === null;
  is.class_ = (value) => is.function_(value) && value.toString().startsWith("class ");
  is.boolean = (value) => value === true || value === false;
  is.symbol = isOfType("symbol");
  is.numericString = (value) => is.string(value) && !is.emptyStringOrWhitespace(value) && !Number.isNaN(Number(value));
  is.array = (value, assertion) => {
    if (!Array.isArray(value)) {
      return false;
    }
    if (!is.function_(assertion)) {
      return true;
    }
    return value.every(assertion);
  };
  is.buffer = (value) => {
    var _a, _b, _c, _d;
    return (_d = (_c = (_b = (_a = value) === null || _a === undefined ? undefined : _a.constructor) === null || _b === undefined ? undefined : _b.isBuffer) === null || _c === undefined ? undefined : _c.call(_b, value)) !== null && _d !== undefined ? _d : false;
  };
  is.blob = (value) => isObjectOfType("Blob")(value);
  is.nullOrUndefined = (value) => is.null_(value) || is.undefined(value);
  is.object = (value) => !is.null_(value) && (typeof value === "object" || is.function_(value));
  is.iterable = (value) => {
    var _a;
    return is.function_((_a = value) === null || _a === undefined ? undefined : _a[Symbol.iterator]);
  };
  is.asyncIterable = (value) => {
    var _a;
    return is.function_((_a = value) === null || _a === undefined ? undefined : _a[Symbol.asyncIterator]);
  };
  is.generator = (value) => {
    var _a, _b;
    return is.iterable(value) && is.function_((_a = value) === null || _a === undefined ? undefined : _a.next) && is.function_((_b = value) === null || _b === undefined ? undefined : _b.throw);
  };
  is.asyncGenerator = (value) => is.asyncIterable(value) && is.function_(value.next) && is.function_(value.throw);
  is.nativePromise = (value) => isObjectOfType("Promise")(value);
  var hasPromiseAPI = (value) => {
    var _a, _b;
    return is.function_((_a = value) === null || _a === undefined ? undefined : _a.then) && is.function_((_b = value) === null || _b === undefined ? undefined : _b.catch);
  };
  is.promise = (value) => is.nativePromise(value) || hasPromiseAPI(value);
  is.generatorFunction = isObjectOfType("GeneratorFunction");
  is.asyncGeneratorFunction = (value) => getObjectType(value) === "AsyncGeneratorFunction";
  is.asyncFunction = (value) => getObjectType(value) === "AsyncFunction";
  is.boundFunction = (value) => is.function_(value) && !value.hasOwnProperty("prototype");
  is.regExp = isObjectOfType("RegExp");
  is.date = isObjectOfType("Date");
  is.error = isObjectOfType("Error");
  is.map = (value) => isObjectOfType("Map")(value);
  is.set = (value) => isObjectOfType("Set")(value);
  is.weakMap = (value) => isObjectOfType("WeakMap")(value);
  is.weakSet = (value) => isObjectOfType("WeakSet")(value);
  is.int8Array = isObjectOfType("Int8Array");
  is.uint8Array = isObjectOfType("Uint8Array");
  is.uint8ClampedArray = isObjectOfType("Uint8ClampedArray");
  is.int16Array = isObjectOfType("Int16Array");
  is.uint16Array = isObjectOfType("Uint16Array");
  is.int32Array = isObjectOfType("Int32Array");
  is.uint32Array = isObjectOfType("Uint32Array");
  is.float32Array = isObjectOfType("Float32Array");
  is.float64Array = isObjectOfType("Float64Array");
  is.bigInt64Array = isObjectOfType("BigInt64Array");
  is.bigUint64Array = isObjectOfType("BigUint64Array");
  is.arrayBuffer = isObjectOfType("ArrayBuffer");
  is.sharedArrayBuffer = isObjectOfType("SharedArrayBuffer");
  is.dataView = isObjectOfType("DataView");
  is.enumCase = (value, targetEnum) => Object.values(targetEnum).includes(value);
  is.directInstanceOf = (instance, class_) => Object.getPrototypeOf(instance) === class_.prototype;
  is.urlInstance = (value) => isObjectOfType("URL")(value);
  is.urlString = (value) => {
    if (!is.string(value)) {
      return false;
    }
    try {
      new URL(value);
      return true;
    } catch (_a) {
      return false;
    }
  };
  is.truthy = (value) => Boolean(value);
  is.falsy = (value) => !value;
  is.nan = (value) => Number.isNaN(value);
  is.primitive = (value) => is.null_(value) || isPrimitiveTypeName(typeof value);
  is.integer = (value) => Number.isInteger(value);
  is.safeInteger = (value) => Number.isSafeInteger(value);
  is.plainObject = (value) => {
    if (toString.call(value) !== "[object Object]") {
      return false;
    }
    const prototype = Object.getPrototypeOf(value);
    return prototype === null || prototype === Object.getPrototypeOf({});
  };
  is.typedArray = (value) => isTypedArrayName(getObjectType(value));
  var isValidLength = (value) => is.safeInteger(value) && value >= 0;
  is.arrayLike = (value) => !is.nullOrUndefined(value) && !is.function_(value) && isValidLength(value.length);
  is.inRange = (value, range) => {
    if (is.number(range)) {
      return value >= Math.min(0, range) && value <= Math.max(range, 0);
    }
    if (is.array(range) && range.length === 2) {
      return value >= Math.min(...range) && value <= Math.max(...range);
    }
    throw new TypeError(`Invalid range: ${JSON.stringify(range)}`);
  };
  var NODE_TYPE_ELEMENT = 1;
  var DOM_PROPERTIES_TO_CHECK = [
    "innerHTML",
    "ownerDocument",
    "style",
    "attributes",
    "nodeValue"
  ];
  is.domElement = (value) => {
    return is.object(value) && value.nodeType === NODE_TYPE_ELEMENT && is.string(value.nodeName) && !is.plainObject(value) && DOM_PROPERTIES_TO_CHECK.every((property) => (property in value));
  };
  is.observable = (value) => {
    var _a, _b, _c, _d;
    if (!value) {
      return false;
    }
    if (value === ((_b = (_a = value)[Symbol.observable]) === null || _b === undefined ? undefined : _b.call(_a))) {
      return true;
    }
    if (value === ((_d = (_c = value)["@@observable"]) === null || _d === undefined ? undefined : _d.call(_c))) {
      return true;
    }
    return false;
  };
  is.nodeStream = (value) => is.object(value) && is.function_(value.pipe) && !is.observable(value);
  is.infinite = (value) => value === Infinity || value === -Infinity;
  var isAbsoluteMod2 = (remainder) => (value) => is.integer(value) && Math.abs(value % 2) === remainder;
  is.evenInteger = isAbsoluteMod2(0);
  is.oddInteger = isAbsoluteMod2(1);
  is.emptyArray = (value) => is.array(value) && value.length === 0;
  is.nonEmptyArray = (value) => is.array(value) && value.length > 0;
  is.emptyString = (value) => is.string(value) && value.length === 0;
  var isWhiteSpaceString = (value) => is.string(value) && !/\S/.test(value);
  is.emptyStringOrWhitespace = (value) => is.emptyString(value) || isWhiteSpaceString(value);
  is.nonEmptyString = (value) => is.string(value) && value.length > 0;
  is.nonEmptyStringAndNotWhitespace = (value) => is.string(value) && !is.emptyStringOrWhitespace(value);
  is.emptyObject = (value) => is.object(value) && !is.map(value) && !is.set(value) && Object.keys(value).length === 0;
  is.nonEmptyObject = (value) => is.object(value) && !is.map(value) && !is.set(value) && Object.keys(value).length > 0;
  is.emptySet = (value) => is.set(value) && value.size === 0;
  is.nonEmptySet = (value) => is.set(value) && value.size > 0;
  is.emptyMap = (value) => is.map(value) && value.size === 0;
  is.nonEmptyMap = (value) => is.map(value) && value.size > 0;
  is.propertyKey = (value) => is.any([is.string, is.number, is.symbol], value);
  is.formData = (value) => isObjectOfType("FormData")(value);
  is.urlSearchParams = (value) => isObjectOfType("URLSearchParams")(value);
  var predicateOnArray = (method, predicate, values) => {
    if (!is.function_(predicate)) {
      throw new TypeError(`Invalid predicate: ${JSON.stringify(predicate)}`);
    }
    if (values.length === 0) {
      throw new TypeError("Invalid number of values");
    }
    return method.call(values, predicate);
  };
  is.any = (predicate, ...values) => {
    const predicates = is.array(predicate) ? predicate : [predicate];
    return predicates.some((singlePredicate) => predicateOnArray(Array.prototype.some, singlePredicate, values));
  };
  is.all = (predicate, ...values) => predicateOnArray(Array.prototype.every, predicate, values);
  var assertType = (condition, description, value, options = {}) => {
    if (!condition) {
      const { multipleValues } = options;
      const valuesMessage = multipleValues ? `received values of types ${[
        ...new Set(value.map((singleValue) => `\`${is(singleValue)}\``))
      ].join(", ")}` : `received value of type \`${is(value)}\``;
      throw new TypeError(`Expected value which is \`${description}\`, ${valuesMessage}.`);
    }
  };
  exports2.assert = {
    undefined: (value) => assertType(is.undefined(value), "undefined", value),
    string: (value) => assertType(is.string(value), "string", value),
    number: (value) => assertType(is.number(value), "number", value),
    bigint: (value) => assertType(is.bigint(value), "bigint", value),
    function_: (value) => assertType(is.function_(value), "Function", value),
    null_: (value) => assertType(is.null_(value), "null", value),
    class_: (value) => assertType(is.class_(value), "Class", value),
    boolean: (value) => assertType(is.boolean(value), "boolean", value),
    symbol: (value) => assertType(is.symbol(value), "symbol", value),
    numericString: (value) => assertType(is.numericString(value), "string with a number", value),
    array: (value, assertion) => {
      const assert = assertType;
      assert(is.array(value), "Array", value);
      if (assertion) {
        value.forEach(assertion);
      }
    },
    buffer: (value) => assertType(is.buffer(value), "Buffer", value),
    blob: (value) => assertType(is.blob(value), "Blob", value),
    nullOrUndefined: (value) => assertType(is.nullOrUndefined(value), "null or undefined", value),
    object: (value) => assertType(is.object(value), "Object", value),
    iterable: (value) => assertType(is.iterable(value), "Iterable", value),
    asyncIterable: (value) => assertType(is.asyncIterable(value), "AsyncIterable", value),
    generator: (value) => assertType(is.generator(value), "Generator", value),
    asyncGenerator: (value) => assertType(is.asyncGenerator(value), "AsyncGenerator", value),
    nativePromise: (value) => assertType(is.nativePromise(value), "native Promise", value),
    promise: (value) => assertType(is.promise(value), "Promise", value),
    generatorFunction: (value) => assertType(is.generatorFunction(value), "GeneratorFunction", value),
    asyncGeneratorFunction: (value) => assertType(is.asyncGeneratorFunction(value), "AsyncGeneratorFunction", value),
    asyncFunction: (value) => assertType(is.asyncFunction(value), "AsyncFunction", value),
    boundFunction: (value) => assertType(is.boundFunction(value), "Function", value),
    regExp: (value) => assertType(is.regExp(value), "RegExp", value),
    date: (value) => assertType(is.date(value), "Date", value),
    error: (value) => assertType(is.error(value), "Error", value),
    map: (value) => assertType(is.map(value), "Map", value),
    set: (value) => assertType(is.set(value), "Set", value),
    weakMap: (value) => assertType(is.weakMap(value), "WeakMap", value),
    weakSet: (value) => assertType(is.weakSet(value), "WeakSet", value),
    int8Array: (value) => assertType(is.int8Array(value), "Int8Array", value),
    uint8Array: (value) => assertType(is.uint8Array(value), "Uint8Array", value),
    uint8ClampedArray: (value) => assertType(is.uint8ClampedArray(value), "Uint8ClampedArray", value),
    int16Array: (value) => assertType(is.int16Array(value), "Int16Array", value),
    uint16Array: (value) => assertType(is.uint16Array(value), "Uint16Array", value),
    int32Array: (value) => assertType(is.int32Array(value), "Int32Array", value),
    uint32Array: (value) => assertType(is.uint32Array(value), "Uint32Array", value),
    float32Array: (value) => assertType(is.float32Array(value), "Float32Array", value),
    float64Array: (value) => assertType(is.float64Array(value), "Float64Array", value),
    bigInt64Array: (value) => assertType(is.bigInt64Array(value), "BigInt64Array", value),
    bigUint64Array: (value) => assertType(is.bigUint64Array(value), "BigUint64Array", value),
    arrayBuffer: (value) => assertType(is.arrayBuffer(value), "ArrayBuffer", value),
    sharedArrayBuffer: (value) => assertType(is.sharedArrayBuffer(value), "SharedArrayBuffer", value),
    dataView: (value) => assertType(is.dataView(value), "DataView", value),
    enumCase: (value, targetEnum) => assertType(is.enumCase(value, targetEnum), "EnumCase", value),
    urlInstance: (value) => assertType(is.urlInstance(value), "URL", value),
    urlString: (value) => assertType(is.urlString(value), "string with a URL", value),
    truthy: (value) => assertType(is.truthy(value), "truthy", value),
    falsy: (value) => assertType(is.falsy(value), "falsy", value),
    nan: (value) => assertType(is.nan(value), "NaN", value),
    primitive: (value) => assertType(is.primitive(value), "primitive", value),
    integer: (value) => assertType(is.integer(value), "integer", value),
    safeInteger: (value) => assertType(is.safeInteger(value), "integer", value),
    plainObject: (value) => assertType(is.plainObject(value), "plain object", value),
    typedArray: (value) => assertType(is.typedArray(value), "TypedArray", value),
    arrayLike: (value) => assertType(is.arrayLike(value), "array-like", value),
    domElement: (value) => assertType(is.domElement(value), "HTMLElement", value),
    observable: (value) => assertType(is.observable(value), "Observable", value),
    nodeStream: (value) => assertType(is.nodeStream(value), "Node.js Stream", value),
    infinite: (value) => assertType(is.infinite(value), "infinite number", value),
    emptyArray: (value) => assertType(is.emptyArray(value), "empty array", value),
    nonEmptyArray: (value) => assertType(is.nonEmptyArray(value), "non-empty array", value),
    emptyString: (value) => assertType(is.emptyString(value), "empty string", value),
    emptyStringOrWhitespace: (value) => assertType(is.emptyStringOrWhitespace(value), "empty string or whitespace", value),
    nonEmptyString: (value) => assertType(is.nonEmptyString(value), "non-empty string", value),
    nonEmptyStringAndNotWhitespace: (value) => assertType(is.nonEmptyStringAndNotWhitespace(value), "non-empty string and not whitespace", value),
    emptyObject: (value) => assertType(is.emptyObject(value), "empty object", value),
    nonEmptyObject: (value) => assertType(is.nonEmptyObject(value), "non-empty object", value),
    emptySet: (value) => assertType(is.emptySet(value), "empty set", value),
    nonEmptySet: (value) => assertType(is.nonEmptySet(value), "non-empty set", value),
    emptyMap: (value) => assertType(is.emptyMap(value), "empty map", value),
    nonEmptyMap: (value) => assertType(is.nonEmptyMap(value), "non-empty map", value),
    propertyKey: (value) => assertType(is.propertyKey(value), "PropertyKey", value),
    formData: (value) => assertType(is.formData(value), "FormData", value),
    urlSearchParams: (value) => assertType(is.urlSearchParams(value), "URLSearchParams", value),
    evenInteger: (value) => assertType(is.evenInteger(value), "even integer", value),
    oddInteger: (value) => assertType(is.oddInteger(value), "odd integer", value),
    directInstanceOf: (instance, class_) => assertType(is.directInstanceOf(instance, class_), "T", instance),
    inRange: (value, range) => assertType(is.inRange(value, range), "in range", value),
    any: (predicate, ...values) => {
      return assertType(is.any(predicate, ...values), "predicate returns truthy for any value", values, { multipleValues: true });
    },
    all: (predicate, ...values) => assertType(is.all(predicate, ...values), "predicate returns truthy for all values", values, { multipleValues: true })
  };
  Object.defineProperties(is, {
    class: {
      value: is.class_
    },
    function: {
      value: is.function_
    },
    null: {
      value: is.null_
    }
  });
  Object.defineProperties(exports2.assert, {
    class: {
      value: exports2.assert.class_
    },
    function: {
      value: exports2.assert.function_
    },
    null: {
      value: exports2.assert.null_
    }
  });
  exports2.default = is;
  module2.exports = is;
  module2.exports.default = is;
  module2.exports.assert = exports2.assert;
});

// node_modules/emojilib/emojis.json
var require_emojis = __commonJS(function(exports2, module2) {
  module2.exports = {
    grinning: {
      keywords: ["face", "smile", "happy", "joy", ":D", "grin"],
      char: "😀",
      fitzpatrick_scale: false,
      category: "people"
    },
    grimacing: {
      keywords: ["face", "grimace", "teeth"],
      char: "😬",
      fitzpatrick_scale: false,
      category: "people"
    },
    grin: {
      keywords: ["face", "happy", "smile", "joy", "kawaii"],
      char: "😁",
      fitzpatrick_scale: false,
      category: "people"
    },
    joy: {
      keywords: ["face", "cry", "tears", "weep", "happy", "happytears", "haha"],
      char: "😂",
      fitzpatrick_scale: false,
      category: "people"
    },
    rofl: {
      keywords: ["face", "rolling", "floor", "laughing", "lol", "haha"],
      char: "🤣",
      fitzpatrick_scale: false,
      category: "people"
    },
    partying: {
      keywords: ["face", "celebration", "woohoo"],
      char: "🥳",
      fitzpatrick_scale: false,
      category: "people"
    },
    smiley: {
      keywords: ["face", "happy", "joy", "haha", ":D", ":)", "smile", "funny"],
      char: "😃",
      fitzpatrick_scale: false,
      category: "people"
    },
    smile: {
      keywords: ["face", "happy", "joy", "funny", "haha", "laugh", "like", ":D", ":)"],
      char: "😄",
      fitzpatrick_scale: false,
      category: "people"
    },
    sweat_smile: {
      keywords: ["face", "hot", "happy", "laugh", "sweat", "smile", "relief"],
      char: "😅",
      fitzpatrick_scale: false,
      category: "people"
    },
    laughing: {
      keywords: ["happy", "joy", "lol", "satisfied", "haha", "face", "glad", "XD", "laugh"],
      char: "😆",
      fitzpatrick_scale: false,
      category: "people"
    },
    innocent: {
      keywords: ["face", "angel", "heaven", "halo"],
      char: "😇",
      fitzpatrick_scale: false,
      category: "people"
    },
    wink: {
      keywords: ["face", "happy", "mischievous", "secret", ";)", "smile", "eye"],
      char: "😉",
      fitzpatrick_scale: false,
      category: "people"
    },
    blush: {
      keywords: ["face", "smile", "happy", "flushed", "crush", "embarrassed", "shy", "joy"],
      char: "😊",
      fitzpatrick_scale: false,
      category: "people"
    },
    slightly_smiling_face: {
      keywords: ["face", "smile"],
      char: "🙂",
      fitzpatrick_scale: false,
      category: "people"
    },
    upside_down_face: {
      keywords: ["face", "flipped", "silly", "smile"],
      char: "🙃",
      fitzpatrick_scale: false,
      category: "people"
    },
    relaxed: {
      keywords: ["face", "blush", "massage", "happiness"],
      char: "☺️",
      fitzpatrick_scale: false,
      category: "people"
    },
    yum: {
      keywords: ["happy", "joy", "tongue", "smile", "face", "silly", "yummy", "nom", "delicious", "savouring"],
      char: "😋",
      fitzpatrick_scale: false,
      category: "people"
    },
    relieved: {
      keywords: ["face", "relaxed", "phew", "massage", "happiness"],
      char: "😌",
      fitzpatrick_scale: false,
      category: "people"
    },
    heart_eyes: {
      keywords: ["face", "love", "like", "affection", "valentines", "infatuation", "crush", "heart"],
      char: "😍",
      fitzpatrick_scale: false,
      category: "people"
    },
    smiling_face_with_three_hearts: {
      keywords: ["face", "love", "like", "affection", "valentines", "infatuation", "crush", "hearts", "adore"],
      char: "🥰",
      fitzpatrick_scale: false,
      category: "people"
    },
    kissing_heart: {
      keywords: ["face", "love", "like", "affection", "valentines", "infatuation", "kiss"],
      char: "😘",
      fitzpatrick_scale: false,
      category: "people"
    },
    kissing: {
      keywords: ["love", "like", "face", "3", "valentines", "infatuation", "kiss"],
      char: "😗",
      fitzpatrick_scale: false,
      category: "people"
    },
    kissing_smiling_eyes: {
      keywords: ["face", "affection", "valentines", "infatuation", "kiss"],
      char: "😙",
      fitzpatrick_scale: false,
      category: "people"
    },
    kissing_closed_eyes: {
      keywords: ["face", "love", "like", "affection", "valentines", "infatuation", "kiss"],
      char: "😚",
      fitzpatrick_scale: false,
      category: "people"
    },
    stuck_out_tongue_winking_eye: {
      keywords: ["face", "prank", "childish", "playful", "mischievous", "smile", "wink", "tongue"],
      char: "😜",
      fitzpatrick_scale: false,
      category: "people"
    },
    zany: {
      keywords: ["face", "goofy", "crazy"],
      char: "🤪",
      fitzpatrick_scale: false,
      category: "people"
    },
    raised_eyebrow: {
      keywords: ["face", "distrust", "scepticism", "disapproval", "disbelief", "surprise"],
      char: "🤨",
      fitzpatrick_scale: false,
      category: "people"
    },
    monocle: {
      keywords: ["face", "stuffy", "wealthy"],
      char: "🧐",
      fitzpatrick_scale: false,
      category: "people"
    },
    stuck_out_tongue_closed_eyes: {
      keywords: ["face", "prank", "playful", "mischievous", "smile", "tongue"],
      char: "😝",
      fitzpatrick_scale: false,
      category: "people"
    },
    stuck_out_tongue: {
      keywords: ["face", "prank", "childish", "playful", "mischievous", "smile", "tongue"],
      char: "😛",
      fitzpatrick_scale: false,
      category: "people"
    },
    money_mouth_face: {
      keywords: ["face", "rich", "dollar", "money"],
      char: "🤑",
      fitzpatrick_scale: false,
      category: "people"
    },
    nerd_face: {
      keywords: ["face", "nerdy", "geek", "dork"],
      char: "🤓",
      fitzpatrick_scale: false,
      category: "people"
    },
    sunglasses: {
      keywords: ["face", "cool", "smile", "summer", "beach", "sunglass"],
      char: "😎",
      fitzpatrick_scale: false,
      category: "people"
    },
    star_struck: {
      keywords: ["face", "smile", "starry", "eyes", "grinning"],
      char: "🤩",
      fitzpatrick_scale: false,
      category: "people"
    },
    clown_face: {
      keywords: ["face"],
      char: "🤡",
      fitzpatrick_scale: false,
      category: "people"
    },
    cowboy_hat_face: {
      keywords: ["face", "cowgirl", "hat"],
      char: "🤠",
      fitzpatrick_scale: false,
      category: "people"
    },
    hugs: {
      keywords: ["face", "smile", "hug"],
      char: "🤗",
      fitzpatrick_scale: false,
      category: "people"
    },
    smirk: {
      keywords: ["face", "smile", "mean", "prank", "smug", "sarcasm"],
      char: "😏",
      fitzpatrick_scale: false,
      category: "people"
    },
    no_mouth: {
      keywords: ["face", "hellokitty"],
      char: "😶",
      fitzpatrick_scale: false,
      category: "people"
    },
    neutral_face: {
      keywords: ["indifference", "meh", ":|", "neutral"],
      char: "😐",
      fitzpatrick_scale: false,
      category: "people"
    },
    expressionless: {
      keywords: ["face", "indifferent", "-_-", "meh", "deadpan"],
      char: "😑",
      fitzpatrick_scale: false,
      category: "people"
    },
    unamused: {
      keywords: ["indifference", "bored", "straight face", "serious", "sarcasm", "unimpressed", "skeptical", "dubious", "side_eye"],
      char: "😒",
      fitzpatrick_scale: false,
      category: "people"
    },
    roll_eyes: {
      keywords: ["face", "eyeroll", "frustrated"],
      char: "🙄",
      fitzpatrick_scale: false,
      category: "people"
    },
    thinking: {
      keywords: ["face", "hmmm", "think", "consider"],
      char: "🤔",
      fitzpatrick_scale: false,
      category: "people"
    },
    lying_face: {
      keywords: ["face", "lie", "pinocchio"],
      char: "🤥",
      fitzpatrick_scale: false,
      category: "people"
    },
    hand_over_mouth: {
      keywords: ["face", "whoops", "shock", "surprise"],
      char: "🤭",
      fitzpatrick_scale: false,
      category: "people"
    },
    shushing: {
      keywords: ["face", "quiet", "shhh"],
      char: "🤫",
      fitzpatrick_scale: false,
      category: "people"
    },
    symbols_over_mouth: {
      keywords: ["face", "swearing", "cursing", "cussing", "profanity", "expletive"],
      char: "🤬",
      fitzpatrick_scale: false,
      category: "people"
    },
    exploding_head: {
      keywords: ["face", "shocked", "mind", "blown"],
      char: "🤯",
      fitzpatrick_scale: false,
      category: "people"
    },
    flushed: {
      keywords: ["face", "blush", "shy", "flattered"],
      char: "😳",
      fitzpatrick_scale: false,
      category: "people"
    },
    disappointed: {
      keywords: ["face", "sad", "upset", "depressed", ":("],
      char: "😞",
      fitzpatrick_scale: false,
      category: "people"
    },
    worried: {
      keywords: ["face", "concern", "nervous", ":("],
      char: "😟",
      fitzpatrick_scale: false,
      category: "people"
    },
    angry: {
      keywords: ["mad", "face", "annoyed", "frustrated"],
      char: "😠",
      fitzpatrick_scale: false,
      category: "people"
    },
    rage: {
      keywords: ["angry", "mad", "hate", "despise"],
      char: "😡",
      fitzpatrick_scale: false,
      category: "people"
    },
    pensive: {
      keywords: ["face", "sad", "depressed", "upset"],
      char: "😔",
      fitzpatrick_scale: false,
      category: "people"
    },
    confused: {
      keywords: ["face", "indifference", "huh", "weird", "hmmm", ":/"],
      char: "😕",
      fitzpatrick_scale: false,
      category: "people"
    },
    slightly_frowning_face: {
      keywords: ["face", "frowning", "disappointed", "sad", "upset"],
      char: "🙁",
      fitzpatrick_scale: false,
      category: "people"
    },
    frowning_face: {
      keywords: ["face", "sad", "upset", "frown"],
      char: "☹",
      fitzpatrick_scale: false,
      category: "people"
    },
    persevere: {
      keywords: ["face", "sick", "no", "upset", "oops"],
      char: "😣",
      fitzpatrick_scale: false,
      category: "people"
    },
    confounded: {
      keywords: ["face", "confused", "sick", "unwell", "oops", ":S"],
      char: "😖",
      fitzpatrick_scale: false,
      category: "people"
    },
    tired_face: {
      keywords: ["sick", "whine", "upset", "frustrated"],
      char: "😫",
      fitzpatrick_scale: false,
      category: "people"
    },
    weary: {
      keywords: ["face", "tired", "sleepy", "sad", "frustrated", "upset"],
      char: "😩",
      fitzpatrick_scale: false,
      category: "people"
    },
    pleading: {
      keywords: ["face", "begging", "mercy"],
      char: "🥺",
      fitzpatrick_scale: false,
      category: "people"
    },
    triumph: {
      keywords: ["face", "gas", "phew", "proud", "pride"],
      char: "😤",
      fitzpatrick_scale: false,
      category: "people"
    },
    open_mouth: {
      keywords: ["face", "surprise", "impressed", "wow", "whoa", ":O"],
      char: "😮",
      fitzpatrick_scale: false,
      category: "people"
    },
    scream: {
      keywords: ["face", "munch", "scared", "omg"],
      char: "😱",
      fitzpatrick_scale: false,
      category: "people"
    },
    fearful: {
      keywords: ["face", "scared", "terrified", "nervous", "oops", "huh"],
      char: "😨",
      fitzpatrick_scale: false,
      category: "people"
    },
    cold_sweat: {
      keywords: ["face", "nervous", "sweat"],
      char: "😰",
      fitzpatrick_scale: false,
      category: "people"
    },
    hushed: {
      keywords: ["face", "woo", "shh"],
      char: "😯",
      fitzpatrick_scale: false,
      category: "people"
    },
    frowning: {
      keywords: ["face", "aw", "what"],
      char: "😦",
      fitzpatrick_scale: false,
      category: "people"
    },
    anguished: {
      keywords: ["face", "stunned", "nervous"],
      char: "😧",
      fitzpatrick_scale: false,
      category: "people"
    },
    cry: {
      keywords: ["face", "tears", "sad", "depressed", "upset", ":'("],
      char: "😢",
      fitzpatrick_scale: false,
      category: "people"
    },
    disappointed_relieved: {
      keywords: ["face", "phew", "sweat", "nervous"],
      char: "😥",
      fitzpatrick_scale: false,
      category: "people"
    },
    drooling_face: {
      keywords: ["face"],
      char: "🤤",
      fitzpatrick_scale: false,
      category: "people"
    },
    sleepy: {
      keywords: ["face", "tired", "rest", "nap"],
      char: "😪",
      fitzpatrick_scale: false,
      category: "people"
    },
    sweat: {
      keywords: ["face", "hot", "sad", "tired", "exercise"],
      char: "😓",
      fitzpatrick_scale: false,
      category: "people"
    },
    hot: {
      keywords: ["face", "feverish", "heat", "red", "sweating"],
      char: "🥵",
      fitzpatrick_scale: false,
      category: "people"
    },
    cold: {
      keywords: ["face", "blue", "freezing", "frozen", "frostbite", "icicles"],
      char: "🥶",
      fitzpatrick_scale: false,
      category: "people"
    },
    sob: {
      keywords: ["face", "cry", "tears", "sad", "upset", "depressed"],
      char: "😭",
      fitzpatrick_scale: false,
      category: "people"
    },
    dizzy_face: {
      keywords: ["spent", "unconscious", "xox", "dizzy"],
      char: "😵",
      fitzpatrick_scale: false,
      category: "people"
    },
    astonished: {
      keywords: ["face", "xox", "surprised", "poisoned"],
      char: "😲",
      fitzpatrick_scale: false,
      category: "people"
    },
    zipper_mouth_face: {
      keywords: ["face", "sealed", "zipper", "secret"],
      char: "🤐",
      fitzpatrick_scale: false,
      category: "people"
    },
    nauseated_face: {
      keywords: ["face", "vomit", "gross", "green", "sick", "throw up", "ill"],
      char: "🤢",
      fitzpatrick_scale: false,
      category: "people"
    },
    sneezing_face: {
      keywords: ["face", "gesundheit", "sneeze", "sick", "allergy"],
      char: "🤧",
      fitzpatrick_scale: false,
      category: "people"
    },
    vomiting: {
      keywords: ["face", "sick"],
      char: "🤮",
      fitzpatrick_scale: false,
      category: "people"
    },
    mask: {
      keywords: ["face", "sick", "ill", "disease"],
      char: "😷",
      fitzpatrick_scale: false,
      category: "people"
    },
    face_with_thermometer: {
      keywords: ["sick", "temperature", "thermometer", "cold", "fever"],
      char: "🤒",
      fitzpatrick_scale: false,
      category: "people"
    },
    face_with_head_bandage: {
      keywords: ["injured", "clumsy", "bandage", "hurt"],
      char: "🤕",
      fitzpatrick_scale: false,
      category: "people"
    },
    woozy: {
      keywords: ["face", "dizzy", "intoxicated", "tipsy", "wavy"],
      char: "🥴",
      fitzpatrick_scale: false,
      category: "people"
    },
    sleeping: {
      keywords: ["face", "tired", "sleepy", "night", "zzz"],
      char: "😴",
      fitzpatrick_scale: false,
      category: "people"
    },
    zzz: {
      keywords: ["sleepy", "tired", "dream"],
      char: "💤",
      fitzpatrick_scale: false,
      category: "people"
    },
    poop: {
      keywords: ["hankey", "shitface", "fail", "turd", "shit"],
      char: "💩",
      fitzpatrick_scale: false,
      category: "people"
    },
    smiling_imp: {
      keywords: ["devil", "horns"],
      char: "😈",
      fitzpatrick_scale: false,
      category: "people"
    },
    imp: {
      keywords: ["devil", "angry", "horns"],
      char: "👿",
      fitzpatrick_scale: false,
      category: "people"
    },
    japanese_ogre: {
      keywords: ["monster", "red", "mask", "halloween", "scary", "creepy", "devil", "demon", "japanese", "ogre"],
      char: "👹",
      fitzpatrick_scale: false,
      category: "people"
    },
    japanese_goblin: {
      keywords: ["red", "evil", "mask", "monster", "scary", "creepy", "japanese", "goblin"],
      char: "👺",
      fitzpatrick_scale: false,
      category: "people"
    },
    skull: {
      keywords: ["dead", "skeleton", "creepy", "death"],
      char: "💀",
      fitzpatrick_scale: false,
      category: "people"
    },
    ghost: {
      keywords: ["halloween", "spooky", "scary"],
      char: "👻",
      fitzpatrick_scale: false,
      category: "people"
    },
    alien: {
      keywords: ["UFO", "paul", "weird", "outer_space"],
      char: "👽",
      fitzpatrick_scale: false,
      category: "people"
    },
    robot: {
      keywords: ["computer", "machine", "bot"],
      char: "🤖",
      fitzpatrick_scale: false,
      category: "people"
    },
    smiley_cat: {
      keywords: ["animal", "cats", "happy", "smile"],
      char: "😺",
      fitzpatrick_scale: false,
      category: "people"
    },
    smile_cat: {
      keywords: ["animal", "cats", "smile"],
      char: "😸",
      fitzpatrick_scale: false,
      category: "people"
    },
    joy_cat: {
      keywords: ["animal", "cats", "haha", "happy", "tears"],
      char: "😹",
      fitzpatrick_scale: false,
      category: "people"
    },
    heart_eyes_cat: {
      keywords: ["animal", "love", "like", "affection", "cats", "valentines", "heart"],
      char: "😻",
      fitzpatrick_scale: false,
      category: "people"
    },
    smirk_cat: {
      keywords: ["animal", "cats", "smirk"],
      char: "😼",
      fitzpatrick_scale: false,
      category: "people"
    },
    kissing_cat: {
      keywords: ["animal", "cats", "kiss"],
      char: "😽",
      fitzpatrick_scale: false,
      category: "people"
    },
    scream_cat: {
      keywords: ["animal", "cats", "munch", "scared", "scream"],
      char: "🙀",
      fitzpatrick_scale: false,
      category: "people"
    },
    crying_cat_face: {
      keywords: ["animal", "tears", "weep", "sad", "cats", "upset", "cry"],
      char: "😿",
      fitzpatrick_scale: false,
      category: "people"
    },
    pouting_cat: {
      keywords: ["animal", "cats"],
      char: "😾",
      fitzpatrick_scale: false,
      category: "people"
    },
    palms_up: {
      keywords: ["hands", "gesture", "cupped", "prayer"],
      char: "🤲",
      fitzpatrick_scale: true,
      category: "people"
    },
    raised_hands: {
      keywords: ["gesture", "hooray", "yea", "celebration", "hands"],
      char: "🙌",
      fitzpatrick_scale: true,
      category: "people"
    },
    clap: {
      keywords: ["hands", "praise", "applause", "congrats", "yay"],
      char: "👏",
      fitzpatrick_scale: true,
      category: "people"
    },
    wave: {
      keywords: ["hands", "gesture", "goodbye", "solong", "farewell", "hello", "hi", "palm"],
      char: "👋",
      fitzpatrick_scale: true,
      category: "people"
    },
    call_me_hand: {
      keywords: ["hands", "gesture"],
      char: "🤙",
      fitzpatrick_scale: true,
      category: "people"
    },
    "+1": {
      keywords: ["thumbsup", "yes", "awesome", "good", "agree", "accept", "cool", "hand", "like"],
      char: "👍",
      fitzpatrick_scale: true,
      category: "people"
    },
    "-1": {
      keywords: ["thumbsdown", "no", "dislike", "hand"],
      char: "👎",
      fitzpatrick_scale: true,
      category: "people"
    },
    facepunch: {
      keywords: ["angry", "violence", "fist", "hit", "attack", "hand"],
      char: "👊",
      fitzpatrick_scale: true,
      category: "people"
    },
    fist: {
      keywords: ["fingers", "hand", "grasp"],
      char: "✊",
      fitzpatrick_scale: true,
      category: "people"
    },
    fist_left: {
      keywords: ["hand", "fistbump"],
      char: "🤛",
      fitzpatrick_scale: true,
      category: "people"
    },
    fist_right: {
      keywords: ["hand", "fistbump"],
      char: "🤜",
      fitzpatrick_scale: true,
      category: "people"
    },
    v: {
      keywords: ["fingers", "ohyeah", "hand", "peace", "victory", "two"],
      char: "✌",
      fitzpatrick_scale: true,
      category: "people"
    },
    ok_hand: {
      keywords: ["fingers", "limbs", "perfect", "ok", "okay"],
      char: "👌",
      fitzpatrick_scale: true,
      category: "people"
    },
    raised_hand: {
      keywords: ["fingers", "stop", "highfive", "palm", "ban"],
      char: "✋",
      fitzpatrick_scale: true,
      category: "people"
    },
    raised_back_of_hand: {
      keywords: ["fingers", "raised", "backhand"],
      char: "🤚",
      fitzpatrick_scale: true,
      category: "people"
    },
    open_hands: {
      keywords: ["fingers", "butterfly", "hands", "open"],
      char: "👐",
      fitzpatrick_scale: true,
      category: "people"
    },
    muscle: {
      keywords: ["arm", "flex", "hand", "summer", "strong", "biceps"],
      char: "💪",
      fitzpatrick_scale: true,
      category: "people"
    },
    pray: {
      keywords: ["please", "hope", "wish", "namaste", "highfive"],
      char: "🙏",
      fitzpatrick_scale: true,
      category: "people"
    },
    foot: {
      keywords: ["kick", "stomp"],
      char: "🦶",
      fitzpatrick_scale: true,
      category: "people"
    },
    leg: {
      keywords: ["kick", "limb"],
      char: "🦵",
      fitzpatrick_scale: true,
      category: "people"
    },
    handshake: {
      keywords: ["agreement", "shake"],
      char: "🤝",
      fitzpatrick_scale: false,
      category: "people"
    },
    point_up: {
      keywords: ["hand", "fingers", "direction", "up"],
      char: "☝",
      fitzpatrick_scale: true,
      category: "people"
    },
    point_up_2: {
      keywords: ["fingers", "hand", "direction", "up"],
      char: "👆",
      fitzpatrick_scale: true,
      category: "people"
    },
    point_down: {
      keywords: ["fingers", "hand", "direction", "down"],
      char: "👇",
      fitzpatrick_scale: true,
      category: "people"
    },
    point_left: {
      keywords: ["direction", "fingers", "hand", "left"],
      char: "👈",
      fitzpatrick_scale: true,
      category: "people"
    },
    point_right: {
      keywords: ["fingers", "hand", "direction", "right"],
      char: "👉",
      fitzpatrick_scale: true,
      category: "people"
    },
    fu: {
      keywords: ["hand", "fingers", "rude", "middle", "flipping"],
      char: "🖕",
      fitzpatrick_scale: true,
      category: "people"
    },
    raised_hand_with_fingers_splayed: {
      keywords: ["hand", "fingers", "palm"],
      char: "🖐",
      fitzpatrick_scale: true,
      category: "people"
    },
    love_you: {
      keywords: ["hand", "fingers", "gesture"],
      char: "🤟",
      fitzpatrick_scale: true,
      category: "people"
    },
    metal: {
      keywords: ["hand", "fingers", "evil_eye", "sign_of_horns", "rock_on"],
      char: "🤘",
      fitzpatrick_scale: true,
      category: "people"
    },
    crossed_fingers: {
      keywords: ["good", "lucky"],
      char: "🤞",
      fitzpatrick_scale: true,
      category: "people"
    },
    vulcan_salute: {
      keywords: ["hand", "fingers", "spock", "star trek"],
      char: "🖖",
      fitzpatrick_scale: true,
      category: "people"
    },
    writing_hand: {
      keywords: ["lower_left_ballpoint_pen", "stationery", "write", "compose"],
      char: "✍",
      fitzpatrick_scale: true,
      category: "people"
    },
    selfie: {
      keywords: ["camera", "phone"],
      char: "🤳",
      fitzpatrick_scale: true,
      category: "people"
    },
    nail_care: {
      keywords: ["beauty", "manicure", "finger", "fashion", "nail"],
      char: "💅",
      fitzpatrick_scale: true,
      category: "people"
    },
    lips: {
      keywords: ["mouth", "kiss"],
      char: "👄",
      fitzpatrick_scale: false,
      category: "people"
    },
    tooth: {
      keywords: ["teeth", "dentist"],
      char: "🦷",
      fitzpatrick_scale: false,
      category: "people"
    },
    tongue: {
      keywords: ["mouth", "playful"],
      char: "👅",
      fitzpatrick_scale: false,
      category: "people"
    },
    ear: {
      keywords: ["face", "hear", "sound", "listen"],
      char: "👂",
      fitzpatrick_scale: true,
      category: "people"
    },
    nose: {
      keywords: ["smell", "sniff"],
      char: "👃",
      fitzpatrick_scale: true,
      category: "people"
    },
    eye: {
      keywords: ["face", "look", "see", "watch", "stare"],
      char: "👁",
      fitzpatrick_scale: false,
      category: "people"
    },
    eyes: {
      keywords: ["look", "watch", "stalk", "peek", "see"],
      char: "👀",
      fitzpatrick_scale: false,
      category: "people"
    },
    brain: {
      keywords: ["smart", "intelligent"],
      char: "🧠",
      fitzpatrick_scale: false,
      category: "people"
    },
    bust_in_silhouette: {
      keywords: ["user", "person", "human"],
      char: "👤",
      fitzpatrick_scale: false,
      category: "people"
    },
    busts_in_silhouette: {
      keywords: ["user", "person", "human", "group", "team"],
      char: "👥",
      fitzpatrick_scale: false,
      category: "people"
    },
    speaking_head: {
      keywords: ["user", "person", "human", "sing", "say", "talk"],
      char: "🗣",
      fitzpatrick_scale: false,
      category: "people"
    },
    baby: {
      keywords: ["child", "boy", "girl", "toddler"],
      char: "👶",
      fitzpatrick_scale: true,
      category: "people"
    },
    child: {
      keywords: ["gender-neutral", "young"],
      char: "🧒",
      fitzpatrick_scale: true,
      category: "people"
    },
    boy: {
      keywords: ["man", "male", "guy", "teenager"],
      char: "👦",
      fitzpatrick_scale: true,
      category: "people"
    },
    girl: {
      keywords: ["female", "woman", "teenager"],
      char: "👧",
      fitzpatrick_scale: true,
      category: "people"
    },
    adult: {
      keywords: ["gender-neutral", "person"],
      char: "🧑",
      fitzpatrick_scale: true,
      category: "people"
    },
    man: {
      keywords: ["mustache", "father", "dad", "guy", "classy", "sir", "moustache"],
      char: "👨",
      fitzpatrick_scale: true,
      category: "people"
    },
    woman: {
      keywords: ["female", "girls", "lady"],
      char: "👩",
      fitzpatrick_scale: true,
      category: "people"
    },
    blonde_woman: {
      keywords: ["woman", "female", "girl", "blonde", "person"],
      char: "👱‍♀️",
      fitzpatrick_scale: true,
      category: "people"
    },
    blonde_man: {
      keywords: ["man", "male", "boy", "blonde", "guy", "person"],
      char: "👱",
      fitzpatrick_scale: true,
      category: "people"
    },
    bearded_person: {
      keywords: ["person", "bewhiskered"],
      char: "🧔",
      fitzpatrick_scale: true,
      category: "people"
    },
    older_adult: {
      keywords: ["human", "elder", "senior", "gender-neutral"],
      char: "🧓",
      fitzpatrick_scale: true,
      category: "people"
    },
    older_man: {
      keywords: ["human", "male", "men", "old", "elder", "senior"],
      char: "👴",
      fitzpatrick_scale: true,
      category: "people"
    },
    older_woman: {
      keywords: ["human", "female", "women", "lady", "old", "elder", "senior"],
      char: "👵",
      fitzpatrick_scale: true,
      category: "people"
    },
    man_with_gua_pi_mao: {
      keywords: ["male", "boy", "chinese"],
      char: "👲",
      fitzpatrick_scale: true,
      category: "people"
    },
    woman_with_headscarf: {
      keywords: ["female", "hijab", "mantilla", "tichel"],
      char: "🧕",
      fitzpatrick_scale: true,
      category: "people"
    },
    woman_with_turban: {
      keywords: ["female", "indian", "hinduism", "arabs", "woman"],
      char: "👳‍♀️",
      fitzpatrick_scale: true,
      category: "people"
    },
    man_with_turban: {
      keywords: ["male", "indian", "hinduism", "arabs"],
      char: "👳",
      fitzpatrick_scale: true,
      category: "people"
    },
    policewoman: {
      keywords: ["woman", "police", "law", "legal", "enforcement", "arrest", "911", "female"],
      char: "👮‍♀️",
      fitzpatrick_scale: true,
      category: "people"
    },
    policeman: {
      keywords: ["man", "police", "law", "legal", "enforcement", "arrest", "911"],
      char: "👮",
      fitzpatrick_scale: true,
      category: "people"
    },
    construction_worker_woman: {
      keywords: ["female", "human", "wip", "build", "construction", "worker", "labor", "woman"],
      char: "👷‍♀️",
      fitzpatrick_scale: true,
      category: "people"
    },
    construction_worker_man: {
      keywords: ["male", "human", "wip", "guy", "build", "construction", "worker", "labor"],
      char: "👷",
      fitzpatrick_scale: true,
      category: "people"
    },
    guardswoman: {
      keywords: ["uk", "gb", "british", "female", "royal", "woman"],
      char: "💂‍♀️",
      fitzpatrick_scale: true,
      category: "people"
    },
    guardsman: {
      keywords: ["uk", "gb", "british", "male", "guy", "royal"],
      char: "💂",
      fitzpatrick_scale: true,
      category: "people"
    },
    female_detective: {
      keywords: ["human", "spy", "detective", "female", "woman"],
      char: "🕵️‍♀️",
      fitzpatrick_scale: true,
      category: "people"
    },
    male_detective: {
      keywords: ["human", "spy", "detective"],
      char: "🕵",
      fitzpatrick_scale: true,
      category: "people"
    },
    woman_health_worker: {
      keywords: ["doctor", "nurse", "therapist", "healthcare", "woman", "human"],
      char: "👩‍⚕️",
      fitzpatrick_scale: true,
      category: "people"
    },
    man_health_worker: {
      keywords: ["doctor", "nurse", "therapist", "healthcare", "man", "human"],
      char: "👨‍⚕️",
      fitzpatrick_scale: true,
      category: "people"
    },
    woman_farmer: {
      keywords: ["rancher", "gardener", "woman", "human"],
      char: "👩‍🌾",
      fitzpatrick_scale: true,
      category: "people"
    },
    man_farmer: {
      keywords: ["rancher", "gardener", "man", "human"],
      char: "👨‍🌾",
      fitzpatrick_scale: true,
      category: "people"
    },
    woman_cook: {
      keywords: ["chef", "woman", "human"],
      char: "👩‍🍳",
      fitzpatrick_scale: true,
      category: "people"
    },
    man_cook: {
      keywords: ["chef", "man", "human"],
      char: "👨‍🍳",
      fitzpatrick_scale: true,
      category: "people"
    },
    woman_student: {
      keywords: ["graduate", "woman", "human"],
      char: "👩‍🎓",
      fitzpatrick_scale: true,
      category: "people"
    },
    man_student: {
      keywords: ["graduate", "man", "human"],
      char: "👨‍🎓",
      fitzpatrick_scale: true,
      category: "people"
    },
    woman_singer: {
      keywords: ["rockstar", "entertainer", "woman", "human"],
      char: "👩‍🎤",
      fitzpatrick_scale: true,
      category: "people"
    },
    man_singer: {
      keywords: ["rockstar", "entertainer", "man", "human"],
      char: "👨‍🎤",
      fitzpatrick_scale: true,
      category: "people"
    },
    woman_teacher: {
      keywords: ["instructor", "professor", "woman", "human"],
      char: "👩‍🏫",
      fitzpatrick_scale: true,
      category: "people"
    },
    man_teacher: {
      keywords: ["instructor", "professor", "man", "human"],
      char: "👨‍🏫",
      fitzpatrick_scale: true,
      category: "people"
    },
    woman_factory_worker: {
      keywords: ["assembly", "industrial", "woman", "human"],
      char: "👩‍🏭",
      fitzpatrick_scale: true,
      category: "people"
    },
    man_factory_worker: {
      keywords: ["assembly", "industrial", "man", "human"],
      char: "👨‍🏭",
      fitzpatrick_scale: true,
      category: "people"
    },
    woman_technologist: {
      keywords: ["coder", "developer", "engineer", "programmer", "software", "woman", "human", "laptop", "computer"],
      char: "👩‍💻",
      fitzpatrick_scale: true,
      category: "people"
    },
    man_technologist: {
      keywords: ["coder", "developer", "engineer", "programmer", "software", "man", "human", "laptop", "computer"],
      char: "👨‍💻",
      fitzpatrick_scale: true,
      category: "people"
    },
    woman_office_worker: {
      keywords: ["business", "manager", "woman", "human"],
      char: "👩‍💼",
      fitzpatrick_scale: true,
      category: "people"
    },
    man_office_worker: {
      keywords: ["business", "manager", "man", "human"],
      char: "👨‍💼",
      fitzpatrick_scale: true,
      category: "people"
    },
    woman_mechanic: {
      keywords: ["plumber", "woman", "human", "wrench"],
      char: "👩‍🔧",
      fitzpatrick_scale: true,
      category: "people"
    },
    man_mechanic: {
      keywords: ["plumber", "man", "human", "wrench"],
      char: "👨‍🔧",
      fitzpatrick_scale: true,
      category: "people"
    },
    woman_scientist: {
      keywords: ["biologist", "chemist", "engineer", "physicist", "woman", "human"],
      char: "👩‍🔬",
      fitzpatrick_scale: true,
      category: "people"
    },
    man_scientist: {
      keywords: ["biologist", "chemist", "engineer", "physicist", "man", "human"],
      char: "👨‍🔬",
      fitzpatrick_scale: true,
      category: "people"
    },
    woman_artist: {
      keywords: ["painter", "woman", "human"],
      char: "👩‍🎨",
      fitzpatrick_scale: true,
      category: "people"
    },
    man_artist: {
      keywords: ["painter", "man", "human"],
      char: "👨‍🎨",
      fitzpatrick_scale: true,
      category: "people"
    },
    woman_firefighter: {
      keywords: ["fireman", "woman", "human"],
      char: "👩‍🚒",
      fitzpatrick_scale: true,
      category: "people"
    },
    man_firefighter: {
      keywords: ["fireman", "man", "human"],
      char: "👨‍🚒",
      fitzpatrick_scale: true,
      category: "people"
    },
    woman_pilot: {
      keywords: ["aviator", "plane", "woman", "human"],
      char: "👩‍✈️",
      fitzpatrick_scale: true,
      category: "people"
    },
    man_pilot: {
      keywords: ["aviator", "plane", "man", "human"],
      char: "👨‍✈️",
      fitzpatrick_scale: true,
      category: "people"
    },
    woman_astronaut: {
      keywords: ["space", "rocket", "woman", "human"],
      char: "👩‍🚀",
      fitzpatrick_scale: true,
      category: "people"
    },
    man_astronaut: {
      keywords: ["space", "rocket", "man", "human"],
      char: "👨‍🚀",
      fitzpatrick_scale: true,
      category: "people"
    },
    woman_judge: {
      keywords: ["justice", "court", "woman", "human"],
      char: "👩‍⚖️",
      fitzpatrick_scale: true,
      category: "people"
    },
    man_judge: {
      keywords: ["justice", "court", "man", "human"],
      char: "👨‍⚖️",
      fitzpatrick_scale: true,
      category: "people"
    },
    woman_superhero: {
      keywords: ["woman", "female", "good", "heroine", "superpowers"],
      char: "🦸‍♀️",
      fitzpatrick_scale: true,
      category: "people"
    },
    man_superhero: {
      keywords: ["man", "male", "good", "hero", "superpowers"],
      char: "🦸‍♂️",
      fitzpatrick_scale: true,
      category: "people"
    },
    woman_supervillain: {
      keywords: ["woman", "female", "evil", "bad", "criminal", "heroine", "superpowers"],
      char: "🦹‍♀️",
      fitzpatrick_scale: true,
      category: "people"
    },
    man_supervillain: {
      keywords: ["man", "male", "evil", "bad", "criminal", "hero", "superpowers"],
      char: "🦹‍♂️",
      fitzpatrick_scale: true,
      category: "people"
    },
    mrs_claus: {
      keywords: ["woman", "female", "xmas", "mother christmas"],
      char: "🤶",
      fitzpatrick_scale: true,
      category: "people"
    },
    santa: {
      keywords: ["festival", "man", "male", "xmas", "father christmas"],
      char: "🎅",
      fitzpatrick_scale: true,
      category: "people"
    },
    sorceress: {
      keywords: ["woman", "female", "mage", "witch"],
      char: "🧙‍♀️",
      fitzpatrick_scale: true,
      category: "people"
    },
    wizard: {
      keywords: ["man", "male", "mage", "sorcerer"],
      char: "🧙‍♂️",
      fitzpatrick_scale: true,
      category: "people"
    },
    woman_elf: {
      keywords: ["woman", "female"],
      char: "🧝‍♀️",
      fitzpatrick_scale: true,
      category: "people"
    },
    man_elf: {
      keywords: ["man", "male"],
      char: "🧝‍♂️",
      fitzpatrick_scale: true,
      category: "people"
    },
    woman_vampire: {
      keywords: ["woman", "female"],
      char: "🧛‍♀️",
      fitzpatrick_scale: true,
      category: "people"
    },
    man_vampire: {
      keywords: ["man", "male", "dracula"],
      char: "🧛‍♂️",
      fitzpatrick_scale: true,
      category: "people"
    },
    woman_zombie: {
      keywords: ["woman", "female", "undead", "walking dead"],
      char: "🧟‍♀️",
      fitzpatrick_scale: false,
      category: "people"
    },
    man_zombie: {
      keywords: ["man", "male", "dracula", "undead", "walking dead"],
      char: "🧟‍♂️",
      fitzpatrick_scale: false,
      category: "people"
    },
    woman_genie: {
      keywords: ["woman", "female"],
      char: "🧞‍♀️",
      fitzpatrick_scale: false,
      category: "people"
    },
    man_genie: {
      keywords: ["man", "male"],
      char: "🧞‍♂️",
      fitzpatrick_scale: false,
      category: "people"
    },
    mermaid: {
      keywords: ["woman", "female", "merwoman", "ariel"],
      char: "🧜‍♀️",
      fitzpatrick_scale: true,
      category: "people"
    },
    merman: {
      keywords: ["man", "male", "triton"],
      char: "🧜‍♂️",
      fitzpatrick_scale: true,
      category: "people"
    },
    woman_fairy: {
      keywords: ["woman", "female"],
      char: "🧚‍♀️",
      fitzpatrick_scale: true,
      category: "people"
    },
    man_fairy: {
      keywords: ["man", "male"],
      char: "🧚‍♂️",
      fitzpatrick_scale: true,
      category: "people"
    },
    angel: {
      keywords: ["heaven", "wings", "halo"],
      char: "👼",
      fitzpatrick_scale: true,
      category: "people"
    },
    pregnant_woman: {
      keywords: ["baby"],
      char: "🤰",
      fitzpatrick_scale: true,
      category: "people"
    },
    breastfeeding: {
      keywords: ["nursing", "baby"],
      char: "🤱",
      fitzpatrick_scale: true,
      category: "people"
    },
    princess: {
      keywords: ["girl", "woman", "female", "blond", "crown", "royal", "queen"],
      char: "👸",
      fitzpatrick_scale: true,
      category: "people"
    },
    prince: {
      keywords: ["boy", "man", "male", "crown", "royal", "king"],
      char: "🤴",
      fitzpatrick_scale: true,
      category: "people"
    },
    bride_with_veil: {
      keywords: ["couple", "marriage", "wedding", "woman", "bride"],
      char: "👰",
      fitzpatrick_scale: true,
      category: "people"
    },
    man_in_tuxedo: {
      keywords: ["couple", "marriage", "wedding", "groom"],
      char: "🤵",
      fitzpatrick_scale: true,
      category: "people"
    },
    running_woman: {
      keywords: ["woman", "walking", "exercise", "race", "running", "female"],
      char: "🏃‍♀️",
      fitzpatrick_scale: true,
      category: "people"
    },
    running_man: {
      keywords: ["man", "walking", "exercise", "race", "running"],
      char: "🏃",
      fitzpatrick_scale: true,
      category: "people"
    },
    walking_woman: {
      keywords: ["human", "feet", "steps", "woman", "female"],
      char: "🚶‍♀️",
      fitzpatrick_scale: true,
      category: "people"
    },
    walking_man: {
      keywords: ["human", "feet", "steps"],
      char: "🚶",
      fitzpatrick_scale: true,
      category: "people"
    },
    dancer: {
      keywords: ["female", "girl", "woman", "fun"],
      char: "💃",
      fitzpatrick_scale: true,
      category: "people"
    },
    man_dancing: {
      keywords: ["male", "boy", "fun", "dancer"],
      char: "🕺",
      fitzpatrick_scale: true,
      category: "people"
    },
    dancing_women: {
      keywords: ["female", "bunny", "women", "girls"],
      char: "👯",
      fitzpatrick_scale: false,
      category: "people"
    },
    dancing_men: {
      keywords: ["male", "bunny", "men", "boys"],
      char: "👯‍♂️",
      fitzpatrick_scale: false,
      category: "people"
    },
    couple: {
      keywords: ["pair", "people", "human", "love", "date", "dating", "like", "affection", "valentines", "marriage"],
      char: "👫",
      fitzpatrick_scale: false,
      category: "people"
    },
    two_men_holding_hands: {
      keywords: ["pair", "couple", "love", "like", "bromance", "friendship", "people", "human"],
      char: "👬",
      fitzpatrick_scale: false,
      category: "people"
    },
    two_women_holding_hands: {
      keywords: ["pair", "friendship", "couple", "love", "like", "female", "people", "human"],
      char: "👭",
      fitzpatrick_scale: false,
      category: "people"
    },
    bowing_woman: {
      keywords: ["woman", "female", "girl"],
      char: "🙇‍♀️",
      fitzpatrick_scale: true,
      category: "people"
    },
    bowing_man: {
      keywords: ["man", "male", "boy"],
      char: "🙇",
      fitzpatrick_scale: true,
      category: "people"
    },
    man_facepalming: {
      keywords: ["man", "male", "boy", "disbelief"],
      char: "🤦‍♂️",
      fitzpatrick_scale: true,
      category: "people"
    },
    woman_facepalming: {
      keywords: ["woman", "female", "girl", "disbelief"],
      char: "🤦‍♀️",
      fitzpatrick_scale: true,
      category: "people"
    },
    woman_shrugging: {
      keywords: ["woman", "female", "girl", "confused", "indifferent", "doubt"],
      char: "🤷",
      fitzpatrick_scale: true,
      category: "people"
    },
    man_shrugging: {
      keywords: ["man", "male", "boy", "confused", "indifferent", "doubt"],
      char: "🤷‍♂️",
      fitzpatrick_scale: true,
      category: "people"
    },
    tipping_hand_woman: {
      keywords: ["female", "girl", "woman", "human", "information"],
      char: "💁",
      fitzpatrick_scale: true,
      category: "people"
    },
    tipping_hand_man: {
      keywords: ["male", "boy", "man", "human", "information"],
      char: "💁‍♂️",
      fitzpatrick_scale: true,
      category: "people"
    },
    no_good_woman: {
      keywords: ["female", "girl", "woman", "nope"],
      char: "🙅",
      fitzpatrick_scale: true,
      category: "people"
    },
    no_good_man: {
      keywords: ["male", "boy", "man", "nope"],
      char: "🙅‍♂️",
      fitzpatrick_scale: true,
      category: "people"
    },
    ok_woman: {
      keywords: ["women", "girl", "female", "pink", "human", "woman"],
      char: "🙆",
      fitzpatrick_scale: true,
      category: "people"
    },
    ok_man: {
      keywords: ["men", "boy", "male", "blue", "human", "man"],
      char: "🙆‍♂️",
      fitzpatrick_scale: true,
      category: "people"
    },
    raising_hand_woman: {
      keywords: ["female", "girl", "woman"],
      char: "🙋",
      fitzpatrick_scale: true,
      category: "people"
    },
    raising_hand_man: {
      keywords: ["male", "boy", "man"],
      char: "🙋‍♂️",
      fitzpatrick_scale: true,
      category: "people"
    },
    pouting_woman: {
      keywords: ["female", "girl", "woman"],
      char: "🙎",
      fitzpatrick_scale: true,
      category: "people"
    },
    pouting_man: {
      keywords: ["male", "boy", "man"],
      char: "🙎‍♂️",
      fitzpatrick_scale: true,
      category: "people"
    },
    frowning_woman: {
      keywords: ["female", "girl", "woman", "sad", "depressed", "discouraged", "unhappy"],
      char: "🙍",
      fitzpatrick_scale: true,
      category: "people"
    },
    frowning_man: {
      keywords: ["male", "boy", "man", "sad", "depressed", "discouraged", "unhappy"],
      char: "🙍‍♂️",
      fitzpatrick_scale: true,
      category: "people"
    },
    haircut_woman: {
      keywords: ["female", "girl", "woman"],
      char: "💇",
      fitzpatrick_scale: true,
      category: "people"
    },
    haircut_man: {
      keywords: ["male", "boy", "man"],
      char: "💇‍♂️",
      fitzpatrick_scale: true,
      category: "people"
    },
    massage_woman: {
      keywords: ["female", "girl", "woman", "head"],
      char: "💆",
      fitzpatrick_scale: true,
      category: "people"
    },
    massage_man: {
      keywords: ["male", "boy", "man", "head"],
      char: "💆‍♂️",
      fitzpatrick_scale: true,
      category: "people"
    },
    woman_in_steamy_room: {
      keywords: ["female", "woman", "spa", "steamroom", "sauna"],
      char: "🧖‍♀️",
      fitzpatrick_scale: true,
      category: "people"
    },
    man_in_steamy_room: {
      keywords: ["male", "man", "spa", "steamroom", "sauna"],
      char: "🧖‍♂️",
      fitzpatrick_scale: true,
      category: "people"
    },
    couple_with_heart_woman_man: {
      keywords: ["pair", "love", "like", "affection", "human", "dating", "valentines", "marriage"],
      char: "💑",
      fitzpatrick_scale: false,
      category: "people"
    },
    couple_with_heart_woman_woman: {
      keywords: ["pair", "love", "like", "affection", "human", "dating", "valentines", "marriage"],
      char: "👩‍❤️‍👩",
      fitzpatrick_scale: false,
      category: "people"
    },
    couple_with_heart_man_man: {
      keywords: ["pair", "love", "like", "affection", "human", "dating", "valentines", "marriage"],
      char: "👨‍❤️‍👨",
      fitzpatrick_scale: false,
      category: "people"
    },
    couplekiss_man_woman: {
      keywords: ["pair", "valentines", "love", "like", "dating", "marriage"],
      char: "💏",
      fitzpatrick_scale: false,
      category: "people"
    },
    couplekiss_woman_woman: {
      keywords: ["pair", "valentines", "love", "like", "dating", "marriage"],
      char: "👩‍❤️‍💋‍👩",
      fitzpatrick_scale: false,
      category: "people"
    },
    couplekiss_man_man: {
      keywords: ["pair", "valentines", "love", "like", "dating", "marriage"],
      char: "👨‍❤️‍💋‍👨",
      fitzpatrick_scale: false,
      category: "people"
    },
    family_man_woman_boy: {
      keywords: ["home", "parents", "child", "mom", "dad", "father", "mother", "people", "human"],
      char: "👪",
      fitzpatrick_scale: false,
      category: "people"
    },
    family_man_woman_girl: {
      keywords: ["home", "parents", "people", "human", "child"],
      char: "👨‍👩‍👧",
      fitzpatrick_scale: false,
      category: "people"
    },
    family_man_woman_girl_boy: {
      keywords: ["home", "parents", "people", "human", "children"],
      char: "👨‍👩‍👧‍👦",
      fitzpatrick_scale: false,
      category: "people"
    },
    family_man_woman_boy_boy: {
      keywords: ["home", "parents", "people", "human", "children"],
      char: "👨‍👩‍👦‍👦",
      fitzpatrick_scale: false,
      category: "people"
    },
    family_man_woman_girl_girl: {
      keywords: ["home", "parents", "people", "human", "children"],
      char: "👨‍👩‍👧‍👧",
      fitzpatrick_scale: false,
      category: "people"
    },
    family_woman_woman_boy: {
      keywords: ["home", "parents", "people", "human", "children"],
      char: "👩‍👩‍👦",
      fitzpatrick_scale: false,
      category: "people"
    },
    family_woman_woman_girl: {
      keywords: ["home", "parents", "people", "human", "children"],
      char: "👩‍👩‍👧",
      fitzpatrick_scale: false,
      category: "people"
    },
    family_woman_woman_girl_boy: {
      keywords: ["home", "parents", "people", "human", "children"],
      char: "👩‍👩‍👧‍👦",
      fitzpatrick_scale: false,
      category: "people"
    },
    family_woman_woman_boy_boy: {
      keywords: ["home", "parents", "people", "human", "children"],
      char: "👩‍👩‍👦‍👦",
      fitzpatrick_scale: false,
      category: "people"
    },
    family_woman_woman_girl_girl: {
      keywords: ["home", "parents", "people", "human", "children"],
      char: "👩‍👩‍👧‍👧",
      fitzpatrick_scale: false,
      category: "people"
    },
    family_man_man_boy: {
      keywords: ["home", "parents", "people", "human", "children"],
      char: "👨‍👨‍👦",
      fitzpatrick_scale: false,
      category: "people"
    },
    family_man_man_girl: {
      keywords: ["home", "parents", "people", "human", "children"],
      char: "👨‍👨‍👧",
      fitzpatrick_scale: false,
      category: "people"
    },
    family_man_man_girl_boy: {
      keywords: ["home", "parents", "people", "human", "children"],
      char: "👨‍👨‍👧‍👦",
      fitzpatrick_scale: false,
      category: "people"
    },
    family_man_man_boy_boy: {
      keywords: ["home", "parents", "people", "human", "children"],
      char: "👨‍👨‍👦‍👦",
      fitzpatrick_scale: false,
      category: "people"
    },
    family_man_man_girl_girl: {
      keywords: ["home", "parents", "people", "human", "children"],
      char: "👨‍👨‍👧‍👧",
      fitzpatrick_scale: false,
      category: "people"
    },
    family_woman_boy: {
      keywords: ["home", "parent", "people", "human", "child"],
      char: "👩‍👦",
      fitzpatrick_scale: false,
      category: "people"
    },
    family_woman_girl: {
      keywords: ["home", "parent", "people", "human", "child"],
      char: "👩‍👧",
      fitzpatrick_scale: false,
      category: "people"
    },
    family_woman_girl_boy: {
      keywords: ["home", "parent", "people", "human", "children"],
      char: "👩‍👧‍👦",
      fitzpatrick_scale: false,
      category: "people"
    },
    family_woman_boy_boy: {
      keywords: ["home", "parent", "people", "human", "children"],
      char: "👩‍👦‍👦",
      fitzpatrick_scale: false,
      category: "people"
    },
    family_woman_girl_girl: {
      keywords: ["home", "parent", "people", "human", "children"],
      char: "👩‍👧‍👧",
      fitzpatrick_scale: false,
      category: "people"
    },
    family_man_boy: {
      keywords: ["home", "parent", "people", "human", "child"],
      char: "👨‍👦",
      fitzpatrick_scale: false,
      category: "people"
    },
    family_man_girl: {
      keywords: ["home", "parent", "people", "human", "child"],
      char: "👨‍👧",
      fitzpatrick_scale: false,
      category: "people"
    },
    family_man_girl_boy: {
      keywords: ["home", "parent", "people", "human", "children"],
      char: "👨‍👧‍👦",
      fitzpatrick_scale: false,
      category: "people"
    },
    family_man_boy_boy: {
      keywords: ["home", "parent", "people", "human", "children"],
      char: "👨‍👦‍👦",
      fitzpatrick_scale: false,
      category: "people"
    },
    family_man_girl_girl: {
      keywords: ["home", "parent", "people", "human", "children"],
      char: "👨‍👧‍👧",
      fitzpatrick_scale: false,
      category: "people"
    },
    yarn: {
      keywords: ["ball", "crochet", "knit"],
      char: "🧶",
      fitzpatrick_scale: false,
      category: "people"
    },
    thread: {
      keywords: ["needle", "sewing", "spool", "string"],
      char: "🧵",
      fitzpatrick_scale: false,
      category: "people"
    },
    coat: {
      keywords: ["jacket"],
      char: "🧥",
      fitzpatrick_scale: false,
      category: "people"
    },
    labcoat: {
      keywords: ["doctor", "experiment", "scientist", "chemist"],
      char: "🥼",
      fitzpatrick_scale: false,
      category: "people"
    },
    womans_clothes: {
      keywords: ["fashion", "shopping_bags", "female"],
      char: "👚",
      fitzpatrick_scale: false,
      category: "people"
    },
    tshirt: {
      keywords: ["fashion", "cloth", "casual", "shirt", "tee"],
      char: "👕",
      fitzpatrick_scale: false,
      category: "people"
    },
    jeans: {
      keywords: ["fashion", "shopping"],
      char: "👖",
      fitzpatrick_scale: false,
      category: "people"
    },
    necktie: {
      keywords: ["shirt", "suitup", "formal", "fashion", "cloth", "business"],
      char: "👔",
      fitzpatrick_scale: false,
      category: "people"
    },
    dress: {
      keywords: ["clothes", "fashion", "shopping"],
      char: "👗",
      fitzpatrick_scale: false,
      category: "people"
    },
    bikini: {
      keywords: ["swimming", "female", "woman", "girl", "fashion", "beach", "summer"],
      char: "👙",
      fitzpatrick_scale: false,
      category: "people"
    },
    kimono: {
      keywords: ["dress", "fashion", "women", "female", "japanese"],
      char: "👘",
      fitzpatrick_scale: false,
      category: "people"
    },
    lipstick: {
      keywords: ["female", "girl", "fashion", "woman"],
      char: "💄",
      fitzpatrick_scale: false,
      category: "people"
    },
    kiss: {
      keywords: ["face", "lips", "love", "like", "affection", "valentines"],
      char: "💋",
      fitzpatrick_scale: false,
      category: "people"
    },
    footprints: {
      keywords: ["feet", "tracking", "walking", "beach"],
      char: "👣",
      fitzpatrick_scale: false,
      category: "people"
    },
    flat_shoe: {
      keywords: ["ballet", "slip-on", "slipper"],
      char: "🥿",
      fitzpatrick_scale: false,
      category: "people"
    },
    high_heel: {
      keywords: ["fashion", "shoes", "female", "pumps", "stiletto"],
      char: "👠",
      fitzpatrick_scale: false,
      category: "people"
    },
    sandal: {
      keywords: ["shoes", "fashion", "flip flops"],
      char: "👡",
      fitzpatrick_scale: false,
      category: "people"
    },
    boot: {
      keywords: ["shoes", "fashion"],
      char: "👢",
      fitzpatrick_scale: false,
      category: "people"
    },
    mans_shoe: {
      keywords: ["fashion", "male"],
      char: "👞",
      fitzpatrick_scale: false,
      category: "people"
    },
    athletic_shoe: {
      keywords: ["shoes", "sports", "sneakers"],
      char: "👟",
      fitzpatrick_scale: false,
      category: "people"
    },
    hiking_boot: {
      keywords: ["backpacking", "camping", "hiking"],
      char: "🥾",
      fitzpatrick_scale: false,
      category: "people"
    },
    socks: {
      keywords: ["stockings", "clothes"],
      char: "🧦",
      fitzpatrick_scale: false,
      category: "people"
    },
    gloves: {
      keywords: ["hands", "winter", "clothes"],
      char: "🧤",
      fitzpatrick_scale: false,
      category: "people"
    },
    scarf: {
      keywords: ["neck", "winter", "clothes"],
      char: "🧣",
      fitzpatrick_scale: false,
      category: "people"
    },
    womans_hat: {
      keywords: ["fashion", "accessories", "female", "lady", "spring"],
      char: "👒",
      fitzpatrick_scale: false,
      category: "people"
    },
    tophat: {
      keywords: ["magic", "gentleman", "classy", "circus"],
      char: "🎩",
      fitzpatrick_scale: false,
      category: "people"
    },
    billed_hat: {
      keywords: ["cap", "baseball"],
      char: "🧢",
      fitzpatrick_scale: false,
      category: "people"
    },
    rescue_worker_helmet: {
      keywords: ["construction", "build"],
      char: "⛑",
      fitzpatrick_scale: false,
      category: "people"
    },
    mortar_board: {
      keywords: ["school", "college", "degree", "university", "graduation", "cap", "hat", "legal", "learn", "education"],
      char: "🎓",
      fitzpatrick_scale: false,
      category: "people"
    },
    crown: {
      keywords: ["king", "kod", "leader", "royalty", "lord"],
      char: "👑",
      fitzpatrick_scale: false,
      category: "people"
    },
    school_satchel: {
      keywords: ["student", "education", "bag", "backpack"],
      char: "🎒",
      fitzpatrick_scale: false,
      category: "people"
    },
    luggage: {
      keywords: ["packing", "travel"],
      char: "🧳",
      fitzpatrick_scale: false,
      category: "people"
    },
    pouch: {
      keywords: ["bag", "accessories", "shopping"],
      char: "👝",
      fitzpatrick_scale: false,
      category: "people"
    },
    purse: {
      keywords: ["fashion", "accessories", "money", "sales", "shopping"],
      char: "👛",
      fitzpatrick_scale: false,
      category: "people"
    },
    handbag: {
      keywords: ["fashion", "accessory", "accessories", "shopping"],
      char: "👜",
      fitzpatrick_scale: false,
      category: "people"
    },
    briefcase: {
      keywords: ["business", "documents", "work", "law", "legal", "job", "career"],
      char: "💼",
      fitzpatrick_scale: false,
      category: "people"
    },
    eyeglasses: {
      keywords: ["fashion", "accessories", "eyesight", "nerdy", "dork", "geek"],
      char: "👓",
      fitzpatrick_scale: false,
      category: "people"
    },
    dark_sunglasses: {
      keywords: ["face", "cool", "accessories"],
      char: "🕶",
      fitzpatrick_scale: false,
      category: "people"
    },
    goggles: {
      keywords: ["eyes", "protection", "safety"],
      char: "🥽",
      fitzpatrick_scale: false,
      category: "people"
    },
    ring: {
      keywords: ["wedding", "propose", "marriage", "valentines", "diamond", "fashion", "jewelry", "gem", "engagement"],
      char: "💍",
      fitzpatrick_scale: false,
      category: "people"
    },
    closed_umbrella: {
      keywords: ["weather", "rain", "drizzle"],
      char: "🌂",
      fitzpatrick_scale: false,
      category: "people"
    },
    dog: {
      keywords: ["animal", "friend", "nature", "woof", "puppy", "pet", "faithful"],
      char: "🐶",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    cat: {
      keywords: ["animal", "meow", "nature", "pet", "kitten"],
      char: "🐱",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    mouse: {
      keywords: ["animal", "nature", "cheese_wedge", "rodent"],
      char: "🐭",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    hamster: {
      keywords: ["animal", "nature"],
      char: "🐹",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    rabbit: {
      keywords: ["animal", "nature", "pet", "spring", "magic", "bunny"],
      char: "🐰",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    fox_face: {
      keywords: ["animal", "nature", "face"],
      char: "🦊",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    bear: {
      keywords: ["animal", "nature", "wild"],
      char: "🐻",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    panda_face: {
      keywords: ["animal", "nature", "panda"],
      char: "🐼",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    koala: {
      keywords: ["animal", "nature"],
      char: "🐨",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    tiger: {
      keywords: ["animal", "cat", "danger", "wild", "nature", "roar"],
      char: "🐯",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    lion: {
      keywords: ["animal", "nature"],
      char: "🦁",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    cow: {
      keywords: ["beef", "ox", "animal", "nature", "moo", "milk"],
      char: "🐮",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    pig: {
      keywords: ["animal", "oink", "nature"],
      char: "🐷",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    pig_nose: {
      keywords: ["animal", "oink"],
      char: "🐽",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    frog: {
      keywords: ["animal", "nature", "croak", "toad"],
      char: "🐸",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    squid: {
      keywords: ["animal", "nature", "ocean", "sea"],
      char: "🦑",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    octopus: {
      keywords: ["animal", "creature", "ocean", "sea", "nature", "beach"],
      char: "🐙",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    shrimp: {
      keywords: ["animal", "ocean", "nature", "seafood"],
      char: "🦐",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    monkey_face: {
      keywords: ["animal", "nature", "circus"],
      char: "🐵",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    gorilla: {
      keywords: ["animal", "nature", "circus"],
      char: "🦍",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    see_no_evil: {
      keywords: ["monkey", "animal", "nature", "haha"],
      char: "🙈",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    hear_no_evil: {
      keywords: ["animal", "monkey", "nature"],
      char: "🙉",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    speak_no_evil: {
      keywords: ["monkey", "animal", "nature", "omg"],
      char: "🙊",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    monkey: {
      keywords: ["animal", "nature", "banana", "circus"],
      char: "🐒",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    chicken: {
      keywords: ["animal", "cluck", "nature", "bird"],
      char: "🐔",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    penguin: {
      keywords: ["animal", "nature"],
      char: "🐧",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    bird: {
      keywords: ["animal", "nature", "fly", "tweet", "spring"],
      char: "🐦",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    baby_chick: {
      keywords: ["animal", "chicken", "bird"],
      char: "🐤",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    hatching_chick: {
      keywords: ["animal", "chicken", "egg", "born", "baby", "bird"],
      char: "🐣",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    hatched_chick: {
      keywords: ["animal", "chicken", "baby", "bird"],
      char: "🐥",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    duck: {
      keywords: ["animal", "nature", "bird", "mallard"],
      char: "🦆",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    eagle: {
      keywords: ["animal", "nature", "bird"],
      char: "🦅",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    owl: {
      keywords: ["animal", "nature", "bird", "hoot"],
      char: "🦉",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    bat: {
      keywords: ["animal", "nature", "blind", "vampire"],
      char: "🦇",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    wolf: {
      keywords: ["animal", "nature", "wild"],
      char: "🐺",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    boar: {
      keywords: ["animal", "nature"],
      char: "🐗",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    horse: {
      keywords: ["animal", "brown", "nature"],
      char: "🐴",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    unicorn: {
      keywords: ["animal", "nature", "mystical"],
      char: "🦄",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    honeybee: {
      keywords: ["animal", "insect", "nature", "bug", "spring", "honey"],
      char: "🐝",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    bug: {
      keywords: ["animal", "insect", "nature", "worm"],
      char: "🐛",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    butterfly: {
      keywords: ["animal", "insect", "nature", "caterpillar"],
      char: "🦋",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    snail: {
      keywords: ["slow", "animal", "shell"],
      char: "🐌",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    beetle: {
      keywords: ["animal", "insect", "nature", "ladybug"],
      char: "🐞",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    ant: {
      keywords: ["animal", "insect", "nature", "bug"],
      char: "🐜",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    grasshopper: {
      keywords: ["animal", "cricket", "chirp"],
      char: "🦗",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    spider: {
      keywords: ["animal", "arachnid"],
      char: "🕷",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    scorpion: {
      keywords: ["animal", "arachnid"],
      char: "🦂",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    crab: {
      keywords: ["animal", "crustacean"],
      char: "🦀",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    snake: {
      keywords: ["animal", "evil", "nature", "hiss", "python"],
      char: "🐍",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    lizard: {
      keywords: ["animal", "nature", "reptile"],
      char: "🦎",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    "t-rex": {
      keywords: ["animal", "nature", "dinosaur", "tyrannosaurus", "extinct"],
      char: "🦖",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    sauropod: {
      keywords: ["animal", "nature", "dinosaur", "brachiosaurus", "brontosaurus", "diplodocus", "extinct"],
      char: "🦕",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    turtle: {
      keywords: ["animal", "slow", "nature", "tortoise"],
      char: "🐢",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    tropical_fish: {
      keywords: ["animal", "swim", "ocean", "beach", "nemo"],
      char: "🐠",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    fish: {
      keywords: ["animal", "food", "nature"],
      char: "🐟",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    blowfish: {
      keywords: ["animal", "nature", "food", "sea", "ocean"],
      char: "🐡",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    dolphin: {
      keywords: ["animal", "nature", "fish", "sea", "ocean", "flipper", "fins", "beach"],
      char: "🐬",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    shark: {
      keywords: ["animal", "nature", "fish", "sea", "ocean", "jaws", "fins", "beach"],
      char: "🦈",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    whale: {
      keywords: ["animal", "nature", "sea", "ocean"],
      char: "🐳",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    whale2: {
      keywords: ["animal", "nature", "sea", "ocean"],
      char: "🐋",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    crocodile: {
      keywords: ["animal", "nature", "reptile", "lizard", "alligator"],
      char: "🐊",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    leopard: {
      keywords: ["animal", "nature"],
      char: "🐆",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    zebra: {
      keywords: ["animal", "nature", "stripes", "safari"],
      char: "🦓",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    tiger2: {
      keywords: ["animal", "nature", "roar"],
      char: "🐅",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    water_buffalo: {
      keywords: ["animal", "nature", "ox", "cow"],
      char: "🐃",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    ox: {
      keywords: ["animal", "cow", "beef"],
      char: "🐂",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    cow2: {
      keywords: ["beef", "ox", "animal", "nature", "moo", "milk"],
      char: "🐄",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    deer: {
      keywords: ["animal", "nature", "horns", "venison"],
      char: "🦌",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    dromedary_camel: {
      keywords: ["animal", "hot", "desert", "hump"],
      char: "🐪",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    camel: {
      keywords: ["animal", "nature", "hot", "desert", "hump"],
      char: "🐫",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    giraffe: {
      keywords: ["animal", "nature", "spots", "safari"],
      char: "🦒",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    elephant: {
      keywords: ["animal", "nature", "nose", "th", "circus"],
      char: "🐘",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    rhinoceros: {
      keywords: ["animal", "nature", "horn"],
      char: "🦏",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    goat: {
      keywords: ["animal", "nature"],
      char: "🐐",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    ram: {
      keywords: ["animal", "sheep", "nature"],
      char: "🐏",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    sheep: {
      keywords: ["animal", "nature", "wool", "shipit"],
      char: "🐑",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    racehorse: {
      keywords: ["animal", "gamble", "luck"],
      char: "🐎",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    pig2: {
      keywords: ["animal", "nature"],
      char: "🐖",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    rat: {
      keywords: ["animal", "mouse", "rodent"],
      char: "🐀",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    mouse2: {
      keywords: ["animal", "nature", "rodent"],
      char: "🐁",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    rooster: {
      keywords: ["animal", "nature", "chicken"],
      char: "🐓",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    turkey: {
      keywords: ["animal", "bird"],
      char: "🦃",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    dove: {
      keywords: ["animal", "bird"],
      char: "🕊",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    dog2: {
      keywords: ["animal", "nature", "friend", "doge", "pet", "faithful"],
      char: "🐕",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    poodle: {
      keywords: ["dog", "animal", "101", "nature", "pet"],
      char: "🐩",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    cat2: {
      keywords: ["animal", "meow", "pet", "cats"],
      char: "🐈",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    rabbit2: {
      keywords: ["animal", "nature", "pet", "magic", "spring"],
      char: "🐇",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    chipmunk: {
      keywords: ["animal", "nature", "rodent", "squirrel"],
      char: "🐿",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    hedgehog: {
      keywords: ["animal", "nature", "spiny"],
      char: "🦔",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    raccoon: {
      keywords: ["animal", "nature"],
      char: "🦝",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    llama: {
      keywords: ["animal", "nature", "alpaca"],
      char: "🦙",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    hippopotamus: {
      keywords: ["animal", "nature"],
      char: "🦛",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    kangaroo: {
      keywords: ["animal", "nature", "australia", "joey", "hop", "marsupial"],
      char: "🦘",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    badger: {
      keywords: ["animal", "nature", "honey"],
      char: "🦡",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    swan: {
      keywords: ["animal", "nature", "bird"],
      char: "🦢",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    peacock: {
      keywords: ["animal", "nature", "peahen", "bird"],
      char: "🦚",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    parrot: {
      keywords: ["animal", "nature", "bird", "pirate", "talk"],
      char: "🦜",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    lobster: {
      keywords: ["animal", "nature", "bisque", "claws", "seafood"],
      char: "🦞",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    mosquito: {
      keywords: ["animal", "nature", "insect", "malaria"],
      char: "🦟",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    paw_prints: {
      keywords: ["animal", "tracking", "footprints", "dog", "cat", "pet", "feet"],
      char: "🐾",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    dragon: {
      keywords: ["animal", "myth", "nature", "chinese", "green"],
      char: "🐉",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    dragon_face: {
      keywords: ["animal", "myth", "nature", "chinese", "green"],
      char: "🐲",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    cactus: {
      keywords: ["vegetable", "plant", "nature"],
      char: "🌵",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    christmas_tree: {
      keywords: ["festival", "vacation", "december", "xmas", "celebration"],
      char: "🎄",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    evergreen_tree: {
      keywords: ["plant", "nature"],
      char: "🌲",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    deciduous_tree: {
      keywords: ["plant", "nature"],
      char: "🌳",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    palm_tree: {
      keywords: ["plant", "vegetable", "nature", "summer", "beach", "mojito", "tropical"],
      char: "🌴",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    seedling: {
      keywords: ["plant", "nature", "grass", "lawn", "spring"],
      char: "🌱",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    herb: {
      keywords: ["vegetable", "plant", "medicine", "weed", "grass", "lawn"],
      char: "🌿",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    shamrock: {
      keywords: ["vegetable", "plant", "nature", "irish", "clover"],
      char: "☘",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    four_leaf_clover: {
      keywords: ["vegetable", "plant", "nature", "lucky", "irish"],
      char: "🍀",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    bamboo: {
      keywords: ["plant", "nature", "vegetable", "panda", "pine_decoration"],
      char: "🎍",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    tanabata_tree: {
      keywords: ["plant", "nature", "branch", "summer"],
      char: "🎋",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    leaves: {
      keywords: ["nature", "plant", "tree", "vegetable", "grass", "lawn", "spring"],
      char: "🍃",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    fallen_leaf: {
      keywords: ["nature", "plant", "vegetable", "leaves"],
      char: "🍂",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    maple_leaf: {
      keywords: ["nature", "plant", "vegetable", "ca", "fall"],
      char: "🍁",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    ear_of_rice: {
      keywords: ["nature", "plant"],
      char: "🌾",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    hibiscus: {
      keywords: ["plant", "vegetable", "flowers", "beach"],
      char: "🌺",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    sunflower: {
      keywords: ["nature", "plant", "fall"],
      char: "🌻",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    rose: {
      keywords: ["flowers", "valentines", "love", "spring"],
      char: "🌹",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    wilted_flower: {
      keywords: ["plant", "nature", "flower"],
      char: "🥀",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    tulip: {
      keywords: ["flowers", "plant", "nature", "summer", "spring"],
      char: "🌷",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    blossom: {
      keywords: ["nature", "flowers", "yellow"],
      char: "🌼",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    cherry_blossom: {
      keywords: ["nature", "plant", "spring", "flower"],
      char: "🌸",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    bouquet: {
      keywords: ["flowers", "nature", "spring"],
      char: "💐",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    mushroom: {
      keywords: ["plant", "vegetable"],
      char: "🍄",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    chestnut: {
      keywords: ["food", "squirrel"],
      char: "🌰",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    jack_o_lantern: {
      keywords: ["halloween", "light", "pumpkin", "creepy", "fall"],
      char: "🎃",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    shell: {
      keywords: ["nature", "sea", "beach"],
      char: "🐚",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    spider_web: {
      keywords: ["animal", "insect", "arachnid", "silk"],
      char: "🕸",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    earth_americas: {
      keywords: ["globe", "world", "USA", "international"],
      char: "🌎",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    earth_africa: {
      keywords: ["globe", "world", "international"],
      char: "🌍",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    earth_asia: {
      keywords: ["globe", "world", "east", "international"],
      char: "🌏",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    full_moon: {
      keywords: ["nature", "yellow", "twilight", "planet", "space", "night", "evening", "sleep"],
      char: "🌕",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    waning_gibbous_moon: {
      keywords: ["nature", "twilight", "planet", "space", "night", "evening", "sleep", "waxing_gibbous_moon"],
      char: "🌖",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    last_quarter_moon: {
      keywords: ["nature", "twilight", "planet", "space", "night", "evening", "sleep"],
      char: "🌗",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    waning_crescent_moon: {
      keywords: ["nature", "twilight", "planet", "space", "night", "evening", "sleep"],
      char: "🌘",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    new_moon: {
      keywords: ["nature", "twilight", "planet", "space", "night", "evening", "sleep"],
      char: "🌑",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    waxing_crescent_moon: {
      keywords: ["nature", "twilight", "planet", "space", "night", "evening", "sleep"],
      char: "🌒",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    first_quarter_moon: {
      keywords: ["nature", "twilight", "planet", "space", "night", "evening", "sleep"],
      char: "🌓",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    waxing_gibbous_moon: {
      keywords: ["nature", "night", "sky", "gray", "twilight", "planet", "space", "evening", "sleep"],
      char: "🌔",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    new_moon_with_face: {
      keywords: ["nature", "twilight", "planet", "space", "night", "evening", "sleep"],
      char: "🌚",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    full_moon_with_face: {
      keywords: ["nature", "twilight", "planet", "space", "night", "evening", "sleep"],
      char: "🌝",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    first_quarter_moon_with_face: {
      keywords: ["nature", "twilight", "planet", "space", "night", "evening", "sleep"],
      char: "🌛",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    last_quarter_moon_with_face: {
      keywords: ["nature", "twilight", "planet", "space", "night", "evening", "sleep"],
      char: "🌜",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    sun_with_face: {
      keywords: ["nature", "morning", "sky"],
      char: "🌞",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    crescent_moon: {
      keywords: ["night", "sleep", "sky", "evening", "magic"],
      char: "🌙",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    star: {
      keywords: ["night", "yellow"],
      char: "⭐",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    star2: {
      keywords: ["night", "sparkle", "awesome", "good", "magic"],
      char: "🌟",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    dizzy: {
      keywords: ["star", "sparkle", "shoot", "magic"],
      char: "💫",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    sparkles: {
      keywords: ["stars", "shine", "shiny", "cool", "awesome", "good", "magic"],
      char: "✨",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    comet: {
      keywords: ["space"],
      char: "☄",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    sunny: {
      keywords: ["weather", "nature", "brightness", "summer", "beach", "spring"],
      char: "☀️",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    sun_behind_small_cloud: {
      keywords: ["weather"],
      char: "🌤",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    partly_sunny: {
      keywords: ["weather", "nature", "cloudy", "morning", "fall", "spring"],
      char: "⛅",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    sun_behind_large_cloud: {
      keywords: ["weather"],
      char: "🌥",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    sun_behind_rain_cloud: {
      keywords: ["weather"],
      char: "🌦",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    cloud: {
      keywords: ["weather", "sky"],
      char: "☁️",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    cloud_with_rain: {
      keywords: ["weather"],
      char: "🌧",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    cloud_with_lightning_and_rain: {
      keywords: ["weather", "lightning"],
      char: "⛈",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    cloud_with_lightning: {
      keywords: ["weather", "thunder"],
      char: "🌩",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    zap: {
      keywords: ["thunder", "weather", "lightning bolt", "fast"],
      char: "⚡",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    fire: {
      keywords: ["hot", "cook", "flame"],
      char: "🔥",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    boom: {
      keywords: ["bomb", "explode", "explosion", "collision", "blown"],
      char: "💥",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    snowflake: {
      keywords: ["winter", "season", "cold", "weather", "christmas", "xmas"],
      char: "❄️",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    cloud_with_snow: {
      keywords: ["weather"],
      char: "🌨",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    snowman: {
      keywords: ["winter", "season", "cold", "weather", "christmas", "xmas", "frozen", "without_snow"],
      char: "⛄",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    snowman_with_snow: {
      keywords: ["winter", "season", "cold", "weather", "christmas", "xmas", "frozen"],
      char: "☃",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    wind_face: {
      keywords: ["gust", "air"],
      char: "🌬",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    dash: {
      keywords: ["wind", "air", "fast", "shoo", "fart", "smoke", "puff"],
      char: "💨",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    tornado: {
      keywords: ["weather", "cyclone", "twister"],
      char: "🌪",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    fog: {
      keywords: ["weather"],
      char: "🌫",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    open_umbrella: {
      keywords: ["weather", "spring"],
      char: "☂",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    umbrella: {
      keywords: ["rainy", "weather", "spring"],
      char: "☔",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    droplet: {
      keywords: ["water", "drip", "faucet", "spring"],
      char: "💧",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    sweat_drops: {
      keywords: ["water", "drip", "oops"],
      char: "💦",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    ocean: {
      keywords: ["sea", "water", "wave", "nature", "tsunami", "disaster"],
      char: "🌊",
      fitzpatrick_scale: false,
      category: "animals_and_nature"
    },
    green_apple: {
      keywords: ["fruit", "nature"],
      char: "🍏",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    apple: {
      keywords: ["fruit", "mac", "school"],
      char: "🍎",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    pear: {
      keywords: ["fruit", "nature", "food"],
      char: "🍐",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    tangerine: {
      keywords: ["food", "fruit", "nature", "orange"],
      char: "🍊",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    lemon: {
      keywords: ["fruit", "nature"],
      char: "🍋",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    banana: {
      keywords: ["fruit", "food", "monkey"],
      char: "🍌",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    watermelon: {
      keywords: ["fruit", "food", "picnic", "summer"],
      char: "🍉",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    grapes: {
      keywords: ["fruit", "food", "wine"],
      char: "🍇",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    strawberry: {
      keywords: ["fruit", "food", "nature"],
      char: "🍓",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    melon: {
      keywords: ["fruit", "nature", "food"],
      char: "🍈",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    cherries: {
      keywords: ["food", "fruit"],
      char: "🍒",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    peach: {
      keywords: ["fruit", "nature", "food"],
      char: "🍑",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    pineapple: {
      keywords: ["fruit", "nature", "food"],
      char: "🍍",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    coconut: {
      keywords: ["fruit", "nature", "food", "palm"],
      char: "🥥",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    kiwi_fruit: {
      keywords: ["fruit", "food"],
      char: "🥝",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    mango: {
      keywords: ["fruit", "food", "tropical"],
      char: "🥭",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    avocado: {
      keywords: ["fruit", "food"],
      char: "🥑",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    broccoli: {
      keywords: ["fruit", "food", "vegetable"],
      char: "🥦",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    tomato: {
      keywords: ["fruit", "vegetable", "nature", "food"],
      char: "🍅",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    eggplant: {
      keywords: ["vegetable", "nature", "food", "aubergine"],
      char: "🍆",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    cucumber: {
      keywords: ["fruit", "food", "pickle"],
      char: "🥒",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    carrot: {
      keywords: ["vegetable", "food", "orange"],
      char: "🥕",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    hot_pepper: {
      keywords: ["food", "spicy", "chilli", "chili"],
      char: "🌶",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    potato: {
      keywords: ["food", "tuber", "vegatable", "starch"],
      char: "🥔",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    corn: {
      keywords: ["food", "vegetable", "plant"],
      char: "🌽",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    leafy_greens: {
      keywords: ["food", "vegetable", "plant", "bok choy", "cabbage", "kale", "lettuce"],
      char: "🥬",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    sweet_potato: {
      keywords: ["food", "nature"],
      char: "🍠",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    peanuts: {
      keywords: ["food", "nut"],
      char: "🥜",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    honey_pot: {
      keywords: ["bees", "sweet", "kitchen"],
      char: "🍯",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    croissant: {
      keywords: ["food", "bread", "french"],
      char: "🥐",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    bread: {
      keywords: ["food", "wheat", "breakfast", "toast"],
      char: "🍞",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    baguette_bread: {
      keywords: ["food", "bread", "french"],
      char: "🥖",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    bagel: {
      keywords: ["food", "bread", "bakery", "schmear"],
      char: "🥯",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    pretzel: {
      keywords: ["food", "bread", "twisted"],
      char: "🥨",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    cheese: {
      keywords: ["food", "chadder"],
      char: "🧀",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    egg: {
      keywords: ["food", "chicken", "breakfast"],
      char: "🥚",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    bacon: {
      keywords: ["food", "breakfast", "pork", "pig", "meat"],
      char: "🥓",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    steak: {
      keywords: ["food", "cow", "meat", "cut", "chop", "lambchop", "porkchop"],
      char: "🥩",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    pancakes: {
      keywords: ["food", "breakfast", "flapjacks", "hotcakes"],
      char: "🥞",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    poultry_leg: {
      keywords: ["food", "meat", "drumstick", "bird", "chicken", "turkey"],
      char: "🍗",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    meat_on_bone: {
      keywords: ["good", "food", "drumstick"],
      char: "🍖",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    bone: {
      keywords: ["skeleton"],
      char: "🦴",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    fried_shrimp: {
      keywords: ["food", "animal", "appetizer", "summer"],
      char: "🍤",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    fried_egg: {
      keywords: ["food", "breakfast", "kitchen", "egg"],
      char: "🍳",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    hamburger: {
      keywords: ["meat", "fast food", "beef", "cheeseburger", "mcdonalds", "burger king"],
      char: "🍔",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    fries: {
      keywords: ["chips", "snack", "fast food"],
      char: "🍟",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    stuffed_flatbread: {
      keywords: ["food", "flatbread", "stuffed", "gyro"],
      char: "🥙",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    hotdog: {
      keywords: ["food", "frankfurter"],
      char: "🌭",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    pizza: {
      keywords: ["food", "party"],
      char: "🍕",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    sandwich: {
      keywords: ["food", "lunch", "bread"],
      char: "🥪",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    canned_food: {
      keywords: ["food", "soup"],
      char: "🥫",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    spaghetti: {
      keywords: ["food", "italian", "noodle"],
      char: "🍝",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    taco: {
      keywords: ["food", "mexican"],
      char: "🌮",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    burrito: {
      keywords: ["food", "mexican"],
      char: "🌯",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    green_salad: {
      keywords: ["food", "healthy", "lettuce"],
      char: "🥗",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    shallow_pan_of_food: {
      keywords: ["food", "cooking", "casserole", "paella"],
      char: "🥘",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    ramen: {
      keywords: ["food", "japanese", "noodle", "chopsticks"],
      char: "🍜",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    stew: {
      keywords: ["food", "meat", "soup"],
      char: "🍲",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    fish_cake: {
      keywords: ["food", "japan", "sea", "beach", "narutomaki", "pink", "swirl", "kamaboko", "surimi", "ramen"],
      char: "🍥",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    fortune_cookie: {
      keywords: ["food", "prophecy"],
      char: "🥠",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    sushi: {
      keywords: ["food", "fish", "japanese", "rice"],
      char: "🍣",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    bento: {
      keywords: ["food", "japanese", "box"],
      char: "🍱",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    curry: {
      keywords: ["food", "spicy", "hot", "indian"],
      char: "🍛",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    rice_ball: {
      keywords: ["food", "japanese"],
      char: "🍙",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    rice: {
      keywords: ["food", "china", "asian"],
      char: "🍚",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    rice_cracker: {
      keywords: ["food", "japanese"],
      char: "🍘",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    oden: {
      keywords: ["food", "japanese"],
      char: "🍢",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    dango: {
      keywords: ["food", "dessert", "sweet", "japanese", "barbecue", "meat"],
      char: "🍡",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    shaved_ice: {
      keywords: ["hot", "dessert", "summer"],
      char: "🍧",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    ice_cream: {
      keywords: ["food", "hot", "dessert"],
      char: "🍨",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    icecream: {
      keywords: ["food", "hot", "dessert", "summer"],
      char: "🍦",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    pie: {
      keywords: ["food", "dessert", "pastry"],
      char: "🥧",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    cake: {
      keywords: ["food", "dessert"],
      char: "🍰",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    cupcake: {
      keywords: ["food", "dessert", "bakery", "sweet"],
      char: "🧁",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    moon_cake: {
      keywords: ["food", "autumn"],
      char: "🥮",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    birthday: {
      keywords: ["food", "dessert", "cake"],
      char: "🎂",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    custard: {
      keywords: ["dessert", "food"],
      char: "🍮",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    candy: {
      keywords: ["snack", "dessert", "sweet", "lolly"],
      char: "🍬",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    lollipop: {
      keywords: ["food", "snack", "candy", "sweet"],
      char: "🍭",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    chocolate_bar: {
      keywords: ["food", "snack", "dessert", "sweet"],
      char: "🍫",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    popcorn: {
      keywords: ["food", "movie theater", "films", "snack"],
      char: "🍿",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    dumpling: {
      keywords: ["food", "empanada", "pierogi", "potsticker"],
      char: "🥟",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    doughnut: {
      keywords: ["food", "dessert", "snack", "sweet", "donut"],
      char: "🍩",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    cookie: {
      keywords: ["food", "snack", "oreo", "chocolate", "sweet", "dessert"],
      char: "🍪",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    milk_glass: {
      keywords: ["beverage", "drink", "cow"],
      char: "🥛",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    beer: {
      keywords: ["relax", "beverage", "drink", "drunk", "party", "pub", "summer", "alcohol", "booze"],
      char: "🍺",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    beers: {
      keywords: ["relax", "beverage", "drink", "drunk", "party", "pub", "summer", "alcohol", "booze"],
      char: "🍻",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    clinking_glasses: {
      keywords: ["beverage", "drink", "party", "alcohol", "celebrate", "cheers", "wine", "champagne", "toast"],
      char: "🥂",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    wine_glass: {
      keywords: ["drink", "beverage", "drunk", "alcohol", "booze"],
      char: "🍷",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    tumbler_glass: {
      keywords: ["drink", "beverage", "drunk", "alcohol", "liquor", "booze", "bourbon", "scotch", "whisky", "glass", "shot"],
      char: "🥃",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    cocktail: {
      keywords: ["drink", "drunk", "alcohol", "beverage", "booze", "mojito"],
      char: "🍸",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    tropical_drink: {
      keywords: ["beverage", "cocktail", "summer", "beach", "alcohol", "booze", "mojito"],
      char: "🍹",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    champagne: {
      keywords: ["drink", "wine", "bottle", "celebration"],
      char: "🍾",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    sake: {
      keywords: ["wine", "drink", "drunk", "beverage", "japanese", "alcohol", "booze"],
      char: "🍶",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    tea: {
      keywords: ["drink", "bowl", "breakfast", "green", "british"],
      char: "🍵",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    cup_with_straw: {
      keywords: ["drink", "soda"],
      char: "🥤",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    coffee: {
      keywords: ["beverage", "caffeine", "latte", "espresso"],
      char: "☕",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    baby_bottle: {
      keywords: ["food", "container", "milk"],
      char: "🍼",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    salt: {
      keywords: ["condiment", "shaker"],
      char: "🧂",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    spoon: {
      keywords: ["cutlery", "kitchen", "tableware"],
      char: "🥄",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    fork_and_knife: {
      keywords: ["cutlery", "kitchen"],
      char: "🍴",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    plate_with_cutlery: {
      keywords: ["food", "eat", "meal", "lunch", "dinner", "restaurant"],
      char: "🍽",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    bowl_with_spoon: {
      keywords: ["food", "breakfast", "cereal", "oatmeal", "porridge"],
      char: "🥣",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    takeout_box: {
      keywords: ["food", "leftovers"],
      char: "🥡",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    chopsticks: {
      keywords: ["food"],
      char: "🥢",
      fitzpatrick_scale: false,
      category: "food_and_drink"
    },
    soccer: {
      keywords: ["sports", "football"],
      char: "⚽",
      fitzpatrick_scale: false,
      category: "activity"
    },
    basketball: {
      keywords: ["sports", "balls", "NBA"],
      char: "🏀",
      fitzpatrick_scale: false,
      category: "activity"
    },
    football: {
      keywords: ["sports", "balls", "NFL"],
      char: "🏈",
      fitzpatrick_scale: false,
      category: "activity"
    },
    baseball: {
      keywords: ["sports", "balls"],
      char: "⚾",
      fitzpatrick_scale: false,
      category: "activity"
    },
    softball: {
      keywords: ["sports", "balls"],
      char: "🥎",
      fitzpatrick_scale: false,
      category: "activity"
    },
    tennis: {
      keywords: ["sports", "balls", "green"],
      char: "🎾",
      fitzpatrick_scale: false,
      category: "activity"
    },
    volleyball: {
      keywords: ["sports", "balls"],
      char: "🏐",
      fitzpatrick_scale: false,
      category: "activity"
    },
    rugby_football: {
      keywords: ["sports", "team"],
      char: "🏉",
      fitzpatrick_scale: false,
      category: "activity"
    },
    flying_disc: {
      keywords: ["sports", "frisbee", "ultimate"],
      char: "🥏",
      fitzpatrick_scale: false,
      category: "activity"
    },
    "8ball": {
      keywords: ["pool", "hobby", "game", "luck", "magic"],
      char: "🎱",
      fitzpatrick_scale: false,
      category: "activity"
    },
    golf: {
      keywords: ["sports", "business", "flag", "hole", "summer"],
      char: "⛳",
      fitzpatrick_scale: false,
      category: "activity"
    },
    golfing_woman: {
      keywords: ["sports", "business", "woman", "female"],
      char: "🏌️‍♀️",
      fitzpatrick_scale: false,
      category: "activity"
    },
    golfing_man: {
      keywords: ["sports", "business"],
      char: "🏌",
      fitzpatrick_scale: true,
      category: "activity"
    },
    ping_pong: {
      keywords: ["sports", "pingpong"],
      char: "🏓",
      fitzpatrick_scale: false,
      category: "activity"
    },
    badminton: {
      keywords: ["sports"],
      char: "🏸",
      fitzpatrick_scale: false,
      category: "activity"
    },
    goal_net: {
      keywords: ["sports"],
      char: "🥅",
      fitzpatrick_scale: false,
      category: "activity"
    },
    ice_hockey: {
      keywords: ["sports"],
      char: "🏒",
      fitzpatrick_scale: false,
      category: "activity"
    },
    field_hockey: {
      keywords: ["sports"],
      char: "🏑",
      fitzpatrick_scale: false,
      category: "activity"
    },
    lacrosse: {
      keywords: ["sports", "ball", "stick"],
      char: "🥍",
      fitzpatrick_scale: false,
      category: "activity"
    },
    cricket: {
      keywords: ["sports"],
      char: "🏏",
      fitzpatrick_scale: false,
      category: "activity"
    },
    ski: {
      keywords: ["sports", "winter", "cold", "snow"],
      char: "🎿",
      fitzpatrick_scale: false,
      category: "activity"
    },
    skier: {
      keywords: ["sports", "winter", "snow"],
      char: "⛷",
      fitzpatrick_scale: false,
      category: "activity"
    },
    snowboarder: {
      keywords: ["sports", "winter"],
      char: "🏂",
      fitzpatrick_scale: true,
      category: "activity"
    },
    person_fencing: {
      keywords: ["sports", "fencing", "sword"],
      char: "🤺",
      fitzpatrick_scale: false,
      category: "activity"
    },
    women_wrestling: {
      keywords: ["sports", "wrestlers"],
      char: "🤼‍♀️",
      fitzpatrick_scale: false,
      category: "activity"
    },
    men_wrestling: {
      keywords: ["sports", "wrestlers"],
      char: "🤼‍♂️",
      fitzpatrick_scale: false,
      category: "activity"
    },
    woman_cartwheeling: {
      keywords: ["gymnastics"],
      char: "🤸‍♀️",
      fitzpatrick_scale: true,
      category: "activity"
    },
    man_cartwheeling: {
      keywords: ["gymnastics"],
      char: "🤸‍♂️",
      fitzpatrick_scale: true,
      category: "activity"
    },
    woman_playing_handball: {
      keywords: ["sports"],
      char: "🤾‍♀️",
      fitzpatrick_scale: true,
      category: "activity"
    },
    man_playing_handball: {
      keywords: ["sports"],
      char: "🤾‍♂️",
      fitzpatrick_scale: true,
      category: "activity"
    },
    ice_skate: {
      keywords: ["sports"],
      char: "⛸",
      fitzpatrick_scale: false,
      category: "activity"
    },
    curling_stone: {
      keywords: ["sports"],
      char: "🥌",
      fitzpatrick_scale: false,
      category: "activity"
    },
    skateboard: {
      keywords: ["board"],
      char: "🛹",
      fitzpatrick_scale: false,
      category: "activity"
    },
    sled: {
      keywords: ["sleigh", "luge", "toboggan"],
      char: "🛷",
      fitzpatrick_scale: false,
      category: "activity"
    },
    bow_and_arrow: {
      keywords: ["sports"],
      char: "🏹",
      fitzpatrick_scale: false,
      category: "activity"
    },
    fishing_pole_and_fish: {
      keywords: ["food", "hobby", "summer"],
      char: "🎣",
      fitzpatrick_scale: false,
      category: "activity"
    },
    boxing_glove: {
      keywords: ["sports", "fighting"],
      char: "🥊",
      fitzpatrick_scale: false,
      category: "activity"
    },
    martial_arts_uniform: {
      keywords: ["judo", "karate", "taekwondo"],
      char: "🥋",
      fitzpatrick_scale: false,
      category: "activity"
    },
    rowing_woman: {
      keywords: ["sports", "hobby", "water", "ship", "woman", "female"],
      char: "🚣‍♀️",
      fitzpatrick_scale: true,
      category: "activity"
    },
    rowing_man: {
      keywords: ["sports", "hobby", "water", "ship"],
      char: "🚣",
      fitzpatrick_scale: true,
      category: "activity"
    },
    climbing_woman: {
      keywords: ["sports", "hobby", "woman", "female", "rock"],
      char: "🧗‍♀️",
      fitzpatrick_scale: true,
      category: "activity"
    },
    climbing_man: {
      keywords: ["sports", "hobby", "man", "male", "rock"],
      char: "🧗‍♂️",
      fitzpatrick_scale: true,
      category: "activity"
    },
    swimming_woman: {
      keywords: ["sports", "exercise", "human", "athlete", "water", "summer", "woman", "female"],
      char: "🏊‍♀️",
      fitzpatrick_scale: true,
      category: "activity"
    },
    swimming_man: {
      keywords: ["sports", "exercise", "human", "athlete", "water", "summer"],
      char: "🏊",
      fitzpatrick_scale: true,
      category: "activity"
    },
    woman_playing_water_polo: {
      keywords: ["sports", "pool"],
      char: "🤽‍♀️",
      fitzpatrick_scale: true,
      category: "activity"
    },
    man_playing_water_polo: {
      keywords: ["sports", "pool"],
      char: "🤽‍♂️",
      fitzpatrick_scale: true,
      category: "activity"
    },
    woman_in_lotus_position: {
      keywords: ["woman", "female", "meditation", "yoga", "serenity", "zen", "mindfulness"],
      char: "🧘‍♀️",
      fitzpatrick_scale: true,
      category: "activity"
    },
    man_in_lotus_position: {
      keywords: ["man", "male", "meditation", "yoga", "serenity", "zen", "mindfulness"],
      char: "🧘‍♂️",
      fitzpatrick_scale: true,
      category: "activity"
    },
    surfing_woman: {
      keywords: ["sports", "ocean", "sea", "summer", "beach", "woman", "female"],
      char: "🏄‍♀️",
      fitzpatrick_scale: true,
      category: "activity"
    },
    surfing_man: {
      keywords: ["sports", "ocean", "sea", "summer", "beach"],
      char: "🏄",
      fitzpatrick_scale: true,
      category: "activity"
    },
    bath: {
      keywords: ["clean", "shower", "bathroom"],
      char: "🛀",
      fitzpatrick_scale: true,
      category: "activity"
    },
    basketball_woman: {
      keywords: ["sports", "human", "woman", "female"],
      char: "⛹️‍♀️",
      fitzpatrick_scale: true,
      category: "activity"
    },
    basketball_man: {
      keywords: ["sports", "human"],
      char: "⛹",
      fitzpatrick_scale: true,
      category: "activity"
    },
    weight_lifting_woman: {
      keywords: ["sports", "training", "exercise", "woman", "female"],
      char: "🏋️‍♀️",
      fitzpatrick_scale: true,
      category: "activity"
    },
    weight_lifting_man: {
      keywords: ["sports", "training", "exercise"],
      char: "🏋",
      fitzpatrick_scale: true,
      category: "activity"
    },
    biking_woman: {
      keywords: ["sports", "bike", "exercise", "hipster", "woman", "female"],
      char: "🚴‍♀️",
      fitzpatrick_scale: true,
      category: "activity"
    },
    biking_man: {
      keywords: ["sports", "bike", "exercise", "hipster"],
      char: "🚴",
      fitzpatrick_scale: true,
      category: "activity"
    },
    mountain_biking_woman: {
      keywords: ["transportation", "sports", "human", "race", "bike", "woman", "female"],
      char: "🚵‍♀️",
      fitzpatrick_scale: true,
      category: "activity"
    },
    mountain_biking_man: {
      keywords: ["transportation", "sports", "human", "race", "bike"],
      char: "🚵",
      fitzpatrick_scale: true,
      category: "activity"
    },
    horse_racing: {
      keywords: ["animal", "betting", "competition", "gambling", "luck"],
      char: "🏇",
      fitzpatrick_scale: true,
      category: "activity"
    },
    business_suit_levitating: {
      keywords: ["suit", "business", "levitate", "hover", "jump"],
      char: "🕴",
      fitzpatrick_scale: true,
      category: "activity"
    },
    trophy: {
      keywords: ["win", "award", "contest", "place", "ftw", "ceremony"],
      char: "🏆",
      fitzpatrick_scale: false,
      category: "activity"
    },
    running_shirt_with_sash: {
      keywords: ["play", "pageant"],
      char: "🎽",
      fitzpatrick_scale: false,
      category: "activity"
    },
    medal_sports: {
      keywords: ["award", "winning"],
      char: "🏅",
      fitzpatrick_scale: false,
      category: "activity"
    },
    medal_military: {
      keywords: ["award", "winning", "army"],
      char: "🎖",
      fitzpatrick_scale: false,
      category: "activity"
    },
    "1st_place_medal": {
      keywords: ["award", "winning", "first"],
      char: "🥇",
      fitzpatrick_scale: false,
      category: "activity"
    },
    "2nd_place_medal": {
      keywords: ["award", "second"],
      char: "🥈",
      fitzpatrick_scale: false,
      category: "activity"
    },
    "3rd_place_medal": {
      keywords: ["award", "third"],
      char: "🥉",
      fitzpatrick_scale: false,
      category: "activity"
    },
    reminder_ribbon: {
      keywords: ["sports", "cause", "support", "awareness"],
      char: "🎗",
      fitzpatrick_scale: false,
      category: "activity"
    },
    rosette: {
      keywords: ["flower", "decoration", "military"],
      char: "🏵",
      fitzpatrick_scale: false,
      category: "activity"
    },
    ticket: {
      keywords: ["event", "concert", "pass"],
      char: "🎫",
      fitzpatrick_scale: false,
      category: "activity"
    },
    tickets: {
      keywords: ["sports", "concert", "entrance"],
      char: "🎟",
      fitzpatrick_scale: false,
      category: "activity"
    },
    performing_arts: {
      keywords: ["acting", "theater", "drama"],
      char: "🎭",
      fitzpatrick_scale: false,
      category: "activity"
    },
    art: {
      keywords: ["design", "paint", "draw", "colors"],
      char: "🎨",
      fitzpatrick_scale: false,
      category: "activity"
    },
    circus_tent: {
      keywords: ["festival", "carnival", "party"],
      char: "🎪",
      fitzpatrick_scale: false,
      category: "activity"
    },
    woman_juggling: {
      keywords: ["juggle", "balance", "skill", "multitask"],
      char: "🤹‍♀️",
      fitzpatrick_scale: true,
      category: "activity"
    },
    man_juggling: {
      keywords: ["juggle", "balance", "skill", "multitask"],
      char: "🤹‍♂️",
      fitzpatrick_scale: true,
      category: "activity"
    },
    microphone: {
      keywords: ["sound", "music", "PA", "sing", "talkshow"],
      char: "🎤",
      fitzpatrick_scale: false,
      category: "activity"
    },
    headphones: {
      keywords: ["music", "score", "gadgets"],
      char: "🎧",
      fitzpatrick_scale: false,
      category: "activity"
    },
    musical_score: {
      keywords: ["treble", "clef", "compose"],
      char: "🎼",
      fitzpatrick_scale: false,
      category: "activity"
    },
    musical_keyboard: {
      keywords: ["piano", "instrument", "compose"],
      char: "🎹",
      fitzpatrick_scale: false,
      category: "activity"
    },
    drum: {
      keywords: ["music", "instrument", "drumsticks", "snare"],
      char: "🥁",
      fitzpatrick_scale: false,
      category: "activity"
    },
    saxophone: {
      keywords: ["music", "instrument", "jazz", "blues"],
      char: "🎷",
      fitzpatrick_scale: false,
      category: "activity"
    },
    trumpet: {
      keywords: ["music", "brass"],
      char: "🎺",
      fitzpatrick_scale: false,
      category: "activity"
    },
    guitar: {
      keywords: ["music", "instrument"],
      char: "🎸",
      fitzpatrick_scale: false,
      category: "activity"
    },
    violin: {
      keywords: ["music", "instrument", "orchestra", "symphony"],
      char: "🎻",
      fitzpatrick_scale: false,
      category: "activity"
    },
    clapper: {
      keywords: ["movie", "film", "record"],
      char: "🎬",
      fitzpatrick_scale: false,
      category: "activity"
    },
    video_game: {
      keywords: ["play", "console", "PS4", "controller"],
      char: "🎮",
      fitzpatrick_scale: false,
      category: "activity"
    },
    space_invader: {
      keywords: ["game", "arcade", "play"],
      char: "👾",
      fitzpatrick_scale: false,
      category: "activity"
    },
    dart: {
      keywords: ["game", "play", "bar", "target", "bullseye"],
      char: "🎯",
      fitzpatrick_scale: false,
      category: "activity"
    },
    game_die: {
      keywords: ["dice", "random", "tabletop", "play", "luck"],
      char: "🎲",
      fitzpatrick_scale: false,
      category: "activity"
    },
    chess_pawn: {
      keywords: ["expendable"],
      char: "♟",
      fitzpatrick_scale: false,
      category: "activity"
    },
    slot_machine: {
      keywords: ["bet", "gamble", "vegas", "fruit machine", "luck", "casino"],
      char: "🎰",
      fitzpatrick_scale: false,
      category: "activity"
    },
    jigsaw: {
      keywords: ["interlocking", "puzzle", "piece"],
      char: "🧩",
      fitzpatrick_scale: false,
      category: "activity"
    },
    bowling: {
      keywords: ["sports", "fun", "play"],
      char: "🎳",
      fitzpatrick_scale: false,
      category: "activity"
    },
    red_car: {
      keywords: ["red", "transportation", "vehicle"],
      char: "🚗",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    taxi: {
      keywords: ["uber", "vehicle", "cars", "transportation"],
      char: "🚕",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    blue_car: {
      keywords: ["transportation", "vehicle"],
      char: "🚙",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    bus: {
      keywords: ["car", "vehicle", "transportation"],
      char: "🚌",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    trolleybus: {
      keywords: ["bart", "transportation", "vehicle"],
      char: "🚎",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    racing_car: {
      keywords: ["sports", "race", "fast", "formula", "f1"],
      char: "🏎",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    police_car: {
      keywords: ["vehicle", "cars", "transportation", "law", "legal", "enforcement"],
      char: "🚓",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    ambulance: {
      keywords: ["health", "911", "hospital"],
      char: "🚑",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    fire_engine: {
      keywords: ["transportation", "cars", "vehicle"],
      char: "🚒",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    minibus: {
      keywords: ["vehicle", "car", "transportation"],
      char: "🚐",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    truck: {
      keywords: ["cars", "transportation"],
      char: "🚚",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    articulated_lorry: {
      keywords: ["vehicle", "cars", "transportation", "express"],
      char: "🚛",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    tractor: {
      keywords: ["vehicle", "car", "farming", "agriculture"],
      char: "🚜",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    kick_scooter: {
      keywords: ["vehicle", "kick", "razor"],
      char: "🛴",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    motorcycle: {
      keywords: ["race", "sports", "fast"],
      char: "🏍",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    bike: {
      keywords: ["sports", "bicycle", "exercise", "hipster"],
      char: "🚲",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    motor_scooter: {
      keywords: ["vehicle", "vespa", "sasha"],
      char: "🛵",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    rotating_light: {
      keywords: ["police", "ambulance", "911", "emergency", "alert", "error", "pinged", "law", "legal"],
      char: "🚨",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    oncoming_police_car: {
      keywords: ["vehicle", "law", "legal", "enforcement", "911"],
      char: "🚔",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    oncoming_bus: {
      keywords: ["vehicle", "transportation"],
      char: "🚍",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    oncoming_automobile: {
      keywords: ["car", "vehicle", "transportation"],
      char: "🚘",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    oncoming_taxi: {
      keywords: ["vehicle", "cars", "uber"],
      char: "🚖",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    aerial_tramway: {
      keywords: ["transportation", "vehicle", "ski"],
      char: "🚡",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    mountain_cableway: {
      keywords: ["transportation", "vehicle", "ski"],
      char: "🚠",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    suspension_railway: {
      keywords: ["vehicle", "transportation"],
      char: "🚟",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    railway_car: {
      keywords: ["transportation", "vehicle"],
      char: "🚃",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    train: {
      keywords: ["transportation", "vehicle", "carriage", "public", "travel"],
      char: "🚋",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    monorail: {
      keywords: ["transportation", "vehicle"],
      char: "🚝",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    bullettrain_side: {
      keywords: ["transportation", "vehicle"],
      char: "🚄",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    bullettrain_front: {
      keywords: ["transportation", "vehicle", "speed", "fast", "public", "travel"],
      char: "🚅",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    light_rail: {
      keywords: ["transportation", "vehicle"],
      char: "🚈",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    mountain_railway: {
      keywords: ["transportation", "vehicle"],
      char: "🚞",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    steam_locomotive: {
      keywords: ["transportation", "vehicle", "train"],
      char: "🚂",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    train2: {
      keywords: ["transportation", "vehicle"],
      char: "🚆",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    metro: {
      keywords: ["transportation", "blue-square", "mrt", "underground", "tube"],
      char: "🚇",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    tram: {
      keywords: ["transportation", "vehicle"],
      char: "🚊",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    station: {
      keywords: ["transportation", "vehicle", "public"],
      char: "🚉",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    flying_saucer: {
      keywords: ["transportation", "vehicle", "ufo"],
      char: "🛸",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    helicopter: {
      keywords: ["transportation", "vehicle", "fly"],
      char: "🚁",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    small_airplane: {
      keywords: ["flight", "transportation", "fly", "vehicle"],
      char: "🛩",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    airplane: {
      keywords: ["vehicle", "transportation", "flight", "fly"],
      char: "✈️",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    flight_departure: {
      keywords: ["airport", "flight", "landing"],
      char: "🛫",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    flight_arrival: {
      keywords: ["airport", "flight", "boarding"],
      char: "🛬",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    sailboat: {
      keywords: ["ship", "summer", "transportation", "water", "sailing"],
      char: "⛵",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    motor_boat: {
      keywords: ["ship"],
      char: "🛥",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    speedboat: {
      keywords: ["ship", "transportation", "vehicle", "summer"],
      char: "🚤",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    ferry: {
      keywords: ["boat", "ship", "yacht"],
      char: "⛴",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    passenger_ship: {
      keywords: ["yacht", "cruise", "ferry"],
      char: "🛳",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    rocket: {
      keywords: ["launch", "ship", "staffmode", "NASA", "outer space", "outer_space", "fly"],
      char: "🚀",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    artificial_satellite: {
      keywords: ["communication", "gps", "orbit", "spaceflight", "NASA", "ISS"],
      char: "🛰",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    seat: {
      keywords: ["sit", "airplane", "transport", "bus", "flight", "fly"],
      char: "💺",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    canoe: {
      keywords: ["boat", "paddle", "water", "ship"],
      char: "🛶",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    anchor: {
      keywords: ["ship", "ferry", "sea", "boat"],
      char: "⚓",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    construction: {
      keywords: ["wip", "progress", "caution", "warning"],
      char: "🚧",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    fuelpump: {
      keywords: ["gas station", "petroleum"],
      char: "⛽",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    busstop: {
      keywords: ["transportation", "wait"],
      char: "🚏",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    vertical_traffic_light: {
      keywords: ["transportation", "driving"],
      char: "🚦",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    traffic_light: {
      keywords: ["transportation", "signal"],
      char: "🚥",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    checkered_flag: {
      keywords: ["contest", "finishline", "race", "gokart"],
      char: "🏁",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    ship: {
      keywords: ["transportation", "titanic", "deploy"],
      char: "🚢",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    ferris_wheel: {
      keywords: ["photo", "carnival", "londoneye"],
      char: "🎡",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    roller_coaster: {
      keywords: ["carnival", "playground", "photo", "fun"],
      char: "🎢",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    carousel_horse: {
      keywords: ["photo", "carnival"],
      char: "🎠",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    building_construction: {
      keywords: ["wip", "working", "progress"],
      char: "🏗",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    foggy: {
      keywords: ["photo", "mountain"],
      char: "🌁",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    tokyo_tower: {
      keywords: ["photo", "japanese"],
      char: "🗼",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    factory: {
      keywords: ["building", "industry", "pollution", "smoke"],
      char: "🏭",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    fountain: {
      keywords: ["photo", "summer", "water", "fresh"],
      char: "⛲",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    rice_scene: {
      keywords: ["photo", "japan", "asia", "tsukimi"],
      char: "🎑",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    mountain: {
      keywords: ["photo", "nature", "environment"],
      char: "⛰",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    mountain_snow: {
      keywords: ["photo", "nature", "environment", "winter", "cold"],
      char: "🏔",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    mount_fuji: {
      keywords: ["photo", "mountain", "nature", "japanese"],
      char: "🗻",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    volcano: {
      keywords: ["photo", "nature", "disaster"],
      char: "🌋",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    japan: {
      keywords: ["nation", "country", "japanese", "asia"],
      char: "🗾",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    camping: {
      keywords: ["photo", "outdoors", "tent"],
      char: "🏕",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    tent: {
      keywords: ["photo", "camping", "outdoors"],
      char: "⛺",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    national_park: {
      keywords: ["photo", "environment", "nature"],
      char: "🏞",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    motorway: {
      keywords: ["road", "cupertino", "interstate", "highway"],
      char: "🛣",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    railway_track: {
      keywords: ["train", "transportation"],
      char: "🛤",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    sunrise: {
      keywords: ["morning", "view", "vacation", "photo"],
      char: "🌅",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    sunrise_over_mountains: {
      keywords: ["view", "vacation", "photo"],
      char: "🌄",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    desert: {
      keywords: ["photo", "warm", "saharah"],
      char: "🏜",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    beach_umbrella: {
      keywords: ["weather", "summer", "sunny", "sand", "mojito"],
      char: "🏖",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    desert_island: {
      keywords: ["photo", "tropical", "mojito"],
      char: "🏝",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    city_sunrise: {
      keywords: ["photo", "good morning", "dawn"],
      char: "🌇",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    city_sunset: {
      keywords: ["photo", "evening", "sky", "buildings"],
      char: "🌆",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    cityscape: {
      keywords: ["photo", "night life", "urban"],
      char: "🏙",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    night_with_stars: {
      keywords: ["evening", "city", "downtown"],
      char: "🌃",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    bridge_at_night: {
      keywords: ["photo", "sanfrancisco"],
      char: "🌉",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    milky_way: {
      keywords: ["photo", "space", "stars"],
      char: "🌌",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    stars: {
      keywords: ["night", "photo"],
      char: "🌠",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    sparkler: {
      keywords: ["stars", "night", "shine"],
      char: "🎇",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    fireworks: {
      keywords: ["photo", "festival", "carnival", "congratulations"],
      char: "🎆",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    rainbow: {
      keywords: ["nature", "happy", "unicorn_face", "photo", "sky", "spring"],
      char: "🌈",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    houses: {
      keywords: ["buildings", "photo"],
      char: "🏘",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    european_castle: {
      keywords: ["building", "royalty", "history"],
      char: "🏰",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    japanese_castle: {
      keywords: ["photo", "building"],
      char: "🏯",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    stadium: {
      keywords: ["photo", "place", "sports", "concert", "venue"],
      char: "🏟",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    statue_of_liberty: {
      keywords: ["american", "newyork"],
      char: "🗽",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    house: {
      keywords: ["building", "home"],
      char: "🏠",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    house_with_garden: {
      keywords: ["home", "plant", "nature"],
      char: "🏡",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    derelict_house: {
      keywords: ["abandon", "evict", "broken", "building"],
      char: "🏚",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    office: {
      keywords: ["building", "bureau", "work"],
      char: "🏢",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    department_store: {
      keywords: ["building", "shopping", "mall"],
      char: "🏬",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    post_office: {
      keywords: ["building", "envelope", "communication"],
      char: "🏣",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    european_post_office: {
      keywords: ["building", "email"],
      char: "🏤",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    hospital: {
      keywords: ["building", "health", "surgery", "doctor"],
      char: "🏥",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    bank: {
      keywords: ["building", "money", "sales", "cash", "business", "enterprise"],
      char: "🏦",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    hotel: {
      keywords: ["building", "accomodation", "checkin"],
      char: "🏨",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    convenience_store: {
      keywords: ["building", "shopping", "groceries"],
      char: "🏪",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    school: {
      keywords: ["building", "student", "education", "learn", "teach"],
      char: "🏫",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    love_hotel: {
      keywords: ["like", "affection", "dating"],
      char: "🏩",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    wedding: {
      keywords: ["love", "like", "affection", "couple", "marriage", "bride", "groom"],
      char: "💒",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    classical_building: {
      keywords: ["art", "culture", "history"],
      char: "🏛",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    church: {
      keywords: ["building", "religion", "christ"],
      char: "⛪",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    mosque: {
      keywords: ["islam", "worship", "minaret"],
      char: "🕌",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    synagogue: {
      keywords: ["judaism", "worship", "temple", "jewish"],
      char: "🕍",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    kaaba: {
      keywords: ["mecca", "mosque", "islam"],
      char: "🕋",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    shinto_shrine: {
      keywords: ["temple", "japan", "kyoto"],
      char: "⛩",
      fitzpatrick_scale: false,
      category: "travel_and_places"
    },
    watch: {
      keywords: ["time", "accessories"],
      char: "⌚",
      fitzpatrick_scale: false,
      category: "objects"
    },
    iphone: {
      keywords: ["technology", "apple", "gadgets", "dial"],
      char: "📱",
      fitzpatrick_scale: false,
      category: "objects"
    },
    calling: {
      keywords: ["iphone", "incoming"],
      char: "📲",
      fitzpatrick_scale: false,
      category: "objects"
    },
    computer: {
      keywords: ["technology", "laptop", "screen", "display", "monitor"],
      char: "💻",
      fitzpatrick_scale: false,
      category: "objects"
    },
    keyboard: {
      keywords: ["technology", "computer", "type", "input", "text"],
      char: "⌨",
      fitzpatrick_scale: false,
      category: "objects"
    },
    desktop_computer: {
      keywords: ["technology", "computing", "screen"],
      char: "🖥",
      fitzpatrick_scale: false,
      category: "objects"
    },
    printer: {
      keywords: ["paper", "ink"],
      char: "🖨",
      fitzpatrick_scale: false,
      category: "objects"
    },
    computer_mouse: {
      keywords: ["click"],
      char: "🖱",
      fitzpatrick_scale: false,
      category: "objects"
    },
    trackball: {
      keywords: ["technology", "trackpad"],
      char: "🖲",
      fitzpatrick_scale: false,
      category: "objects"
    },
    joystick: {
      keywords: ["game", "play"],
      char: "🕹",
      fitzpatrick_scale: false,
      category: "objects"
    },
    clamp: {
      keywords: ["tool"],
      char: "🗜",
      fitzpatrick_scale: false,
      category: "objects"
    },
    minidisc: {
      keywords: ["technology", "record", "data", "disk", "90s"],
      char: "💽",
      fitzpatrick_scale: false,
      category: "objects"
    },
    floppy_disk: {
      keywords: ["oldschool", "technology", "save", "90s", "80s"],
      char: "💾",
      fitzpatrick_scale: false,
      category: "objects"
    },
    cd: {
      keywords: ["technology", "dvd", "disk", "disc", "90s"],
      char: "💿",
      fitzpatrick_scale: false,
      category: "objects"
    },
    dvd: {
      keywords: ["cd", "disk", "disc"],
      char: "📀",
      fitzpatrick_scale: false,
      category: "objects"
    },
    vhs: {
      keywords: ["record", "video", "oldschool", "90s", "80s"],
      char: "📼",
      fitzpatrick_scale: false,
      category: "objects"
    },
    camera: {
      keywords: ["gadgets", "photography"],
      char: "📷",
      fitzpatrick_scale: false,
      category: "objects"
    },
    camera_flash: {
      keywords: ["photography", "gadgets"],
      char: "📸",
      fitzpatrick_scale: false,
      category: "objects"
    },
    video_camera: {
      keywords: ["film", "record"],
      char: "📹",
      fitzpatrick_scale: false,
      category: "objects"
    },
    movie_camera: {
      keywords: ["film", "record"],
      char: "🎥",
      fitzpatrick_scale: false,
      category: "objects"
    },
    film_projector: {
      keywords: ["video", "tape", "record", "movie"],
      char: "📽",
      fitzpatrick_scale: false,
      category: "objects"
    },
    film_strip: {
      keywords: ["movie"],
      char: "🎞",
      fitzpatrick_scale: false,
      category: "objects"
    },
    telephone_receiver: {
      keywords: ["technology", "communication", "dial"],
      char: "📞",
      fitzpatrick_scale: false,
      category: "objects"
    },
    phone: {
      keywords: ["technology", "communication", "dial", "telephone"],
      char: "☎️",
      fitzpatrick_scale: false,
      category: "objects"
    },
    pager: {
      keywords: ["bbcall", "oldschool", "90s"],
      char: "📟",
      fitzpatrick_scale: false,
      category: "objects"
    },
    fax: {
      keywords: ["communication", "technology"],
      char: "📠",
      fitzpatrick_scale: false,
      category: "objects"
    },
    tv: {
      keywords: ["technology", "program", "oldschool", "show", "television"],
      char: "📺",
      fitzpatrick_scale: false,
      category: "objects"
    },
    radio: {
      keywords: ["communication", "music", "podcast", "program"],
      char: "📻",
      fitzpatrick_scale: false,
      category: "objects"
    },
    studio_microphone: {
      keywords: ["sing", "recording", "artist", "talkshow"],
      char: "🎙",
      fitzpatrick_scale: false,
      category: "objects"
    },
    level_slider: {
      keywords: ["scale"],
      char: "🎚",
      fitzpatrick_scale: false,
      category: "objects"
    },
    control_knobs: {
      keywords: ["dial"],
      char: "🎛",
      fitzpatrick_scale: false,
      category: "objects"
    },
    compass: {
      keywords: ["magnetic", "navigation", "orienteering"],
      char: "🧭",
      fitzpatrick_scale: false,
      category: "objects"
    },
    stopwatch: {
      keywords: ["time", "deadline"],
      char: "⏱",
      fitzpatrick_scale: false,
      category: "objects"
    },
    timer_clock: {
      keywords: ["alarm"],
      char: "⏲",
      fitzpatrick_scale: false,
      category: "objects"
    },
    alarm_clock: {
      keywords: ["time", "wake"],
      char: "⏰",
      fitzpatrick_scale: false,
      category: "objects"
    },
    mantelpiece_clock: {
      keywords: ["time"],
      char: "🕰",
      fitzpatrick_scale: false,
      category: "objects"
    },
    hourglass_flowing_sand: {
      keywords: ["oldschool", "time", "countdown"],
      char: "⏳",
      fitzpatrick_scale: false,
      category: "objects"
    },
    hourglass: {
      keywords: ["time", "clock", "oldschool", "limit", "exam", "quiz", "test"],
      char: "⌛",
      fitzpatrick_scale: false,
      category: "objects"
    },
    satellite: {
      keywords: ["communication", "future", "radio", "space"],
      char: "📡",
      fitzpatrick_scale: false,
      category: "objects"
    },
    battery: {
      keywords: ["power", "energy", "sustain"],
      char: "🔋",
      fitzpatrick_scale: false,
      category: "objects"
    },
    electric_plug: {
      keywords: ["charger", "power"],
      char: "🔌",
      fitzpatrick_scale: false,
      category: "objects"
    },
    bulb: {
      keywords: ["light", "electricity", "idea"],
      char: "💡",
      fitzpatrick_scale: false,
      category: "objects"
    },
    flashlight: {
      keywords: ["dark", "camping", "sight", "night"],
      char: "🔦",
      fitzpatrick_scale: false,
      category: "objects"
    },
    candle: {
      keywords: ["fire", "wax"],
      char: "🕯",
      fitzpatrick_scale: false,
      category: "objects"
    },
    fire_extinguisher: {
      keywords: ["quench"],
      char: "🧯",
      fitzpatrick_scale: false,
      category: "objects"
    },
    wastebasket: {
      keywords: ["bin", "trash", "rubbish", "garbage", "toss"],
      char: "🗑",
      fitzpatrick_scale: false,
      category: "objects"
    },
    oil_drum: {
      keywords: ["barrell"],
      char: "🛢",
      fitzpatrick_scale: false,
      category: "objects"
    },
    money_with_wings: {
      keywords: ["dollar", "bills", "payment", "sale"],
      char: "💸",
      fitzpatrick_scale: false,
      category: "objects"
    },
    dollar: {
      keywords: ["money", "sales", "bill", "currency"],
      char: "💵",
      fitzpatrick_scale: false,
      category: "objects"
    },
    yen: {
      keywords: ["money", "sales", "japanese", "dollar", "currency"],
      char: "💴",
      fitzpatrick_scale: false,
      category: "objects"
    },
    euro: {
      keywords: ["money", "sales", "dollar", "currency"],
      char: "💶",
      fitzpatrick_scale: false,
      category: "objects"
    },
    pound: {
      keywords: ["british", "sterling", "money", "sales", "bills", "uk", "england", "currency"],
      char: "💷",
      fitzpatrick_scale: false,
      category: "objects"
    },
    moneybag: {
      keywords: ["dollar", "payment", "coins", "sale"],
      char: "💰",
      fitzpatrick_scale: false,
      category: "objects"
    },
    credit_card: {
      keywords: ["money", "sales", "dollar", "bill", "payment", "shopping"],
      char: "💳",
      fitzpatrick_scale: false,
      category: "objects"
    },
    gem: {
      keywords: ["blue", "ruby", "diamond", "jewelry"],
      char: "💎",
      fitzpatrick_scale: false,
      category: "objects"
    },
    balance_scale: {
      keywords: ["law", "fairness", "weight"],
      char: "⚖",
      fitzpatrick_scale: false,
      category: "objects"
    },
    toolbox: {
      keywords: ["tools", "diy", "fix", "maintainer", "mechanic"],
      char: "🧰",
      fitzpatrick_scale: false,
      category: "objects"
    },
    wrench: {
      keywords: ["tools", "diy", "ikea", "fix", "maintainer"],
      char: "🔧",
      fitzpatrick_scale: false,
      category: "objects"
    },
    hammer: {
      keywords: ["tools", "build", "create"],
      char: "🔨",
      fitzpatrick_scale: false,
      category: "objects"
    },
    hammer_and_pick: {
      keywords: ["tools", "build", "create"],
      char: "⚒",
      fitzpatrick_scale: false,
      category: "objects"
    },
    hammer_and_wrench: {
      keywords: ["tools", "build", "create"],
      char: "🛠",
      fitzpatrick_scale: false,
      category: "objects"
    },
    pick: {
      keywords: ["tools", "dig"],
      char: "⛏",
      fitzpatrick_scale: false,
      category: "objects"
    },
    nut_and_bolt: {
      keywords: ["handy", "tools", "fix"],
      char: "🔩",
      fitzpatrick_scale: false,
      category: "objects"
    },
    gear: {
      keywords: ["cog"],
      char: "⚙",
      fitzpatrick_scale: false,
      category: "objects"
    },
    brick: {
      keywords: ["bricks"],
      char: "🧱",
      fitzpatrick_scale: false,
      category: "objects"
    },
    chains: {
      keywords: ["lock", "arrest"],
      char: "⛓",
      fitzpatrick_scale: false,
      category: "objects"
    },
    magnet: {
      keywords: ["attraction", "magnetic"],
      char: "🧲",
      fitzpatrick_scale: false,
      category: "objects"
    },
    gun: {
      keywords: ["violence", "weapon", "pistol", "revolver"],
      char: "🔫",
      fitzpatrick_scale: false,
      category: "objects"
    },
    bomb: {
      keywords: ["boom", "explode", "explosion", "terrorism"],
      char: "💣",
      fitzpatrick_scale: false,
      category: "objects"
    },
    firecracker: {
      keywords: ["dynamite", "boom", "explode", "explosion", "explosive"],
      char: "🧨",
      fitzpatrick_scale: false,
      category: "objects"
    },
    hocho: {
      keywords: ["knife", "blade", "cutlery", "kitchen", "weapon"],
      char: "🔪",
      fitzpatrick_scale: false,
      category: "objects"
    },
    dagger: {
      keywords: ["weapon"],
      char: "🗡",
      fitzpatrick_scale: false,
      category: "objects"
    },
    crossed_swords: {
      keywords: ["weapon"],
      char: "⚔",
      fitzpatrick_scale: false,
      category: "objects"
    },
    shield: {
      keywords: ["protection", "security"],
      char: "🛡",
      fitzpatrick_scale: false,
      category: "objects"
    },
    smoking: {
      keywords: ["kills", "tobacco", "cigarette", "joint", "smoke"],
      char: "🚬",
      fitzpatrick_scale: false,
      category: "objects"
    },
    skull_and_crossbones: {
      keywords: ["poison", "danger", "deadly", "scary", "death", "pirate", "evil"],
      char: "☠",
      fitzpatrick_scale: false,
      category: "objects"
    },
    coffin: {
      keywords: ["vampire", "dead", "die", "death", "rip", "graveyard", "cemetery", "casket", "funeral", "box"],
      char: "⚰",
      fitzpatrick_scale: false,
      category: "objects"
    },
    funeral_urn: {
      keywords: ["dead", "die", "death", "rip", "ashes"],
      char: "⚱",
      fitzpatrick_scale: false,
      category: "objects"
    },
    amphora: {
      keywords: ["vase", "jar"],
      char: "🏺",
      fitzpatrick_scale: false,
      category: "objects"
    },
    crystal_ball: {
      keywords: ["disco", "party", "magic", "circus", "fortune_teller"],
      char: "🔮",
      fitzpatrick_scale: false,
      category: "objects"
    },
    prayer_beads: {
      keywords: ["dhikr", "religious"],
      char: "📿",
      fitzpatrick_scale: false,
      category: "objects"
    },
    nazar_amulet: {
      keywords: ["bead", "charm"],
      char: "🧿",
      fitzpatrick_scale: false,
      category: "objects"
    },
    barber: {
      keywords: ["hair", "salon", "style"],
      char: "💈",
      fitzpatrick_scale: false,
      category: "objects"
    },
    alembic: {
      keywords: ["distilling", "science", "experiment", "chemistry"],
      char: "⚗",
      fitzpatrick_scale: false,
      category: "objects"
    },
    telescope: {
      keywords: ["stars", "space", "zoom", "science", "astronomy"],
      char: "🔭",
      fitzpatrick_scale: false,
      category: "objects"
    },
    microscope: {
      keywords: ["laboratory", "experiment", "zoomin", "science", "study"],
      char: "🔬",
      fitzpatrick_scale: false,
      category: "objects"
    },
    hole: {
      keywords: ["embarrassing"],
      char: "🕳",
      fitzpatrick_scale: false,
      category: "objects"
    },
    pill: {
      keywords: ["health", "medicine", "doctor", "pharmacy", "drug"],
      char: "💊",
      fitzpatrick_scale: false,
      category: "objects"
    },
    syringe: {
      keywords: ["health", "hospital", "drugs", "blood", "medicine", "needle", "doctor", "nurse"],
      char: "💉",
      fitzpatrick_scale: false,
      category: "objects"
    },
    dna: {
      keywords: ["biologist", "genetics", "life"],
      char: "🧬",
      fitzpatrick_scale: false,
      category: "objects"
    },
    microbe: {
      keywords: ["amoeba", "bacteria", "germs"],
      char: "🦠",
      fitzpatrick_scale: false,
      category: "objects"
    },
    petri_dish: {
      keywords: ["bacteria", "biology", "culture", "lab"],
      char: "🧫",
      fitzpatrick_scale: false,
      category: "objects"
    },
    test_tube: {
      keywords: ["chemistry", "experiment", "lab", "science"],
      char: "🧪",
      fitzpatrick_scale: false,
      category: "objects"
    },
    thermometer: {
      keywords: ["weather", "temperature", "hot", "cold"],
      char: "🌡",
      fitzpatrick_scale: false,
      category: "objects"
    },
    broom: {
      keywords: ["cleaning", "sweeping", "witch"],
      char: "🧹",
      fitzpatrick_scale: false,
      category: "objects"
    },
    basket: {
      keywords: ["laundry"],
      char: "🧺",
      fitzpatrick_scale: false,
      category: "objects"
    },
    toilet_paper: {
      keywords: ["roll"],
      char: "🧻",
      fitzpatrick_scale: false,
      category: "objects"
    },
    label: {
      keywords: ["sale", "tag"],
      char: "🏷",
      fitzpatrick_scale: false,
      category: "objects"
    },
    bookmark: {
      keywords: ["favorite", "label", "save"],
      char: "🔖",
      fitzpatrick_scale: false,
      category: "objects"
    },
    toilet: {
      keywords: ["restroom", "wc", "washroom", "bathroom", "potty"],
      char: "🚽",
      fitzpatrick_scale: false,
      category: "objects"
    },
    shower: {
      keywords: ["clean", "water", "bathroom"],
      char: "🚿",
      fitzpatrick_scale: false,
      category: "objects"
    },
    bathtub: {
      keywords: ["clean", "shower", "bathroom"],
      char: "🛁",
      fitzpatrick_scale: false,
      category: "objects"
    },
    soap: {
      keywords: ["bar", "bathing", "cleaning", "lather"],
      char: "🧼",
      fitzpatrick_scale: false,
      category: "objects"
    },
    sponge: {
      keywords: ["absorbing", "cleaning", "porous"],
      char: "🧽",
      fitzpatrick_scale: false,
      category: "objects"
    },
    lotion_bottle: {
      keywords: ["moisturizer", "sunscreen"],
      char: "🧴",
      fitzpatrick_scale: false,
      category: "objects"
    },
    key: {
      keywords: ["lock", "door", "password"],
      char: "🔑",
      fitzpatrick_scale: false,
      category: "objects"
    },
    old_key: {
      keywords: ["lock", "door", "password"],
      char: "🗝",
      fitzpatrick_scale: false,
      category: "objects"
    },
    couch_and_lamp: {
      keywords: ["read", "chill"],
      char: "🛋",
      fitzpatrick_scale: false,
      category: "objects"
    },
    sleeping_bed: {
      keywords: ["bed", "rest"],
      char: "🛌",
      fitzpatrick_scale: true,
      category: "objects"
    },
    bed: {
      keywords: ["sleep", "rest"],
      char: "🛏",
      fitzpatrick_scale: false,
      category: "objects"
    },
    door: {
      keywords: ["house", "entry", "exit"],
      char: "🚪",
      fitzpatrick_scale: false,
      category: "objects"
    },
    bellhop_bell: {
      keywords: ["service"],
      char: "🛎",
      fitzpatrick_scale: false,
      category: "objects"
    },
    teddy_bear: {
      keywords: ["plush", "stuffed"],
      char: "🧸",
      fitzpatrick_scale: false,
      category: "objects"
    },
    framed_picture: {
      keywords: ["photography"],
      char: "🖼",
      fitzpatrick_scale: false,
      category: "objects"
    },
    world_map: {
      keywords: ["location", "direction"],
      char: "🗺",
      fitzpatrick_scale: false,
      category: "objects"
    },
    parasol_on_ground: {
      keywords: ["weather", "summer"],
      char: "⛱",
      fitzpatrick_scale: false,
      category: "objects"
    },
    moyai: {
      keywords: ["rock", "easter island", "moai"],
      char: "🗿",
      fitzpatrick_scale: false,
      category: "objects"
    },
    shopping: {
      keywords: ["mall", "buy", "purchase"],
      char: "🛍",
      fitzpatrick_scale: false,
      category: "objects"
    },
    shopping_cart: {
      keywords: ["trolley"],
      char: "🛒",
      fitzpatrick_scale: false,
      category: "objects"
    },
    balloon: {
      keywords: ["party", "celebration", "birthday", "circus"],
      char: "🎈",
      fitzpatrick_scale: false,
      category: "objects"
    },
    flags: {
      keywords: ["fish", "japanese", "koinobori", "carp", "banner"],
      char: "🎏",
      fitzpatrick_scale: false,
      category: "objects"
    },
    ribbon: {
      keywords: ["decoration", "pink", "girl", "bowtie"],
      char: "🎀",
      fitzpatrick_scale: false,
      category: "objects"
    },
    gift: {
      keywords: ["present", "birthday", "christmas", "xmas"],
      char: "🎁",
      fitzpatrick_scale: false,
      category: "objects"
    },
    confetti_ball: {
      keywords: ["festival", "party", "birthday", "circus"],
      char: "🎊",
      fitzpatrick_scale: false,
      category: "objects"
    },
    tada: {
      keywords: ["party", "congratulations", "birthday", "magic", "circus", "celebration"],
      char: "🎉",
      fitzpatrick_scale: false,
      category: "objects"
    },
    dolls: {
      keywords: ["japanese", "toy", "kimono"],
      char: "🎎",
      fitzpatrick_scale: false,
      category: "objects"
    },
    wind_chime: {
      keywords: ["nature", "ding", "spring", "bell"],
      char: "🎐",
      fitzpatrick_scale: false,
      category: "objects"
    },
    crossed_flags: {
      keywords: ["japanese", "nation", "country", "border"],
      char: "🎌",
      fitzpatrick_scale: false,
      category: "objects"
    },
    izakaya_lantern: {
      keywords: ["light", "paper", "halloween", "spooky"],
      char: "🏮",
      fitzpatrick_scale: false,
      category: "objects"
    },
    red_envelope: {
      keywords: ["gift"],
      char: "🧧",
      fitzpatrick_scale: false,
      category: "objects"
    },
    email: {
      keywords: ["letter", "postal", "inbox", "communication"],
      char: "✉️",
      fitzpatrick_scale: false,
      category: "objects"
    },
    envelope_with_arrow: {
      keywords: ["email", "communication"],
      char: "📩",
      fitzpatrick_scale: false,
      category: "objects"
    },
    incoming_envelope: {
      keywords: ["email", "inbox"],
      char: "📨",
      fitzpatrick_scale: false,
      category: "objects"
    },
    "e-mail": {
      keywords: ["communication", "inbox"],
      char: "📧",
      fitzpatrick_scale: false,
      category: "objects"
    },
    love_letter: {
      keywords: ["email", "like", "affection", "envelope", "valentines"],
      char: "💌",
      fitzpatrick_scale: false,
      category: "objects"
    },
    postbox: {
      keywords: ["email", "letter", "envelope"],
      char: "📮",
      fitzpatrick_scale: false,
      category: "objects"
    },
    mailbox_closed: {
      keywords: ["email", "communication", "inbox"],
      char: "📪",
      fitzpatrick_scale: false,
      category: "objects"
    },
    mailbox: {
      keywords: ["email", "inbox", "communication"],
      char: "📫",
      fitzpatrick_scale: false,
      category: "objects"
    },
    mailbox_with_mail: {
      keywords: ["email", "inbox", "communication"],
      char: "📬",
      fitzpatrick_scale: false,
      category: "objects"
    },
    mailbox_with_no_mail: {
      keywords: ["email", "inbox"],
      char: "📭",
      fitzpatrick_scale: false,
      category: "objects"
    },
    package: {
      keywords: ["mail", "gift", "cardboard", "box", "moving"],
      char: "📦",
      fitzpatrick_scale: false,
      category: "objects"
    },
    postal_horn: {
      keywords: ["instrument", "music"],
      char: "📯",
      fitzpatrick_scale: false,
      category: "objects"
    },
    inbox_tray: {
      keywords: ["email", "documents"],
      char: "📥",
      fitzpatrick_scale: false,
      category: "objects"
    },
    outbox_tray: {
      keywords: ["inbox", "email"],
      char: "📤",
      fitzpatrick_scale: false,
      category: "objects"
    },
    scroll: {
      keywords: ["documents", "ancient", "history", "paper"],
      char: "📜",
      fitzpatrick_scale: false,
      category: "objects"
    },
    page_with_curl: {
      keywords: ["documents", "office", "paper"],
      char: "📃",
      fitzpatrick_scale: false,
      category: "objects"
    },
    bookmark_tabs: {
      keywords: ["favorite", "save", "order", "tidy"],
      char: "📑",
      fitzpatrick_scale: false,
      category: "objects"
    },
    receipt: {
      keywords: ["accounting", "expenses"],
      char: "🧾",
      fitzpatrick_scale: false,
      category: "objects"
    },
    bar_chart: {
      keywords: ["graph", "presentation", "stats"],
      char: "📊",
      fitzpatrick_scale: false,
      category: "objects"
    },
    chart_with_upwards_trend: {
      keywords: ["graph", "presentation", "stats", "recovery", "business", "economics", "money", "sales", "good", "success"],
      char: "📈",
      fitzpatrick_scale: false,
      category: "objects"
    },
    chart_with_downwards_trend: {
      keywords: ["graph", "presentation", "stats", "recession", "business", "economics", "money", "sales", "bad", "failure"],
      char: "📉",
      fitzpatrick_scale: false,
      category: "objects"
    },
    page_facing_up: {
      keywords: ["documents", "office", "paper", "information"],
      char: "📄",
      fitzpatrick_scale: false,
      category: "objects"
    },
    date: {
      keywords: ["calendar", "schedule"],
      char: "📅",
      fitzpatrick_scale: false,
      category: "objects"
    },
    calendar: {
      keywords: ["schedule", "date", "planning"],
      char: "📆",
      fitzpatrick_scale: false,
      category: "objects"
    },
    spiral_calendar: {
      keywords: ["date", "schedule", "planning"],
      char: "🗓",
      fitzpatrick_scale: false,
      category: "objects"
    },
    card_index: {
      keywords: ["business", "stationery"],
      char: "📇",
      fitzpatrick_scale: false,
      category: "objects"
    },
    card_file_box: {
      keywords: ["business", "stationery"],
      char: "🗃",
      fitzpatrick_scale: false,
      category: "objects"
    },
    ballot_box: {
      keywords: ["election", "vote"],
      char: "🗳",
      fitzpatrick_scale: false,
      category: "objects"
    },
    file_cabinet: {
      keywords: ["filing", "organizing"],
      char: "🗄",
      fitzpatrick_scale: false,
      category: "objects"
    },
    clipboard: {
      keywords: ["stationery", "documents"],
      char: "📋",
      fitzpatrick_scale: false,
      category: "objects"
    },
    spiral_notepad: {
      keywords: ["memo", "stationery"],
      char: "🗒",
      fitzpatrick_scale: false,
      category: "objects"
    },
    file_folder: {
      keywords: ["documents", "business", "office"],
      char: "📁",
      fitzpatrick_scale: false,
      category: "objects"
    },
    open_file_folder: {
      keywords: ["documents", "load"],
      char: "📂",
      fitzpatrick_scale: false,
      category: "objects"
    },
    card_index_dividers: {
      keywords: ["organizing", "business", "stationery"],
      char: "🗂",
      fitzpatrick_scale: false,
      category: "objects"
    },
    newspaper_roll: {
      keywords: ["press", "headline"],
      char: "🗞",
      fitzpatrick_scale: false,
      category: "objects"
    },
    newspaper: {
      keywords: ["press", "headline"],
      char: "📰",
      fitzpatrick_scale: false,
      category: "objects"
    },
    notebook: {
      keywords: ["stationery", "record", "notes", "paper", "study"],
      char: "📓",
      fitzpatrick_scale: false,
      category: "objects"
    },
    closed_book: {
      keywords: ["read", "library", "knowledge", "textbook", "learn"],
      char: "📕",
      fitzpatrick_scale: false,
      category: "objects"
    },
    green_book: {
      keywords: ["read", "library", "knowledge", "study"],
      char: "📗",
      fitzpatrick_scale: false,
      category: "objects"
    },
    blue_book: {
      keywords: ["read", "library", "knowledge", "learn", "study"],
      char: "📘",
      fitzpatrick_scale: false,
      category: "objects"
    },
    orange_book: {
      keywords: ["read", "library", "knowledge", "textbook", "study"],
      char: "📙",
      fitzpatrick_scale: false,
      category: "objects"
    },
    notebook_with_decorative_cover: {
      keywords: ["classroom", "notes", "record", "paper", "study"],
      char: "📔",
      fitzpatrick_scale: false,
      category: "objects"
    },
    ledger: {
      keywords: ["notes", "paper"],
      char: "📒",
      fitzpatrick_scale: false,
      category: "objects"
    },
    books: {
      keywords: ["literature", "library", "study"],
      char: "📚",
      fitzpatrick_scale: false,
      category: "objects"
    },
    open_book: {
      keywords: ["book", "read", "library", "knowledge", "literature", "learn", "study"],
      char: "📖",
      fitzpatrick_scale: false,
      category: "objects"
    },
    safety_pin: {
      keywords: ["diaper"],
      char: "🧷",
      fitzpatrick_scale: false,
      category: "objects"
    },
    link: {
      keywords: ["rings", "url"],
      char: "🔗",
      fitzpatrick_scale: false,
      category: "objects"
    },
    paperclip: {
      keywords: ["documents", "stationery"],
      char: "📎",
      fitzpatrick_scale: false,
      category: "objects"
    },
    paperclips: {
      keywords: ["documents", "stationery"],
      char: "🖇",
      fitzpatrick_scale: false,
      category: "objects"
    },
    scissors: {
      keywords: ["stationery", "cut"],
      char: "✂️",
      fitzpatrick_scale: false,
      category: "objects"
    },
    triangular_ruler: {
      keywords: ["stationery", "math", "architect", "sketch"],
      char: "📐",
      fitzpatrick_scale: false,
      category: "objects"
    },
    straight_ruler: {
      keywords: ["stationery", "calculate", "length", "math", "school", "drawing", "architect", "sketch"],
      char: "📏",
      fitzpatrick_scale: false,
      category: "objects"
    },
    abacus: {
      keywords: ["calculation"],
      char: "🧮",
      fitzpatrick_scale: false,
      category: "objects"
    },
    pushpin: {
      keywords: ["stationery", "mark", "here"],
      char: "📌",
      fitzpatrick_scale: false,
      category: "objects"
    },
    round_pushpin: {
      keywords: ["stationery", "location", "map", "here"],
      char: "📍",
      fitzpatrick_scale: false,
      category: "objects"
    },
    triangular_flag_on_post: {
      keywords: ["mark", "milestone", "place"],
      char: "🚩",
      fitzpatrick_scale: false,
      category: "objects"
    },
    white_flag: {
      keywords: ["losing", "loser", "lost", "surrender", "give up", "fail"],
      char: "🏳",
      fitzpatrick_scale: false,
      category: "objects"
    },
    black_flag: {
      keywords: ["pirate"],
      char: "🏴",
      fitzpatrick_scale: false,
      category: "objects"
    },
    rainbow_flag: {
      keywords: ["flag", "rainbow", "pride", "gay", "lgbt", "glbt", "queer", "homosexual", "lesbian", "bisexual", "transgender"],
      char: "🏳️‍🌈",
      fitzpatrick_scale: false,
      category: "objects"
    },
    closed_lock_with_key: {
      keywords: ["security", "privacy"],
      char: "🔐",
      fitzpatrick_scale: false,
      category: "objects"
    },
    lock: {
      keywords: ["security", "password", "padlock"],
      char: "🔒",
      fitzpatrick_scale: false,
      category: "objects"
    },
    unlock: {
      keywords: ["privacy", "security"],
      char: "🔓",
      fitzpatrick_scale: false,
      category: "objects"
    },
    lock_with_ink_pen: {
      keywords: ["security", "secret"],
      char: "🔏",
      fitzpatrick_scale: false,
      category: "objects"
    },
    pen: {
      keywords: ["stationery", "writing", "write"],
      char: "🖊",
      fitzpatrick_scale: false,
      category: "objects"
    },
    fountain_pen: {
      keywords: ["stationery", "writing", "write"],
      char: "🖋",
      fitzpatrick_scale: false,
      category: "objects"
    },
    black_nib: {
      keywords: ["pen", "stationery", "writing", "write"],
      char: "✒️",
      fitzpatrick_scale: false,
      category: "objects"
    },
    memo: {
      keywords: ["write", "documents", "stationery", "pencil", "paper", "writing", "legal", "exam", "quiz", "test", "study", "compose"],
      char: "📝",
      fitzpatrick_scale: false,
      category: "objects"
    },
    pencil2: {
      keywords: ["stationery", "write", "paper", "writing", "school", "study"],
      char: "✏️",
      fitzpatrick_scale: false,
      category: "objects"
    },
    crayon: {
      keywords: ["drawing", "creativity"],
      char: "🖍",
      fitzpatrick_scale: false,
      category: "objects"
    },
    paintbrush: {
      keywords: ["drawing", "creativity", "art"],
      char: "🖌",
      fitzpatrick_scale: false,
      category: "objects"
    },
    mag: {
      keywords: ["search", "zoom", "find", "detective"],
      char: "🔍",
      fitzpatrick_scale: false,
      category: "objects"
    },
    mag_right: {
      keywords: ["search", "zoom", "find", "detective"],
      char: "🔎",
      fitzpatrick_scale: false,
      category: "objects"
    },
    heart: {
      keywords: ["love", "like", "valentines"],
      char: "❤️",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    orange_heart: {
      keywords: ["love", "like", "affection", "valentines"],
      char: "🧡",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    yellow_heart: {
      keywords: ["love", "like", "affection", "valentines"],
      char: "💛",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    green_heart: {
      keywords: ["love", "like", "affection", "valentines"],
      char: "💚",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    blue_heart: {
      keywords: ["love", "like", "affection", "valentines"],
      char: "💙",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    purple_heart: {
      keywords: ["love", "like", "affection", "valentines"],
      char: "💜",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    black_heart: {
      keywords: ["evil"],
      char: "🖤",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    broken_heart: {
      keywords: ["sad", "sorry", "break", "heart", "heartbreak"],
      char: "💔",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    heavy_heart_exclamation: {
      keywords: ["decoration", "love"],
      char: "❣",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    two_hearts: {
      keywords: ["love", "like", "affection", "valentines", "heart"],
      char: "💕",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    revolving_hearts: {
      keywords: ["love", "like", "affection", "valentines"],
      char: "💞",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    heartbeat: {
      keywords: ["love", "like", "affection", "valentines", "pink", "heart"],
      char: "💓",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    heartpulse: {
      keywords: ["like", "love", "affection", "valentines", "pink"],
      char: "💗",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    sparkling_heart: {
      keywords: ["love", "like", "affection", "valentines"],
      char: "💖",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    cupid: {
      keywords: ["love", "like", "heart", "affection", "valentines"],
      char: "💘",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    gift_heart: {
      keywords: ["love", "valentines"],
      char: "💝",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    heart_decoration: {
      keywords: ["purple-square", "love", "like"],
      char: "💟",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    peace_symbol: {
      keywords: ["hippie"],
      char: "☮",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    latin_cross: {
      keywords: ["christianity"],
      char: "✝",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    star_and_crescent: {
      keywords: ["islam"],
      char: "☪",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    om: {
      keywords: ["hinduism", "buddhism", "sikhism", "jainism"],
      char: "🕉",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    wheel_of_dharma: {
      keywords: ["hinduism", "buddhism", "sikhism", "jainism"],
      char: "☸",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    star_of_david: {
      keywords: ["judaism"],
      char: "✡",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    six_pointed_star: {
      keywords: ["purple-square", "religion", "jewish", "hexagram"],
      char: "🔯",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    menorah: {
      keywords: ["hanukkah", "candles", "jewish"],
      char: "🕎",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    yin_yang: {
      keywords: ["balance"],
      char: "☯",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    orthodox_cross: {
      keywords: ["suppedaneum", "religion"],
      char: "☦",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    place_of_worship: {
      keywords: ["religion", "church", "temple", "prayer"],
      char: "🛐",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    ophiuchus: {
      keywords: ["sign", "purple-square", "constellation", "astrology"],
      char: "⛎",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    aries: {
      keywords: ["sign", "purple-square", "zodiac", "astrology"],
      char: "♈",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    taurus: {
      keywords: ["purple-square", "sign", "zodiac", "astrology"],
      char: "♉",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    gemini: {
      keywords: ["sign", "zodiac", "purple-square", "astrology"],
      char: "♊",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    cancer: {
      keywords: ["sign", "zodiac", "purple-square", "astrology"],
      char: "♋",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    leo: {
      keywords: ["sign", "purple-square", "zodiac", "astrology"],
      char: "♌",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    virgo: {
      keywords: ["sign", "zodiac", "purple-square", "astrology"],
      char: "♍",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    libra: {
      keywords: ["sign", "purple-square", "zodiac", "astrology"],
      char: "♎",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    scorpius: {
      keywords: ["sign", "zodiac", "purple-square", "astrology", "scorpio"],
      char: "♏",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    sagittarius: {
      keywords: ["sign", "zodiac", "purple-square", "astrology"],
      char: "♐",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    capricorn: {
      keywords: ["sign", "zodiac", "purple-square", "astrology"],
      char: "♑",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    aquarius: {
      keywords: ["sign", "purple-square", "zodiac", "astrology"],
      char: "♒",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    pisces: {
      keywords: ["purple-square", "sign", "zodiac", "astrology"],
      char: "♓",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    id: {
      keywords: ["purple-square", "words"],
      char: "🆔",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    atom_symbol: {
      keywords: ["science", "physics", "chemistry"],
      char: "⚛",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    u7a7a: {
      keywords: ["kanji", "japanese", "chinese", "empty", "sky", "blue-square"],
      char: "🈳",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    u5272: {
      keywords: ["cut", "divide", "chinese", "kanji", "pink-square"],
      char: "🈹",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    radioactive: {
      keywords: ["nuclear", "danger"],
      char: "☢",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    biohazard: {
      keywords: ["danger"],
      char: "☣",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    mobile_phone_off: {
      keywords: ["mute", "orange-square", "silence", "quiet"],
      char: "📴",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    vibration_mode: {
      keywords: ["orange-square", "phone"],
      char: "📳",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    u6709: {
      keywords: ["orange-square", "chinese", "have", "kanji"],
      char: "🈶",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    u7121: {
      keywords: ["nothing", "chinese", "kanji", "japanese", "orange-square"],
      char: "🈚",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    u7533: {
      keywords: ["chinese", "japanese", "kanji", "orange-square"],
      char: "🈸",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    u55b6: {
      keywords: ["japanese", "opening hours", "orange-square"],
      char: "🈺",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    u6708: {
      keywords: ["chinese", "month", "moon", "japanese", "orange-square", "kanji"],
      char: "🈷️",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    eight_pointed_black_star: {
      keywords: ["orange-square", "shape", "polygon"],
      char: "✴️",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    vs: {
      keywords: ["words", "orange-square"],
      char: "🆚",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    accept: {
      keywords: ["ok", "good", "chinese", "kanji", "agree", "yes", "orange-circle"],
      char: "🉑",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    white_flower: {
      keywords: ["japanese", "spring"],
      char: "💮",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    ideograph_advantage: {
      keywords: ["chinese", "kanji", "obtain", "get", "circle"],
      char: "🉐",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    secret: {
      keywords: ["privacy", "chinese", "sshh", "kanji", "red-circle"],
      char: "㊙️",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    congratulations: {
      keywords: ["chinese", "kanji", "japanese", "red-circle"],
      char: "㊗️",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    u5408: {
      keywords: ["japanese", "chinese", "join", "kanji", "red-square"],
      char: "🈴",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    u6e80: {
      keywords: ["full", "chinese", "japanese", "red-square", "kanji"],
      char: "🈵",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    u7981: {
      keywords: ["kanji", "japanese", "chinese", "forbidden", "limit", "restricted", "red-square"],
      char: "🈲",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    a: {
      keywords: ["red-square", "alphabet", "letter"],
      char: "🅰️",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    b: {
      keywords: ["red-square", "alphabet", "letter"],
      char: "🅱️",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    ab: {
      keywords: ["red-square", "alphabet"],
      char: "🆎",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    cl: {
      keywords: ["alphabet", "words", "red-square"],
      char: "🆑",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    o2: {
      keywords: ["alphabet", "red-square", "letter"],
      char: "🅾️",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    sos: {
      keywords: ["help", "red-square", "words", "emergency", "911"],
      char: "🆘",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    no_entry: {
      keywords: ["limit", "security", "privacy", "bad", "denied", "stop", "circle"],
      char: "⛔",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    name_badge: {
      keywords: ["fire", "forbid"],
      char: "📛",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    no_entry_sign: {
      keywords: ["forbid", "stop", "limit", "denied", "disallow", "circle"],
      char: "🚫",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    x: {
      keywords: ["no", "delete", "remove", "cancel", "red"],
      char: "❌",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    o: {
      keywords: ["circle", "round"],
      char: "⭕",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    stop_sign: {
      keywords: ["stop"],
      char: "🛑",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    anger: {
      keywords: ["angry", "mad"],
      char: "💢",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    hotsprings: {
      keywords: ["bath", "warm", "relax"],
      char: "♨️",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    no_pedestrians: {
      keywords: ["rules", "crossing", "walking", "circle"],
      char: "🚷",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    do_not_litter: {
      keywords: ["trash", "bin", "garbage", "circle"],
      char: "🚯",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    no_bicycles: {
      keywords: ["cyclist", "prohibited", "circle"],
      char: "🚳",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    "non-potable_water": {
      keywords: ["drink", "faucet", "tap", "circle"],
      char: "🚱",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    underage: {
      keywords: ["18", "drink", "pub", "night", "minor", "circle"],
      char: "🔞",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    no_mobile_phones: {
      keywords: ["iphone", "mute", "circle"],
      char: "📵",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    exclamation: {
      keywords: ["heavy_exclamation_mark", "danger", "surprise", "punctuation", "wow", "warning"],
      char: "❗",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    grey_exclamation: {
      keywords: ["surprise", "punctuation", "gray", "wow", "warning"],
      char: "❕",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    question: {
      keywords: ["doubt", "confused"],
      char: "❓",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    grey_question: {
      keywords: ["doubts", "gray", "huh", "confused"],
      char: "❔",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    bangbang: {
      keywords: ["exclamation", "surprise"],
      char: "‼️",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    interrobang: {
      keywords: ["wat", "punctuation", "surprise"],
      char: "⁉️",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    "100": {
      keywords: ["score", "perfect", "numbers", "century", "exam", "quiz", "test", "pass", "hundred"],
      char: "💯",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    low_brightness: {
      keywords: ["sun", "afternoon", "warm", "summer"],
      char: "🔅",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    high_brightness: {
      keywords: ["sun", "light"],
      char: "🔆",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    trident: {
      keywords: ["weapon", "spear"],
      char: "🔱",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    fleur_de_lis: {
      keywords: ["decorative", "scout"],
      char: "⚜",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    part_alternation_mark: {
      keywords: ["graph", "presentation", "stats", "business", "economics", "bad"],
      char: "〽️",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    warning: {
      keywords: ["exclamation", "wip", "alert", "error", "problem", "issue"],
      char: "⚠️",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    children_crossing: {
      keywords: ["school", "warning", "danger", "sign", "driving", "yellow-diamond"],
      char: "🚸",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    beginner: {
      keywords: ["badge", "shield"],
      char: "🔰",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    recycle: {
      keywords: ["arrow", "environment", "garbage", "trash"],
      char: "♻️",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    u6307: {
      keywords: ["chinese", "point", "green-square", "kanji"],
      char: "🈯",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    chart: {
      keywords: ["green-square", "graph", "presentation", "stats"],
      char: "💹",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    sparkle: {
      keywords: ["stars", "green-square", "awesome", "good", "fireworks"],
      char: "❇️",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    eight_spoked_asterisk: {
      keywords: ["star", "sparkle", "green-square"],
      char: "✳️",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    negative_squared_cross_mark: {
      keywords: ["x", "green-square", "no", "deny"],
      char: "❎",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    white_check_mark: {
      keywords: ["green-square", "ok", "agree", "vote", "election", "answer", "tick"],
      char: "✅",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    diamond_shape_with_a_dot_inside: {
      keywords: ["jewel", "blue", "gem", "crystal", "fancy"],
      char: "💠",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    cyclone: {
      keywords: ["weather", "swirl", "blue", "cloud", "vortex", "spiral", "whirlpool", "spin", "tornado", "hurricane", "typhoon"],
      char: "🌀",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    loop: {
      keywords: ["tape", "cassette"],
      char: "➿",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    globe_with_meridians: {
      keywords: ["earth", "international", "world", "internet", "interweb", "i18n"],
      char: "🌐",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    m: {
      keywords: ["alphabet", "blue-circle", "letter"],
      char: "Ⓜ️",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    atm: {
      keywords: ["money", "sales", "cash", "blue-square", "payment", "bank"],
      char: "🏧",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    sa: {
      keywords: ["japanese", "blue-square", "katakana"],
      char: "🈂️",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    passport_control: {
      keywords: ["custom", "blue-square"],
      char: "🛂",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    customs: {
      keywords: ["passport", "border", "blue-square"],
      char: "🛃",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    baggage_claim: {
      keywords: ["blue-square", "airport", "transport"],
      char: "🛄",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    left_luggage: {
      keywords: ["blue-square", "travel"],
      char: "🛅",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    wheelchair: {
      keywords: ["blue-square", "disabled", "a11y", "accessibility"],
      char: "♿",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    no_smoking: {
      keywords: ["cigarette", "blue-square", "smell", "smoke"],
      char: "🚭",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    wc: {
      keywords: ["toilet", "restroom", "blue-square"],
      char: "🚾",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    parking: {
      keywords: ["cars", "blue-square", "alphabet", "letter"],
      char: "🅿️",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    potable_water: {
      keywords: ["blue-square", "liquid", "restroom", "cleaning", "faucet"],
      char: "🚰",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    mens: {
      keywords: ["toilet", "restroom", "wc", "blue-square", "gender", "male"],
      char: "🚹",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    womens: {
      keywords: ["purple-square", "woman", "female", "toilet", "loo", "restroom", "gender"],
      char: "🚺",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    baby_symbol: {
      keywords: ["orange-square", "child"],
      char: "🚼",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    restroom: {
      keywords: ["blue-square", "toilet", "refresh", "wc", "gender"],
      char: "🚻",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    put_litter_in_its_place: {
      keywords: ["blue-square", "sign", "human", "info"],
      char: "🚮",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    cinema: {
      keywords: ["blue-square", "record", "film", "movie", "curtain", "stage", "theater"],
      char: "🎦",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    signal_strength: {
      keywords: ["blue-square", "reception", "phone", "internet", "connection", "wifi", "bluetooth", "bars"],
      char: "📶",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    koko: {
      keywords: ["blue-square", "here", "katakana", "japanese", "destination"],
      char: "🈁",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    ng: {
      keywords: ["blue-square", "words", "shape", "icon"],
      char: "🆖",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    ok: {
      keywords: ["good", "agree", "yes", "blue-square"],
      char: "🆗",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    up: {
      keywords: ["blue-square", "above", "high"],
      char: "🆙",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    cool: {
      keywords: ["words", "blue-square"],
      char: "🆒",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    new: {
      keywords: ["blue-square", "words", "start"],
      char: "🆕",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    free: {
      keywords: ["blue-square", "words"],
      char: "🆓",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    zero: {
      keywords: ["0", "numbers", "blue-square", "null"],
      char: "0️⃣",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    one: {
      keywords: ["blue-square", "numbers", "1"],
      char: "1️⃣",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    two: {
      keywords: ["numbers", "2", "prime", "blue-square"],
      char: "2️⃣",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    three: {
      keywords: ["3", "numbers", "prime", "blue-square"],
      char: "3️⃣",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    four: {
      keywords: ["4", "numbers", "blue-square"],
      char: "4️⃣",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    five: {
      keywords: ["5", "numbers", "blue-square", "prime"],
      char: "5️⃣",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    six: {
      keywords: ["6", "numbers", "blue-square"],
      char: "6️⃣",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    seven: {
      keywords: ["7", "numbers", "blue-square", "prime"],
      char: "7️⃣",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    eight: {
      keywords: ["8", "blue-square", "numbers"],
      char: "8️⃣",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    nine: {
      keywords: ["blue-square", "numbers", "9"],
      char: "9️⃣",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    keycap_ten: {
      keywords: ["numbers", "10", "blue-square"],
      char: "🔟",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    asterisk: {
      keywords: ["star", "keycap"],
      char: "*⃣",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    "1234": {
      keywords: ["numbers", "blue-square"],
      char: "🔢",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    eject_button: {
      keywords: ["blue-square"],
      char: "⏏️",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    arrow_forward: {
      keywords: ["blue-square", "right", "direction", "play"],
      char: "▶️",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    pause_button: {
      keywords: ["pause", "blue-square"],
      char: "⏸",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    next_track_button: {
      keywords: ["forward", "next", "blue-square"],
      char: "⏭",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    stop_button: {
      keywords: ["blue-square"],
      char: "⏹",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    record_button: {
      keywords: ["blue-square"],
      char: "⏺",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    play_or_pause_button: {
      keywords: ["blue-square", "play", "pause"],
      char: "⏯",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    previous_track_button: {
      keywords: ["backward"],
      char: "⏮",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    fast_forward: {
      keywords: ["blue-square", "play", "speed", "continue"],
      char: "⏩",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    rewind: {
      keywords: ["play", "blue-square"],
      char: "⏪",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    twisted_rightwards_arrows: {
      keywords: ["blue-square", "shuffle", "music", "random"],
      char: "🔀",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    repeat: {
      keywords: ["loop", "record"],
      char: "🔁",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    repeat_one: {
      keywords: ["blue-square", "loop"],
      char: "🔂",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    arrow_backward: {
      keywords: ["blue-square", "left", "direction"],
      char: "◀️",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    arrow_up_small: {
      keywords: ["blue-square", "triangle", "direction", "point", "forward", "top"],
      char: "🔼",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    arrow_down_small: {
      keywords: ["blue-square", "direction", "bottom"],
      char: "🔽",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    arrow_double_up: {
      keywords: ["blue-square", "direction", "top"],
      char: "⏫",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    arrow_double_down: {
      keywords: ["blue-square", "direction", "bottom"],
      char: "⏬",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    arrow_right: {
      keywords: ["blue-square", "next"],
      char: "➡️",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    arrow_left: {
      keywords: ["blue-square", "previous", "back"],
      char: "⬅️",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    arrow_up: {
      keywords: ["blue-square", "continue", "top", "direction"],
      char: "⬆️",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    arrow_down: {
      keywords: ["blue-square", "direction", "bottom"],
      char: "⬇️",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    arrow_upper_right: {
      keywords: ["blue-square", "point", "direction", "diagonal", "northeast"],
      char: "↗️",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    arrow_lower_right: {
      keywords: ["blue-square", "direction", "diagonal", "southeast"],
      char: "↘️",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    arrow_lower_left: {
      keywords: ["blue-square", "direction", "diagonal", "southwest"],
      char: "↙️",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    arrow_upper_left: {
      keywords: ["blue-square", "point", "direction", "diagonal", "northwest"],
      char: "↖️",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    arrow_up_down: {
      keywords: ["blue-square", "direction", "way", "vertical"],
      char: "↕️",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    left_right_arrow: {
      keywords: ["shape", "direction", "horizontal", "sideways"],
      char: "↔️",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    arrows_counterclockwise: {
      keywords: ["blue-square", "sync", "cycle"],
      char: "🔄",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    arrow_right_hook: {
      keywords: ["blue-square", "return", "rotate", "direction"],
      char: "↪️",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    leftwards_arrow_with_hook: {
      keywords: ["back", "return", "blue-square", "undo", "enter"],
      char: "↩️",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    arrow_heading_up: {
      keywords: ["blue-square", "direction", "top"],
      char: "⤴️",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    arrow_heading_down: {
      keywords: ["blue-square", "direction", "bottom"],
      char: "⤵️",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    hash: {
      keywords: ["symbol", "blue-square", "twitter"],
      char: "#️⃣",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    information_source: {
      keywords: ["blue-square", "alphabet", "letter"],
      char: "ℹ️",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    abc: {
      keywords: ["blue-square", "alphabet"],
      char: "🔤",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    abcd: {
      keywords: ["blue-square", "alphabet"],
      char: "🔡",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    capital_abcd: {
      keywords: ["alphabet", "words", "blue-square"],
      char: "🔠",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    symbols: {
      keywords: ["blue-square", "music", "note", "ampersand", "percent", "glyphs", "characters"],
      char: "🔣",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    musical_note: {
      keywords: ["score", "tone", "sound"],
      char: "🎵",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    notes: {
      keywords: ["music", "score"],
      char: "🎶",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    wavy_dash: {
      keywords: ["draw", "line", "moustache", "mustache", "squiggle", "scribble"],
      char: "〰️",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    curly_loop: {
      keywords: ["scribble", "draw", "shape", "squiggle"],
      char: "➰",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    heavy_check_mark: {
      keywords: ["ok", "nike", "answer", "yes", "tick"],
      char: "✔️",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    arrows_clockwise: {
      keywords: ["sync", "cycle", "round", "repeat"],
      char: "🔃",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    heavy_plus_sign: {
      keywords: ["math", "calculation", "addition", "more", "increase"],
      char: "➕",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    heavy_minus_sign: {
      keywords: ["math", "calculation", "subtract", "less"],
      char: "➖",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    heavy_division_sign: {
      keywords: ["divide", "math", "calculation"],
      char: "➗",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    heavy_multiplication_x: {
      keywords: ["math", "calculation"],
      char: "✖️",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    infinity: {
      keywords: ["forever"],
      char: "♾",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    heavy_dollar_sign: {
      keywords: ["money", "sales", "payment", "currency", "buck"],
      char: "💲",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    currency_exchange: {
      keywords: ["money", "sales", "dollar", "travel"],
      char: "💱",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    copyright: {
      keywords: ["ip", "license", "circle", "law", "legal"],
      char: "©️",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    registered: {
      keywords: ["alphabet", "circle"],
      char: "®️",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    tm: {
      keywords: ["trademark", "brand", "law", "legal"],
      char: "™️",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    end: {
      keywords: ["words", "arrow"],
      char: "🔚",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    back: {
      keywords: ["arrow", "words", "return"],
      char: "🔙",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    on: {
      keywords: ["arrow", "words"],
      char: "🔛",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    top: {
      keywords: ["words", "blue-square"],
      char: "🔝",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    soon: {
      keywords: ["arrow", "words"],
      char: "🔜",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    ballot_box_with_check: {
      keywords: ["ok", "agree", "confirm", "black-square", "vote", "election", "yes", "tick"],
      char: "☑️",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    radio_button: {
      keywords: ["input", "old", "music", "circle"],
      char: "🔘",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    white_circle: {
      keywords: ["shape", "round"],
      char: "⚪",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    black_circle: {
      keywords: ["shape", "button", "round"],
      char: "⚫",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    red_circle: {
      keywords: ["shape", "error", "danger"],
      char: "🔴",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    large_blue_circle: {
      keywords: ["shape", "icon", "button"],
      char: "🔵",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    small_orange_diamond: {
      keywords: ["shape", "jewel", "gem"],
      char: "🔸",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    small_blue_diamond: {
      keywords: ["shape", "jewel", "gem"],
      char: "🔹",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    large_orange_diamond: {
      keywords: ["shape", "jewel", "gem"],
      char: "🔶",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    large_blue_diamond: {
      keywords: ["shape", "jewel", "gem"],
      char: "🔷",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    small_red_triangle: {
      keywords: ["shape", "direction", "up", "top"],
      char: "🔺",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    black_small_square: {
      keywords: ["shape", "icon"],
      char: "▪️",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    white_small_square: {
      keywords: ["shape", "icon"],
      char: "▫️",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    black_large_square: {
      keywords: ["shape", "icon", "button"],
      char: "⬛",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    white_large_square: {
      keywords: ["shape", "icon", "stone", "button"],
      char: "⬜",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    small_red_triangle_down: {
      keywords: ["shape", "direction", "bottom"],
      char: "🔻",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    black_medium_square: {
      keywords: ["shape", "button", "icon"],
      char: "◼️",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    white_medium_square: {
      keywords: ["shape", "stone", "icon"],
      char: "◻️",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    black_medium_small_square: {
      keywords: ["icon", "shape", "button"],
      char: "◾",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    white_medium_small_square: {
      keywords: ["shape", "stone", "icon", "button"],
      char: "◽",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    black_square_button: {
      keywords: ["shape", "input", "frame"],
      char: "🔲",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    white_square_button: {
      keywords: ["shape", "input"],
      char: "🔳",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    speaker: {
      keywords: ["sound", "volume", "silence", "broadcast"],
      char: "🔈",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    sound: {
      keywords: ["volume", "speaker", "broadcast"],
      char: "🔉",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    loud_sound: {
      keywords: ["volume", "noise", "noisy", "speaker", "broadcast"],
      char: "🔊",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    mute: {
      keywords: ["sound", "volume", "silence", "quiet"],
      char: "🔇",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    mega: {
      keywords: ["sound", "speaker", "volume"],
      char: "📣",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    loudspeaker: {
      keywords: ["volume", "sound"],
      char: "📢",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    bell: {
      keywords: ["sound", "notification", "christmas", "xmas", "chime"],
      char: "🔔",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    no_bell: {
      keywords: ["sound", "volume", "mute", "quiet", "silent"],
      char: "🔕",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    black_joker: {
      keywords: ["poker", "cards", "game", "play", "magic"],
      char: "🃏",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    mahjong: {
      keywords: ["game", "play", "chinese", "kanji"],
      char: "🀄",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    spades: {
      keywords: ["poker", "cards", "suits", "magic"],
      char: "♠️",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    clubs: {
      keywords: ["poker", "cards", "magic", "suits"],
      char: "♣️",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    hearts: {
      keywords: ["poker", "cards", "magic", "suits"],
      char: "♥️",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    diamonds: {
      keywords: ["poker", "cards", "magic", "suits"],
      char: "♦️",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    flower_playing_cards: {
      keywords: ["game", "sunset", "red"],
      char: "🎴",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    thought_balloon: {
      keywords: ["bubble", "cloud", "speech", "thinking", "dream"],
      char: "💭",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    right_anger_bubble: {
      keywords: ["caption", "speech", "thinking", "mad"],
      char: "🗯",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    speech_balloon: {
      keywords: ["bubble", "words", "message", "talk", "chatting"],
      char: "💬",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    left_speech_bubble: {
      keywords: ["words", "message", "talk", "chatting"],
      char: "🗨",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    clock1: {
      keywords: ["time", "late", "early", "schedule"],
      char: "🕐",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    clock2: {
      keywords: ["time", "late", "early", "schedule"],
      char: "🕑",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    clock3: {
      keywords: ["time", "late", "early", "schedule"],
      char: "🕒",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    clock4: {
      keywords: ["time", "late", "early", "schedule"],
      char: "🕓",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    clock5: {
      keywords: ["time", "late", "early", "schedule"],
      char: "🕔",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    clock6: {
      keywords: ["time", "late", "early", "schedule", "dawn", "dusk"],
      char: "🕕",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    clock7: {
      keywords: ["time", "late", "early", "schedule"],
      char: "🕖",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    clock8: {
      keywords: ["time", "late", "early", "schedule"],
      char: "🕗",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    clock9: {
      keywords: ["time", "late", "early", "schedule"],
      char: "🕘",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    clock10: {
      keywords: ["time", "late", "early", "schedule"],
      char: "🕙",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    clock11: {
      keywords: ["time", "late", "early", "schedule"],
      char: "🕚",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    clock12: {
      keywords: ["time", "noon", "midnight", "midday", "late", "early", "schedule"],
      char: "🕛",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    clock130: {
      keywords: ["time", "late", "early", "schedule"],
      char: "🕜",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    clock230: {
      keywords: ["time", "late", "early", "schedule"],
      char: "🕝",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    clock330: {
      keywords: ["time", "late", "early", "schedule"],
      char: "🕞",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    clock430: {
      keywords: ["time", "late", "early", "schedule"],
      char: "🕟",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    clock530: {
      keywords: ["time", "late", "early", "schedule"],
      char: "🕠",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    clock630: {
      keywords: ["time", "late", "early", "schedule"],
      char: "🕡",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    clock730: {
      keywords: ["time", "late", "early", "schedule"],
      char: "🕢",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    clock830: {
      keywords: ["time", "late", "early", "schedule"],
      char: "🕣",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    clock930: {
      keywords: ["time", "late", "early", "schedule"],
      char: "🕤",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    clock1030: {
      keywords: ["time", "late", "early", "schedule"],
      char: "🕥",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    clock1130: {
      keywords: ["time", "late", "early", "schedule"],
      char: "🕦",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    clock1230: {
      keywords: ["time", "late", "early", "schedule"],
      char: "🕧",
      fitzpatrick_scale: false,
      category: "symbols"
    },
    afghanistan: {
      keywords: ["af", "flag", "nation", "country", "banner"],
      char: "🇦🇫",
      fitzpatrick_scale: false,
      category: "flags"
    },
    aland_islands: {
      keywords: ["Åland", "islands", "flag", "nation", "country", "banner"],
      char: "🇦🇽",
      fitzpatrick_scale: false,
      category: "flags"
    },
    albania: {
      keywords: ["al", "flag", "nation", "country", "banner"],
      char: "🇦🇱",
      fitzpatrick_scale: false,
      category: "flags"
    },
    algeria: {
      keywords: ["dz", "flag", "nation", "country", "banner"],
      char: "🇩🇿",
      fitzpatrick_scale: false,
      category: "flags"
    },
    american_samoa: {
      keywords: ["american", "ws", "flag", "nation", "country", "banner"],
      char: "🇦🇸",
      fitzpatrick_scale: false,
      category: "flags"
    },
    andorra: {
      keywords: ["ad", "flag", "nation", "country", "banner"],
      char: "🇦🇩",
      fitzpatrick_scale: false,
      category: "flags"
    },
    angola: {
      keywords: ["ao", "flag", "nation", "country", "banner"],
      char: "🇦🇴",
      fitzpatrick_scale: false,
      category: "flags"
    },
    anguilla: {
      keywords: ["ai", "flag", "nation", "country", "banner"],
      char: "🇦🇮",
      fitzpatrick_scale: false,
      category: "flags"
    },
    antarctica: {
      keywords: ["aq", "flag", "nation", "country", "banner"],
      char: "🇦🇶",
      fitzpatrick_scale: false,
      category: "flags"
    },
    antigua_barbuda: {
      keywords: ["antigua", "barbuda", "flag", "nation", "country", "banner"],
      char: "🇦🇬",
      fitzpatrick_scale: false,
      category: "flags"
    },
    argentina: {
      keywords: ["ar", "flag", "nation", "country", "banner"],
      char: "🇦🇷",
      fitzpatrick_scale: false,
      category: "flags"
    },
    armenia: {
      keywords: ["am", "flag", "nation", "country", "banner"],
      char: "🇦🇲",
      fitzpatrick_scale: false,
      category: "flags"
    },
    aruba: {
      keywords: ["aw", "flag", "nation", "country", "banner"],
      char: "🇦🇼",
      fitzpatrick_scale: false,
      category: "flags"
    },
    australia: {
      keywords: ["au", "flag", "nation", "country", "banner"],
      char: "🇦🇺",
      fitzpatrick_scale: false,
      category: "flags"
    },
    austria: {
      keywords: ["at", "flag", "nation", "country", "banner"],
      char: "🇦🇹",
      fitzpatrick_scale: false,
      category: "flags"
    },
    azerbaijan: {
      keywords: ["az", "flag", "nation", "country", "banner"],
      char: "🇦🇿",
      fitzpatrick_scale: false,
      category: "flags"
    },
    bahamas: {
      keywords: ["bs", "flag", "nation", "country", "banner"],
      char: "🇧🇸",
      fitzpatrick_scale: false,
      category: "flags"
    },
    bahrain: {
      keywords: ["bh", "flag", "nation", "country", "banner"],
      char: "🇧🇭",
      fitzpatrick_scale: false,
      category: "flags"
    },
    bangladesh: {
      keywords: ["bd", "flag", "nation", "country", "banner"],
      char: "🇧🇩",
      fitzpatrick_scale: false,
      category: "flags"
    },
    barbados: {
      keywords: ["bb", "flag", "nation", "country", "banner"],
      char: "🇧🇧",
      fitzpatrick_scale: false,
      category: "flags"
    },
    belarus: {
      keywords: ["by", "flag", "nation", "country", "banner"],
      char: "🇧🇾",
      fitzpatrick_scale: false,
      category: "flags"
    },
    belgium: {
      keywords: ["be", "flag", "nation", "country", "banner"],
      char: "🇧🇪",
      fitzpatrick_scale: false,
      category: "flags"
    },
    belize: {
      keywords: ["bz", "flag", "nation", "country", "banner"],
      char: "🇧🇿",
      fitzpatrick_scale: false,
      category: "flags"
    },
    benin: {
      keywords: ["bj", "flag", "nation", "country", "banner"],
      char: "🇧🇯",
      fitzpatrick_scale: false,
      category: "flags"
    },
    bermuda: {
      keywords: ["bm", "flag", "nation", "country", "banner"],
      char: "🇧🇲",
      fitzpatrick_scale: false,
      category: "flags"
    },
    bhutan: {
      keywords: ["bt", "flag", "nation", "country", "banner"],
      char: "🇧🇹",
      fitzpatrick_scale: false,
      category: "flags"
    },
    bolivia: {
      keywords: ["bo", "flag", "nation", "country", "banner"],
      char: "🇧🇴",
      fitzpatrick_scale: false,
      category: "flags"
    },
    caribbean_netherlands: {
      keywords: ["bonaire", "flag", "nation", "country", "banner"],
      char: "🇧🇶",
      fitzpatrick_scale: false,
      category: "flags"
    },
    bosnia_herzegovina: {
      keywords: ["bosnia", "herzegovina", "flag", "nation", "country", "banner"],
      char: "🇧🇦",
      fitzpatrick_scale: false,
      category: "flags"
    },
    botswana: {
      keywords: ["bw", "flag", "nation", "country", "banner"],
      char: "🇧🇼",
      fitzpatrick_scale: false,
      category: "flags"
    },
    brazil: {
      keywords: ["br", "flag", "nation", "country", "banner"],
      char: "🇧🇷",
      fitzpatrick_scale: false,
      category: "flags"
    },
    british_indian_ocean_territory: {
      keywords: ["british", "indian", "ocean", "territory", "flag", "nation", "country", "banner"],
      char: "🇮🇴",
      fitzpatrick_scale: false,
      category: "flags"
    },
    british_virgin_islands: {
      keywords: ["british", "virgin", "islands", "bvi", "flag", "nation", "country", "banner"],
      char: "🇻🇬",
      fitzpatrick_scale: false,
      category: "flags"
    },
    brunei: {
      keywords: ["bn", "darussalam", "flag", "nation", "country", "banner"],
      char: "🇧🇳",
      fitzpatrick_scale: false,
      category: "flags"
    },
    bulgaria: {
      keywords: ["bg", "flag", "nation", "country", "banner"],
      char: "🇧🇬",
      fitzpatrick_scale: false,
      category: "flags"
    },
    burkina_faso: {
      keywords: ["burkina", "faso", "flag", "nation", "country", "banner"],
      char: "🇧🇫",
      fitzpatrick_scale: false,
      category: "flags"
    },
    burundi: {
      keywords: ["bi", "flag", "nation", "country", "banner"],
      char: "🇧🇮",
      fitzpatrick_scale: false,
      category: "flags"
    },
    cape_verde: {
      keywords: ["cabo", "verde", "flag", "nation", "country", "banner"],
      char: "🇨🇻",
      fitzpatrick_scale: false,
      category: "flags"
    },
    cambodia: {
      keywords: ["kh", "flag", "nation", "country", "banner"],
      char: "🇰🇭",
      fitzpatrick_scale: false,
      category: "flags"
    },
    cameroon: {
      keywords: ["cm", "flag", "nation", "country", "banner"],
      char: "🇨🇲",
      fitzpatrick_scale: false,
      category: "flags"
    },
    canada: {
      keywords: ["ca", "flag", "nation", "country", "banner"],
      char: "🇨🇦",
      fitzpatrick_scale: false,
      category: "flags"
    },
    canary_islands: {
      keywords: ["canary", "islands", "flag", "nation", "country", "banner"],
      char: "🇮🇨",
      fitzpatrick_scale: false,
      category: "flags"
    },
    cayman_islands: {
      keywords: ["cayman", "islands", "flag", "nation", "country", "banner"],
      char: "🇰🇾",
      fitzpatrick_scale: false,
      category: "flags"
    },
    central_african_republic: {
      keywords: ["central", "african", "republic", "flag", "nation", "country", "banner"],
      char: "🇨🇫",
      fitzpatrick_scale: false,
      category: "flags"
    },
    chad: {
      keywords: ["td", "flag", "nation", "country", "banner"],
      char: "🇹🇩",
      fitzpatrick_scale: false,
      category: "flags"
    },
    chile: {
      keywords: ["flag", "nation", "country", "banner"],
      char: "🇨🇱",
      fitzpatrick_scale: false,
      category: "flags"
    },
    cn: {
      keywords: ["china", "chinese", "prc", "flag", "country", "nation", "banner"],
      char: "🇨🇳",
      fitzpatrick_scale: false,
      category: "flags"
    },
    christmas_island: {
      keywords: ["christmas", "island", "flag", "nation", "country", "banner"],
      char: "🇨🇽",
      fitzpatrick_scale: false,
      category: "flags"
    },
    cocos_islands: {
      keywords: ["cocos", "keeling", "islands", "flag", "nation", "country", "banner"],
      char: "🇨🇨",
      fitzpatrick_scale: false,
      category: "flags"
    },
    colombia: {
      keywords: ["co", "flag", "nation", "country", "banner"],
      char: "🇨🇴",
      fitzpatrick_scale: false,
      category: "flags"
    },
    comoros: {
      keywords: ["km", "flag", "nation", "country", "banner"],
      char: "🇰🇲",
      fitzpatrick_scale: false,
      category: "flags"
    },
    congo_brazzaville: {
      keywords: ["congo", "flag", "nation", "country", "banner"],
      char: "🇨🇬",
      fitzpatrick_scale: false,
      category: "flags"
    },
    congo_kinshasa: {
      keywords: ["congo", "democratic", "republic", "flag", "nation", "country", "banner"],
      char: "🇨🇩",
      fitzpatrick_scale: false,
      category: "flags"
    },
    cook_islands: {
      keywords: ["cook", "islands", "flag", "nation", "country", "banner"],
      char: "🇨🇰",
      fitzpatrick_scale: false,
      category: "flags"
    },
    costa_rica: {
      keywords: ["costa", "rica", "flag", "nation", "country", "banner"],
      char: "🇨🇷",
      fitzpatrick_scale: false,
      category: "flags"
    },
    croatia: {
      keywords: ["hr", "flag", "nation", "country", "banner"],
      char: "🇭🇷",
      fitzpatrick_scale: false,
      category: "flags"
    },
    cuba: {
      keywords: ["cu", "flag", "nation", "country", "banner"],
      char: "🇨🇺",
      fitzpatrick_scale: false,
      category: "flags"
    },
    curacao: {
      keywords: ["curaçao", "flag", "nation", "country", "banner"],
      char: "🇨🇼",
      fitzpatrick_scale: false,
      category: "flags"
    },
    cyprus: {
      keywords: ["cy", "flag", "nation", "country", "banner"],
      char: "🇨🇾",
      fitzpatrick_scale: false,
      category: "flags"
    },
    czech_republic: {
      keywords: ["cz", "flag", "nation", "country", "banner"],
      char: "🇨🇿",
      fitzpatrick_scale: false,
      category: "flags"
    },
    denmark: {
      keywords: ["dk", "flag", "nation", "country", "banner"],
      char: "🇩🇰",
      fitzpatrick_scale: false,
      category: "flags"
    },
    djibouti: {
      keywords: ["dj", "flag", "nation", "country", "banner"],
      char: "🇩🇯",
      fitzpatrick_scale: false,
      category: "flags"
    },
    dominica: {
      keywords: ["dm", "flag", "nation", "country", "banner"],
      char: "🇩🇲",
      fitzpatrick_scale: false,
      category: "flags"
    },
    dominican_republic: {
      keywords: ["dominican", "republic", "flag", "nation", "country", "banner"],
      char: "🇩🇴",
      fitzpatrick_scale: false,
      category: "flags"
    },
    ecuador: {
      keywords: ["ec", "flag", "nation", "country", "banner"],
      char: "🇪🇨",
      fitzpatrick_scale: false,
      category: "flags"
    },
    egypt: {
      keywords: ["eg", "flag", "nation", "country", "banner"],
      char: "🇪🇬",
      fitzpatrick_scale: false,
      category: "flags"
    },
    el_salvador: {
      keywords: ["el", "salvador", "flag", "nation", "country", "banner"],
      char: "🇸🇻",
      fitzpatrick_scale: false,
      category: "flags"
    },
    equatorial_guinea: {
      keywords: ["equatorial", "gn", "flag", "nation", "country", "banner"],
      char: "🇬🇶",
      fitzpatrick_scale: false,
      category: "flags"
    },
    eritrea: {
      keywords: ["er", "flag", "nation", "country", "banner"],
      char: "🇪🇷",
      fitzpatrick_scale: false,
      category: "flags"
    },
    estonia: {
      keywords: ["ee", "flag", "nation", "country", "banner"],
      char: "🇪🇪",
      fitzpatrick_scale: false,
      category: "flags"
    },
    ethiopia: {
      keywords: ["et", "flag", "nation", "country", "banner"],
      char: "🇪🇹",
      fitzpatrick_scale: false,
      category: "flags"
    },
    eu: {
      keywords: ["european", "union", "flag", "banner"],
      char: "🇪🇺",
      fitzpatrick_scale: false,
      category: "flags"
    },
    falkland_islands: {
      keywords: ["falkland", "islands", "malvinas", "flag", "nation", "country", "banner"],
      char: "🇫🇰",
      fitzpatrick_scale: false,
      category: "flags"
    },
    faroe_islands: {
      keywords: ["faroe", "islands", "flag", "nation", "country", "banner"],
      char: "🇫🇴",
      fitzpatrick_scale: false,
      category: "flags"
    },
    fiji: {
      keywords: ["fj", "flag", "nation", "country", "banner"],
      char: "🇫🇯",
      fitzpatrick_scale: false,
      category: "flags"
    },
    finland: {
      keywords: ["fi", "flag", "nation", "country", "banner"],
      char: "🇫🇮",
      fitzpatrick_scale: false,
      category: "flags"
    },
    fr: {
      keywords: ["banner", "flag", "nation", "france", "french", "country"],
      char: "🇫🇷",
      fitzpatrick_scale: false,
      category: "flags"
    },
    french_guiana: {
      keywords: ["french", "guiana", "flag", "nation", "country", "banner"],
      char: "🇬🇫",
      fitzpatrick_scale: false,
      category: "flags"
    },
    french_polynesia: {
      keywords: ["french", "polynesia", "flag", "nation", "country", "banner"],
      char: "🇵🇫",
      fitzpatrick_scale: false,
      category: "flags"
    },
    french_southern_territories: {
      keywords: ["french", "southern", "territories", "flag", "nation", "country", "banner"],
      char: "🇹🇫",
      fitzpatrick_scale: false,
      category: "flags"
    },
    gabon: {
      keywords: ["ga", "flag", "nation", "country", "banner"],
      char: "🇬🇦",
      fitzpatrick_scale: false,
      category: "flags"
    },
    gambia: {
      keywords: ["gm", "flag", "nation", "country", "banner"],
      char: "🇬🇲",
      fitzpatrick_scale: false,
      category: "flags"
    },
    georgia: {
      keywords: ["ge", "flag", "nation", "country", "banner"],
      char: "🇬🇪",
      fitzpatrick_scale: false,
      category: "flags"
    },
    de: {
      keywords: ["german", "nation", "flag", "country", "banner"],
      char: "🇩🇪",
      fitzpatrick_scale: false,
      category: "flags"
    },
    ghana: {
      keywords: ["gh", "flag", "nation", "country", "banner"],
      char: "🇬🇭",
      fitzpatrick_scale: false,
      category: "flags"
    },
    gibraltar: {
      keywords: ["gi", "flag", "nation", "country", "banner"],
      char: "🇬🇮",
      fitzpatrick_scale: false,
      category: "flags"
    },
    greece: {
      keywords: ["gr", "flag", "nation", "country", "banner"],
      char: "🇬🇷",
      fitzpatrick_scale: false,
      category: "flags"
    },
    greenland: {
      keywords: ["gl", "flag", "nation", "country", "banner"],
      char: "🇬🇱",
      fitzpatrick_scale: false,
      category: "flags"
    },
    grenada: {
      keywords: ["gd", "flag", "nation", "country", "banner"],
      char: "🇬🇩",
      fitzpatrick_scale: false,
      category: "flags"
    },
    guadeloupe: {
      keywords: ["gp", "flag", "nation", "country", "banner"],
      char: "🇬🇵",
      fitzpatrick_scale: false,
      category: "flags"
    },
    guam: {
      keywords: ["gu", "flag", "nation", "country", "banner"],
      char: "🇬🇺",
      fitzpatrick_scale: false,
      category: "flags"
    },
    guatemala: {
      keywords: ["gt", "flag", "nation", "country", "banner"],
      char: "🇬🇹",
      fitzpatrick_scale: false,
      category: "flags"
    },
    guernsey: {
      keywords: ["gg", "flag", "nation", "country", "banner"],
      char: "🇬🇬",
      fitzpatrick_scale: false,
      category: "flags"
    },
    guinea: {
      keywords: ["gn", "flag", "nation", "country", "banner"],
      char: "🇬🇳",
      fitzpatrick_scale: false,
      category: "flags"
    },
    guinea_bissau: {
      keywords: ["gw", "bissau", "flag", "nation", "country", "banner"],
      char: "🇬🇼",
      fitzpatrick_scale: false,
      category: "flags"
    },
    guyana: {
      keywords: ["gy", "flag", "nation", "country", "banner"],
      char: "🇬🇾",
      fitzpatrick_scale: false,
      category: "flags"
    },
    haiti: {
      keywords: ["ht", "flag", "nation", "country", "banner"],
      char: "🇭🇹",
      fitzpatrick_scale: false,
      category: "flags"
    },
    honduras: {
      keywords: ["hn", "flag", "nation", "country", "banner"],
      char: "🇭🇳",
      fitzpatrick_scale: false,
      category: "flags"
    },
    hong_kong: {
      keywords: ["hong", "kong", "flag", "nation", "country", "banner"],
      char: "🇭🇰",
      fitzpatrick_scale: false,
      category: "flags"
    },
    hungary: {
      keywords: ["hu", "flag", "nation", "country", "banner"],
      char: "🇭🇺",
      fitzpatrick_scale: false,
      category: "flags"
    },
    iceland: {
      keywords: ["is", "flag", "nation", "country", "banner"],
      char: "🇮🇸",
      fitzpatrick_scale: false,
      category: "flags"
    },
    india: {
      keywords: ["in", "flag", "nation", "country", "banner"],
      char: "🇮🇳",
      fitzpatrick_scale: false,
      category: "flags"
    },
    indonesia: {
      keywords: ["flag", "nation", "country", "banner"],
      char: "🇮🇩",
      fitzpatrick_scale: false,
      category: "flags"
    },
    iran: {
      keywords: ["iran,", "islamic", "republic", "flag", "nation", "country", "banner"],
      char: "🇮🇷",
      fitzpatrick_scale: false,
      category: "flags"
    },
    iraq: {
      keywords: ["iq", "flag", "nation", "country", "banner"],
      char: "🇮🇶",
      fitzpatrick_scale: false,
      category: "flags"
    },
    ireland: {
      keywords: ["ie", "flag", "nation", "country", "banner"],
      char: "🇮🇪",
      fitzpatrick_scale: false,
      category: "flags"
    },
    isle_of_man: {
      keywords: ["isle", "man", "flag", "nation", "country", "banner"],
      char: "🇮🇲",
      fitzpatrick_scale: false,
      category: "flags"
    },
    israel: {
      keywords: ["il", "flag", "nation", "country", "banner"],
      char: "🇮🇱",
      fitzpatrick_scale: false,
      category: "flags"
    },
    it: {
      keywords: ["italy", "flag", "nation", "country", "banner"],
      char: "🇮🇹",
      fitzpatrick_scale: false,
      category: "flags"
    },
    cote_divoire: {
      keywords: ["ivory", "coast", "flag", "nation", "country", "banner"],
      char: "🇨🇮",
      fitzpatrick_scale: false,
      category: "flags"
    },
    jamaica: {
      keywords: ["jm", "flag", "nation", "country", "banner"],
      char: "🇯🇲",
      fitzpatrick_scale: false,
      category: "flags"
    },
    jp: {
      keywords: ["japanese", "nation", "flag", "country", "banner"],
      char: "🇯🇵",
      fitzpatrick_scale: false,
      category: "flags"
    },
    jersey: {
      keywords: ["je", "flag", "nation", "country", "banner"],
      char: "🇯🇪",
      fitzpatrick_scale: false,
      category: "flags"
    },
    jordan: {
      keywords: ["jo", "flag", "nation", "country", "banner"],
      char: "🇯🇴",
      fitzpatrick_scale: false,
      category: "flags"
    },
    kazakhstan: {
      keywords: ["kz", "flag", "nation", "country", "banner"],
      char: "🇰🇿",
      fitzpatrick_scale: false,
      category: "flags"
    },
    kenya: {
      keywords: ["ke", "flag", "nation", "country", "banner"],
      char: "🇰🇪",
      fitzpatrick_scale: false,
      category: "flags"
    },
    kiribati: {
      keywords: ["ki", "flag", "nation", "country", "banner"],
      char: "🇰🇮",
      fitzpatrick_scale: false,
      category: "flags"
    },
    kosovo: {
      keywords: ["xk", "flag", "nation", "country", "banner"],
      char: "🇽🇰",
      fitzpatrick_scale: false,
      category: "flags"
    },
    kuwait: {
      keywords: ["kw", "flag", "nation", "country", "banner"],
      char: "🇰🇼",
      fitzpatrick_scale: false,
      category: "flags"
    },
    kyrgyzstan: {
      keywords: ["kg", "flag", "nation", "country", "banner"],
      char: "🇰🇬",
      fitzpatrick_scale: false,
      category: "flags"
    },
    laos: {
      keywords: ["lao", "democratic", "republic", "flag", "nation", "country", "banner"],
      char: "🇱🇦",
      fitzpatrick_scale: false,
      category: "flags"
    },
    latvia: {
      keywords: ["lv", "flag", "nation", "country", "banner"],
      char: "🇱🇻",
      fitzpatrick_scale: false,
      category: "flags"
    },
    lebanon: {
      keywords: ["lb", "flag", "nation", "country", "banner"],
      char: "🇱🇧",
      fitzpatrick_scale: false,
      category: "flags"
    },
    lesotho: {
      keywords: ["ls", "flag", "nation", "country", "banner"],
      char: "🇱🇸",
      fitzpatrick_scale: false,
      category: "flags"
    },
    liberia: {
      keywords: ["lr", "flag", "nation", "country", "banner"],
      char: "🇱🇷",
      fitzpatrick_scale: false,
      category: "flags"
    },
    libya: {
      keywords: ["ly", "flag", "nation", "country", "banner"],
      char: "🇱🇾",
      fitzpatrick_scale: false,
      category: "flags"
    },
    liechtenstein: {
      keywords: ["li", "flag", "nation", "country", "banner"],
      char: "🇱🇮",
      fitzpatrick_scale: false,
      category: "flags"
    },
    lithuania: {
      keywords: ["lt", "flag", "nation", "country", "banner"],
      char: "🇱🇹",
      fitzpatrick_scale: false,
      category: "flags"
    },
    luxembourg: {
      keywords: ["lu", "flag", "nation", "country", "banner"],
      char: "🇱🇺",
      fitzpatrick_scale: false,
      category: "flags"
    },
    macau: {
      keywords: ["macao", "flag", "nation", "country", "banner"],
      char: "🇲🇴",
      fitzpatrick_scale: false,
      category: "flags"
    },
    macedonia: {
      keywords: ["macedonia,", "flag", "nation", "country", "banner"],
      char: "🇲🇰",
      fitzpatrick_scale: false,
      category: "flags"
    },
    madagascar: {
      keywords: ["mg", "flag", "nation", "country", "banner"],
      char: "🇲🇬",
      fitzpatrick_scale: false,
      category: "flags"
    },
    malawi: {
      keywords: ["mw", "flag", "nation", "country", "banner"],
      char: "🇲🇼",
      fitzpatrick_scale: false,
      category: "flags"
    },
    malaysia: {
      keywords: ["my", "flag", "nation", "country", "banner"],
      char: "🇲🇾",
      fitzpatrick_scale: false,
      category: "flags"
    },
    maldives: {
      keywords: ["mv", "flag", "nation", "country", "banner"],
      char: "🇲🇻",
      fitzpatrick_scale: false,
      category: "flags"
    },
    mali: {
      keywords: ["ml", "flag", "nation", "country", "banner"],
      char: "🇲🇱",
      fitzpatrick_scale: false,
      category: "flags"
    },
    malta: {
      keywords: ["mt", "flag", "nation", "country", "banner"],
      char: "🇲🇹",
      fitzpatrick_scale: false,
      category: "flags"
    },
    marshall_islands: {
      keywords: ["marshall", "islands", "flag", "nation", "country", "banner"],
      char: "🇲🇭",
      fitzpatrick_scale: false,
      category: "flags"
    },
    martinique: {
      keywords: ["mq", "flag", "nation", "country", "banner"],
      char: "🇲🇶",
      fitzpatrick_scale: false,
      category: "flags"
    },
    mauritania: {
      keywords: ["mr", "flag", "nation", "country", "banner"],
      char: "🇲🇷",
      fitzpatrick_scale: false,
      category: "flags"
    },
    mauritius: {
      keywords: ["mu", "flag", "nation", "country", "banner"],
      char: "🇲🇺",
      fitzpatrick_scale: false,
      category: "flags"
    },
    mayotte: {
      keywords: ["yt", "flag", "nation", "country", "banner"],
      char: "🇾🇹",
      fitzpatrick_scale: false,
      category: "flags"
    },
    mexico: {
      keywords: ["mx", "flag", "nation", "country", "banner"],
      char: "🇲🇽",
      fitzpatrick_scale: false,
      category: "flags"
    },
    micronesia: {
      keywords: ["micronesia,", "federated", "states", "flag", "nation", "country", "banner"],
      char: "🇫🇲",
      fitzpatrick_scale: false,
      category: "flags"
    },
    moldova: {
      keywords: ["moldova,", "republic", "flag", "nation", "country", "banner"],
      char: "🇲🇩",
      fitzpatrick_scale: false,
      category: "flags"
    },
    monaco: {
      keywords: ["mc", "flag", "nation", "country", "banner"],
      char: "🇲🇨",
      fitzpatrick_scale: false,
      category: "flags"
    },
    mongolia: {
      keywords: ["mn", "flag", "nation", "country", "banner"],
      char: "🇲🇳",
      fitzpatrick_scale: false,
      category: "flags"
    },
    montenegro: {
      keywords: ["me", "flag", "nation", "country", "banner"],
      char: "🇲🇪",
      fitzpatrick_scale: false,
      category: "flags"
    },
    montserrat: {
      keywords: ["ms", "flag", "nation", "country", "banner"],
      char: "🇲🇸",
      fitzpatrick_scale: false,
      category: "flags"
    },
    morocco: {
      keywords: ["ma", "flag", "nation", "country", "banner"],
      char: "🇲🇦",
      fitzpatrick_scale: false,
      category: "flags"
    },
    mozambique: {
      keywords: ["mz", "flag", "nation", "country", "banner"],
      char: "🇲🇿",
      fitzpatrick_scale: false,
      category: "flags"
    },
    myanmar: {
      keywords: ["mm", "flag", "nation", "country", "banner"],
      char: "🇲🇲",
      fitzpatrick_scale: false,
      category: "flags"
    },
    namibia: {
      keywords: ["na", "flag", "nation", "country", "banner"],
      char: "🇳🇦",
      fitzpatrick_scale: false,
      category: "flags"
    },
    nauru: {
      keywords: ["nr", "flag", "nation", "country", "banner"],
      char: "🇳🇷",
      fitzpatrick_scale: false,
      category: "flags"
    },
    nepal: {
      keywords: ["np", "flag", "nation", "country", "banner"],
      char: "🇳🇵",
      fitzpatrick_scale: false,
      category: "flags"
    },
    netherlands: {
      keywords: ["nl", "flag", "nation", "country", "banner"],
      char: "🇳🇱",
      fitzpatrick_scale: false,
      category: "flags"
    },
    new_caledonia: {
      keywords: ["new", "caledonia", "flag", "nation", "country", "banner"],
      char: "🇳🇨",
      fitzpatrick_scale: false,
      category: "flags"
    },
    new_zealand: {
      keywords: ["new", "zealand", "flag", "nation", "country", "banner"],
      char: "🇳🇿",
      fitzpatrick_scale: false,
      category: "flags"
    },
    nicaragua: {
      keywords: ["ni", "flag", "nation", "country", "banner"],
      char: "🇳🇮",
      fitzpatrick_scale: false,
      category: "flags"
    },
    niger: {
      keywords: ["ne", "flag", "nation", "country", "banner"],
      char: "🇳🇪",
      fitzpatrick_scale: false,
      category: "flags"
    },
    nigeria: {
      keywords: ["flag", "nation", "country", "banner"],
      char: "🇳🇬",
      fitzpatrick_scale: false,
      category: "flags"
    },
    niue: {
      keywords: ["nu", "flag", "nation", "country", "banner"],
      char: "🇳🇺",
      fitzpatrick_scale: false,
      category: "flags"
    },
    norfolk_island: {
      keywords: ["norfolk", "island", "flag", "nation", "country", "banner"],
      char: "🇳🇫",
      fitzpatrick_scale: false,
      category: "flags"
    },
    northern_mariana_islands: {
      keywords: ["northern", "mariana", "islands", "flag", "nation", "country", "banner"],
      char: "🇲🇵",
      fitzpatrick_scale: false,
      category: "flags"
    },
    north_korea: {
      keywords: ["north", "korea", "nation", "flag", "country", "banner"],
      char: "🇰🇵",
      fitzpatrick_scale: false,
      category: "flags"
    },
    norway: {
      keywords: ["no", "flag", "nation", "country", "banner"],
      char: "🇳🇴",
      fitzpatrick_scale: false,
      category: "flags"
    },
    oman: {
      keywords: ["om_symbol", "flag", "nation", "country", "banner"],
      char: "🇴🇲",
      fitzpatrick_scale: false,
      category: "flags"
    },
    pakistan: {
      keywords: ["pk", "flag", "nation", "country", "banner"],
      char: "🇵🇰",
      fitzpatrick_scale: false,
      category: "flags"
    },
    palau: {
      keywords: ["pw", "flag", "nation", "country", "banner"],
      char: "🇵🇼",
      fitzpatrick_scale: false,
      category: "flags"
    },
    palestinian_territories: {
      keywords: ["palestine", "palestinian", "territories", "flag", "nation", "country", "banner"],
      char: "🇵🇸",
      fitzpatrick_scale: false,
      category: "flags"
    },
    panama: {
      keywords: ["pa", "flag", "nation", "country", "banner"],
      char: "🇵🇦",
      fitzpatrick_scale: false,
      category: "flags"
    },
    papua_new_guinea: {
      keywords: ["papua", "new", "guinea", "flag", "nation", "country", "banner"],
      char: "🇵🇬",
      fitzpatrick_scale: false,
      category: "flags"
    },
    paraguay: {
      keywords: ["py", "flag", "nation", "country", "banner"],
      char: "🇵🇾",
      fitzpatrick_scale: false,
      category: "flags"
    },
    peru: {
      keywords: ["pe", "flag", "nation", "country", "banner"],
      char: "🇵🇪",
      fitzpatrick_scale: false,
      category: "flags"
    },
    philippines: {
      keywords: ["ph", "flag", "nation", "country", "banner"],
      char: "🇵🇭",
      fitzpatrick_scale: false,
      category: "flags"
    },
    pitcairn_islands: {
      keywords: ["pitcairn", "flag", "nation", "country", "banner"],
      char: "🇵🇳",
      fitzpatrick_scale: false,
      category: "flags"
    },
    poland: {
      keywords: ["pl", "flag", "nation", "country", "banner"],
      char: "🇵🇱",
      fitzpatrick_scale: false,
      category: "flags"
    },
    portugal: {
      keywords: ["pt", "flag", "nation", "country", "banner"],
      char: "🇵🇹",
      fitzpatrick_scale: false,
      category: "flags"
    },
    puerto_rico: {
      keywords: ["puerto", "rico", "flag", "nation", "country", "banner"],
      char: "🇵🇷",
      fitzpatrick_scale: false,
      category: "flags"
    },
    qatar: {
      keywords: ["qa", "flag", "nation", "country", "banner"],
      char: "🇶🇦",
      fitzpatrick_scale: false,
      category: "flags"
    },
    reunion: {
      keywords: ["réunion", "flag", "nation", "country", "banner"],
      char: "🇷🇪",
      fitzpatrick_scale: false,
      category: "flags"
    },
    romania: {
      keywords: ["ro", "flag", "nation", "country", "banner"],
      char: "🇷🇴",
      fitzpatrick_scale: false,
      category: "flags"
    },
    ru: {
      keywords: ["russian", "federation", "flag", "nation", "country", "banner"],
      char: "🇷🇺",
      fitzpatrick_scale: false,
      category: "flags"
    },
    rwanda: {
      keywords: ["rw", "flag", "nation", "country", "banner"],
      char: "🇷🇼",
      fitzpatrick_scale: false,
      category: "flags"
    },
    st_barthelemy: {
      keywords: ["saint", "barthélemy", "flag", "nation", "country", "banner"],
      char: "🇧🇱",
      fitzpatrick_scale: false,
      category: "flags"
    },
    st_helena: {
      keywords: ["saint", "helena", "ascension", "tristan", "cunha", "flag", "nation", "country", "banner"],
      char: "🇸🇭",
      fitzpatrick_scale: false,
      category: "flags"
    },
    st_kitts_nevis: {
      keywords: ["saint", "kitts", "nevis", "flag", "nation", "country", "banner"],
      char: "🇰🇳",
      fitzpatrick_scale: false,
      category: "flags"
    },
    st_lucia: {
      keywords: ["saint", "lucia", "flag", "nation", "country", "banner"],
      char: "🇱🇨",
      fitzpatrick_scale: false,
      category: "flags"
    },
    st_pierre_miquelon: {
      keywords: ["saint", "pierre", "miquelon", "flag", "nation", "country", "banner"],
      char: "🇵🇲",
      fitzpatrick_scale: false,
      category: "flags"
    },
    st_vincent_grenadines: {
      keywords: ["saint", "vincent", "grenadines", "flag", "nation", "country", "banner"],
      char: "🇻🇨",
      fitzpatrick_scale: false,
      category: "flags"
    },
    samoa: {
      keywords: ["ws", "flag", "nation", "country", "banner"],
      char: "🇼🇸",
      fitzpatrick_scale: false,
      category: "flags"
    },
    san_marino: {
      keywords: ["san", "marino", "flag", "nation", "country", "banner"],
      char: "🇸🇲",
      fitzpatrick_scale: false,
      category: "flags"
    },
    sao_tome_principe: {
      keywords: ["sao", "tome", "principe", "flag", "nation", "country", "banner"],
      char: "🇸🇹",
      fitzpatrick_scale: false,
      category: "flags"
    },
    saudi_arabia: {
      keywords: ["flag", "nation", "country", "banner"],
      char: "🇸🇦",
      fitzpatrick_scale: false,
      category: "flags"
    },
    senegal: {
      keywords: ["sn", "flag", "nation", "country", "banner"],
      char: "🇸🇳",
      fitzpatrick_scale: false,
      category: "flags"
    },
    serbia: {
      keywords: ["rs", "flag", "nation", "country", "banner"],
      char: "🇷🇸",
      fitzpatrick_scale: false,
      category: "flags"
    },
    seychelles: {
      keywords: ["sc", "flag", "nation", "country", "banner"],
      char: "🇸🇨",
      fitzpatrick_scale: false,
      category: "flags"
    },
    sierra_leone: {
      keywords: ["sierra", "leone", "flag", "nation", "country", "banner"],
      char: "🇸🇱",
      fitzpatrick_scale: false,
      category: "flags"
    },
    singapore: {
      keywords: ["sg", "flag", "nation", "country", "banner"],
      char: "🇸🇬",
      fitzpatrick_scale: false,
      category: "flags"
    },
    sint_maarten: {
      keywords: ["sint", "maarten", "dutch", "flag", "nation", "country", "banner"],
      char: "🇸🇽",
      fitzpatrick_scale: false,
      category: "flags"
    },
    slovakia: {
      keywords: ["sk", "flag", "nation", "country", "banner"],
      char: "🇸🇰",
      fitzpatrick_scale: false,
      category: "flags"
    },
    slovenia: {
      keywords: ["si", "flag", "nation", "country", "banner"],
      char: "🇸🇮",
      fitzpatrick_scale: false,
      category: "flags"
    },
    solomon_islands: {
      keywords: ["solomon", "islands", "flag", "nation", "country", "banner"],
      char: "🇸🇧",
      fitzpatrick_scale: false,
      category: "flags"
    },
    somalia: {
      keywords: ["so", "flag", "nation", "country", "banner"],
      char: "🇸🇴",
      fitzpatrick_scale: false,
      category: "flags"
    },
    south_africa: {
      keywords: ["south", "africa", "flag", "nation", "country", "banner"],
      char: "🇿🇦",
      fitzpatrick_scale: false,
      category: "flags"
    },
    south_georgia_south_sandwich_islands: {
      keywords: ["south", "georgia", "sandwich", "islands", "flag", "nation", "country", "banner"],
      char: "🇬🇸",
      fitzpatrick_scale: false,
      category: "flags"
    },
    kr: {
      keywords: ["south", "korea", "nation", "flag", "country", "banner"],
      char: "🇰🇷",
      fitzpatrick_scale: false,
      category: "flags"
    },
    south_sudan: {
      keywords: ["south", "sd", "flag", "nation", "country", "banner"],
      char: "🇸🇸",
      fitzpatrick_scale: false,
      category: "flags"
    },
    es: {
      keywords: ["spain", "flag", "nation", "country", "banner"],
      char: "🇪🇸",
      fitzpatrick_scale: false,
      category: "flags"
    },
    sri_lanka: {
      keywords: ["sri", "lanka", "flag", "nation", "country", "banner"],
      char: "🇱🇰",
      fitzpatrick_scale: false,
      category: "flags"
    },
    sudan: {
      keywords: ["sd", "flag", "nation", "country", "banner"],
      char: "🇸🇩",
      fitzpatrick_scale: false,
      category: "flags"
    },
    suriname: {
      keywords: ["sr", "flag", "nation", "country", "banner"],
      char: "🇸🇷",
      fitzpatrick_scale: false,
      category: "flags"
    },
    swaziland: {
      keywords: ["sz", "flag", "nation", "country", "banner"],
      char: "🇸🇿",
      fitzpatrick_scale: false,
      category: "flags"
    },
    sweden: {
      keywords: ["se", "flag", "nation", "country", "banner"],
      char: "🇸🇪",
      fitzpatrick_scale: false,
      category: "flags"
    },
    switzerland: {
      keywords: ["ch", "flag", "nation", "country", "banner"],
      char: "🇨🇭",
      fitzpatrick_scale: false,
      category: "flags"
    },
    syria: {
      keywords: ["syrian", "arab", "republic", "flag", "nation", "country", "banner"],
      char: "🇸🇾",
      fitzpatrick_scale: false,
      category: "flags"
    },
    taiwan: {
      keywords: ["tw", "flag", "nation", "country", "banner"],
      char: "🇹🇼",
      fitzpatrick_scale: false,
      category: "flags"
    },
    tajikistan: {
      keywords: ["tj", "flag", "nation", "country", "banner"],
      char: "🇹🇯",
      fitzpatrick_scale: false,
      category: "flags"
    },
    tanzania: {
      keywords: ["tanzania,", "united", "republic", "flag", "nation", "country", "banner"],
      char: "🇹🇿",
      fitzpatrick_scale: false,
      category: "flags"
    },
    thailand: {
      keywords: ["th", "flag", "nation", "country", "banner"],
      char: "🇹🇭",
      fitzpatrick_scale: false,
      category: "flags"
    },
    timor_leste: {
      keywords: ["timor", "leste", "flag", "nation", "country", "banner"],
      char: "🇹🇱",
      fitzpatrick_scale: false,
      category: "flags"
    },
    togo: {
      keywords: ["tg", "flag", "nation", "country", "banner"],
      char: "🇹🇬",
      fitzpatrick_scale: false,
      category: "flags"
    },
    tokelau: {
      keywords: ["tk", "flag", "nation", "country", "banner"],
      char: "🇹🇰",
      fitzpatrick_scale: false,
      category: "flags"
    },
    tonga: {
      keywords: ["to", "flag", "nation", "country", "banner"],
      char: "🇹🇴",
      fitzpatrick_scale: false,
      category: "flags"
    },
    trinidad_tobago: {
      keywords: ["trinidad", "tobago", "flag", "nation", "country", "banner"],
      char: "🇹🇹",
      fitzpatrick_scale: false,
      category: "flags"
    },
    tunisia: {
      keywords: ["tn", "flag", "nation", "country", "banner"],
      char: "🇹🇳",
      fitzpatrick_scale: false,
      category: "flags"
    },
    tr: {
      keywords: ["turkey", "flag", "nation", "country", "banner"],
      char: "🇹🇷",
      fitzpatrick_scale: false,
      category: "flags"
    },
    turkmenistan: {
      keywords: ["flag", "nation", "country", "banner"],
      char: "🇹🇲",
      fitzpatrick_scale: false,
      category: "flags"
    },
    turks_caicos_islands: {
      keywords: ["turks", "caicos", "islands", "flag", "nation", "country", "banner"],
      char: "🇹🇨",
      fitzpatrick_scale: false,
      category: "flags"
    },
    tuvalu: {
      keywords: ["flag", "nation", "country", "banner"],
      char: "🇹🇻",
      fitzpatrick_scale: false,
      category: "flags"
    },
    uganda: {
      keywords: ["ug", "flag", "nation", "country", "banner"],
      char: "🇺🇬",
      fitzpatrick_scale: false,
      category: "flags"
    },
    ukraine: {
      keywords: ["ua", "flag", "nation", "country", "banner"],
      char: "🇺🇦",
      fitzpatrick_scale: false,
      category: "flags"
    },
    united_arab_emirates: {
      keywords: ["united", "arab", "emirates", "flag", "nation", "country", "banner"],
      char: "🇦🇪",
      fitzpatrick_scale: false,
      category: "flags"
    },
    uk: {
      keywords: ["united", "kingdom", "great", "britain", "northern", "ireland", "flag", "nation", "country", "banner", "british", "UK", "english", "england", "union jack"],
      char: "🇬🇧",
      fitzpatrick_scale: false,
      category: "flags"
    },
    england: {
      keywords: ["flag", "english"],
      char: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
      fitzpatrick_scale: false,
      category: "flags"
    },
    scotland: {
      keywords: ["flag", "scottish"],
      char: "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
      fitzpatrick_scale: false,
      category: "flags"
    },
    wales: {
      keywords: ["flag", "welsh"],
      char: "🏴󠁧󠁢󠁷󠁬󠁳󠁿",
      fitzpatrick_scale: false,
      category: "flags"
    },
    us: {
      keywords: ["united", "states", "america", "flag", "nation", "country", "banner"],
      char: "🇺🇸",
      fitzpatrick_scale: false,
      category: "flags"
    },
    us_virgin_islands: {
      keywords: ["virgin", "islands", "us", "flag", "nation", "country", "banner"],
      char: "🇻🇮",
      fitzpatrick_scale: false,
      category: "flags"
    },
    uruguay: {
      keywords: ["uy", "flag", "nation", "country", "banner"],
      char: "🇺🇾",
      fitzpatrick_scale: false,
      category: "flags"
    },
    uzbekistan: {
      keywords: ["uz", "flag", "nation", "country", "banner"],
      char: "🇺🇿",
      fitzpatrick_scale: false,
      category: "flags"
    },
    vanuatu: {
      keywords: ["vu", "flag", "nation", "country", "banner"],
      char: "🇻🇺",
      fitzpatrick_scale: false,
      category: "flags"
    },
    vatican_city: {
      keywords: ["vatican", "city", "flag", "nation", "country", "banner"],
      char: "🇻🇦",
      fitzpatrick_scale: false,
      category: "flags"
    },
    venezuela: {
      keywords: ["ve", "bolivarian", "republic", "flag", "nation", "country", "banner"],
      char: "🇻🇪",
      fitzpatrick_scale: false,
      category: "flags"
    },
    vietnam: {
      keywords: ["viet", "nam", "flag", "nation", "country", "banner"],
      char: "🇻🇳",
      fitzpatrick_scale: false,
      category: "flags"
    },
    wallis_futuna: {
      keywords: ["wallis", "futuna", "flag", "nation", "country", "banner"],
      char: "🇼🇫",
      fitzpatrick_scale: false,
      category: "flags"
    },
    western_sahara: {
      keywords: ["western", "sahara", "flag", "nation", "country", "banner"],
      char: "🇪🇭",
      fitzpatrick_scale: false,
      category: "flags"
    },
    yemen: {
      keywords: ["ye", "flag", "nation", "country", "banner"],
      char: "🇾🇪",
      fitzpatrick_scale: false,
      category: "flags"
    },
    zambia: {
      keywords: ["zm", "flag", "nation", "country", "banner"],
      char: "🇿🇲",
      fitzpatrick_scale: false,
      category: "flags"
    },
    zimbabwe: {
      keywords: ["zw", "flag", "nation", "country", "banner"],
      char: "🇿🇼",
      fitzpatrick_scale: false,
      category: "flags"
    },
    united_nations: {
      keywords: ["un", "flag", "banner"],
      char: "🇺🇳",
      fitzpatrick_scale: false,
      category: "flags"
    },
    pirate_flag: {
      keywords: ["skull", "crossbones", "flag", "banner"],
      char: "🏴‍☠️",
      fitzpatrick_scale: false,
      category: "flags"
    }
  };
});

// node_modules/emojilib/ordered.json
var require_ordered = __commonJS(function(exports2, module2) {
  module2.exports = [
    "grinning",
    "smiley",
    "smile",
    "grin",
    "laughing",
    "sweat_smile",
    "joy",
    "rofl",
    "relaxed",
    "blush",
    "innocent",
    "slightly_smiling_face",
    "upside_down_face",
    "wink",
    "relieved",
    "heart_eyes",
    "smiling_face_with_three_hearts",
    "kissing_heart",
    "kissing",
    "kissing_smiling_eyes",
    "kissing_closed_eyes",
    "yum",
    "stuck_out_tongue",
    "stuck_out_tongue_closed_eyes",
    "stuck_out_tongue_winking_eye",
    "zany",
    "raised_eyebrow",
    "monocle",
    "nerd_face",
    "sunglasses",
    "star_struck",
    "partying",
    "smirk",
    "unamused",
    "disappointed",
    "pensive",
    "worried",
    "confused",
    "slightly_frowning_face",
    "frowning_face",
    "persevere",
    "confounded",
    "tired_face",
    "weary",
    "pleading",
    "cry",
    "sob",
    "triumph",
    "angry",
    "rage",
    "symbols_over_mouth",
    "exploding_head",
    "flushed",
    "hot",
    "cold",
    "scream",
    "fearful",
    "cold_sweat",
    "disappointed_relieved",
    "sweat",
    "hugs",
    "thinking",
    "hand_over_mouth",
    "shushing",
    "lying_face",
    "no_mouth",
    "neutral_face",
    "expressionless",
    "grimacing",
    "roll_eyes",
    "hushed",
    "frowning",
    "anguished",
    "open_mouth",
    "astonished",
    "sleeping",
    "drooling_face",
    "sleepy",
    "dizzy_face",
    "zipper_mouth_face",
    "woozy",
    "nauseated_face",
    "vomiting",
    "sneezing_face",
    "mask",
    "face_with_thermometer",
    "face_with_head_bandage",
    "money_mouth_face",
    "cowboy_hat_face",
    "smiling_imp",
    "imp",
    "japanese_ogre",
    "japanese_goblin",
    "clown_face",
    "poop",
    "ghost",
    "skull",
    "skull_and_crossbones",
    "alien",
    "space_invader",
    "robot",
    "jack_o_lantern",
    "smiley_cat",
    "smile_cat",
    "joy_cat",
    "heart_eyes_cat",
    "smirk_cat",
    "kissing_cat",
    "scream_cat",
    "crying_cat_face",
    "pouting_cat",
    "palms_up",
    "open_hands",
    "raised_hands",
    "clap",
    "handshake",
    "+1",
    "-1",
    "facepunch",
    "fist",
    "fist_left",
    "fist_right",
    "crossed_fingers",
    "v",
    "love_you",
    "metal",
    "ok_hand",
    "point_left",
    "point_right",
    "point_up",
    "point_down",
    "point_up_2",
    "raised_hand",
    "raised_back_of_hand",
    "raised_hand_with_fingers_splayed",
    "vulcan_salute",
    "wave",
    "call_me_hand",
    "muscle",
    "fu",
    "writing_hand",
    "pray",
    "foot",
    "leg",
    "ring",
    "lipstick",
    "kiss",
    "lips",
    "tooth",
    "tongue",
    "ear",
    "nose",
    "footprints",
    "eye",
    "eyes",
    "brain",
    "speaking_head",
    "bust_in_silhouette",
    "busts_in_silhouette",
    "baby",
    "girl",
    "child",
    "boy",
    "woman",
    "adult",
    "man",
    "blonde_woman",
    "blonde_man",
    "bearded_person",
    "older_woman",
    "older_adult",
    "older_man",
    "man_with_gua_pi_mao",
    "woman_with_headscarf",
    "woman_with_turban",
    "man_with_turban",
    "policewoman",
    "policeman",
    "construction_worker_woman",
    "construction_worker_man",
    "guardswoman",
    "guardsman",
    "female_detective",
    "male_detective",
    "woman_health_worker",
    "man_health_worker",
    "woman_farmer",
    "man_farmer",
    "woman_cook",
    "man_cook",
    "woman_student",
    "man_student",
    "woman_singer",
    "man_singer",
    "woman_teacher",
    "man_teacher",
    "woman_factory_worker",
    "man_factory_worker",
    "woman_technologist",
    "man_technologist",
    "woman_office_worker",
    "man_office_worker",
    "woman_mechanic",
    "man_mechanic",
    "woman_scientist",
    "man_scientist",
    "woman_artist",
    "man_artist",
    "woman_firefighter",
    "man_firefighter",
    "woman_pilot",
    "man_pilot",
    "woman_astronaut",
    "man_astronaut",
    "woman_judge",
    "man_judge",
    "bride_with_veil",
    "man_in_tuxedo",
    "princess",
    "prince",
    "woman_superhero",
    "man_superhero",
    "woman_supervillain",
    "man_supervillain",
    "mrs_claus",
    "santa",
    "sorceress",
    "wizard",
    "woman_elf",
    "man_elf",
    "woman_vampire",
    "man_vampire",
    "woman_zombie",
    "man_zombie",
    "woman_genie",
    "man_genie",
    "mermaid",
    "merman",
    "woman_fairy",
    "man_fairy",
    "angel",
    "pregnant_woman",
    "breastfeeding",
    "bowing_woman",
    "bowing_man",
    "tipping_hand_woman",
    "tipping_hand_man",
    "no_good_woman",
    "no_good_man",
    "ok_woman",
    "ok_man",
    "raising_hand_woman",
    "raising_hand_man",
    "woman_facepalming",
    "man_facepalming",
    "woman_shrugging",
    "man_shrugging",
    "pouting_woman",
    "pouting_man",
    "frowning_woman",
    "frowning_man",
    "haircut_woman",
    "haircut_man",
    "massage_woman",
    "massage_man",
    "woman_in_steamy_room",
    "man_in_steamy_room",
    "nail_care",
    "selfie",
    "dancer",
    "man_dancing",
    "dancing_women",
    "dancing_men",
    "business_suit_levitating",
    "walking_woman",
    "walking_man",
    "running_woman",
    "running_man",
    "couple",
    "two_women_holding_hands",
    "two_men_holding_hands",
    "couple_with_heart_woman_man",
    "couple_with_heart_woman_woman",
    "couple_with_heart_man_man",
    "couplekiss_man_woman",
    "couplekiss_woman_woman",
    "couplekiss_man_man",
    "family_man_woman_boy",
    "family_man_woman_girl",
    "family_man_woman_girl_boy",
    "family_man_woman_boy_boy",
    "family_man_woman_girl_girl",
    "family_woman_woman_boy",
    "family_woman_woman_girl",
    "family_woman_woman_girl_boy",
    "family_woman_woman_boy_boy",
    "family_woman_woman_girl_girl",
    "family_man_man_boy",
    "family_man_man_girl",
    "family_man_man_girl_boy",
    "family_man_man_boy_boy",
    "family_man_man_girl_girl",
    "family_woman_boy",
    "family_woman_girl",
    "family_woman_girl_boy",
    "family_woman_boy_boy",
    "family_woman_girl_girl",
    "family_man_boy",
    "family_man_girl",
    "family_man_girl_boy",
    "family_man_boy_boy",
    "family_man_girl_girl",
    "yarn",
    "thread",
    "coat",
    "labcoat",
    "womans_clothes",
    "tshirt",
    "jeans",
    "necktie",
    "dress",
    "bikini",
    "kimono",
    "flat_shoe",
    "high_heel",
    "sandal",
    "boot",
    "mans_shoe",
    "athletic_shoe",
    "hiking_boot",
    "socks",
    "gloves",
    "scarf",
    "tophat",
    "billed_hat",
    "womans_hat",
    "mortar_board",
    "rescue_worker_helmet",
    "crown",
    "pouch",
    "purse",
    "handbag",
    "briefcase",
    "school_satchel",
    "luggage",
    "eyeglasses",
    "dark_sunglasses",
    "goggles",
    "closed_umbrella",
    "dog",
    "cat",
    "mouse",
    "hamster",
    "rabbit",
    "fox_face",
    "bear",
    "panda_face",
    "koala",
    "tiger",
    "lion",
    "cow",
    "pig",
    "pig_nose",
    "frog",
    "monkey_face",
    "see_no_evil",
    "hear_no_evil",
    "speak_no_evil",
    "monkey",
    "chicken",
    "penguin",
    "bird",
    "baby_chick",
    "hatching_chick",
    "hatched_chick",
    "duck",
    "eagle",
    "owl",
    "bat",
    "wolf",
    "boar",
    "horse",
    "unicorn",
    "honeybee",
    "bug",
    "butterfly",
    "snail",
    "shell",
    "beetle",
    "ant",
    "mosquito",
    "grasshopper",
    "spider",
    "spider_web",
    "scorpion",
    "turtle",
    "snake",
    "lizard",
    "t-rex",
    "sauropod",
    "octopus",
    "squid",
    "shrimp",
    "lobster",
    "crab",
    "blowfish",
    "tropical_fish",
    "fish",
    "dolphin",
    "whale",
    "whale2",
    "shark",
    "crocodile",
    "tiger2",
    "leopard",
    "zebra",
    "gorilla",
    "elephant",
    "hippopotamus",
    "rhinoceros",
    "dromedary_camel",
    "giraffe",
    "kangaroo",
    "camel",
    "water_buffalo",
    "ox",
    "cow2",
    "racehorse",
    "pig2",
    "ram",
    "sheep",
    "llama",
    "goat",
    "deer",
    "dog2",
    "poodle",
    "cat2",
    "rooster",
    "turkey",
    "peacock",
    "parrot",
    "swan",
    "dove",
    "rabbit2",
    "raccoon",
    "badger",
    "rat",
    "mouse2",
    "chipmunk",
    "hedgehog",
    "paw_prints",
    "dragon",
    "dragon_face",
    "cactus",
    "christmas_tree",
    "evergreen_tree",
    "deciduous_tree",
    "palm_tree",
    "seedling",
    "herb",
    "shamrock",
    "four_leaf_clover",
    "bamboo",
    "tanabata_tree",
    "leaves",
    "fallen_leaf",
    "maple_leaf",
    "ear_of_rice",
    "hibiscus",
    "sunflower",
    "rose",
    "wilted_flower",
    "tulip",
    "blossom",
    "cherry_blossom",
    "bouquet",
    "mushroom",
    "earth_americas",
    "earth_africa",
    "earth_asia",
    "full_moon",
    "waning_gibbous_moon",
    "last_quarter_moon",
    "waning_crescent_moon",
    "new_moon",
    "waxing_crescent_moon",
    "first_quarter_moon",
    "waxing_gibbous_moon",
    "new_moon_with_face",
    "full_moon_with_face",
    "first_quarter_moon_with_face",
    "last_quarter_moon_with_face",
    "sun_with_face",
    "crescent_moon",
    "star",
    "star2",
    "dizzy",
    "sparkles",
    "comet",
    "sunny",
    "sun_behind_small_cloud",
    "partly_sunny",
    "sun_behind_large_cloud",
    "sun_behind_rain_cloud",
    "cloud",
    "cloud_with_rain",
    "cloud_with_lightning_and_rain",
    "cloud_with_lightning",
    "zap",
    "fire",
    "boom",
    "snowflake",
    "cloud_with_snow",
    "snowman",
    "snowman_with_snow",
    "wind_face",
    "dash",
    "tornado",
    "fog",
    "open_umbrella",
    "umbrella",
    "droplet",
    "sweat_drops",
    "ocean",
    "green_apple",
    "apple",
    "pear",
    "tangerine",
    "lemon",
    "banana",
    "watermelon",
    "grapes",
    "strawberry",
    "melon",
    "cherries",
    "peach",
    "mango",
    "pineapple",
    "coconut",
    "kiwi_fruit",
    "tomato",
    "eggplant",
    "avocado",
    "broccoli",
    "leafy_greens",
    "cucumber",
    "hot_pepper",
    "corn",
    "carrot",
    "potato",
    "sweet_potato",
    "croissant",
    "bagel",
    "bread",
    "baguette_bread",
    "pretzel",
    "cheese",
    "egg",
    "fried_egg",
    "pancakes",
    "bacon",
    "steak",
    "poultry_leg",
    "meat_on_bone",
    "bone",
    "hotdog",
    "hamburger",
    "fries",
    "pizza",
    "sandwich",
    "stuffed_flatbread",
    "taco",
    "burrito",
    "green_salad",
    "shallow_pan_of_food",
    "canned_food",
    "spaghetti",
    "ramen",
    "stew",
    "curry",
    "sushi",
    "bento",
    "fried_shrimp",
    "rice_ball",
    "rice",
    "rice_cracker",
    "fish_cake",
    "fortune_cookie",
    "moon_cake",
    "oden",
    "dango",
    "shaved_ice",
    "ice_cream",
    "icecream",
    "pie",
    "cupcake",
    "cake",
    "birthday",
    "custard",
    "lollipop",
    "candy",
    "chocolate_bar",
    "popcorn",
    "doughnut",
    "dumpling",
    "cookie",
    "chestnut",
    "peanuts",
    "honey_pot",
    "milk_glass",
    "baby_bottle",
    "coffee",
    "tea",
    "cup_with_straw",
    "sake",
    "beer",
    "beers",
    "clinking_glasses",
    "wine_glass",
    "tumbler_glass",
    "cocktail",
    "tropical_drink",
    "champagne",
    "spoon",
    "fork_and_knife",
    "plate_with_cutlery",
    "bowl_with_spoon",
    "takeout_box",
    "chopsticks",
    "salt",
    "soccer",
    "basketball",
    "football",
    "baseball",
    "softball",
    "tennis",
    "volleyball",
    "rugby_football",
    "flying_disc",
    "8ball",
    "golf",
    "golfing_woman",
    "golfing_man",
    "ping_pong",
    "badminton",
    "goal_net",
    "ice_hockey",
    "field_hockey",
    "lacrosse",
    "cricket",
    "ski",
    "skier",
    "snowboarder",
    "person_fencing",
    "women_wrestling",
    "men_wrestling",
    "woman_cartwheeling",
    "man_cartwheeling",
    "woman_playing_handball",
    "man_playing_handball",
    "ice_skate",
    "curling_stone",
    "skateboard",
    "sled",
    "bow_and_arrow",
    "fishing_pole_and_fish",
    "boxing_glove",
    "martial_arts_uniform",
    "rowing_woman",
    "rowing_man",
    "climbing_woman",
    "climbing_man",
    "swimming_woman",
    "swimming_man",
    "woman_playing_water_polo",
    "man_playing_water_polo",
    "woman_in_lotus_position",
    "man_in_lotus_position",
    "surfing_woman",
    "surfing_man",
    "basketball_woman",
    "basketball_man",
    "weight_lifting_woman",
    "weight_lifting_man",
    "biking_woman",
    "biking_man",
    "mountain_biking_woman",
    "mountain_biking_man",
    "horse_racing",
    "trophy",
    "running_shirt_with_sash",
    "medal_sports",
    "medal_military",
    "1st_place_medal",
    "2nd_place_medal",
    "3rd_place_medal",
    "reminder_ribbon",
    "rosette",
    "ticket",
    "tickets",
    "performing_arts",
    "art",
    "circus_tent",
    "woman_juggling",
    "man_juggling",
    "microphone",
    "headphones",
    "musical_score",
    "musical_keyboard",
    "drum",
    "saxophone",
    "trumpet",
    "guitar",
    "violin",
    "clapper",
    "video_game",
    "dart",
    "game_die",
    "chess_pawn",
    "slot_machine",
    "jigsaw",
    "bowling",
    "red_car",
    "taxi",
    "blue_car",
    "bus",
    "trolleybus",
    "racing_car",
    "police_car",
    "ambulance",
    "fire_engine",
    "minibus",
    "truck",
    "articulated_lorry",
    "tractor",
    "kick_scooter",
    "motorcycle",
    "bike",
    "motor_scooter",
    "rotating_light",
    "oncoming_police_car",
    "oncoming_bus",
    "oncoming_automobile",
    "oncoming_taxi",
    "aerial_tramway",
    "mountain_cableway",
    "suspension_railway",
    "railway_car",
    "train",
    "monorail",
    "bullettrain_side",
    "bullettrain_front",
    "light_rail",
    "mountain_railway",
    "steam_locomotive",
    "train2",
    "metro",
    "tram",
    "station",
    "flying_saucer",
    "helicopter",
    "small_airplane",
    "airplane",
    "flight_departure",
    "flight_arrival",
    "sailboat",
    "motor_boat",
    "speedboat",
    "ferry",
    "passenger_ship",
    "rocket",
    "artificial_satellite",
    "seat",
    "canoe",
    "anchor",
    "construction",
    "fuelpump",
    "busstop",
    "vertical_traffic_light",
    "traffic_light",
    "ship",
    "ferris_wheel",
    "roller_coaster",
    "carousel_horse",
    "building_construction",
    "foggy",
    "tokyo_tower",
    "factory",
    "fountain",
    "rice_scene",
    "mountain",
    "mountain_snow",
    "mount_fuji",
    "volcano",
    "japan",
    "camping",
    "tent",
    "national_park",
    "motorway",
    "railway_track",
    "sunrise",
    "sunrise_over_mountains",
    "desert",
    "beach_umbrella",
    "desert_island",
    "city_sunrise",
    "city_sunset",
    "cityscape",
    "night_with_stars",
    "bridge_at_night",
    "milky_way",
    "stars",
    "sparkler",
    "fireworks",
    "rainbow",
    "houses",
    "european_castle",
    "japanese_castle",
    "stadium",
    "statue_of_liberty",
    "house",
    "house_with_garden",
    "derelict_house",
    "office",
    "department_store",
    "post_office",
    "european_post_office",
    "hospital",
    "bank",
    "hotel",
    "convenience_store",
    "school",
    "love_hotel",
    "wedding",
    "classical_building",
    "church",
    "mosque",
    "synagogue",
    "kaaba",
    "shinto_shrine",
    "watch",
    "iphone",
    "calling",
    "computer",
    "keyboard",
    "desktop_computer",
    "printer",
    "computer_mouse",
    "trackball",
    "joystick",
    "clamp",
    "minidisc",
    "floppy_disk",
    "cd",
    "dvd",
    "vhs",
    "camera",
    "camera_flash",
    "video_camera",
    "movie_camera",
    "film_projector",
    "film_strip",
    "telephone_receiver",
    "phone",
    "pager",
    "fax",
    "tv",
    "radio",
    "studio_microphone",
    "level_slider",
    "control_knobs",
    "compass",
    "stopwatch",
    "timer_clock",
    "alarm_clock",
    "mantelpiece_clock",
    "hourglass_flowing_sand",
    "hourglass",
    "satellite",
    "battery",
    "electric_plug",
    "bulb",
    "flashlight",
    "candle",
    "fire_extinguisher",
    "wastebasket",
    "oil_drum",
    "money_with_wings",
    "dollar",
    "yen",
    "euro",
    "pound",
    "moneybag",
    "credit_card",
    "gem",
    "balance_scale",
    "toolbox",
    "wrench",
    "hammer",
    "hammer_and_pick",
    "hammer_and_wrench",
    "pick",
    "nut_and_bolt",
    "gear",
    "brick",
    "chains",
    "magnet",
    "gun",
    "bomb",
    "firecracker",
    "hocho",
    "dagger",
    "crossed_swords",
    "shield",
    "smoking",
    "coffin",
    "funeral_urn",
    "amphora",
    "crystal_ball",
    "prayer_beads",
    "nazar_amulet",
    "barber",
    "alembic",
    "telescope",
    "microscope",
    "hole",
    "pill",
    "syringe",
    "dna",
    "microbe",
    "petri_dish",
    "test_tube",
    "thermometer",
    "broom",
    "basket",
    "toilet_paper",
    "label",
    "bookmark",
    "toilet",
    "shower",
    "bathtub",
    "bath",
    "soap",
    "sponge",
    "lotion_bottle",
    "key",
    "old_key",
    "couch_and_lamp",
    "sleeping_bed",
    "bed",
    "door",
    "bellhop_bell",
    "teddy_bear",
    "framed_picture",
    "world_map",
    "parasol_on_ground",
    "moyai",
    "shopping",
    "shopping_cart",
    "balloon",
    "flags",
    "ribbon",
    "gift",
    "confetti_ball",
    "tada",
    "dolls",
    "wind_chime",
    "crossed_flags",
    "izakaya_lantern",
    "red_envelope",
    "email",
    "envelope_with_arrow",
    "incoming_envelope",
    "e-mail",
    "love_letter",
    "postbox",
    "mailbox_closed",
    "mailbox",
    "mailbox_with_mail",
    "mailbox_with_no_mail",
    "package",
    "postal_horn",
    "inbox_tray",
    "outbox_tray",
    "scroll",
    "page_with_curl",
    "bookmark_tabs",
    "receipt",
    "bar_chart",
    "chart_with_upwards_trend",
    "chart_with_downwards_trend",
    "page_facing_up",
    "date",
    "calendar",
    "spiral_calendar",
    "card_index",
    "card_file_box",
    "ballot_box",
    "file_cabinet",
    "clipboard",
    "spiral_notepad",
    "file_folder",
    "open_file_folder",
    "card_index_dividers",
    "newspaper_roll",
    "newspaper",
    "notebook",
    "closed_book",
    "green_book",
    "blue_book",
    "orange_book",
    "notebook_with_decorative_cover",
    "ledger",
    "books",
    "open_book",
    "safety_pin",
    "link",
    "paperclip",
    "paperclips",
    "scissors",
    "triangular_ruler",
    "straight_ruler",
    "abacus",
    "pushpin",
    "round_pushpin",
    "closed_lock_with_key",
    "lock",
    "unlock",
    "lock_with_ink_pen",
    "pen",
    "fountain_pen",
    "black_nib",
    "memo",
    "pencil2",
    "crayon",
    "paintbrush",
    "mag",
    "mag_right",
    "heart",
    "orange_heart",
    "yellow_heart",
    "green_heart",
    "blue_heart",
    "purple_heart",
    "black_heart",
    "broken_heart",
    "heavy_heart_exclamation",
    "two_hearts",
    "revolving_hearts",
    "heartbeat",
    "heartpulse",
    "sparkling_heart",
    "cupid",
    "gift_heart",
    "heart_decoration",
    "peace_symbol",
    "latin_cross",
    "star_and_crescent",
    "om",
    "wheel_of_dharma",
    "star_of_david",
    "six_pointed_star",
    "menorah",
    "yin_yang",
    "orthodox_cross",
    "place_of_worship",
    "ophiuchus",
    "aries",
    "taurus",
    "gemini",
    "cancer",
    "leo",
    "virgo",
    "libra",
    "scorpius",
    "sagittarius",
    "capricorn",
    "aquarius",
    "pisces",
    "id",
    "atom_symbol",
    "u7a7a",
    "u5272",
    "radioactive",
    "biohazard",
    "mobile_phone_off",
    "vibration_mode",
    "u6709",
    "u7121",
    "u7533",
    "u55b6",
    "u6708",
    "eight_pointed_black_star",
    "vs",
    "accept",
    "white_flower",
    "ideograph_advantage",
    "secret",
    "congratulations",
    "u5408",
    "u6e80",
    "u7981",
    "a",
    "b",
    "ab",
    "cl",
    "o2",
    "sos",
    "no_entry",
    "name_badge",
    "no_entry_sign",
    "x",
    "o",
    "stop_sign",
    "anger",
    "hotsprings",
    "no_pedestrians",
    "do_not_litter",
    "no_bicycles",
    "non-potable_water",
    "underage",
    "no_mobile_phones",
    "exclamation",
    "grey_exclamation",
    "question",
    "grey_question",
    "bangbang",
    "interrobang",
    "100",
    "low_brightness",
    "high_brightness",
    "trident",
    "fleur_de_lis",
    "part_alternation_mark",
    "warning",
    "children_crossing",
    "beginner",
    "recycle",
    "u6307",
    "chart",
    "sparkle",
    "eight_spoked_asterisk",
    "negative_squared_cross_mark",
    "white_check_mark",
    "diamond_shape_with_a_dot_inside",
    "cyclone",
    "loop",
    "globe_with_meridians",
    "m",
    "atm",
    "zzz",
    "sa",
    "passport_control",
    "customs",
    "baggage_claim",
    "left_luggage",
    "wheelchair",
    "no_smoking",
    "wc",
    "parking",
    "potable_water",
    "mens",
    "womens",
    "baby_symbol",
    "restroom",
    "put_litter_in_its_place",
    "cinema",
    "signal_strength",
    "koko",
    "ng",
    "ok",
    "up",
    "cool",
    "new",
    "free",
    "zero",
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
    "keycap_ten",
    "asterisk",
    "1234",
    "eject_button",
    "arrow_forward",
    "pause_button",
    "next_track_button",
    "stop_button",
    "record_button",
    "play_or_pause_button",
    "previous_track_button",
    "fast_forward",
    "rewind",
    "twisted_rightwards_arrows",
    "repeat",
    "repeat_one",
    "arrow_backward",
    "arrow_up_small",
    "arrow_down_small",
    "arrow_double_up",
    "arrow_double_down",
    "arrow_right",
    "arrow_left",
    "arrow_up",
    "arrow_down",
    "arrow_upper_right",
    "arrow_lower_right",
    "arrow_lower_left",
    "arrow_upper_left",
    "arrow_up_down",
    "left_right_arrow",
    "arrows_counterclockwise",
    "arrow_right_hook",
    "leftwards_arrow_with_hook",
    "arrow_heading_up",
    "arrow_heading_down",
    "hash",
    "information_source",
    "abc",
    "abcd",
    "capital_abcd",
    "symbols",
    "musical_note",
    "notes",
    "wavy_dash",
    "curly_loop",
    "heavy_check_mark",
    "arrows_clockwise",
    "heavy_plus_sign",
    "heavy_minus_sign",
    "heavy_division_sign",
    "heavy_multiplication_x",
    "infinity",
    "heavy_dollar_sign",
    "currency_exchange",
    "copyright",
    "registered",
    "tm",
    "end",
    "back",
    "on",
    "top",
    "soon",
    "ballot_box_with_check",
    "radio_button",
    "white_circle",
    "black_circle",
    "red_circle",
    "large_blue_circle",
    "small_orange_diamond",
    "small_blue_diamond",
    "large_orange_diamond",
    "large_blue_diamond",
    "small_red_triangle",
    "black_small_square",
    "white_small_square",
    "black_large_square",
    "white_large_square",
    "small_red_triangle_down",
    "black_medium_square",
    "white_medium_square",
    "black_medium_small_square",
    "white_medium_small_square",
    "black_square_button",
    "white_square_button",
    "speaker",
    "sound",
    "loud_sound",
    "mute",
    "mega",
    "loudspeaker",
    "bell",
    "no_bell",
    "black_joker",
    "mahjong",
    "spades",
    "clubs",
    "hearts",
    "diamonds",
    "flower_playing_cards",
    "thought_balloon",
    "right_anger_bubble",
    "speech_balloon",
    "left_speech_bubble",
    "clock1",
    "clock2",
    "clock3",
    "clock4",
    "clock5",
    "clock6",
    "clock7",
    "clock8",
    "clock9",
    "clock10",
    "clock11",
    "clock12",
    "clock130",
    "clock230",
    "clock330",
    "clock430",
    "clock530",
    "clock630",
    "clock730",
    "clock830",
    "clock930",
    "clock1030",
    "clock1130",
    "clock1230",
    "white_flag",
    "black_flag",
    "pirate_flag",
    "checkered_flag",
    "triangular_flag_on_post",
    "rainbow_flag",
    "united_nations",
    "afghanistan",
    "aland_islands",
    "albania",
    "algeria",
    "american_samoa",
    "andorra",
    "angola",
    "anguilla",
    "antarctica",
    "antigua_barbuda",
    "argentina",
    "armenia",
    "aruba",
    "australia",
    "austria",
    "azerbaijan",
    "bahamas",
    "bahrain",
    "bangladesh",
    "barbados",
    "belarus",
    "belgium",
    "belize",
    "benin",
    "bermuda",
    "bhutan",
    "bolivia",
    "caribbean_netherlands",
    "bosnia_herzegovina",
    "botswana",
    "brazil",
    "british_indian_ocean_territory",
    "british_virgin_islands",
    "brunei",
    "bulgaria",
    "burkina_faso",
    "burundi",
    "cape_verde",
    "cambodia",
    "cameroon",
    "canada",
    "canary_islands",
    "cayman_islands",
    "central_african_republic",
    "chad",
    "chile",
    "cn",
    "christmas_island",
    "cocos_islands",
    "colombia",
    "comoros",
    "congo_brazzaville",
    "congo_kinshasa",
    "cook_islands",
    "costa_rica",
    "croatia",
    "cuba",
    "curacao",
    "cyprus",
    "czech_republic",
    "denmark",
    "djibouti",
    "dominica",
    "dominican_republic",
    "ecuador",
    "egypt",
    "el_salvador",
    "equatorial_guinea",
    "eritrea",
    "estonia",
    "ethiopia",
    "eu",
    "falkland_islands",
    "faroe_islands",
    "fiji",
    "finland",
    "fr",
    "french_guiana",
    "french_polynesia",
    "french_southern_territories",
    "gabon",
    "gambia",
    "georgia",
    "de",
    "ghana",
    "gibraltar",
    "greece",
    "greenland",
    "grenada",
    "guadeloupe",
    "guam",
    "guatemala",
    "guernsey",
    "guinea",
    "guinea_bissau",
    "guyana",
    "haiti",
    "honduras",
    "hong_kong",
    "hungary",
    "iceland",
    "india",
    "indonesia",
    "iran",
    "iraq",
    "ireland",
    "isle_of_man",
    "israel",
    "it",
    "cote_divoire",
    "jamaica",
    "jp",
    "jersey",
    "jordan",
    "kazakhstan",
    "kenya",
    "kiribati",
    "kosovo",
    "kuwait",
    "kyrgyzstan",
    "laos",
    "latvia",
    "lebanon",
    "lesotho",
    "liberia",
    "libya",
    "liechtenstein",
    "lithuania",
    "luxembourg",
    "macau",
    "macedonia",
    "madagascar",
    "malawi",
    "malaysia",
    "maldives",
    "mali",
    "malta",
    "marshall_islands",
    "martinique",
    "mauritania",
    "mauritius",
    "mayotte",
    "mexico",
    "micronesia",
    "moldova",
    "monaco",
    "mongolia",
    "montenegro",
    "montserrat",
    "morocco",
    "mozambique",
    "myanmar",
    "namibia",
    "nauru",
    "nepal",
    "netherlands",
    "new_caledonia",
    "new_zealand",
    "nicaragua",
    "niger",
    "nigeria",
    "niue",
    "norfolk_island",
    "northern_mariana_islands",
    "north_korea",
    "norway",
    "oman",
    "pakistan",
    "palau",
    "palestinian_territories",
    "panama",
    "papua_new_guinea",
    "paraguay",
    "peru",
    "philippines",
    "pitcairn_islands",
    "poland",
    "portugal",
    "puerto_rico",
    "qatar",
    "reunion",
    "romania",
    "ru",
    "rwanda",
    "st_barthelemy",
    "st_helena",
    "st_kitts_nevis",
    "st_lucia",
    "st_pierre_miquelon",
    "st_vincent_grenadines",
    "samoa",
    "san_marino",
    "sao_tome_principe",
    "saudi_arabia",
    "senegal",
    "serbia",
    "seychelles",
    "sierra_leone",
    "singapore",
    "sint_maarten",
    "slovakia",
    "slovenia",
    "solomon_islands",
    "somalia",
    "south_africa",
    "south_georgia_south_sandwich_islands",
    "kr",
    "south_sudan",
    "es",
    "sri_lanka",
    "sudan",
    "suriname",
    "swaziland",
    "sweden",
    "switzerland",
    "syria",
    "taiwan",
    "tajikistan",
    "tanzania",
    "thailand",
    "timor_leste",
    "togo",
    "tokelau",
    "tonga",
    "trinidad_tobago",
    "tunisia",
    "tr",
    "turkmenistan",
    "turks_caicos_islands",
    "tuvalu",
    "uganda",
    "ukraine",
    "united_arab_emirates",
    "uk",
    "england",
    "scotland",
    "wales",
    "us",
    "us_virgin_islands",
    "uruguay",
    "uzbekistan",
    "vanuatu",
    "vatican_city",
    "venezuela",
    "vietnam",
    "wallis_futuna",
    "western_sahara",
    "yemen",
    "zambia",
    "zimbabwe"
  ];
});

// node_modules/emojilib/index.js
var require_emojilib = __commonJS(function(exports2, module2) {
  module2.exports = {
    lib: require_emojis(),
    ordered: require_ordered(),
    fitzpatrick_scale_modifiers: ["\uD83C\uDFFB", "\uD83C\uDFFC", "\uD83C\uDFFD", "\uD83C\uDFFE", "\uD83C\uDFFF"]
  };
});

// node_modules/char-regex/index.js
var require_char_regex = __commonJS(function(exports2, module2) {
  module2.exports = () => {
    const astralRange = "\\ud800-\\udfff";
    const comboMarksRange = "\\u0300-\\u036f";
    const comboHalfMarksRange = "\\ufe20-\\ufe2f";
    const comboSymbolsRange = "\\u20d0-\\u20ff";
    const comboMarksExtendedRange = "\\u1ab0-\\u1aff";
    const comboMarksSupplementRange = "\\u1dc0-\\u1dff";
    const comboRange = comboMarksRange + comboHalfMarksRange + comboSymbolsRange + comboMarksExtendedRange + comboMarksSupplementRange;
    const varRange = "\\ufe0e\\ufe0f";
    const familyRange = "\\uD83D\\uDC69\\uD83C\\uDFFB\\u200D\\uD83C\\uDF93";
    const astral = `[${astralRange}]`;
    const combo = `[${comboRange}]`;
    const fitz = "\\ud83c[\\udffb-\\udfff]";
    const modifier = `(?:${combo}|${fitz})`;
    const nonAstral = `[^${astralRange}]`;
    const regional = "(?:\\uD83C[\\uDDE6-\\uDDFF]){2}";
    const surrogatePair = "[\\ud800-\\udbff][\\udc00-\\udfff]";
    const zwj = "\\u200d";
    const blackFlag = "(?:\\ud83c\\udff4\\udb40\\udc67\\udb40\\udc62\\udb40(?:\\udc65|\\udc73|\\udc77)\\udb40(?:\\udc6e|\\udc63|\\udc6c)\\udb40(?:\\udc67|\\udc74|\\udc73)\\udb40\\udc7f)";
    const family = `[${familyRange}]`;
    const optModifier = `${modifier}?`;
    const optVar = `[${varRange}]?`;
    const optJoin = `(?:${zwj}(?:${[nonAstral, regional, surrogatePair].join("|")})${optVar + optModifier})*`;
    const seq = optVar + optModifier + optJoin;
    const nonAstralCombo = `${nonAstral}${combo}?`;
    const symbol = `(?:${[nonAstralCombo, combo, regional, surrogatePair, astral, family].join("|")})`;
    return new RegExp(`${blackFlag}|${fitz}(?=${fitz})|${symbol + seq}`, "g");
  };
});

// node_modules/unicode-emoji-modifier-base/index.js
var require_unicode_emoji_modifier_base = __commonJS(function(exports2, module2) {
  module2.exports = new Set([
    9757,
    9977,
    9994,
    9995,
    9996,
    9997,
    127877,
    127939,
    127940,
    127946,
    127947,
    128066,
    128067,
    128070,
    128071,
    128072,
    128073,
    128074,
    128075,
    128076,
    128077,
    128078,
    128079,
    128080,
    128102,
    128103,
    128104,
    128105,
    128110,
    128112,
    128113,
    128114,
    128115,
    128116,
    128117,
    128118,
    128119,
    128120,
    128124,
    128129,
    128130,
    128131,
    128133,
    128134,
    128135,
    128170,
    128373,
    128378,
    128400,
    128405,
    128406,
    128581,
    128582,
    128583,
    128587,
    128588,
    128589,
    128590,
    128591,
    128675,
    128692,
    128693,
    128694,
    128704,
    129304,
    129305,
    129306,
    129307,
    129308,
    129309,
    129310,
    129318,
    129328,
    129331,
    129332,
    129333,
    129334,
    129335,
    129336,
    129337,
    129340,
    129341,
    129342
  ]);
});

// node_modules/skin-tone/index.js
var require_skin_tone = __commonJS(function(exports2, module2) {
  var emojiModifierBase = require_unicode_emoji_modifier_base();
  var skinTones = new Map([
    ["none", ""],
    ["white", "\uD83C\uDFFB"],
    ["creamWhite", "\uD83C\uDFFC"],
    ["lightBrown", "\uD83C\uDFFD"],
    ["brown", "\uD83C\uDFFE"],
    ["darkBrown", "\uD83C\uDFFF"]
  ]);
  module2.exports = (emoji, tone) => {
    if (!skinTones.has(tone)) {
      throw new TypeError(`Unexpected \`skinTone\` name: ${tone}`);
    }
    emoji = emoji.replace(/[\u{1f3fb}-\u{1f3ff}]/u, "");
    if (emojiModifierBase.has(emoji.codePointAt(0)) && tone !== "none") {
      emoji += skinTones.get(tone);
    }
    return emoji;
  };
});

// src/client/index.tsx
var exports_client = {};
__export(exports_client, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(exports_client);

// src/client/TotemMemoryCard.tsx
var import_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");

// src/client/controller.ts
var import_dsh_client_store = require("@deepseek-ai/dsh-client-store");
function routeKey(provider, model) {
  return `${provider}\x00${model}`;
}
function parseRouteKey(key) {
  if (key === "")
    return { provider: "", model: "" };
  const at = key.indexOf("\x00");
  return at < 0 ? { provider: key, model: "" } : { provider: key.slice(0, at), model: key.slice(at + 1) };
}
function storedRoute(value) {
  if (value === undefined)
    return "";
  const provider = typeof value.provider === "string" ? value.provider.trim() : "";
  const model = typeof value.model === "string" ? value.model.trim() : "";
  return provider.length > 0 && model.length > 0 ? routeKey(provider, model) : "";
}
var EMBEDDING_BACKENDS = ["auto", "hash", "model2vec"];
function storedBackend(value) {
  const backend = typeof value?.embeddingBackend === "string" ? value.embeddingBackend.trim() : "";
  return EMBEDDING_BACKENDS.includes(backend) ? backend : "auto";
}

class TotemMemoryCardController {
  scope;
  ctx;
  groups = [];
  failures = [];
  catalogStatus = "idle";
  draft;
  draftBackend;
  draftRevision;
  saving = false;
  failed = false;
  conflicted = false;
  disposed = false;
  saveGeneration = 0;
  catalogGeneration = 0;
  store;
  unsubscribe;
  constructor(scope, ctx) {
    this.scope = scope;
    this.ctx = ctx;
    this.store = import_dsh_client_store.createSnapshotStore(this.projection());
    this.unsubscribe = scope.subscribe(() => {
      const snapshot = this.scope.getSnapshot();
      const dirty = this.draft !== undefined || this.draftBackend !== undefined;
      if (!this.saving && dirty && snapshot.revision !== this.draftRevision) {
        const sameRoute = this.draft === undefined || storedRoute(snapshot.value) === this.draft;
        const sameBackend = this.draftBackend === undefined || storedBackend(snapshot.value) === this.draftBackend;
        if (sameRoute && sameBackend)
          this.clearDraft();
        else
          this.conflicted = true;
      }
      this.publish();
    });
    this.loadCatalog();
  }
  dispose() {
    this.disposed = true;
    this.saveGeneration += 1;
    this.catalogGeneration += 1;
    this.unsubscribe();
  }
  inject() {
    return {
      hooks: { totemMemoryCard: this.store },
      select: (key) => {
        this.select(key);
      },
      selectBackend: (value) => {
        this.selectBackend(value);
      },
      save: () => {
        this.save();
      },
      discard: () => {
        this.discard();
      },
      retryCatalog: () => {
        this.loadCatalog();
      }
    };
  }
  refreshCatalog() {
    if (this.disposed)
      return;
    this.catalogGeneration += 1;
    this.catalogStatus = "idle";
    this.loadCatalog();
  }
  current() {
    return storedRoute(this.scope.getSnapshot().value);
  }
  currentBackend() {
    return storedBackend(this.scope.getSnapshot().value);
  }
  requested() {
    return this.draft ?? this.current();
  }
  requestedBackend() {
    return this.draftBackend ?? this.currentBackend();
  }
  select(key) {
    const snapshot = this.scope.getSnapshot();
    if (this.disposed || snapshot.status !== "ready" || !snapshot.writable || this.saving)
      return;
    if (this.draft === undefined)
      this.draftRevision = snapshot.revision;
    this.draft = key;
    this.failed = false;
    this.conflicted = false;
    this.publish();
  }
  selectBackend(value) {
    const snapshot = this.scope.getSnapshot();
    if (this.disposed || snapshot.status !== "ready" || !snapshot.writable || this.saving)
      return;
    if (!EMBEDDING_BACKENDS.includes(value))
      return;
    if (this.draft === undefined && this.draftBackend === undefined) {
      this.draftRevision = snapshot.revision;
    }
    this.draftBackend = value;
    this.failed = false;
    this.conflicted = false;
    this.publish();
  }
  discard() {
    if (this.saving)
      return;
    this.clearDraft();
    this.publish();
  }
  clearDraft() {
    this.draft = undefined;
    this.draftBackend = undefined;
    this.draftRevision = undefined;
    this.failed = false;
    this.conflicted = false;
  }
  async save() {
    const snapshot = this.scope.getSnapshot();
    const desired = this.requested();
    const desiredBackend = this.requestedBackend();
    if (this.disposed || snapshot.status !== "ready" || !snapshot.writable || this.saving || desired === this.current() && desiredBackend === this.currentBackend())
      return;
    const staged = this.draft !== undefined || this.draftBackend !== undefined;
    if (staged && snapshot.revision !== this.draftRevision) {
      this.conflicted = true;
      this.publish();
      return;
    }
    const route = parseRouteKey(desired);
    const generation = this.saveGeneration;
    this.saving = true;
    this.failed = false;
    this.conflicted = false;
    this.publish();
    await this.scope.mutate([
      { op: "set", path: ["provider"], value: route.provider },
      { op: "set", path: ["model"], value: route.model },
      { op: "set", path: ["embeddingBackend"], value: desiredBackend }
    ], this.draftRevision);
    if (generation !== this.saveGeneration)
      return;
    const landed = this.current() === desired && this.currentBackend() === desiredBackend;
    this.saving = false;
    this.failed = !landed;
    if (landed)
      this.clearDraft();
    this.publish();
  }
  async loadCatalog() {
    if (this.disposed || this.catalogStatus === "loading")
      return;
    const generation = this.catalogGeneration;
    this.catalogStatus = "loading";
    this.publish();
    const response = await this.ctx.remote.session.modelCatalog();
    if (generation !== this.catalogGeneration)
      return;
    if (response.ok) {
      this.groups = response.value.groups;
      this.failures = response.value.failures;
      this.catalogStatus = "ready";
    } else {
      this.catalogStatus = "error";
    }
    this.publish();
  }
  projection() {
    const snapshot = this.scope.getSnapshot();
    const current = this.current();
    const requested = this.requested();
    const currentBackend = this.currentBackend();
    const requestedBackend = this.requestedBackend();
    return {
      available: snapshot.status === "ready",
      writable: snapshot.writable,
      dirty: current !== requested || currentBackend !== requestedBackend,
      invalid: requested !== "" && requested !== current && !this.known(requested),
      saving: this.saving,
      failed: this.failed,
      current,
      requested,
      currentBackend,
      requestedBackend,
      groups: this.groups,
      failures: this.failures,
      catalogStatus: this.catalogStatus,
      catalogPartial: this.failures.length > 0,
      conflicted: this.conflicted
    };
  }
  known(key) {
    const route = parseRouteKey(key);
    return this.groups.some((group) => group.id === route.provider && group.models.some((model) => model.id === route.model));
  }
  publish() {
    this.store.set(this.projection());
  }
}

// src/client/TotemMemoryCard.tsx
var jsx_runtime = require("react/jsx-runtime");
var LABELS = {
  unavailable: "This deployment does not serve the Totem settings row.",
  readOnly: "This deployment stores settings read-only.",
  saveFailed: "The deployment did not accept this model; the previous choice is still active.",
  save: "Save",
  saving: "Saving…"
};
var SELECT_STYLE = {
  width: "100%",
  maxWidth: 460,
  padding: "6px 8px",
  borderRadius: 6,
  border: "1px solid var(--dsw-alias-border, #3a3a3a)",
  background: "var(--dsw-alias-bg-secondary, transparent)",
  color: "inherit",
  fontSize: 13
};
var HELP_STYLE = {
  margin: 0,
  fontSize: 12,
  lineHeight: 1.5,
  color: "var(--dsw-alias-text-secondary, #9a9a9a)"
};
function TotemMemoryCard(props) {
  const state = props.useTotemMemoryCard((snapshot) => snapshot);
  if (props.view === "summary")
    return /* @__PURE__ */ jsx_runtime.jsx("span", {
      children: "Choose the model that writes Totem memories."
    });
  const requested = parseRouteKey(state.requested);
  const storedUnavailable = state.requested !== "" && !state.dirty && !state.groups.some((group) => group.id === requested.provider && group.models.some((model) => model.id === requested.model));
  return /* @__PURE__ */ jsx_runtime.jsx(import_dsh_client_ui_primitives.SettingsForm, {
    labels: LABELS,
    state,
    onSave: props.save,
    onDiscard: props.discard,
    children: /* @__PURE__ */ jsx_runtime.jsxs("div", {
      style: { display: "flex", flexDirection: "column", gap: 8 },
      children: [
        /* @__PURE__ */ jsx_runtime.jsx("label", {
          htmlFor: "dsh-totem-memory-model",
          style: { fontSize: 13, fontWeight: 600 },
          children: "Memory model"
        }),
        /* @__PURE__ */ jsx_runtime.jsxs("select", {
          id: "dsh-totem-memory-model",
          style: SELECT_STYLE,
          value: state.requested,
          disabled: !state.writable || state.saving || state.catalogStatus === "loading",
          onChange: (event) => {
            props.select(event.target.value);
          },
          children: [
            /* @__PURE__ */ jsx_runtime.jsx("option", {
              value: "",
              children: "Deployment default"
            }),
            state.groups.map((group) => /* @__PURE__ */ jsx_runtime.jsx("optgroup", {
              label: group.name.length > 0 ? group.name : group.id,
              children: group.models.map((model) => /* @__PURE__ */ jsx_runtime.jsx("option", {
                value: routeKey(group.id, model.id),
                children: model.name.length > 0 ? model.name : model.id
              }, routeKey(group.id, model.id)))
            }, group.id)),
            storedUnavailable ? /* @__PURE__ */ jsx_runtime.jsx("option", {
              value: state.requested,
              children: `${requested.provider} / ${requested.model} (unavailable)`
            }) : null
          ]
        }),
        /* @__PURE__ */ jsx_runtime.jsx("p", {
          style: HELP_STYLE,
          children: "The model that writes Totem memories after file reads and edits. Leave the deployment default to reuse your main agent model, or pick any model from any configured provider."
        }),
        /* @__PURE__ */ jsx_runtime.jsx("label", {
          htmlFor: "dsh-totem-embedding-backend",
          style: { fontSize: 13, fontWeight: 600 },
          children: "Retrieval encoder"
        }),
        /* @__PURE__ */ jsx_runtime.jsxs("select", {
          id: "dsh-totem-embedding-backend",
          style: SELECT_STYLE,
          value: state.requestedBackend,
          disabled: !state.writable || state.saving,
          onChange: (event) => {
            props.selectBackend(event.target.value);
          },
          children: [
            /* @__PURE__ */ jsx_runtime.jsx("option", {
              value: "auto",
              children: "Automatic (Model2Vec when installed)"
            }),
            /* @__PURE__ */ jsx_runtime.jsx("option", {
              value: "model2vec",
              children: "Model2Vec (potion-retrieval-32M)"
            }),
            /* @__PURE__ */ jsx_runtime.jsx("option", {
              value: "hash",
              children: "Offline hash (no extra dependency)"
            })
          ]
        }),
        /* @__PURE__ */ jsx_runtime.jsxs("p", {
          style: HELP_STYLE,
          children: [
            "The dense retrieval leg used by Totem. Model2Vec needs the optional",
            " ",
            /* @__PURE__ */ jsx_runtime.jsx("code", {
              children: "totem-mcp[embeddings]"
            }),
            " package and downloads",
            " ",
            /* @__PURE__ */ jsx_runtime.jsx("code", {
              children: "minishlab/potion-retrieval-32M"
            }),
            " on first use; the hash encoder is the dependency-free fallback. Applies the next time the Totem server starts."
          ]
        }),
        state.catalogStatus === "error" ? /* @__PURE__ */ jsx_runtime.jsxs("p", {
          style: HELP_STYLE,
          role: "status",
          children: [
            "The model catalog is unavailable.",
            " ",
            /* @__PURE__ */ jsx_runtime.jsx("button", {
              type: "button",
              onClick: props.retryCatalog,
              children: "Retry"
            })
          ]
        }) : null,
        state.catalogPartial ? /* @__PURE__ */ jsx_runtime.jsx("p", {
          style: HELP_STYLE,
          role: "status",
          children: "Some providers could not be listed; their saved routes remain selectable."
        }) : null,
        state.conflicted ? /* @__PURE__ */ jsx_runtime.jsx("p", {
          style: HELP_STYLE,
          role: "status",
          children: "Settings changed elsewhere; reopen this page before saving."
        }) : null
      ]
    })
  });
}

// src/client/AssistantSection.tsx
var import_react = require("react");
var import_dsh_client_ui_primitives2 = require("@deepseek-ai/dsh-client-ui-primitives");
var jsx_runtime2 = require("react/jsx-runtime");
var TABS = [
  { id: "memory", label: "Memory" },
  { id: "candidates", label: "Candidates" },
  { id: "conflicts", label: "Conflicts" },
  { id: "reminders", label: "Reminders" },
  { id: "watches", label: "Watches" },
  { id: "notifications", label: "Notifications" },
  { id: "verify", label: "Verify" },
  { id: "server", label: "Server" }
];
var FIELD = {
  width: "100%",
  maxWidth: 520,
  padding: "6px 8px",
  borderRadius: 6,
  border: "1px solid var(--dsw-alias-border, #3a3a3a)",
  background: "var(--dsw-alias-bg-secondary, transparent)",
  color: "inherit",
  fontSize: 13,
  boxSizing: "border-box"
};
var MUTED = {
  margin: 0,
  fontSize: 12,
  lineHeight: 1.5,
  color: "var(--dsw-alias-text-secondary, #9a9a9a)"
};
var CARD = {
  border: "1px solid var(--dsw-alias-border, #333)",
  borderRadius: 8,
  padding: "10px 12px",
  display: "flex",
  flexDirection: "column",
  gap: 4
};
var ROW_ACTIONS = { display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" };
function AssistantSection(props) {
  const state = props.useAssistant((snapshot) => snapshot);
  const [draft, setDraft] = import_react.useState({
    ntfyUrl: state.config.ntfyUrl ?? "https://ntfy.sh",
    ntfyTopic: state.config.ntfyTopic ?? "",
    ntfyToken: state.config.ntfyToken ?? "",
    telegramBotToken: state.config.telegramBotToken ?? "",
    telegramChatId: state.config.telegramChatId ?? ""
  });
  const [watch, setWatch] = import_react.useState({ kind: "page", url: "", condition: "", interval: "15" });
  const [verifyDraft, setVerifyDraft] = import_react.useState({ command: state.verifyCommand, disable: state.verifyDisable });
  const [confirmRestart, setConfirmRestart] = import_react.useState(false);
  import_react.useEffect(() => {
    setVerifyDraft({ command: state.verifyCommand, disable: state.verifyDisable });
  }, [state.verifyCommand, state.verifyDisable]);
  return /* @__PURE__ */ jsx_runtime2.jsxs("div", {
    style: { display: "flex", flexDirection: "column", gap: 16, padding: "4px 0" },
    children: [
      /* @__PURE__ */ jsx_runtime2.jsxs("div", {
        style: { display: "flex", gap: 6, flexWrap: "wrap" },
        children: [
          TABS.map((tab) => /* @__PURE__ */ jsx_runtime2.jsx(import_dsh_client_ui_primitives2.Button, {
            variant: state.tab === tab.id ? "primary" : "ghost",
            onClick: () => {
              props.setTab(tab.id);
            },
            children: tab.label
          }, tab.id)),
          /* @__PURE__ */ jsx_runtime2.jsx(import_dsh_client_ui_primitives2.Button, {
            variant: "ghost",
            onClick: props.refresh,
            disabled: state.status === "loading",
            children: "Refresh"
          })
        ]
      }),
      state.error === null ? null : /* @__PURE__ */ jsx_runtime2.jsx("p", {
        style: { ...MUTED, color: "var(--dsw-alias-text-error, #e5484d)" },
        role: "status",
        children: state.error
      }),
      state.notice === null ? null : /* @__PURE__ */ jsx_runtime2.jsx("p", {
        style: MUTED,
        role: "status",
        children: state.notice
      }),
      state.tab === "memory" ? /* @__PURE__ */ jsx_runtime2.jsxs("div", {
        style: { display: "flex", flexDirection: "column", gap: 12 },
        children: [
          /* @__PURE__ */ jsx_runtime2.jsxs("div", {
            style: { display: "flex", gap: 8, flexWrap: "wrap" },
            children: [
              /* @__PURE__ */ jsx_runtime2.jsx("input", {
                style: { ...FIELD, flex: "1 1 320px" },
                value: state.project,
                placeholder: "Project path (absolute)",
                onChange: (event) => {
                  props.setProject(event.target.value);
                }
              }),
              /* @__PURE__ */ jsx_runtime2.jsx("input", {
                style: { ...FIELD, flex: "1 1 220px" },
                value: state.query,
                placeholder: "Search memory…",
                onChange: (event) => {
                  props.setQuery(event.target.value);
                },
                onKeyDown: (event) => {
                  if (event.key === "Enter")
                    props.search();
                }
              }),
              /* @__PURE__ */ jsx_runtime2.jsx(import_dsh_client_ui_primitives2.Button, {
                variant: "outline",
                onClick: props.search,
                disabled: state.status === "loading",
                children: "Search"
              })
            ]
          }),
          /* @__PURE__ */ jsx_runtime2.jsx("p", {
            style: MUTED,
            children: "Searches the selected project's Totem store. Leave the query empty to list recent memories."
          }),
          state.memories.length === 0 ? /* @__PURE__ */ jsx_runtime2.jsx("p", {
            style: MUTED,
            children: state.status === "loading" ? "Loading…" : "No memories."
          }) : state.memories.map((item, index) => /* @__PURE__ */ jsx_runtime2.jsxs("div", {
            style: CARD,
            children: [
              /* @__PURE__ */ jsx_runtime2.jsxs("div", {
                style: { fontSize: 13, fontWeight: 600 },
                children: [
                  item.type === undefined ? "" : `[${item.type}] `,
                  item.title ?? item.id ?? ""
                ]
              }),
              /* @__PURE__ */ jsx_runtime2.jsx("div", {
                style: { fontSize: 13 },
                children: item.statement ?? ""
              }),
              item.tags === undefined || item.tags.length === 0 ? null : /* @__PURE__ */ jsx_runtime2.jsx("p", {
                style: MUTED,
                children: item.tags.join(" · ")
              })
            ]
          }, item.id ?? `${index}`))
        ]
      }) : null,
      state.tab === "candidates" ? /* @__PURE__ */ jsx_runtime2.jsxs("div", {
        style: { display: "flex", flexDirection: "column", gap: 12 },
        children: [
          /* @__PURE__ */ jsx_runtime2.jsx("p", {
            style: MUTED,
            children: "Memories distilled from completed turns, waiting for approval. Approved items are written to the project's Totem store."
          }),
          state.candidates.length === 0 ? /* @__PURE__ */ jsx_runtime2.jsx("p", {
            style: MUTED,
            children: state.status === "loading" ? "Loading…" : "No pending candidates."
          }) : state.candidates.map((candidate) => /* @__PURE__ */ jsx_runtime2.jsxs("div", {
            style: CARD,
            children: [
              /* @__PURE__ */ jsx_runtime2.jsxs("div", {
                style: { fontSize: 13, fontWeight: 600 },
                children: [
                  "[",
                  candidate.type,
                  "] ",
                  candidate.title
                ]
              }),
              /* @__PURE__ */ jsx_runtime2.jsx("div", {
                style: { fontSize: 13 },
                children: candidate.statement
              }),
              /* @__PURE__ */ jsx_runtime2.jsxs("p", {
                style: MUTED,
                children: [
                  candidate.project,
                  " · ",
                  candidate.tags.join(" · ")
                ]
              }),
              /* @__PURE__ */ jsx_runtime2.jsxs("div", {
                style: ROW_ACTIONS,
                children: [
                  /* @__PURE__ */ jsx_runtime2.jsx(import_dsh_client_ui_primitives2.Button, {
                    variant: "primary",
                    onClick: () => {
                      props.approve(candidate.id);
                    },
                    disabled: state.writing,
                    children: "Approve"
                  }),
                  /* @__PURE__ */ jsx_runtime2.jsx(import_dsh_client_ui_primitives2.Button, {
                    variant: "ghost",
                    onClick: () => {
                      props.reject(candidate.id);
                    },
                    disabled: state.writing,
                    children: "Reject"
                  })
                ]
              })
            ]
          }, candidate.id))
        ]
      }) : null,
      state.tab === "conflicts" ? /* @__PURE__ */ jsx_runtime2.jsxs("div", {
        style: { display: "flex", flexDirection: "column", gap: 12 },
        children: [
          /* @__PURE__ */ jsx_runtime2.jsx("p", {
            style: MUTED,
            children: "Contradictions detected when a memory was written. Resolving one records a contradiction between the pair and, when you keep a side, supersedes the other memory."
          }),
          state.conflictSummary === null ? null : /* @__PURE__ */ jsx_runtime2.jsxs("p", {
            style: MUTED,
            children: [
              state.conflictSummary.total,
              " memories · ",
              state.conflictSummary.durable,
              " durable ·",
              " ",
              state.conflictSummary.staleItems,
              " with stale evidence (",
              Math.round(state.conflictSummary.staleRatio * 100),
              "%)"
            ]
          }),
          state.conflicts.length === 0 ? /* @__PURE__ */ jsx_runtime2.jsx("p", {
            style: MUTED,
            children: state.status === "loading" ? "Loading…" : "No open conflicts."
          }) : state.conflicts.map((conflict) => /* @__PURE__ */ jsx_runtime2.jsxs("div", {
            style: CARD,
            children: [
              /* @__PURE__ */ jsx_runtime2.jsx("div", {
                style: { fontSize: 13, fontWeight: 600 },
                children: conflict.condition || "Conflicting claims"
              }),
              /* @__PURE__ */ jsx_runtime2.jsxs("div", {
                style: { fontSize: 13 },
                children: [
                  "A: ",
                  conflict.claimA || conflict.itemA
                ]
              }),
              /* @__PURE__ */ jsx_runtime2.jsxs("div", {
                style: { fontSize: 13 },
                children: [
                  "B: ",
                  conflict.claimB || conflict.itemB
                ]
              }),
              /* @__PURE__ */ jsx_runtime2.jsxs("p", {
                style: MUTED,
                children: [
                  conflict.itemA.slice(0, 8),
                  " · ",
                  conflict.itemB.slice(0, 8),
                  " · ",
                  new Date(conflict.createdAt).toLocaleString()
                ]
              }),
              /* @__PURE__ */ jsx_runtime2.jsxs("div", {
                style: ROW_ACTIONS,
                children: [
                  /* @__PURE__ */ jsx_runtime2.jsx(import_dsh_client_ui_primitives2.Button, {
                    variant: "primary",
                    onClick: () => {
                      props.resolveConflict(conflict.id, "keep-a");
                    },
                    disabled: state.writing,
                    children: "Keep A"
                  }),
                  /* @__PURE__ */ jsx_runtime2.jsx(import_dsh_client_ui_primitives2.Button, {
                    variant: "primary",
                    onClick: () => {
                      props.resolveConflict(conflict.id, "keep-b");
                    },
                    disabled: state.writing,
                    children: "Keep B"
                  }),
                  /* @__PURE__ */ jsx_runtime2.jsx(import_dsh_client_ui_primitives2.Button, {
                    variant: "ghost",
                    onClick: () => {
                      props.resolveConflict(conflict.id, "both");
                    },
                    disabled: state.writing,
                    children: "Keep both"
                  })
                ]
              })
            ]
          }, conflict.id))
        ]
      }) : null,
      state.tab === "reminders" ? /* @__PURE__ */ jsx_runtime2.jsx("div", {
        style: { display: "flex", flexDirection: "column", gap: 12 },
        children: state.reminders.length === 0 ? /* @__PURE__ */ jsx_runtime2.jsx("p", {
          style: MUTED,
          children: state.status === "loading" ? "Loading…" : "No pending reminders. Ask the agent to remind you."
        }) : state.reminders.map((reminder) => /* @__PURE__ */ jsx_runtime2.jsxs("div", {
          style: CARD,
          children: [
            /* @__PURE__ */ jsx_runtime2.jsx("div", {
              style: { fontSize: 13, fontWeight: 600 },
              children: reminder.text
            }),
            /* @__PURE__ */ jsx_runtime2.jsxs("p", {
              style: MUTED,
              children: [
                reminder.kind,
                reminder.next === undefined ? " · no further notifications" : ` · next ${new Date(reminder.next.at).toLocaleString()} (${reminder.next.label})`,
                reminder.snoozedUntil === undefined ? "" : ` · snoozed until ${new Date(reminder.snoozedUntil).toLocaleString()}`
              ]
            }),
            /* @__PURE__ */ jsx_runtime2.jsxs("div", {
              style: ROW_ACTIONS,
              children: [
                /* @__PURE__ */ jsx_runtime2.jsx(import_dsh_client_ui_primitives2.Button, {
                  variant: "outline",
                  onClick: () => {
                    props.snooze(reminder.id, 10);
                  },
                  disabled: state.writing,
                  children: "Snooze 10m"
                }),
                /* @__PURE__ */ jsx_runtime2.jsx(import_dsh_client_ui_primitives2.Button, {
                  variant: "outline",
                  onClick: () => {
                    props.ackReminder(reminder.id);
                  },
                  disabled: state.writing,
                  children: "Ack"
                }),
                /* @__PURE__ */ jsx_runtime2.jsx(import_dsh_client_ui_primitives2.Button, {
                  variant: "ghost",
                  onClick: () => {
                    props.doneReminder(reminder.id);
                  },
                  disabled: state.writing,
                  children: "Done"
                }),
                /* @__PURE__ */ jsx_runtime2.jsx(import_dsh_client_ui_primitives2.Button, {
                  variant: "ghost",
                  onClick: () => {
                    props.cancelReminder(reminder.id);
                  },
                  disabled: state.writing,
                  children: "Cancel"
                })
              ]
            })
          ]
        }, reminder.id))
      }) : null,
      state.tab === "watches" ? /* @__PURE__ */ jsx_runtime2.jsxs("div", {
        style: { display: "flex", flexDirection: "column", gap: 12 },
        children: [
          /* @__PURE__ */ jsx_runtime2.jsxs("div", {
            style: { ...CARD, gap: 8 },
            children: [
              /* @__PURE__ */ jsx_runtime2.jsx("div", {
                style: { fontSize: 13, fontWeight: 600 },
                children: "Add a watch"
              }),
              /* @__PURE__ */ jsx_runtime2.jsxs("div", {
                style: { display: "flex", gap: 8, flexWrap: "wrap" },
                children: [
                  /* @__PURE__ */ jsx_runtime2.jsxs("select", {
                    style: { ...FIELD, width: 160 },
                    value: watch.kind,
                    onChange: (event) => {
                      setWatch({ ...watch, kind: event.target.value });
                    },
                    children: [
                      /* @__PURE__ */ jsx_runtime2.jsx("option", {
                        value: "page",
                        children: "Page changes"
                      }),
                      /* @__PURE__ */ jsx_runtime2.jsx("option", {
                        value: "rss",
                        children: "Feed items"
                      }),
                      /* @__PURE__ */ jsx_runtime2.jsx("option", {
                        value: "condition",
                        children: "Condition"
                      })
                    ]
                  }),
                  /* @__PURE__ */ jsx_runtime2.jsx("input", {
                    style: { ...FIELD, flex: "1 1 280px" },
                    placeholder: "https://…",
                    value: watch.url,
                    onChange: (event) => {
                      setWatch({ ...watch, url: event.target.value });
                    }
                  }),
                  /* @__PURE__ */ jsx_runtime2.jsx("input", {
                    style: { ...FIELD, width: 110 },
                    placeholder: "minutes",
                    value: watch.interval,
                    onChange: (event) => {
                      setWatch({ ...watch, interval: event.target.value });
                    }
                  })
                ]
              }),
              watch.kind === "condition" ? /* @__PURE__ */ jsx_runtime2.jsx("input", {
                style: FIELD,
                placeholder: "Condition (answered YES/NO)",
                value: watch.condition,
                onChange: (event) => {
                  setWatch({ ...watch, condition: event.target.value });
                }
              }) : null,
              /* @__PURE__ */ jsx_runtime2.jsx("div", {
                children: /* @__PURE__ */ jsx_runtime2.jsx(import_dsh_client_ui_primitives2.Button, {
                  variant: "primary",
                  disabled: state.writing || watch.url.trim().length === 0,
                  onClick: () => {
                    props.addWatch(watch);
                    setWatch({ kind: "page", url: "", condition: "", interval: "15" });
                  },
                  children: "Add watch"
                })
              })
            ]
          }),
          state.watches.length === 0 ? /* @__PURE__ */ jsx_runtime2.jsx("p", {
            style: MUTED,
            children: state.status === "loading" ? "Loading…" : "No watches."
          }) : state.watches.map((item) => /* @__PURE__ */ jsx_runtime2.jsxs("div", {
            style: CARD,
            children: [
              /* @__PURE__ */ jsx_runtime2.jsxs("div", {
                style: { fontSize: 13, fontWeight: 600 },
                children: [
                  item.kind,
                  " · ",
                  item.url
                ]
              }),
              /* @__PURE__ */ jsx_runtime2.jsxs("p", {
                style: MUTED,
                children: [
                  "every ",
                  item.intervalMinutes,
                  "m · ",
                  item.active ? "active" : "stopped",
                  item.lastResult === undefined ? "" : ` · ${item.lastResult}`,
                  item.condition === undefined ? "" : ` · ${item.condition}`
                ]
              }),
              /* @__PURE__ */ jsx_runtime2.jsxs("div", {
                style: ROW_ACTIONS,
                children: [
                  /* @__PURE__ */ jsx_runtime2.jsx(import_dsh_client_ui_primitives2.Button, {
                    variant: "outline",
                    onClick: () => {
                      props.runWatch(item.id);
                    },
                    disabled: state.writing,
                    children: "Run now"
                  }),
                  item.active ? /* @__PURE__ */ jsx_runtime2.jsx(import_dsh_client_ui_primitives2.Button, {
                    variant: "ghost",
                    onClick: () => {
                      props.cancelWatch(item.id);
                    },
                    disabled: state.writing,
                    children: "Stop"
                  }) : null
                ]
              })
            ]
          }, item.id))
        ]
      }) : null,
      state.tab === "notifications" ? /* @__PURE__ */ jsx_runtime2.jsxs("div", {
        style: { display: "flex", flexDirection: "column", gap: 12 },
        children: [
          /* @__PURE__ */ jsx_runtime2.jsx("p", {
            style: MUTED,
            children: "Reminders and watches deliver through ntfy and/or Telegram. Leave a channel empty to disable it."
          }),
          /* @__PURE__ */ jsx_runtime2.jsxs("label", {
            style: { display: "flex", flexDirection: "column", gap: 4 },
            children: [
              /* @__PURE__ */ jsx_runtime2.jsx("span", {
                style: { fontSize: 12, fontWeight: 600 },
                children: "ntfy URL"
              }),
              /* @__PURE__ */ jsx_runtime2.jsx("input", {
                style: FIELD,
                value: draft.ntfyUrl,
                onChange: (event) => {
                  setDraft({ ...draft, ntfyUrl: event.target.value });
                }
              })
            ]
          }),
          /* @__PURE__ */ jsx_runtime2.jsxs("label", {
            style: { display: "flex", flexDirection: "column", gap: 4 },
            children: [
              /* @__PURE__ */ jsx_runtime2.jsx("span", {
                style: { fontSize: 12, fontWeight: 600 },
                children: "ntfy topic"
              }),
              /* @__PURE__ */ jsx_runtime2.jsx("input", {
                style: FIELD,
                value: draft.ntfyTopic,
                onChange: (event) => {
                  setDraft({ ...draft, ntfyTopic: event.target.value });
                }
              })
            ]
          }),
          /* @__PURE__ */ jsx_runtime2.jsxs("label", {
            style: { display: "flex", flexDirection: "column", gap: 4 },
            children: [
              /* @__PURE__ */ jsx_runtime2.jsx("span", {
                style: { fontSize: 12, fontWeight: 600 },
                children: "ntfy token (optional)"
              }),
              /* @__PURE__ */ jsx_runtime2.jsx("input", {
                style: FIELD,
                type: "password",
                value: draft.ntfyToken,
                onChange: (event) => {
                  setDraft({ ...draft, ntfyToken: event.target.value });
                }
              })
            ]
          }),
          /* @__PURE__ */ jsx_runtime2.jsxs("label", {
            style: { display: "flex", flexDirection: "column", gap: 4 },
            children: [
              /* @__PURE__ */ jsx_runtime2.jsx("span", {
                style: { fontSize: 12, fontWeight: 600 },
                children: "Telegram bot token"
              }),
              /* @__PURE__ */ jsx_runtime2.jsx("input", {
                style: FIELD,
                type: "password",
                value: draft.telegramBotToken,
                onChange: (event) => {
                  setDraft({ ...draft, telegramBotToken: event.target.value });
                }
              })
            ]
          }),
          /* @__PURE__ */ jsx_runtime2.jsxs("label", {
            style: { display: "flex", flexDirection: "column", gap: 4 },
            children: [
              /* @__PURE__ */ jsx_runtime2.jsx("span", {
                style: { fontSize: 12, fontWeight: 600 },
                children: "Telegram chat id"
              }),
              /* @__PURE__ */ jsx_runtime2.jsx("input", {
                style: FIELD,
                value: draft.telegramChatId,
                onChange: (event) => {
                  setDraft({ ...draft, telegramChatId: event.target.value });
                }
              })
            ]
          }),
          /* @__PURE__ */ jsx_runtime2.jsxs("div", {
            style: ROW_ACTIONS,
            children: [
              /* @__PURE__ */ jsx_runtime2.jsx(import_dsh_client_ui_primitives2.Button, {
                variant: "primary",
                onClick: () => {
                  props.saveConfig(draft);
                },
                disabled: state.writing,
                children: "Save"
              }),
              /* @__PURE__ */ jsx_runtime2.jsx(import_dsh_client_ui_primitives2.Button, {
                variant: "outline",
                onClick: props.testNotification,
                disabled: state.writing,
                children: "Send test"
              })
            ]
          })
        ]
      }) : null,
      state.tab === "verify" ? /* @__PURE__ */ jsx_runtime2.jsxs("div", {
        style: { display: "flex", flexDirection: "column", gap: 12 },
        children: [
          /* @__PURE__ */ jsx_runtime2.jsx("p", {
            style: MUTED,
            children: "Deterministic rules run at the end of every turn and warn only: a finding is reported in the turn card, never enforced. No model is involved."
          }),
          /* @__PURE__ */ jsx_runtime2.jsxs("label", {
            style: { display: "flex", flexDirection: "column", gap: 4 },
            children: [
              /* @__PURE__ */ jsx_runtime2.jsx("span", {
                style: { fontSize: 12, fontWeight: 600 },
                children: "Verify command (optional, run once per turn)"
              }),
              /* @__PURE__ */ jsx_runtime2.jsx("input", {
                style: FIELD,
                value: verifyDraft.command,
                placeholder: "e.g. bun test",
                onChange: (event) => {
                  setVerifyDraft({ ...verifyDraft, command: event.target.value });
                }
              })
            ]
          }),
          /* @__PURE__ */ jsx_runtime2.jsxs("label", {
            style: { display: "flex", flexDirection: "column", gap: 4 },
            children: [
              /* @__PURE__ */ jsx_runtime2.jsx("span", {
                style: { fontSize: 12, fontWeight: 600 },
                children: "Disabled rules (comma separated ids)"
              }),
              /* @__PURE__ */ jsx_runtime2.jsx("input", {
                style: FIELD,
                value: verifyDraft.disable,
                placeholder: "e.g. debug-breakpoint",
                onChange: (event) => {
                  setVerifyDraft({ ...verifyDraft, disable: event.target.value });
                }
              })
            ]
          }),
          /* @__PURE__ */ jsx_runtime2.jsx("div", {
            style: ROW_ACTIONS,
            children: /* @__PURE__ */ jsx_runtime2.jsx(import_dsh_client_ui_primitives2.Button, {
              variant: "primary",
              onClick: () => {
                props.saveVerify(verifyDraft.command, verifyDraft.disable);
              },
              disabled: state.writing,
              children: "Save"
            })
          }),
          /* @__PURE__ */ jsx_runtime2.jsxs("p", {
            style: MUTED,
            children: [
              state.verifyRules.length,
              " rule(s) active."
            ]
          }),
          state.verifyRules.map((rule) => /* @__PURE__ */ jsx_runtime2.jsxs("div", {
            style: CARD,
            children: [
              /* @__PURE__ */ jsx_runtime2.jsxs("div", {
                style: { fontSize: 13, fontWeight: 600 },
                children: [
                  /* @__PURE__ */ jsx_runtime2.jsx("code", {
                    style: { fontSize: 12 },
                    children: rule.id
                  }),
                  " · ",
                  /* @__PURE__ */ jsx_runtime2.jsx("span", {
                    style: { fontSize: 11, color: rule.severity === "high" ? "var(--dsw-alias-state-error-primary, #e5484d)" : "var(--dsw-alias-text-secondary, #9a9a9a)" },
                    children: rule.severity
                  })
                ]
              }),
              /* @__PURE__ */ jsx_runtime2.jsx("div", {
                style: { fontSize: 13 },
                children: rule.description
              })
            ]
          }, rule.id))
        ]
      }) : null,
      state.tab === "server" ? /* @__PURE__ */ jsx_runtime2.jsxs("div", {
        style: { display: "flex", flexDirection: "column", gap: 12 },
        children: [
          /* @__PURE__ */ jsx_runtime2.jsx("p", {
            style: MUTED,
            children: "Restarts the DSH host that serves this page. The session survives and this page reloads as soon as the replacement answers. A restart pressed during a turn waits for that turn to finish, so nothing is cut in half."
          }),
          /* @__PURE__ */ jsx_runtime2.jsxs("div", {
            style: CARD,
            children: [
              /* @__PURE__ */ jsx_runtime2.jsx("span", {
                style: { fontSize: 12, fontWeight: 600 },
                children: "Host"
              }),
              /* @__PURE__ */ jsx_runtime2.jsxs("span", {
                style: MUTED,
                children: [
                  "pid ",
                  state.host?.pid ?? "—",
                  " · ",
                  state.host?.busy === true ? "a turn is running" : "idle"
                ]
              }),
              /* @__PURE__ */ jsx_runtime2.jsxs("span", {
                style: MUTED,
                children: [
                  "launcher: ",
                  state.host?.launcher ?? "not found (set restartCommand)"
                ]
              })
            ]
          }),
          /* @__PURE__ */ jsx_runtime2.jsxs("div", {
            style: CARD,
            children: [
              /* @__PURE__ */ jsx_runtime2.jsx("span", {
                style: { fontSize: 12, fontWeight: 600 },
                children: "Permanent login"
              }),
              /* @__PURE__ */ jsx_runtime2.jsx("span", {
                style: MUTED,
                children: "Open this link once on a new device. It is derived from the persistent session secret, so it survives restarts and never needs a copied token. Reset the browser-session credential to rotate it."
              }),
              state.host?.loginUrl ? /* @__PURE__ */ jsx_runtime2.jsxs(jsx_runtime2.Fragment, {
                children: [
                  /* @__PURE__ */ jsx_runtime2.jsx("code", {
                    style: { fontSize: 11, wordBreak: "break-all" },
                    children: state.host.loginUrl
                  }),
                  /* @__PURE__ */ jsx_runtime2.jsx("div", {
                    style: ROW_ACTIONS,
                    children: /* @__PURE__ */ jsx_runtime2.jsx(import_dsh_client_ui_primitives2.Button, {
                      variant: "ghost",
                      onClick: () => {
                        navigator.clipboard?.writeText(state.host?.loginUrl ?? "");
                      },
                      children: "Copy link"
                    })
                  }),
                  state.host.loginQr ? /* @__PURE__ */ jsx_runtime2.jsx("img", {
                    src: state.host.loginQr,
                    alt: "Permanent login QR code",
                    width: 180,
                    height: 180,
                    style: { background: "#fff", borderRadius: 8 }
                  }) : null
                ]
              }) : /* @__PURE__ */ jsx_runtime2.jsx("span", {
                style: MUTED,
                children: "Unavailable: the host could not read the browser-session secret."
              })
            ]
          }),
          /* @__PURE__ */ jsx_runtime2.jsxs("div", {
            style: { ...ROW_ACTIONS, alignItems: "stretch" },
            children: [
              /* @__PURE__ */ jsx_runtime2.jsx(import_dsh_client_ui_primitives2.Button, {
                variant: "primary",
                style: { minHeight: 44, flex: "1 1 220px" },
                disabled: state.restarting || state.host?.launcher === null,
                onClick: () => {
                  if (confirmRestart) {
                    setConfirmRestart(false);
                    props.restartServer();
                    return;
                  }
                  setConfirmRestart(true);
                },
                children: state.restarting ? state.restartMessage ?? "Restarting…" : confirmRestart ? "Tap again to restart" : "Restart DSH server"
              }),
              confirmRestart && !state.restarting ? /* @__PURE__ */ jsx_runtime2.jsx(import_dsh_client_ui_primitives2.Button, {
                variant: "ghost",
                style: { minHeight: 44 },
                onClick: () => {
                  setConfirmRestart(false);
                },
                children: "Cancel"
              }) : null
            ]
          }),
          confirmRestart && !state.restarting ? /* @__PURE__ */ jsx_runtime2.jsx("p", {
            style: MUTED,
            children: "The page disconnects for a few seconds and reloads itself."
          }) : null,
          state.restartMessage !== null && !state.restarting ? /* @__PURE__ */ jsx_runtime2.jsx("p", {
            style: MUTED,
            children: state.restartMessage
          }) : null
        ]
      }) : null
    ]
  });
}

// src/client/assistant-controller.ts
var import_dsh_client_store2 = require("@deepseek-ai/dsh-client-store");
class AssistantController {
  form;
  ctx;
  store;
  unsubscribe;
  tab = "memory";
  project = "";
  query = "";
  memories = [];
  candidates = [];
  conflicts = [];
  conflictSummary = null;
  reminders = [];
  watches = [];
  verifyRules = [];
  verifyCommand = "";
  verifyDisable = "";
  host = null;
  restarting = false;
  restartMessage = null;
  status = "idle";
  error = null;
  notice = null;
  writing = false;
  disposed = false;
  constructor(form, ctx) {
    this.form = form;
    this.ctx = ctx;
    this.store = import_dsh_client_store2.createSnapshotStore(this.projection());
    this.unsubscribe = form.subscribe(() => {
      this.publish();
    });
    this.loadState();
  }
  dispose() {
    this.disposed = true;
    this.unsubscribe();
  }
  inject() {
    return {
      hooks: { assistant: this.store },
      setTab: (tab) => {
        this.setTab(tab);
      },
      setProject: (project) => {
        this.project = project;
        this.publish();
      },
      setQuery: (query) => {
        this.query = query;
        this.publish();
      },
      search: () => {
        this.search();
      },
      refresh: () => {
        this.refresh();
      },
      approve: (id) => {
        this.action(`/candidates/${encodeURIComponent(id)}/approve`, "Memory approved.");
      },
      reject: (id) => {
        this.action(`/candidates/${encodeURIComponent(id)}/reject`, "Candidate rejected.");
      },
      resolveConflict: (id, resolution) => {
        this.action(`/conflicts/${encodeURIComponent(id)}/resolve`, "Conflict resolved.", { resolution });
      },
      snooze: (id, minutes) => {
        this.action(`/reminders/${encodeURIComponent(id)}/snooze`, "Reminder snoozed.", { minutes });
      },
      doneReminder: (id) => {
        this.action(`/reminders/${encodeURIComponent(id)}/done`, "Reminder done.");
      },
      ackReminder: (id) => {
        this.action(`/reminders/${encodeURIComponent(id)}/ack`, "Notification acknowledged.");
      },
      cancelReminder: (id) => {
        this.action(`/reminders/${encodeURIComponent(id)}/cancel`, "Reminder canceled.");
      },
      runWatch: (id) => {
        this.action(`/watches/${encodeURIComponent(id)}/run`, "Watch checked.");
      },
      cancelWatch: (id) => {
        this.action(`/watches/${encodeURIComponent(id)}/cancel`, "Watch stopped.");
      },
      addWatch: (draft) => {
        this.addWatch(draft);
      },
      saveConfig: (values) => {
        this.saveConfig(values);
      },
      saveVerify: (command, disable) => {
        this.saveVerify(command, disable);
      },
      testNotification: () => {
        this.testNotification();
      },
      restartServer: () => {
        this.restartServer();
      }
    };
  }
  config() {
    return this.form.getSnapshot().value ?? {};
  }
  token() {
    return this.config().apiToken?.trim() ?? "";
  }
  projection() {
    return {
      tab: this.tab,
      project: this.project,
      query: this.query,
      memories: this.memories,
      candidates: this.candidates,
      conflicts: this.conflicts,
      conflictSummary: this.conflictSummary,
      reminders: this.reminders,
      watches: this.watches,
      status: this.status,
      error: this.error,
      notice: this.notice,
      config: this.config(),
      writing: this.writing,
      verifyRules: this.verifyRules,
      verifyCommand: this.verifyCommand,
      verifyDisable: this.verifyDisable,
      host: this.host,
      restarting: this.restarting,
      restartMessage: this.restartMessage
    };
  }
  publish() {
    if (this.disposed)
      return;
    this.store.set(this.projection());
  }
  async loadState() {
    try {
      const state = await this.request("/state");
      if (this.project.length === 0)
        this.project = state.lastProject ?? "";
      await this.refresh();
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error);
      this.status = "error";
      this.publish();
    }
  }
  setTab(tab) {
    this.tab = tab;
    this.notice = null;
    this.error = null;
    this.refresh();
  }
  async request(path, init) {
    const token = this.token();
    if (token.length === 0)
      throw new Error("Set the assistant apiToken in the Totem plugin config first.");
    const response = await fetch(`/totem${path}`, {
      ...init,
      headers: {
        ...init?.headers,
        authorization: `Bearer ${token}`,
        ...init?.body === undefined ? {} : { "content-type": "application/json" }
      }
    });
    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      throw new Error(detail.error ?? `request failed (${response.status})`);
    }
    return await response.json();
  }
  async refresh() {
    this.status = "loading";
    this.error = null;
    this.publish();
    try {
      if (this.tab === "memory")
        await this.search(false);
      else if (this.tab === "candidates") {
        const data = await this.request("/candidates");
        this.candidates = data.items.filter((item) => item.status === "pending");
      } else if (this.tab === "conflicts") {
        const params = new URLSearchParams;
        if (this.project.length > 0)
          params.set("project", this.project);
        const data = await this.request(`/conflicts?${params.toString()}`);
        this.conflicts = data.items;
        this.conflictSummary = data.summary ?? null;
      } else if (this.tab === "reminders") {
        const data = await this.request("/reminders");
        this.reminders = data.items.filter((item) => !item.done);
      } else if (this.tab === "watches") {
        const data = await this.request("/watches");
        this.watches = data.items;
      } else if (this.tab === "verify") {
        const data = await this.request("/verify/rules");
        this.verifyRules = data.rules;
        this.verifyCommand = data.settings.command;
        this.verifyDisable = data.settings.disable.join(", ");
      } else if (this.tab === "server") {
        this.host = await this.request("/host");
      }
      this.status = "ready";
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error);
      this.status = "error";
    }
    this.publish();
  }
  async restartServer() {
    if (this.restarting)
      return;
    this.restarting = true;
    this.error = null;
    this.restartMessage = "Scheduling the restart…";
    this.publish();
    try {
      const before = this.host ?? await this.request("/host");
      this.host = before;
      const { plan } = await this.request("/restart", {
        method: "POST",
        body: JSON.stringify({ idle: true })
      });
      this.restartMessage = plan.mode === "idle" ? "Waiting for the running turn to finish…" : "Restarting the host…";
      this.publish();
      await this.waitForNewHost(before.pid);
      this.restartMessage = "Host is back — reloading…";
      this.publish();
      const location = globalThis.location;
      location?.reload();
    } catch (error) {
      this.restarting = false;
      this.restartMessage = null;
      this.error = error instanceof Error ? error.message : String(error);
      this.publish();
    }
  }
  async waitForNewHost(pid) {
    const deadline = Date.now() + 120000;
    let sawDown = false;
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      try {
        const host = await this.request("/host");
        if (host.pid !== pid)
          return;
      } catch {
        sawDown = true;
      }
    }
    throw new Error(sawDown ? "the host went down but did not come back within two minutes" : "the host did not restart within two minutes");
  }
  async search(publishLoading = true) {
    if (publishLoading) {
      this.status = "loading";
      this.publish();
    }
    const params = new URLSearchParams({ project: this.project, limit: "100" });
    if (this.query.trim().length > 0)
      params.set("query", this.query.trim());
    const data = await this.request(`/memories?${params.toString()}`);
    this.memories = data.items;
    this.status = "ready";
    this.publish();
  }
  async action(path, notice, bodyValue) {
    this.writing = true;
    this.error = null;
    this.publish();
    try {
      await this.request(path, {
        method: "POST",
        ...bodyValue === undefined ? {} : { body: JSON.stringify(bodyValue) }
      });
      this.notice = notice;
      await this.refresh();
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error);
      this.status = "error";
      this.publish();
    } finally {
      this.writing = false;
      this.publish();
    }
  }
  async addWatch(draft) {
    const interval = Number(draft.interval);
    this.writing = true;
    this.error = null;
    this.publish();
    try {
      await this.request("/watches", {
        method: "POST",
        body: JSON.stringify({
          kind: draft.kind,
          url: draft.url,
          condition: draft.condition,
          intervalMinutes: Number.isFinite(interval) && interval > 0 ? interval : 15
        })
      });
      this.notice = "Watch added.";
      await this.refresh();
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error);
      this.status = "error";
    } finally {
      this.writing = false;
      this.publish();
    }
  }
  async saveConfig(values) {
    const snapshot = this.form.getSnapshot();
    const fields = [
      "ntfyUrl",
      "ntfyTopic",
      "ntfyToken",
      "telegramBotToken",
      "telegramChatId"
    ];
    this.writing = true;
    this.publish();
    const ok = await this.form.mutate(fields.map((field) => ({
      op: "set",
      path: [field],
      value: values[field] ?? ""
    })), snapshot.revision);
    this.writing = false;
    this.notice = ok ? "Notification settings saved." : null;
    this.error = ok ? null : "The Host did not accept the notification settings.";
    this.publish();
  }
  async saveVerify(command, disable) {
    const snapshot = this.form.getSnapshot();
    const ids = disable.split(",").map((part) => part.trim()).filter(Boolean);
    this.writing = true;
    this.publish();
    const ok = await this.form.mutate([
      { op: "set", path: ["verifyCommand"], value: command },
      { op: "set", path: ["verifyDisable"], value: ids }
    ], snapshot.revision);
    this.writing = false;
    this.verifyCommand = command;
    this.verifyDisable = ids.join(", ");
    this.notice = ok ? "Verification settings saved." : null;
    this.error = ok ? null : "The Host did not accept the verification settings.";
    this.publish();
  }
  async testNotification() {
    this.writing = true;
    this.publish();
    try {
      const result = await this.request("/notify-test", {
        method: "POST",
        body: JSON.stringify({ title: "dsh-totem", message: "Notifications are configured correctly." })
      });
      this.notice = `Test sent: ${JSON.stringify(result)}`;
      this.error = null;
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error);
    } finally {
      this.writing = false;
      this.publish();
    }
  }
}

// src/client/verify-card.ts
var CACHE_MS = 600;

class VerifyController {
  form;
  cache = new Map;
  constructor(form) {
    this.form = form;
  }
  token() {
    return this.form.getSnapshot().value?.apiToken?.trim() ?? "";
  }
  async request(path) {
    const token = this.token();
    if (token.length === 0)
      return;
    try {
      const response = await fetch(`/totem${path}`, { headers: { authorization: `Bearer ${token}` } });
      if (!response.ok)
        return;
      return await response.json();
    } catch {
      return;
    }
  }
  lookupTurn = async (turn) => {
    const hit = this.cache.get(turn);
    if (hit !== undefined && Date.now() - hit.at < CACHE_MS)
      return hit.result;
    const data = await this.request(`/verify?turn=${turn}`);
    const result = data?.result ?? null;
    this.cache.set(turn, { at: Date.now(), result });
    return result;
  };
  async rules() {
    const data = await this.request("/verify/rules");
    return {
      rules: data?.rules ?? [],
      command: data?.settings?.command ?? "",
      disable: data?.settings?.disable ?? []
    };
  }
}

// src/client/VerifyTurnCard.tsx
var import_react2 = require("react");

// src/client/turn.ts
function turnNumberOf(value) {
  if (typeof value === "number")
    return Number.isFinite(value) ? value : undefined;
  if (typeof value === "object" && value !== null) {
    const candidate = value.turn;
    if (typeof candidate === "number" && Number.isFinite(candidate))
      return candidate;
  }
  return;
}
function turnStatusOf(value) {
  if (typeof value !== "object" || value === null)
    return "unknown";
  const status = value.status;
  return status === "open" || status === "closed" ? status : "unknown";
}

// src/client/VerifyTurnCard.tsx
var jsx_runtime3 = require("react/jsx-runtime");
var HIGH = "var(--dsw-alias-state-error-primary, #e5534b)";
var MEDIUM = "var(--dsw-alias-state-warning-primary, #d29922)";
var MUTED2 = "var(--dsw-alias-text-secondary, #9a9a9a)";
var BORDER = "var(--dsw-alias-border, #333)";
function severityColor(severity) {
  return severity === "high" ? HIGH : MEDIUM;
}
function FindingRow({ finding }) {
  return /* @__PURE__ */ jsx_runtime3.jsxs("li", {
    style: { display: "flex", gap: 8, alignItems: "baseline", padding: "3px 0" },
    children: [
      /* @__PURE__ */ jsx_runtime3.jsx("span", {
        style: {
          flex: "0 0 auto",
          fontFamily: "ui-monospace, SFMono-Regular, monospace",
          fontSize: 11,
          color: severityColor(finding.severity)
        },
        children: finding.rule
      }),
      /* @__PURE__ */ jsx_runtime3.jsxs("span", {
        style: { flex: "1 1 auto", minWidth: 0, overflowWrap: "anywhere" },
        children: [
          finding.path === undefined || finding.path.length === 0 ? "" : /* @__PURE__ */ jsx_runtime3.jsxs("code", {
            style: { fontSize: 11 },
            children: [
              finding.path,
              " "
            ]
          }),
          finding.detail
        ]
      }),
      /* @__PURE__ */ jsx_runtime3.jsx("span", {
        style: { flex: "0 0 auto", fontSize: 10, color: MUTED2 },
        children: finding.source ?? finding.tool ?? ""
      })
    ]
  });
}
function VerifyTurnCard({ turn, lookupTurn }) {
  const number = turnNumberOf(turn);
  const status = turnStatusOf(turn);
  const [result, setResult] = import_react2.useState(undefined);
  import_react2.useEffect(() => {
    if (number === undefined)
      return;
    let active = true;
    lookupTurn(number).then((loaded) => {
      if (active)
        setResult(loaded);
    });
    return () => {
      active = false;
    };
  }, [number, status, lookupTurn]);
  if (result === undefined || result === null)
    return null;
  if (result.findings.length === 0 && result.command === undefined)
    return null;
  const { findings } = result;
  const high = findings.filter((finding) => finding.severity === "high").length;
  const mutated = result.command !== undefined;
  return /* @__PURE__ */ jsx_runtime3.jsxs("section", {
    "aria-label": "Deterministic verification",
    style: {
      border: `1px solid ${BORDER}`,
      borderLeft: `3px solid ${high > 0 ? HIGH : BORDER}`,
      borderRadius: 8,
      padding: "8px 10px",
      fontSize: 12,
      lineHeight: 1.5
    },
    children: [
      /* @__PURE__ */ jsx_runtime3.jsxs("header", {
        style: { display: "flex", gap: 8, alignItems: "baseline", marginBottom: findings.length === 0 ? 0 : 4 },
        children: [
          /* @__PURE__ */ jsx_runtime3.jsx("strong", {
            style: { fontSize: 12 },
            children: "Verification"
          }),
          /* @__PURE__ */ jsx_runtime3.jsxs("span", {
            style: { color: MUTED2 },
            children: [
              findings.length === 0 ? "clean" : `${findings.length} finding${findings.length === 1 ? "" : "s"}${high > 0 ? ` (${high} high)` : ""}`,
              " · ",
              result.ms,
              " ms",
              mutated ? ` · command ${result.command?.ok === true ? "passed" : "failed"}` : ""
            ]
          })
        ]
      }),
      findings.length === 0 ? null : /* @__PURE__ */ jsx_runtime3.jsx("ul", {
        style: { listStyle: "none", margin: 0, padding: 0 },
        children: findings.map((finding, index) => /* @__PURE__ */ jsx_runtime3.jsx(FindingRow, {
          finding
        }, `${finding.rule}:${finding.path ?? ""}:${index}`))
      })
    ]
  });
}

// src/client/SessionUnreadIcon.tsx
var jsx_runtime4 = require("react/jsx-runtime");
function SessionUnreadIcon() {
  return /* @__PURE__ */ jsx_runtime4.jsxs("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 16 16",
    fill: "none",
    "aria-hidden": "true",
    children: [
      /* @__PURE__ */ jsx_runtime4.jsx("circle", {
        cx: "8",
        cy: "8",
        r: "5.2",
        stroke: "currentColor",
        strokeWidth: "1.4"
      }),
      /* @__PURE__ */ jsx_runtime4.jsx("circle", {
        cx: "8",
        cy: "8",
        r: "2.2",
        fill: "currentColor"
      })
    ]
  });
}

// src/client/unread-store.ts
var UNREAD_KEY = "dsh-totem:unread-sessions";
var MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
function defaultStorage() {
  try {
    return typeof localStorage === "undefined" ? undefined : localStorage;
  } catch {
    return;
  }
}
function readUnread(storage = defaultStorage()) {
  if (storage === undefined)
    return [];
  let parsed;
  try {
    const raw = storage.getItem(UNREAD_KEY);
    parsed = raw === null ? undefined : JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed))
    return [];
  const now = Date.now();
  const seen = new Set;
  const records = [];
  for (const entry of parsed) {
    if (typeof entry !== "object" || entry === null)
      continue;
    const record = entry;
    if (typeof record.sessionId !== "string" || record.sessionId.length === 0)
      continue;
    const markedAt = typeof record.markedAt === "number" && Number.isFinite(record.markedAt) ? record.markedAt : now;
    if (now - markedAt > MAX_AGE_MS || seen.has(record.sessionId))
      continue;
    seen.add(record.sessionId);
    records.push({ sessionId: record.sessionId, markedAt });
  }
  return records.sort((left, right) => right.markedAt - left.markedAt);
}
function writeUnread(records, storage = defaultStorage()) {
  if (storage === undefined)
    return;
  try {
    storage.setItem(UNREAD_KEY, JSON.stringify(records));
  } catch {}
}
function withMark(records, sessionId, markedAt = Date.now()) {
  const rest = records.filter((record) => record.sessionId !== sessionId);
  return [{ sessionId, markedAt }, ...rest].sort((left, right) => right.markedAt - left.markedAt);
}
function withoutMark(records, sessionId) {
  return records.filter((record) => record.sessionId !== sessionId);
}
function markStored(sessionId, storage) {
  const records = withMark(readUnread(storage), sessionId);
  writeUnread(records, storage);
  return records;
}
function clearStored(sessionId, storage) {
  const records = withoutMark(readUnread(storage), sessionId);
  writeUnread(records, storage);
  return records;
}

// src/client/session-unread.ts
function currentKey(session) {
  const snapshot = session.current.getSnapshot?.() ?? session.current.value;
  return snapshot?.key;
}
var UNREAD_SYNCED_KEY = "dsh-totem:unread-synced";

class SessionUnreadController {
  session;
  storage;
  remote;
  pending = new Set;
  clearing = new Set;
  observedUnread = new Set;
  syncing;
  constructor(session, storage, remote) {
    this.session = session;
    this.storage = storage;
    this.remote = remote;
  }
  isCurrent(sessionId) {
    return currentKey(this.session) === sessionId;
  }
  mark(sessionId) {
    if (sessionId.length === 0)
      return false;
    markStored(sessionId, this.storage);
    this.session.completionUnread.add(sessionId);
    this.session.publishStatus();
    if (this.remote === undefined)
      return true;
    this.pending.add(sessionId);
    this.pushMark(sessionId);
    return true;
  }
  clear(sessionId) {
    if (sessionId.length === 0)
      return false;
    clearStored(sessionId, this.storage);
    this.observedUnread.delete(sessionId);
    const changed = this.session.completionUnread.delete(sessionId);
    if (changed)
      this.session.publishStatus();
    if (this.remote !== undefined)
      this.clearRemote([sessionId]);
    return true;
  }
  async pushMark(sessionId) {
    const remote = this.remote;
    if (remote === undefined) {
      this.pending.delete(sessionId);
      return;
    }
    const items = await remote.mark(sessionId);
    if (items === undefined)
      return;
    this.pending.delete(sessionId);
    this.apply(items);
  }
  restore() {
    const statuses = this.session.sessionStatus.getSnapshot();
    const current = currentKey(this.session);
    let changed = false;
    for (const record of readUnread(this.storage)) {
      const status = statuses.get(record.sessionId);
      if (status?.running === true || record.sessionId === current) {
        clearStored(record.sessionId, this.storage);
        continue;
      }
      if (this.session.completionUnread.has(record.sessionId))
        continue;
      this.session.completionUnread.add(record.sessionId);
      changed = true;
    }
    if (changed)
      this.session.publishStatus();
  }
  sync() {
    if (this.remote === undefined)
      return Promise.resolve();
    this.syncing ??= this.reconcile().finally(() => {
      this.syncing = undefined;
    });
    return this.syncing;
  }
  async reconcile() {
    const remote = this.remote;
    if (remote === undefined)
      return;
    const storage = this.storage ?? defaultStorage();
    for (const sessionId of [...this.pending])
      await this.pushMark(sessionId);
    let items = await remote.list();
    if (items === undefined)
      return;
    if (storage?.getItem(UNREAD_SYNCED_KEY) !== "1") {
      const remoteIds = new Set(items.map((item) => item.sessionId));
      for (const record of readUnread(storage)) {
        if (!remoteIds.has(record.sessionId))
          await remote.mark(record.sessionId);
      }
      storage?.setItem(UNREAD_SYNCED_KEY, "1");
      items = await remote.list() ?? items;
    }
    this.apply(items);
  }
  apply(items) {
    const statuses = this.session.sessionStatus.getSnapshot();
    const current = currentKey(this.session);
    const dead = new Set;
    const live = [];
    let changed = false;
    for (const item of items) {
      const status = statuses.get(item.sessionId);
      if (status?.running === true || item.sessionId === current) {
        dead.add(item.sessionId);
        continue;
      }
      live.push(item);
      if (!this.session.completionUnread.has(item.sessionId)) {
        this.session.completionUnread.add(item.sessionId);
        changed = true;
      }
    }
    const remoteIds = new Set(live.map((item) => item.sessionId));
    for (const record of readUnread(this.storage)) {
      if (remoteIds.has(record.sessionId) || this.pending.has(record.sessionId))
        continue;
      clearStored(record.sessionId, this.storage);
      if (this.session.completionUnread.delete(record.sessionId))
        changed = true;
    }
    for (const sessionId of this.pending) {
      if (!remoteIds.has(sessionId))
        live.push({ sessionId, markedAt: Date.now() });
    }
    writeUnread(live, this.storage);
    if (changed)
      this.session.publishStatus();
    if (dead.size > 0)
      this.clearRemote([...dead]);
  }
  async clearRemote(sessionIds) {
    const remote = this.remote;
    if (remote === undefined)
      return;
    const fresh = sessionIds.filter((id) => !this.clearing.has(id));
    if (fresh.length === 0)
      return;
    for (const id of fresh)
      this.clearing.add(id);
    const items = await remote.clear(fresh);
    for (const id of fresh)
      this.clearing.delete(id);
    if (items !== undefined)
      this.apply(items);
  }
  watch() {
    return this.session.sessionStatus.subscribe(() => {
      const statuses = this.session.sessionStatus.getSnapshot();
      const current = currentKey(this.session);
      const drop = [];
      for (const record of readUnread(this.storage)) {
        const resumed = statuses.get(record.sessionId)?.running === true;
        if (resumed || record.sessionId === current) {
          clearStored(record.sessionId, this.storage);
          drop.push(record.sessionId);
        }
      }
      if (drop.length > 0)
        this.clearRemote(drop);
      const unread = new Set;
      for (const [sessionId, status] of statuses) {
        if (status.completionUnread !== true)
          continue;
        unread.add(sessionId);
        if (status.running === true || sessionId === current)
          continue;
        if (!this.observedUnread.has(sessionId))
          this.trackCompletion(sessionId);
      }
      this.observedUnread.clear();
      for (const sessionId of unread)
        this.observedUnread.add(sessionId);
    });
  }
  trackCompletion(sessionId) {
    if (this.remote === undefined || this.pending.has(sessionId))
      return;
    if (readUnread(this.storage).some((record) => record.sessionId === sessionId))
      return;
    markStored(sessionId, this.storage);
    this.pending.add(sessionId);
    this.pushMark(sessionId);
  }
}

// src/client/unread-sync.ts
function parseItems(value) {
  if (typeof value !== "object" || value === null)
    return;
  const items = value.items;
  if (!Array.isArray(items))
    return;
  const records = [];
  for (const entry of items) {
    if (typeof entry !== "object" || entry === null)
      continue;
    const record = entry;
    if (typeof record.sessionId !== "string" || record.sessionId.length === 0)
      continue;
    const markedAt = typeof record.markedAt === "number" && Number.isFinite(record.markedAt) ? record.markedAt : Date.now();
    records.push({ sessionId: record.sessionId, markedAt });
  }
  return records;
}

class UnreadApi {
  token;
  constructor(token) {
    this.token = token;
  }
  async request(path, init) {
    const token = this.token().trim();
    if (token.length === 0)
      return;
    try {
      const response = await fetch(`/totem${path}`, {
        ...init,
        headers: {
          authorization: `Bearer ${token}`,
          ...init.body === undefined ? {} : { "content-type": "application/json" }
        }
      });
      if (!response.ok)
        return;
      return parseItems(await response.json());
    } catch {
      return;
    }
  }
  async list() {
    return this.request("/unread", { method: "GET" });
  }
  async mark(sessionId) {
    return this.request("/unread", { method: "POST", body: JSON.stringify({ sessionId }) });
  }
  async clear(sessionIds) {
    return this.request("/unread/clear", { method: "POST", body: JSON.stringify({ sessionIds }) });
  }
}

// src/client/unread-menu.ts
var UNREAD_MENU_ORDER = 350;
function unreadMenuActions(target, deps) {
  const { sessionId } = target;
  if (sessionId.length === 0)
    return [];
  if (deps.isCurrent(sessionId))
    return [];
  const status = deps.statusOf(sessionId);
  if (status?.completionUnread === true) {
    return [{
      id: "totem-read",
      label: "Mark as read",
      icon: { key: "totem.unread" },
      run: () => {
        deps.clear(sessionId);
      }
    }];
  }
  return [{
    id: "totem-unread",
    label: "Mark as unread",
    icon: { key: "totem.unread" },
    run: () => {
      deps.mark(sessionId);
    }
  }];
}

// src/client/OverviewPage.tsx
var import_react3 = require("react");
var jsx_runtime5 = require("react/jsx-runtime");
var PAGE = {
  height: "100%",
  overflowY: "auto",
  padding: "28px 32px 40px",
  display: "flex",
  justifyContent: "center"
};
var INNER = { width: "100%", maxWidth: 1040, display: "flex", flexDirection: "column", gap: 22 };
var MUTED3 = { color: "var(--dsw-alias-text-secondary, #9a9a9a)", fontSize: 12 };
var CARD2 = {
  border: "1px solid var(--dsw-alias-border, #2e2e2e)",
  borderRadius: 12,
  background: "var(--dsw-alias-bg-secondary, #161616)",
  padding: "16px 18px"
};
var CHIP = {
  border: "1px solid var(--dsw-alias-border, #3a3a3a)",
  borderRadius: 999,
  padding: "3px 10px",
  fontSize: 11,
  cursor: "pointer",
  background: "transparent",
  color: "var(--dsw-alias-text-secondary, #9a9a9a)"
};
var COLORS = ["var(--dsw-alias-bg-tertiary, #1b1f24)", "#0e3a5c", "#0b5cad", "#1d8cf8", "#4cb3ff"];
var SOURCES = [
  { id: "all", label: "All" },
  { id: "dsh", label: "dsh" },
  { id: "opencode", label: "opencode" },
  { id: "encoder", label: "encoder" }
];
function compact(value) {
  if (!Number.isFinite(value) || value <= 0)
    return "0";
  if (value >= 1000000000000)
    return `${(value / 1000000000000).toFixed(2)}T`;
  if (value >= 1e9)
    return `${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6)
    return `${(value / 1e6).toFixed(2)}M`;
  if (value >= 1000)
    return `${(value / 1000).toFixed(1)}K`;
  return String(Math.round(value));
}
function integer(value) {
  return Math.round(value).toLocaleString();
}
function shortDate(date) {
  if (date.length === 0)
    return "—";
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
function shift(date, days) {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + days);
  return value.toLocaleDateString("en-CA");
}
function dayOfWeek(date) {
  return new Date(`${date}T12:00:00`).getDay();
}
function buildWeeks(days, mode) {
  const totals = new Map;
  let running = 0;
  for (const day of [...days].sort((left, right) => left.date.localeCompare(right.date))) {
    running += day.tokens;
    totals.set(day.date, mode === "cumulative" ? running : day.tokens);
  }
  const todayKey = new Date().toLocaleDateString("en-CA");
  const start = shift(todayKey, -364);
  const startAligned = shift(start, -dayOfWeek(start));
  const values = [...totals.values()].filter((value) => value > 0).sort((left, right) => left - right);
  const threshold = (quantile) => values.length === 0 ? 0 : values[Math.min(values.length - 1, Math.floor(values.length * quantile))];
  const levels = [threshold(0.25), threshold(0.5), threshold(0.75), threshold(0.9)];
  const weeks = [];
  for (let week = 0;week < 53; week++) {
    const column = [];
    for (let weekday = 0;weekday < 7; weekday++) {
      const date = shift(startAligned, week * 7 + weekday);
      const future = date > todayKey;
      const value = totals.get(date) ?? 0;
      const level = value <= 0 ? 0 : value <= levels[0] ? 1 : value <= levels[1] ? 2 : value <= levels[2] ? 3 : 4;
      column.push({ date, value, level, future });
    }
    weeks.push(column);
  }
  return weeks;
}
function Heatmap({ days, mode }) {
  const weeks = import_react3.useMemo(() => buildWeeks(days, mode), [days, mode]);
  const labels = import_react3.useMemo(() => {
    let previous = "";
    return weeks.map((column) => {
      const month = column[0].date.slice(0, 7);
      if (month === previous)
        return "";
      previous = month;
      return new Date(`${column[0].date}T12:00:00`).toLocaleDateString(undefined, { month: "short" });
    });
  }, [weeks]);
  return /* @__PURE__ */ jsx_runtime5.jsxs("div", {
    style: { display: "flex", flexDirection: "column", gap: 6, overflowX: "auto" },
    children: [
      /* @__PURE__ */ jsx_runtime5.jsx("div", {
        style: { display: "grid", gridAutoFlow: "column", gridAutoColumns: "13px", gap: 2, minWidth: 53 * 15 },
        children: labels.map((label, index) => /* @__PURE__ */ jsx_runtime5.jsx("span", {
          style: { ...MUTED3, fontSize: 10, whiteSpace: "nowrap" },
          children: label
        }, index))
      }),
      /* @__PURE__ */ jsx_runtime5.jsx("div", {
        style: { display: "grid", gridAutoFlow: "column", gridAutoColumns: "13px", gap: 2, minWidth: 53 * 15 },
        children: weeks.map((column, index) => /* @__PURE__ */ jsx_runtime5.jsx("div", {
          style: { display: "grid", gridTemplateRows: "repeat(7, 13px)", gap: 2 },
          children: column.map((cell) => /* @__PURE__ */ jsx_runtime5.jsx("div", {
            title: cell.future ? "" : `${cell.date} · ${integer(cell.value)} tokens`,
            style: {
              width: 13,
              height: 13,
              borderRadius: 3,
              background: cell.future ? "transparent" : COLORS[cell.level],
              opacity: cell.future ? 0 : 1
            }
          }, cell.date))
        }, index))
      }),
      /* @__PURE__ */ jsx_runtime5.jsxs("div", {
        style: { display: "flex", alignItems: "center", gap: 5, justifyContent: "flex-end" },
        children: [
          /* @__PURE__ */ jsx_runtime5.jsx("span", {
            style: { ...MUTED3, fontSize: 10 },
            children: "Less"
          }),
          COLORS.map((color, index) => /* @__PURE__ */ jsx_runtime5.jsx("span", {
            style: { width: 11, height: 11, borderRadius: 2, background: color }
          }, index)),
          /* @__PURE__ */ jsx_runtime5.jsx("span", {
            style: { ...MUTED3, fontSize: 10 },
            children: "More"
          })
        ]
      })
    ]
  });
}
function Stat({ label, value }) {
  return /* @__PURE__ */ jsx_runtime5.jsxs("div", {
    style: { display: "flex", flexDirection: "column", gap: 2, minWidth: 108 },
    children: [
      /* @__PURE__ */ jsx_runtime5.jsx("span", {
        style: { fontSize: 15, fontWeight: 600 },
        children: value
      }),
      /* @__PURE__ */ jsx_runtime5.jsx("span", {
        style: { ...MUTED3, fontSize: 11 },
        children: label
      })
    ]
  });
}
function Failure({ reason, status }) {
  const text = reason === "unauthorized" ? "Set the Totem `apiToken` in Plugins, then reload this page." : reason === "missing-route" ? "The Host has not loaded the Overview endpoint (404). Restart `dsh-totem` and reload." : reason === "offline" ? "Cannot reach the Host. Check that the app is running." : `The Host returned an error${status === undefined ? "" : ` (${status})`}.`;
  return /* @__PURE__ */ jsx_runtime5.jsx("div", {
    style: { ...PAGE, alignItems: "center", justifyContent: "center" },
    children: /* @__PURE__ */ jsx_runtime5.jsxs("div", {
      style: { ...CARD2, maxWidth: 480, textAlign: "center" },
      children: [
        /* @__PURE__ */ jsx_runtime5.jsx("div", {
          style: { fontSize: 14, fontWeight: 600, marginBottom: 6 },
          children: "Overview unavailable"
        }),
        /* @__PURE__ */ jsx_runtime5.jsx("div", {
          style: MUTED3,
          children: text
        })
      ]
    })
  });
}
function OverviewPage(props) {
  const [source, setSource] = import_react3.useState("all");
  const [result, setResult] = import_react3.useState(null);
  const [mode, setMode] = import_react3.useState("daily");
  const [importing, setImporting] = import_react3.useState(false);
  import_react3.useEffect(() => {
    let active = true;
    const load = async () => {
      const next = await props.load(source);
      if (active)
        setResult(next);
    };
    load();
    const timer = setInterval(() => {
      load();
    }, 60000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [source]);
  const runImport = async () => {
    if (importing)
      return;
    setImporting(true);
    const next = await props.importHistory();
    setImporting(false);
    if (next.ok) {
      setSource("all");
      setResult(await props.load("all"));
    } else {
      setResult(next);
    }
  };
  if (result === null) {
    return /* @__PURE__ */ jsx_runtime5.jsx("div", {
      style: { ...PAGE, alignItems: "center", justifyContent: "center" },
      children: /* @__PURE__ */ jsx_runtime5.jsx("span", {
        style: MUTED3,
        children: "Loading usage…"
      })
    });
  }
  if (!result.ok)
    return /* @__PURE__ */ jsx_runtime5.jsx(Failure, {
      reason: result.reason,
      status: result.status
    });
  const data = result.data;
  const total = compact(data.totals.tokens);
  const unit = /[A-Za-z]$/u.exec(total)?.[0] ?? "";
  const digits = unit === "" ? total : total.slice(0, -1);
  const importedAt = data.import.importedAt;
  return /* @__PURE__ */ jsx_runtime5.jsx("div", {
    style: PAGE,
    children: /* @__PURE__ */ jsx_runtime5.jsxs("div", {
      style: INNER,
      children: [
        /* @__PURE__ */ jsx_runtime5.jsxs("div", {
          style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" },
          children: [
            /* @__PURE__ */ jsx_runtime5.jsx("div", {
              style: { display: "flex", gap: 2 },
              children: SOURCES.map((option) => /* @__PURE__ */ jsx_runtime5.jsx("button", {
                type: "button",
                onClick: () => {
                  setSource(option.id);
                },
                style: { ...CHIP, ...source === option.id ? { background: "var(--dsw-alias-bg-tertiary, #222)", color: "inherit" } : {} },
                children: option.label
              }, option.id))
            }),
            /* @__PURE__ */ jsx_runtime5.jsxs("div", {
              style: { display: "flex", alignItems: "center", gap: 8 },
              children: [
                importedAt === null ? null : /* @__PURE__ */ jsx_runtime5.jsxs("span", {
                  style: { ...MUTED3, fontSize: 11 },
                  children: [
                    "Imported ",
                    new Date(importedAt).toLocaleString()
                  ]
                }),
                /* @__PURE__ */ jsx_runtime5.jsx("button", {
                  type: "button",
                  style: CHIP,
                  onClick: () => {
                    props.load(source).then(setResult);
                  },
                  children: "Refresh"
                }),
                /* @__PURE__ */ jsx_runtime5.jsx("button", {
                  type: "button",
                  style: { ...CHIP, color: "inherit", borderColor: "var(--dsw-alias-border, #555)" },
                  disabled: importing,
                  onClick: () => {
                    runImport();
                  },
                  children: importing ? "Importing…" : importedAt === null ? "Import history" : "Re-import"
                })
              ]
            })
          ]
        }),
        data.totals.tokens === 0 ? /* @__PURE__ */ jsx_runtime5.jsxs("div", {
          style: { ...CARD2, textAlign: "center", padding: "40px 18px" },
          children: [
            /* @__PURE__ */ jsx_runtime5.jsxs("div", {
              style: { fontSize: 14, fontWeight: 600, marginBottom: 6 },
              children: [
                "No usage for ",
                source
              ]
            }),
            /* @__PURE__ */ jsx_runtime5.jsx("div", {
              style: MUTED3,
              children: "Run a turn, or import the opencode/encoder history. Importing scans the message tables once and caches daily totals."
            })
          ]
        }) : /* @__PURE__ */ jsx_runtime5.jsxs(jsx_runtime5.Fragment, {
          children: [
            /* @__PURE__ */ jsx_runtime5.jsxs("div", {
              style: { display: "flex", flexDirection: "column", alignItems: "center", gap: 4, paddingTop: 8 },
              children: [
                /* @__PURE__ */ jsx_runtime5.jsxs("div", {
                  style: { display: "flex", alignItems: "baseline", gap: 6 },
                  children: [
                    /* @__PURE__ */ jsx_runtime5.jsx("span", {
                      style: { fontSize: 56, lineHeight: 1, fontWeight: 650, letterSpacing: "-0.03em" },
                      children: digits
                    }),
                    unit === "" ? null : /* @__PURE__ */ jsx_runtime5.jsx("span", {
                      style: { fontSize: 26, fontWeight: 600, color: "var(--dsw-alias-text-secondary, #9a9a9a)" },
                      children: unit
                    })
                  ]
                }),
                /* @__PURE__ */ jsx_runtime5.jsx("span", {
                  style: { ...MUTED3, fontSize: 12 },
                  children: "Lifetime tokens"
                })
              ]
            }),
            /* @__PURE__ */ jsx_runtime5.jsxs("div", {
              style: { ...CARD2, display: "flex", flexWrap: "wrap", gap: "16px 28px", justifyContent: "space-between" },
              children: [
                /* @__PURE__ */ jsx_runtime5.jsx(Stat, {
                  label: "Lifetime tokens",
                  value: integer(data.totals.tokens)
                }),
                /* @__PURE__ */ jsx_runtime5.jsx(Stat, {
                  label: "Peak day",
                  value: compact(data.stats.peak.tokens)
                }),
                /* @__PURE__ */ jsx_runtime5.jsx(Stat, {
                  label: "Longest streak",
                  value: `${data.stats.longestStreak} days`
                }),
                /* @__PURE__ */ jsx_runtime5.jsx(Stat, {
                  label: "Current streak",
                  value: `${data.stats.currentStreak} days`
                }),
                /* @__PURE__ */ jsx_runtime5.jsx(Stat, {
                  label: "Active days",
                  value: integer(data.totals.activeDays)
                }),
                /* @__PURE__ */ jsx_runtime5.jsx(Stat, {
                  label: "Sessions",
                  value: integer(data.totals.sessions)
                }),
                /* @__PURE__ */ jsx_runtime5.jsx(Stat, {
                  label: "Avg tokens/day",
                  value: compact(data.stats.avgTokensPerDay)
                }),
                /* @__PURE__ */ jsx_runtime5.jsx(Stat, {
                  label: "Avg prompts/day",
                  value: String(data.stats.avgPromptsPerDay)
                }),
                /* @__PURE__ */ jsx_runtime5.jsx(Stat, {
                  label: "Avg tokens/prompt",
                  value: compact(data.stats.avgTokensPerPrompt)
                }),
                /* @__PURE__ */ jsx_runtime5.jsx(Stat, {
                  label: "Avg session tokens",
                  value: compact(data.stats.avgSessionTokens)
                }),
                /* @__PURE__ */ jsx_runtime5.jsx(Stat, {
                  label: "Cached tokens",
                  value: compact(data.totals.cacheRead)
                })
              ]
            }),
            /* @__PURE__ */ jsx_runtime5.jsxs("div", {
              style: CARD2,
              children: [
                /* @__PURE__ */ jsx_runtime5.jsxs("div", {
                  style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 },
                  children: [
                    /* @__PURE__ */ jsx_runtime5.jsxs("div", {
                      style: { display: "flex", flexDirection: "column", gap: 2 },
                      children: [
                        /* @__PURE__ */ jsx_runtime5.jsx("span", {
                          style: { fontSize: 13, fontWeight: 600 },
                          children: "Token activity"
                        }),
                        /* @__PURE__ */ jsx_runtime5.jsxs("span", {
                          style: { ...MUTED3, fontSize: 11 },
                          children: [
                            data.totals.prompts.toLocaleString(),
                            " prompts · peak ",
                            shortDate(data.stats.peak.date)
                          ]
                        })
                      ]
                    }),
                    /* @__PURE__ */ jsx_runtime5.jsx("div", {
                      style: { display: "flex", gap: 2 },
                      children: ["daily", "cumulative"].map((option) => /* @__PURE__ */ jsx_runtime5.jsx("button", {
                        type: "button",
                        onClick: () => {
                          setMode(option);
                        },
                        style: { ...CHIP, ...mode === option ? { background: "var(--dsw-alias-bg-tertiary, #222)", color: "inherit" } : {} },
                        children: option === "daily" ? "Daily" : "Cumulative"
                      }, option))
                    })
                  ]
                }),
                /* @__PURE__ */ jsx_runtime5.jsx(Heatmap, {
                  days: data.days,
                  mode
                })
              ]
            }),
            data.models.length > 0 ? /* @__PURE__ */ jsx_runtime5.jsxs("div", {
              style: CARD2,
              children: [
                /* @__PURE__ */ jsx_runtime5.jsx("div", {
                  style: { fontSize: 13, fontWeight: 600, marginBottom: 10 },
                  children: "Top models"
                }),
                /* @__PURE__ */ jsx_runtime5.jsx("div", {
                  style: { display: "flex", flexDirection: "column", gap: 7 },
                  children: data.models.map((model) => {
                    const share = data.totals.tokens === 0 ? 0 : model.tokens / data.totals.tokens;
                    return /* @__PURE__ */ jsx_runtime5.jsxs("div", {
                      style: { display: "flex", alignItems: "center", gap: 10 },
                      children: [
                        /* @__PURE__ */ jsx_runtime5.jsx("span", {
                          style: { width: 190, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
                          children: model.model.length > 0 ? model.model : model.provider
                        }),
                        /* @__PURE__ */ jsx_runtime5.jsx("div", {
                          style: { flex: 1, height: 7, borderRadius: 4, background: "var(--dsw-alias-bg-tertiary, #222)", overflow: "hidden" },
                          children: /* @__PURE__ */ jsx_runtime5.jsx("div", {
                            style: { width: `${Math.max(2, Math.round(share * 100))}%`, height: "100%", background: "#1d8cf8" }
                          })
                        }),
                        /* @__PURE__ */ jsx_runtime5.jsx("span", {
                          style: { ...MUTED3, fontVariantNumeric: "tabular-nums", width: 70, textAlign: "right" },
                          children: compact(model.tokens)
                        }),
                        /* @__PURE__ */ jsx_runtime5.jsxs("span", {
                          style: { ...MUTED3, fontSize: 11, width: 42, textAlign: "right" },
                          children: [
                            Math.round(share * 100),
                            "%"
                          ]
                        })
                      ]
                    }, `${model.provider}/${model.model}`);
                  })
                })
              ]
            }) : null,
            /* @__PURE__ */ jsx_runtime5.jsxs("div", {
              style: { ...MUTED3, fontSize: 11, textAlign: "center", paddingBottom: 8 },
              children: [
                "Updated ",
                new Date(data.generatedAt).toLocaleTimeString(),
                " · ",
                data.totals.input.toLocaleString(),
                " in / ",
                data.totals.output.toLocaleString(),
                " out / ",
                data.totals.cacheRead.toLocaleString(),
                " cached",
                importedAt === null ? "" : ` · history imported ${new Date(importedAt).toLocaleDateString()}`
              ]
            })
          ]
        })
      ]
    })
  });
}

// src/client/OverviewIcon.tsx
var jsx_runtime6 = require("react/jsx-runtime");
function OverviewIcon({ size = 18 }) {
  return /* @__PURE__ */ jsx_runtime6.jsxs("svg", {
    width: size,
    height: size,
    viewBox: "0 0 16 16",
    fill: "none",
    "aria-hidden": "true",
    children: [
      /* @__PURE__ */ jsx_runtime6.jsx("rect", {
        x: "1.5",
        y: "9.5",
        width: "2.6",
        height: "5",
        rx: "1",
        fill: "currentColor",
        opacity: "0.65"
      }),
      /* @__PURE__ */ jsx_runtime6.jsx("rect", {
        x: "6.7",
        y: "5.5",
        width: "2.6",
        height: "9",
        rx: "1",
        fill: "currentColor",
        opacity: "0.85"
      }),
      /* @__PURE__ */ jsx_runtime6.jsx("rect", {
        x: "11.9",
        y: "1.5",
        width: "2.6",
        height: "13",
        rx: "1",
        fill: "currentColor"
      })
    ]
  });
}

// src/client/overview.ts
async function readResult(response) {
  if (response.status === 401 || response.status === 403)
    return { ok: false, reason: "unauthorized", status: response.status };
  if (response.status === 404)
    return { ok: false, reason: "missing-route", status: 404 };
  if (!response.ok)
    return { ok: false, reason: "error", status: response.status };
  try {
    return { ok: true, data: await response.json() };
  } catch {
    return { ok: false, reason: "error", status: response.status };
  }
}

class OverviewController {
  form;
  constructor(form) {
    this.form = form;
  }
  token() {
    return this.form.getSnapshot().value?.apiToken?.trim() ?? "";
  }
  load = async (source = "all") => {
    const token = this.token();
    if (token.length === 0)
      return { ok: false, reason: "unauthorized" };
    try {
      const response = await fetch(`/totem/overview?source=${encodeURIComponent(source)}`, {
        headers: { authorization: `Bearer ${token}` }
      });
      return await readResult(response);
    } catch {
      return { ok: false, reason: "offline" };
    }
  };
  importHistory = async () => {
    const token = this.token();
    if (token.length === 0)
      return { ok: false, reason: "unauthorized" };
    try {
      const response = await fetch("/totem/overview/import", {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: "{}"
      });
      return await readResult(response);
    } catch {
      return { ok: false, reason: "offline" };
    }
  };
}

// node_modules/node-emoji/lib/index.js
var import_emojilib = __toESM(require_emojilib(), 1);
var import_char_regex = __toESM(require_char_regex(), 1);
var import_is = __toESM(require_dist(), 1);
var import_skin_tone = __toESM(require_skin_tone(), 1);
var charRegexMatcher = import_char_regex.default();
var NON_SPACING_MARK = String.fromCharCode(65039);
var nonSpacingRegex = new RegExp(NON_SPACING_MARK, "g");
function normalizeCode(code) {
  return code.replace(nonSpacingRegex, "");
}
function normalizeName(name) {
  return /:.+:/.test(name) ? name.slice(1, -1) : name;
}
var emojiData = Object.entries(import_emojilib.default.lib).map(([name, { char: emoji }]) => [name, emoji]);
var emojiCodesByName = new Map(emojiData);
var emojiNamesByCode = new Map(emojiData.map(([name, emoji]) => [normalizeCode(emoji), name]));
var get = (codeOrName) => {
  import_is.assert.string(codeOrName);
  return emojiCodesByName.get(normalizeName(codeOrName));
};

// src/client/emoji.ts
var ALIASES = {
  wilted_rose: "wilted_flower"
};
var SHORTCODE = /:([a-z0-9_+-]+):/gi;
function replaceShortcodes(text) {
  return text.replace(SHORTCODE, (match, name) => {
    const key = name.toLowerCase();
    const emoji = get(ALIASES[key] ?? key);
    return emoji ?? match;
  });
}
function eligible(node) {
  const parent = node.parentElement;
  if (parent === null)
    return false;
  if (parent.closest('pre, code, textarea, input, [contenteditable="true"]') !== null)
    return false;
  return parent.closest("[data-chat-flow-key]") !== null;
}
function installEmojiShortcodes(doc = typeof document === "undefined" ? undefined : document) {
  if (doc === undefined || doc.body === null)
    return () => {};
  const pending = new Set;
  let scheduled = false;
  const flush = () => {
    scheduled = false;
    for (const node of pending) {
      const value = node.nodeValue;
      if (value === null)
        continue;
      const next = replaceShortcodes(value);
      if (next !== value)
        node.nodeValue = next;
    }
    pending.clear();
  };
  const enqueue = (node) => {
    if (!eligible(node))
      return;
    pending.add(node);
    if (!scheduled) {
      scheduled = true;
      if (typeof requestAnimationFrame === "function")
        requestAnimationFrame(flush);
      else
        queueMicrotask(flush);
    }
  };
  const scan = (scope) => {
    if (scope.nodeType === Node.TEXT_NODE) {
      enqueue(scope);
      return;
    }
    const walker = doc.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode()) !== null)
      enqueue(node);
  };
  scan(doc.body);
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === "characterData") {
        if (record.target.nodeType === Node.TEXT_NODE)
          enqueue(record.target);
        continue;
      }
      for (const node of record.addedNodes)
        scan(node);
    }
  });
  observer.observe(doc.body, { childList: true, subtree: true, characterData: true });
  return () => observer.disconnect();
}

// src/client/index.tsx
var inject = ["slots", "remote", "remote.session", "configForms"];
function apply(ctx) {
  const card = new TotemMemoryCardController(ctx.configForms.get("totem"), ctx);
  ctx.effect(() => () => {
    card.dispose();
  }, "dsh-totem: model card lifetime");
  const face = card.inject();
  ctx.effect(() => ctx.remote.$on("llm/adapters-updated", () => {
    card.refreshCatalog();
  }), "dsh-totem: adapter invalidations");
  ctx.effect(() => ctx.remote.$on("settings/document-updated", () => {
    card.refreshCatalog();
  }), "dsh-totem: settings invalidations");
  ctx.effect(() => ctx.on("connection/reset", () => {
    card.refreshCatalog();
  }), "dsh-totem: connection resets");
  const overview = new OverviewController(ctx.configForms.get("totem"));
  ctx.effect(() => ctx.slots.inject("contextMenu.icon", () => ctx.slots.register({
    name: "contextMenu.icon",
    key: "totem.unread"
  }, SessionUnreadIcon)), "dsh-totem: unread menu icon");
  let unread;
  ctx.inject?.(["uiSession"], (inner) => {
    const session = inner.uiSession;
    if (session?.completionUnread === undefined)
      return;
    unread = new SessionUnreadController(session, undefined, new UnreadApi(() => {
      const value = ctx.configForms.get("totem").getSnapshot().value ?? {};
      return value.apiToken ?? "";
    }));
    unread.restore();
    ctx.effect(() => unread?.watch() ?? (() => {}), "dsh-totem: unread mark expiry");
    const controller = unread;
    ctx.effect(() => {
      controller.sync();
      if (typeof document === "undefined")
        return () => {};
      const sync = () => {
        controller.sync();
      };
      const timer = setInterval(sync, 20000);
      const form = ctx.configForms.get("totem");
      const unsubscribe = form.subscribe?.(sync);
      const initial = setTimeout(sync, 1500);
      const onVisible = () => {
        if (document.visibilityState === "visible")
          sync();
      };
      window.addEventListener?.("focus", sync);
      document.addEventListener("visibilitychange", onVisible);
      return () => {
        clearInterval(timer);
        clearTimeout(initial);
        unsubscribe?.();
        window.removeEventListener?.("focus", sync);
        document.removeEventListener("visibilitychange", onVisible);
      };
    }, "dsh-totem: unread cross-device sync");
    ctx.inject?.(["contextMenus"], (menuInner) => {
      const menus = menuInner.contextMenus;
      if (menus?.register === undefined)
        return;
      ctx.effect(() => menus.register({
        id: "totem.unread",
        target: "session",
        order: UNREAD_MENU_ORDER,
        observe: () => [session.sessionStatus],
        resolve: (target) => unreadMenuActions(target, {
          isCurrent: (id) => controller.isCurrent(id),
          statusOf: (id) => session.sessionStatus.getSnapshot().get(id),
          mark: (id) => controller.mark(id),
          clear: (id) => controller.clear(id)
        })
      }), "dsh-totem: mark unread menu");
    });
  });
  ctx.effect(() => ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({
    name: "sidebar.panellist",
    id: "overview",
    order: -10,
    label: () => "Overview"
  }, OverviewIcon)), "dsh-totem: overview sidebar entry");
  ctx.effect(() => ctx.slots.inject("main", () => ctx.slots.register({
    name: "main",
    key: "overview",
    inject: () => ({ load: overview.load, importHistory: overview.importHistory })
  }, OverviewPage)), "dsh-totem: overview panel");
  const verify = new VerifyController(ctx.configForms.get("totem"));
  ctx.effect(() => ctx.slots.inject("conversation.chat.turnTail", () => ctx.slots.register({
    name: "conversation.chat.turnTail",
    id: "verify-turn",
    order: 10,
    inject: () => ({ lookupTurn: verify.lookupTurn })
  }, VerifyTurnCard)), "dsh-totem: verify turn card");
  const assistant = new AssistantController(ctx.configForms.get("totem"), ctx);
  ctx.effect(() => () => {
    assistant.dispose();
  }, "dsh-totem: assistant section lifetime");
  const assistantFace = assistant.inject();
  ctx.effect(() => ctx.slots.inject("settings.section", () => ctx.slots.register({
    name: "settings.section",
    id: "assistant",
    order: 30,
    label: () => "Assistant",
    inject: () => assistantFace
  }, AssistantSection)), "dsh-totem: assistant section");
  ctx.effect(() => ctx.configForms.whileServed(["totem"], () => ctx.slots.inject("plugins.item", () => ctx.slots.register({
    name: "plugins.item",
    id: "totem",
    order: 60,
    label: () => "Totem memory",
    inject: () => face
  }, TotemMemoryCard))), "dsh-totem: settings page");
  ctx.effect(() => installEmojiShortcodes(), "dsh-totem: emoji shortcodes");
}

    return module.exports;
  }
});
