// AST walker that converts the Figma-exported JSX into plain HTML.
// Handles the subset of JSX patterns the Figma MCP emits:
//   - JSXElement / JSXFragment / JSXText
//   - className / style={{...}} / src={imgX} / data-* / alt / other string attrs
//   - JSXExpressionContainer with: Identifier, TemplateLiteral (no exprs),
//     LogicalExpression (className fallback), ObjectExpression (style)
//   - PascalCase component calls — inlined via a components map
//
// Emits minified HTML (no extraneous whitespace around block elements).

import { Parser } from 'acorn';
import jsx from 'acorn-jsx';

const JsxParser = Parser.extend(jsx());

// Void elements that must not have a closing tag.
const VOID = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

// Attributes safe to emit even if the value is empty (e.g. alt="").
const ALLOW_EMPTY = new Set(['alt']);

function parse(source) {
  return JsxParser.parse(source, {
    ecmaVersion: 'latest',
    sourceType: 'module',
  });
}

// Extract:
//   - constants: `const imgX = "https://..."` as { imgX: "https://..." }
//   - components: `function Foo({ className }) { return (<jsx>) }` and
//     `export default function Bar() { return (<jsx>) }`
function buildProgramIndex(program) {
  const constants = {};
  const components = {};
  let defaultJsx = null;

  for (const node of program.body) {
    // const X = "..."
    if (node.type === 'VariableDeclaration') {
      for (const d of node.declarations) {
        if (
          d.id.type === 'Identifier' &&
          d.init &&
          d.init.type === 'Literal' &&
          typeof d.init.value === 'string'
        ) {
          constants[d.id.name] = d.init.value;
        }
      }
    }

    // function Foo(...) { return (<jsx>) }
    if (node.type === 'FunctionDeclaration' && node.id) {
      const jsxNode = extractReturnJsx(node.body);
      if (jsxNode) {
        components[node.id.name] = {
          params: node.params,
          jsx: jsxNode,
        };
      }
    }

    // export default function Bar() { return (<jsx>) }
    if (
      node.type === 'ExportDefaultDeclaration' &&
      node.declaration?.type === 'FunctionDeclaration'
    ) {
      const jsxNode = extractReturnJsx(node.declaration.body);
      if (jsxNode) {
        defaultJsx = jsxNode;
      }
    }
  }

  return { constants, components, defaultJsx };
}

function extractReturnJsx(body) {
  if (!body || body.type !== 'BlockStatement') return null;
  for (const stmt of body.body) {
    if (stmt.type === 'ReturnStatement' && stmt.argument) {
      return unwrapParens(stmt.argument);
    }
  }
  return null;
}

function unwrapParens(node) {
  // acorn never produces ParenthesizedExpression for JSX roots, but be safe.
  while (node?.type === 'ParenthesizedExpression') node = node.expression;
  return node;
}

// ── Expression evaluation (limited to patterns seen in Figma exports) ───────
function evalExpression(expr, ctx) {
  if (!expr) return '';
  switch (expr.type) {
    case 'Literal':
      return expr.value == null ? '' : String(expr.value);
    case 'Identifier':
      return Object.prototype.hasOwnProperty.call(ctx.constants, expr.name)
        ? ctx.constants[expr.name]
        : Object.prototype.hasOwnProperty.call(ctx.props, expr.name)
        ? ctx.props[expr.name]
        : '';
    case 'TemplateLiteral': {
      // Join quasis interleaved with evaluated expressions.
      let out = '';
      for (let i = 0; i < expr.quasis.length; i++) {
        out += expr.quasis[i].value.cooked ?? expr.quasis[i].value.raw;
        if (i < expr.expressions.length) {
          out += evalExpression(expr.expressions[i], ctx);
        }
      }
      return out;
    }
    case 'LogicalExpression': {
      const l = evalExpression(expr.left, ctx);
      if (expr.operator === '||') return l || evalExpression(expr.right, ctx);
      if (expr.operator === '&&') return l ? evalExpression(expr.right, ctx) : '';
      if (expr.operator === '??') return l != null && l !== '' ? l : evalExpression(expr.right, ctx);
      return l;
    }
    case 'ConditionalExpression': {
      const t = evalExpression(expr.test, ctx);
      return t ? evalExpression(expr.consequent, ctx) : evalExpression(expr.alternate, ctx);
    }
    case 'ObjectExpression': {
      // Used for style={{ ... }}. Return an object of stringified values.
      const obj = {};
      for (const prop of expr.properties) {
        if (prop.type !== 'Property') continue;
        const key =
          prop.key.type === 'Identifier' ? prop.key.name :
          prop.key.type === 'Literal' ? String(prop.key.value) : null;
        if (!key) continue;
        obj[key] = evalExpression(prop.value, ctx);
      }
      return obj;
    }
    case 'BinaryExpression': {
      const l = evalExpression(expr.left, ctx);
      const r = evalExpression(expr.right, ctx);
      if (expr.operator === '+') return String(l) + String(r);
      return '';
    }
    default:
      return '';
  }
}

// ── HTML emission helpers ───────────────────────────────────────────────────
function htmlEscape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function attrEscape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;');
}

function camelToKebab(name) {
  // For CSS properties in inline styles: backgroundImage → background-image.
  return name.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
}

function styleObjToCss(obj) {
  if (typeof obj !== 'object' || obj == null) return '';
  return Object.entries(obj)
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `${camelToKebab(k)}:${String(v).trim()}`)
    .join(';');
}

// JSX attribute name → HTML attribute name. JSX uses className/htmlFor, HTML
// uses class/for. Other names pass through (including data-*, aria-*).
function mapAttrName(jsxName) {
  if (jsxName === 'className') return 'class';
  if (jsxName === 'htmlFor') return 'for';
  return jsxName;
}

// ── JSX attribute evaluation ────────────────────────────────────────────────
function getJsxAttrName(attr) {
  if (attr.name.type === 'JSXIdentifier') return attr.name.name;
  if (attr.name.type === 'JSXNamespacedName') {
    return `${attr.name.namespace.name}:${attr.name.name.name}`;
  }
  return null;
}

function evalAttrValue(attr, ctx) {
  // No value → boolean attribute (e.g. <input disabled />).
  if (attr.value == null) return true;
  if (attr.value.type === 'Literal') return attr.value.value;
  if (attr.value.type === 'JSXExpressionContainer') {
    return evalExpression(attr.value.expression, ctx);
  }
  return '';
}

// ── Element name resolution ─────────────────────────────────────────────────
function getElementName(openingName) {
  if (openingName.type === 'JSXIdentifier') return openingName.name;
  if (openingName.type === 'JSXMemberExpression') {
    const parts = [];
    let node = openingName;
    while (node.type === 'JSXMemberExpression') {
      parts.unshift(node.property.name);
      node = node.object;
    }
    parts.unshift(node.name);
    return parts.join('.');
  }
  return null;
}

function isComponentName(name) {
  return /^[A-Z]/.test(name);
}

// ── Core walker: emits HTML string ──────────────────────────────────────────
export function jsxToHtml(source, options = {}) {
  const { stripDataAttrs = true } = options;
  const program = parse(source);
  const { constants, components, defaultJsx } = buildProgramIndex(program);

  if (!defaultJsx) throw new Error('No default export JSX found.');

  const ctx = {
    constants,
    components,
    props: {},
    stripDataAttrs,
  };

  return emitNode(defaultJsx, ctx).trim();
}

function emitNode(node, ctx) {
  if (!node) return '';
  switch (node.type) {
    case 'JSXElement':
      return emitElement(node, ctx);
    case 'JSXFragment':
      return node.children.map((c) => emitNode(c, ctx)).join('');
    case 'JSXText':
      // Collapse runs of whitespace to a single space (matches JSX text semantics
      // loosely). Leading/trailing whitespace-only text around tags is trimmed.
      if (/^\s+$/.test(node.value)) return '';
      return htmlEscape(node.value.replace(/\s+/g, ' '));
    case 'JSXExpressionContainer': {
      const v = evalExpression(node.expression, ctx);
      if (v == null || v === '' || typeof v === 'boolean') return '';
      return htmlEscape(String(v));
    }
    default:
      return '';
  }
}

function emitElement(node, ctx) {
  const name = getElementName(node.openingElement.name);
  if (!name) return '';

  // PascalCase → custom component. Inline its JSX with props filled in.
  if (isComponentName(name)) {
    const comp = ctx.components[name];
    if (!comp) {
      // Unknown component — skip to avoid emitting invalid HTML.
      return '';
    }
    // Collect props from the call site.
    const callProps = {};
    for (const a of node.openingElement.attributes) {
      if (a.type !== 'JSXAttribute') continue;
      const key = getJsxAttrName(a);
      if (!key) continue;
      callProps[key] = evalAttrValue(a, ctx);
    }
    const newCtx = { ...ctx, props: callProps };
    return emitNode(comp.jsx, newCtx);
  }

  // Standard HTML element.
  const attrs = [];
  let classValue = null;
  let styleValue = null;
  for (const a of node.openingElement.attributes) {
    if (a.type !== 'JSXAttribute') continue;
    const jsxKey = getJsxAttrName(a);
    if (!jsxKey) continue;
    const htmlKey = mapAttrName(jsxKey);

    if (ctx.stripDataAttrs && htmlKey.startsWith('data-')) continue;

    const v = evalAttrValue(a, ctx);
    if (htmlKey === 'class') {
      classValue = typeof v === 'string' ? v : '';
      continue;
    }
    if (htmlKey === 'style') {
      // Style can be a string or an object (from style={{...}}).
      styleValue = typeof v === 'object' ? styleObjToCss(v) : String(v || '');
      continue;
    }
    if (v === true) {
      attrs.push(htmlKey);
    } else if (v === false || v == null) {
      // skip
    } else if (v === '' && !ALLOW_EMPTY.has(htmlKey)) {
      // skip empty non-alt attrs (e.g. href="")
    } else {
      attrs.push(`${htmlKey}="${attrEscape(v)}"`);
    }
  }
  if (classValue != null && classValue !== '') {
    attrs.unshift(`class="${attrEscape(classValue)}"`);
  }
  if (styleValue) {
    attrs.push(`style="${attrEscape(styleValue)}"`);
  }

  const attrStr = attrs.length ? ' ' + attrs.join(' ') : '';
  const tag = name.toLowerCase();

  if (VOID.has(tag) || node.openingElement.selfClosing) {
    if (VOID.has(tag)) return `<${tag}${attrStr}>`;
    // Non-void self-closing (e.g. <div />) → emit as empty open+close.
    return `<${tag}${attrStr}></${tag}>`;
  }

  const inner = node.children.map((c) => emitNode(c, ctx)).join('');
  return `<${tag}${attrStr}>${inner}</${tag}>`;
}

// ── Utility: collect every class token present in the emitted HTML ──────────
// Tailwind v4 JIT works best when given the actual raw class strings, so we
// just return the deduped list of tokens.
export function collectClassTokens(html) {
  const tokens = new Set();
  const re = /class="([^"]*)"/g;
  let m;
  while ((m = re.exec(html))) {
    for (const t of m[1].split(/\s+/)) {
      if (t) tokens.add(t);
    }
  }
  return Array.from(tokens);
}

// ── Utility: find every asset URL value in the constants map ────────────────
export function extractAssetMap(source) {
  const program = parse(source);
  const { constants } = buildProgramIndex(program);
  const assets = {};
  for (const [k, v] of Object.entries(constants)) {
    if (typeof v === 'string' && v.includes('://')) {
      assets[k] = v;
    }
  }
  return assets;
}
