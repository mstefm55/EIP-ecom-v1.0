import { perfectFitMetadata } from '../../config/perfectFitMetadata';

export const materialsMetadata = perfectFitMetadata.materials;

export const getUom = (code) =>
  materialsMetadata.uoms.find((item) => item.code === code) ||
  materialsMetadata.uoms[0];

export const getCurrency = (code) =>
  materialsMetadata.currencies.find((item) => item.code === code) ||
  materialsMetadata.currencies[0];

export const canConvertUom = (fromCode, toCode) => {
  const from = getUom(fromCode);
  const to = getUom(toCode);
  return from.family === to.family;
};

export const convertQuantity = (value, fromCode, toCode) => {
  const amount = Number(value) || 0;
  if (fromCode === toCode) return amount;

  const from = getUom(fromCode);
  const to = getUom(toCode);

  if (from.family !== to.family) {
    throw new Error(`Cannot convert ${from.label} to ${to.label}.`);
  }

  return (amount * from.toBase) / to.toBase;
};

export const convertUnitPrice = (price, fromCode, toCode) => {
  const amount = Number(price) || 0;
  if (fromCode === toCode || amount === 0) return amount;

  const from = getUom(fromCode);
  const to = getUom(toCode);

  if (from.family !== to.family) {
    throw new Error(`Cannot convert price from ${from.label} to ${to.label}.`);
  }

  return amount * (to.toBase / from.toBase);
};
