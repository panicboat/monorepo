# Tasks: Implement Concierge

## 1. Database Schema
- [ ] 1.1 Create concierge__conversations table (id, cast_id, guest_id, last_message_at, etc.)
- [ ] 1.2 Create concierge__messages table (id, conversation_id, sender_type, content, message_type, created_at)
- [ ] 1.3 Create concierge__read_receipts table (conversation_id, user_id, last_read_at)

## 2. Backend - Concierge Domain
- [ ] 2.1 Create conversations relation and repository
- [ ] 2.2 Create messages relation and repository
- [ ] 2.3 Create read_receipts relation and repository
- [ ] 2.4 Implement SendMessage use case
- [ ] 2.5 Implement GetConversation use case
- [ ] 2.6 Implement ListConversations use case
- [ ] 2.7 Implement MarkAsRead use case

## 3. Proto & gRPC
- [ ] 3.1 Define ConciergeService proto
- [ ] 3.2 Define Message types (text, invitation, system)
- [ ] 3.3 Define ListConversations RPC
- [ ] 3.4 Define GetConversation RPC (with messages)
- [ ] 3.5 Define SendMessage RPC
- [ ] 3.6 Define MarkAsRead RPC
- [ ] 3.7 Implement gRPC handler

## 4. Frontend API Routes
- [ ] 4.1 Create /api/cast/concierge/route.ts (list conversations)
- [ ] 4.2 Create /api/cast/concierge/[id]/route.ts (messages)
- [ ] 4.3 Create /api/cast/concierge/[id]/send/route.ts
- [ ] 4.4 Create /api/guest/concierge/* routes (mirror)

## 5. Frontend - Concierge Module
- [ ] 5.1 Create useConcierge hook
- [ ] 5.2 Create useConversation hook
- [ ] 5.3 Update ChatList component to use real data
- [ ] 5.4 Update ChatRoom component to use real data
- [ ] 5.5 Implement message sending UI
- [ ] 5.6 Implement unread badge

## 6. Frontend Pages
- [ ] 6.1 Connect /cast/concierge to real API
- [ ] 6.2 Connect /cast/concierge/[id] to real API
- [ ] 6.3 Connect /guest/concierge to real API
- [ ] 6.4 Connect /guest/concierge/[id] to real API

## 7. Invitation Cards
- [ ] 7.1 Design invitation message type schema
- [ ] 7.2 Implement invitation card component
- [ ] 7.3 Add "Send Invitation" action in chat

## 8. Testing
- [ ] 8.1 Test message send/receive flow
- [ ] 8.2 Test conversation list loading
- [ ] 8.3 Test read receipt updating
- [ ] 8.4 Test invitation card display
