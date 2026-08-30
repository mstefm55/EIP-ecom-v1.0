const isWithinWindow = (promotion, now) => {
  const startsAt = promotion?.startsAt ? new Date(promotion.startsAt).getTime() : null;
  const endsAt = promotion?.endsAt ? new Date(promotion.endsAt).getTime() : null;
  return (!startsAt || startsAt <= now) && (!endsAt || endsAt >= now);
};

const isEligible = (promotion, user) => {
  const roles = Array.isArray(promotion?.eligibleRoles) ? promotion.eligibleRoles : [];
  const tiers = Array.isArray(promotion?.eligibleTiers) ? promotion.eligibleTiers : [];
  return (!roles.length || roles.includes(user?.role)) &&
    (!tiers.length || tiers.includes(user?.tier));
};

export function resolveActivePromotion(promotions = [], user = null, now = Date.now()) {
  if (!user || !Array.isArray(promotions)) return null;
  const promotion = promotions.find((candidate) =>
    candidate?.active === true &&
    Number(candidate?.discountPercent) > 0 &&
    isWithinWindow(candidate, now) &&
    isEligible(candidate, user)
  );
  if (!promotion) return null;
  return {
    id: promotion.id,
    code: String(promotion.code || '').trim().toUpperCase(),
    discountPercent: Number(promotion.discountPercent),
    benefitLabel: promotion.benefitLabel || ''
  };
}

export function resolvePromotionByCode(promotions = [], code = '', user = null, now = Date.now()) {
  const normalizedCode = String(code || '').trim().toUpperCase();
  if (!normalizedCode || !Array.isArray(promotions)) return null;
  const promotion = promotions.find((candidate) =>
    String(candidate?.code || '').trim().toUpperCase() === normalizedCode &&
    candidate?.active === true &&
    Number(candidate?.discountPercent) > 0 &&
    isWithinWindow(candidate, now) &&
    isEligible(candidate, user)
  );
  return promotion ? {
    id: promotion.id,
    code: normalizedCode,
    discountPercent: Number(promotion.discountPercent),
    benefitLabel: promotion.benefitLabel || ''
  } : null;
}
