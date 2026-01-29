# Tasks: Implement Trust

## 1. Database Schema
- [ ] 1.1 Create trust__reviews table (id, reservation_id, cast_id, guest_id, content, status, created_at)
- [ ] 1.2 Create trust__ratings table (review_id, dimension, score) for 5-axis ratings
- [ ] 1.3 Create trust__cast_scores table (cast_id, dimension, avg_score) for aggregated scores
- [ ] 1.4 Add indexes for cast_id lookups

## 2. Backend - Trust Domain
- [ ] 2.1 Create reviews relation and repository
- [ ] 2.2 Create ratings relation and repository
- [ ] 2.3 Create cast_scores relation and repository
- [ ] 2.4 Implement SubmitReview use case (guest)
- [ ] 2.5 Implement ApproveReview use case (cast)
- [ ] 2.6 Implement RejectReview use case (cast)
- [ ] 2.7 Implement GetCastTrustScore use case
- [ ] 2.8 Implement ListCastReviews use case
- [ ] 2.9 Implement ListPendingReviews use case (for cast)
- [ ] 2.10 Implement RecalculateCastScores use case

## 3. Proto & gRPC
- [ ] 3.1 Define TrustService proto
- [ ] 3.2 Define Review and Rating message types
- [ ] 3.3 Define TrustScore message (5-axis radar data)
- [ ] 3.4 Define SubmitReview RPC
- [ ] 3.5 Define ApproveReview RPC
- [ ] 3.6 Define RejectReview RPC
- [ ] 3.7 Define GetCastTrustScore RPC
- [ ] 3.8 Define ListCastReviews RPC
- [ ] 3.9 Define ListPendingReviews RPC
- [ ] 3.10 Implement gRPC handler

## 4. Frontend API Routes
- [ ] 4.1 Create /api/guest/reviews/route.ts (submit review)
- [ ] 4.2 Create /api/cast/reviews/route.ts (list pending, approve/reject)
- [ ] 4.3 Create /api/guest/casts/[id]/reviews/route.ts (list approved reviews)
- [ ] 4.4 Create /api/guest/casts/[id]/trust-score/route.ts

## 5. Frontend - Cast Side
- [ ] 5.1 Connect /cast/reviews to real API
- [ ] 5.2 Implement approve/reject actions
- [ ] 5.3 Show pending reviews count badge

## 6. Frontend - Guest Side
- [ ] 6.1 Add review submission form after completed reservation
- [ ] 6.2 Add 5-axis rating input (Looks, Charm, Tech, Service, Love)
- [ ] 6.3 Display TrustRadar on cast detail page
- [ ] 6.4 Display review list on cast detail page

## 7. Score Calculation
- [ ] 7.1 Implement score aggregation on review approval
- [ ] 7.2 Add score recalculation job (for consistency)

## 8. Testing
- [ ] 8.1 Test review submission flow
- [ ] 8.2 Test approval/rejection flow
- [ ] 8.3 Test score calculation
- [ ] 8.4 Test radar chart display
