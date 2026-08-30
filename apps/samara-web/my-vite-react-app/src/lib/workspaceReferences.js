const normalizeToken = (value, fallback = 'PF') => {
  const cleaned = String(value || '').trim();
  if (!cleaned) return fallback;
  const token = cleaned
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .replace(/[^a-z0-9]/gi, '')
    .toUpperCase()
    .slice(0, 3);
  return token || fallback;
};

const nextNumericSequence = (references = []) => {
  const numbers = references.map((reference) => {
    const match = String(reference || '').match(/(\d+)(?!.*\d)/);
    return match ? Number(match[1]) : 0;
  });
  return Math.max(0, ...numbers) + 1;
};

export const generateProjectReference = ({ name, existingReference } = {}) =>
  existingReference || normalizeToken(name);

export const generateStyleReference = ({ designerReference, styleName, siblingReferences = [], existingReference } = {}) => {
  if (existingReference) return existingReference;
  return `${designerReference || 'PF'}-${normalizeToken(styleName, 'STY')}-${String(nextNumericSequence(siblingReferences)).padStart(3, '0')}`;
};

export const generateVariantReference = ({ styleReference, siblingCount = 0, existingReference } = {}) =>
  existingReference || `${styleReference || 'PF-STY-001'}-V${String(siblingCount + 1).padStart(2, '0')}`;

export const generatePatternFileReference = ({ variantReference, existingReferences = [] } = {}) =>
  `${variantReference || 'PF-STY-001-V01'}-PAT-${String(nextNumericSequence(existingReferences)).padStart(3, '0')}`;
