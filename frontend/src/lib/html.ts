// input:  [raw user/content HTML strings, Canvas page bodies, and browser DOM parsing APIs]
// output: [safe HTML sanitization helpers for block-preserving text/list mode or richer HTML mode plus HTML-shape detection helpers]
// pos:    [small frontend HTML safety utility for rendering trusted subsets of rich text in dialogs, UI surfaces, and Canvas page bodies]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

const ALLOWED_TAGS = new Set([
  'a',
  'b',
  'blockquote',
  'br',
  'code',
  'div',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'i',
  'li',
  'ol',
  'p',
  'pre',
  'span',
  'strong',
  'ul',
]);

const PLAIN_TEXT_LIST_TAGS = new Set([
  'a',
  'blockquote',
  'br',
  'code',
  'div',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'li',
  'ol',
  'p',
  'pre',
  'strong',
  'ul',
]);

const ALLOWED_ATTRS = new Set([
  'href',
  'style',
  'target',
  'rel',
]);

const SAFE_URL_PROTOCOLS = new Set([
  'http:',
  'https:',
  'mailto:',
]);

const HTML_TAG_PATTERN = /<\/?[a-z][\s\S]*>/i;
const ALLOWED_STYLE_PROPS = new Set([
  'background-color',
  'color',
  'font-size',
  'font-style',
  'font-weight',
  'line-height',
  'text-align',
  'text-decoration',
]);

interface SanitizeOptions {
  allowedTags: Set<string>;
  allowInlineStyles: boolean;
  allowedDataAttrs?: Set<string>;
}

const isSafeHref = (value: string) => {
  if (!value) return false;
  try {
    const parsed = new URL(value, 'https://semestra.local');
    return SAFE_URL_PROTOCOLS.has(parsed.protocol);
  } catch {
    return false;
  }
};

const isSafeStyleValue = (value: string) => {
  return !/url\(|expression\(|javascript:|@import/i.test(value);
};

const sanitizeInlineStyle = (element: HTMLElement) => {
  const safeEntries: string[] = [];

  for (const propertyName of Array.from(element.style)) {
    const normalizedName = propertyName.toLowerCase();
    if (!ALLOWED_STYLE_PROPS.has(normalizedName)) continue;

    const value = element.style.getPropertyValue(propertyName).trim();
    if (!value || !isSafeStyleValue(value)) continue;
    safeEntries.push(`${normalizedName}: ${value}`);
  }

  return safeEntries.join('; ');
};

const sanitizeNode = (node: Node, documentRef: Document, options: SanitizeOptions): Node | null => {
  if (node.nodeType === Node.TEXT_NODE) {
    return documentRef.createTextNode(node.textContent ?? '');
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return null;
  }

  const element = node as HTMLElement;
  const tagName = element.tagName.toLowerCase();
  const children = Array.from(element.childNodes)
    .map((child) => sanitizeNode(child, documentRef, options))
    .filter((child): child is Node => child !== null);

  if (!options.allowedTags.has(tagName)) {
    if (children.length === 0) return null;
    const fragment = documentRef.createDocumentFragment();
    for (const child of children) {
      fragment.appendChild(child);
    }
    return fragment;
  }

  const cleanElement = documentRef.createElement(tagName);
  for (const attr of Array.from(element.attributes)) {
    const attrName = attr.name.toLowerCase();
    if (!ALLOWED_ATTRS.has(attrName)) {
      if (options.allowedDataAttrs && attrName.startsWith('data-') && options.allowedDataAttrs.has(attrName) && tagName === 'a') {
        cleanElement.setAttribute(attrName, attr.value);
      }
      continue;
    }

    if (attrName === 'href') {
      if (tagName !== 'a') continue;
      if (!isSafeHref(attr.value.trim())) continue;
      cleanElement.setAttribute('href', attr.value.trim());
      continue;
    }

    if (attrName === 'target') {
      if (tagName !== 'a') continue;
      cleanElement.setAttribute('target', '_blank');
      continue;
    }

    if (attrName === 'rel') {
      if (tagName !== 'a') continue;
      cleanElement.setAttribute('rel', 'noopener noreferrer nofollow');
      continue;
    }

    if (attrName === 'style') {
      if (!options.allowInlineStyles) continue;
      const sanitizedStyle = sanitizeInlineStyle(element);
      if (sanitizedStyle) {
        cleanElement.setAttribute('style', sanitizedStyle);
      }
    }
  }

  if (tagName === 'a' && cleanElement.hasAttribute('href') && !cleanElement.hasAttribute('rel')) {
    cleanElement.setAttribute('rel', 'noopener noreferrer nofollow');
  }

  for (const child of children) {
    cleanElement.appendChild(child);
  }

  return cleanElement;
};

export const looksLikeHtml = (value: string | null | undefined) => {
  return Boolean(value && HTML_TAG_PATTERN.test(value));
};

export const sanitizeHtmlFragment = (value: string | null | undefined) => {
  return sanitizeHtmlFragmentWithOptions(value, {
    allowedTags: ALLOWED_TAGS,
    allowInlineStyles: true,
  });
};

const CANVAS_ALLOWED_DATA_ATTRS = new Set([
  'data-api-endpoint',
  'data-api-returntype',
]);

export const sanitizeCanvasHtmlFragment = (value: string | null | undefined) => {
  return sanitizeHtmlFragmentWithOptions(value, {
    allowedTags: ALLOWED_TAGS,
    allowInlineStyles: true,
    allowedDataAttrs: CANVAS_ALLOWED_DATA_ATTRS,
  });
};

export const sanitizeTextListHtmlFragment = (value: string | null | undefined) => {
  return sanitizeHtmlFragmentWithOptions(value, {
    allowedTags: PLAIN_TEXT_LIST_TAGS,
    allowInlineStyles: false,
  });
};

const sanitizeHtmlFragmentWithOptions = (value: string | null | undefined, options: SanitizeOptions) => {
  if (!value || typeof window === 'undefined') return '';

  const parser = new DOMParser();
  const parsed = parser.parseFromString(value, 'text/html');
  const output = document.createElement('div');

  for (const child of Array.from(parsed.body.childNodes)) {
    const sanitizedChild = sanitizeNode(child, document, options);
    if (sanitizedChild) {
      output.appendChild(sanitizedChild);
    }
  }

  return output.innerHTML;
};
