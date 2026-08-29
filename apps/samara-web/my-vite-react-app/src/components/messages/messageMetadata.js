import { perfectFitMetadata } from '../../config/perfectFitMetadata';
import {
  formatRecipientDisplay,
  getPublicUserPresentation,
  getUserRoutingId
} from '../../lib/userIdentity';

export const messageMetadata = perfectFitMetadata.messaging;

export function getUserIdentity(user) {
  if (!user) return '';
  return getUserRoutingId(user);
}

export function getUserDisplayName(user) {
  if (!user) return 'Perfect Fit user';
  return formatRecipientDisplay(getPublicUserPresentation(user));
}
