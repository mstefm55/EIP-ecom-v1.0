/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import CreationsAndFeedback from './CreationsAndFeedback';

/**
 * CustomerGalleryAndReviews is now a lightweight, optimized wrapper
 * pointing directly to the unified CreationsAndFeedback component.
 * This completely eliminates duplicate codebase components, styles, and states
 * while preserving backward compatibility across all parent components.
 */
export default function CustomerGalleryAndReviews({
  pattern,
  reviews = [],
  onAddReview,
  currentUser = null
}) {
  return (
    <CreationsAndFeedback
      pattern={pattern}
      reviews={reviews}
      onAddReview={onAddReview}
      currentUser={currentUser}
    />
  );
}
