# Tasks: Implement Ritual

## 1. Database Schema
- [ ] 1.1 Create ritual__invitations table (id, cast_id, guest_id, plan_id, date, time, price, status, etc.)
- [ ] 1.2 Create ritual__reservations table (id, invitation_id, sealed_at, completed_at, cancelled_at, etc.)
- [ ] 1.3 Add indexes for cast_id, guest_id, date lookups

## 2. Backend - Ritual Domain
- [ ] 2.1 Create invitations relation and repository
- [ ] 2.2 Create reservations relation and repository
- [ ] 2.3 Implement CreateInvitation use case
- [ ] 2.4 Implement AcceptInvitation use case (Guest seals)
- [ ] 2.5 Implement CancelInvitation use case
- [ ] 2.6 Implement CompleteReservation use case
- [ ] 2.7 Implement GetReservationStats use case (earnings, counts)
- [ ] 2.8 Implement ListUpcomingReservations use case
- [ ] 2.9 Implement ListReservationHistory use case

## 3. Proto & gRPC
- [ ] 3.1 Define RitualService proto
- [ ] 3.2 Define Invitation and Reservation message types
- [ ] 3.3 Define CreateInvitation RPC
- [ ] 3.4 Define AcceptInvitation RPC
- [ ] 3.5 Define CancelReservation RPC
- [ ] 3.6 Define CompleteReservation RPC
- [ ] 3.7 Define GetReservationStats RPC
- [ ] 3.8 Define ListUpcomingReservations RPC
- [ ] 3.9 Define ListReservationHistory RPC
- [ ] 3.10 Implement gRPC handler

## 4. Frontend API Routes
- [ ] 4.1 Create /api/cast/invitations/route.ts (create invitation)
- [ ] 4.2 Create /api/cast/stats/route.ts (earnings, promise rate)
- [ ] 4.3 Create /api/cast/upcoming-reservations/route.ts
- [ ] 4.4 Create /api/cast/history/route.ts
- [ ] 4.5 Create /api/guest/invitations/route.ts (accept/decline)

## 5. Frontend - Cast Side
- [ ] 5.1 Connect /cast/home earnings summary to real API
- [ ] 5.2 Connect /cast/home upcoming reservations to real API
- [ ] 5.3 Connect /cast/history to real API
- [ ] 5.4 Connect /cast/mypage stats (sales, promise rate) to real API
- [ ] 5.5 Update /cast/pledges/[id] to use real data

## 6. Frontend - Guest Side
- [ ] 6.1 Create invitation acceptance UI in chat
- [ ] 6.2 Create guest reservations list page (if needed)

## 7. Integration with Concierge
- [ ] 7.1 Send invitation message when invitation is created
- [ ] 7.2 Send system message on status changes

## 8. Testing
- [ ] 8.1 Test invitation creation flow
- [ ] 8.2 Test acceptance (sealing) flow
- [ ] 8.3 Test cancellation flow
- [ ] 8.4 Test stats calculation
- [ ] 8.5 Test history listing with filters
