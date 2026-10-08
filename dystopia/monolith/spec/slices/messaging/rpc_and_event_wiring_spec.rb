# frozen_string_literal: true

require "spec_helper"
require "lib/current"
require "slices/messaging/grpc/messaging_handler"
require "slices/notifications/grpc/notification_handler"

RSpec.describe "Messaging and notifications RPC entry points and event payloads", type: :database do
  let(:db) { Hanami.app["db.gateway"].connection }

  let(:cast) { create_account_with_profile(role: 2, username: "wiring_cast") }
  let(:guest) { create_account_with_profile(username: "wiring_guest") }
  let(:outsider) { create_account_with_profile(username: "wiring_outsider") }

  def handler(handler_class, method, message)
    handler_class.new(method_key: method, service: double, rpc_desc: double, active_call: double, message: message)
  end

  def rpc(handler_class, method, message)
    handler(handler_class, method, message).public_send(method)
  end

  def act_as(profile_id)
    Current.account_id = SecureRandom.uuid_v7
    Current.profile_id = profile_id
  end

  def status(code)
    raise_error(GRPC::BadStatus) { |e| expect(e.code).to eq(code) }
  end

  def send_message(**attrs)
    rpc(Messaging::Grpc::MessagingHandler, :send_message, Messaging::V1::SendMessageRequest.new(**attrs))
  end

  def threads
    rpc(Messaging::Grpc::MessagingHandler, :list_threads, Messaging::V1::ListThreadsRequest.new)
  end

  def total_unread
    rpc(Messaging::Grpc::MessagingHandler, :get_total_unread_count, Messaging::V1::GetTotalUnreadCountRequest.new).count
  end

  after { Current.clear }

  describe "messaging RPCs" do
    it "sends a message to a profile and stores the participants as an ordered profile pair" do
      act_as(cast)

      sent = send_message(recipient_profile_id: guest, content: "hello")

      expect(sent.message.sender_profile_id).to eq(cast)
      expect(db[:messaging__messages].select_map([:thread_id, :sender_profile_id])).to eq([[sent.thread_id, cast]])
      expect(db[:messaging__threads].select_map([:profile_a, :profile_b])).to eq([[cast, guest].minmax])
    end

    it "shows the thread to both participants with the counterpart and the unread count" do
      act_as(cast)
      thread_id = send_message(recipient_profile_id: guest, content: "one").thread_id
      send_message(thread_id: thread_id, content: "two")

      expect(threads.threads.map { |t| [t.counterpart.id, t.unread_count] }).to eq([[guest, 0]])
      expect(total_unread).to eq(0)

      act_as(guest)
      listed = threads
      expect(listed.threads.map { |t| [t.id, t.counterpart.id, t.counterpart.role, t.unread_count] }).to eq([[thread_id, cast, 2, 2]])
      expect(listed.total_unread_count).to eq(2)
      expect(total_unread).to eq(2)

      messages = rpc(Messaging::Grpc::MessagingHandler, :list_messages, Messaging::V1::ListMessagesRequest.new(thread_id: thread_id)).messages
      expect(messages.map(&:sender_profile_id)).to eq([cast, cast])

      rpc(Messaging::Grpc::MessagingHandler, :mark_read, Messaging::V1::MarkReadRequest.new(thread_id: thread_id, message_id: messages.first.id))
      expect(total_unread).to eq(0)
      expect(db[:messaging__read_states].select_map([:thread_id, :profile_id])).to eq([[thread_id, guest]])
    end

    it "opens a thread by recipient profile and replies through the thread id" do
      act_as(cast)
      opened = rpc(Messaging::Grpc::MessagingHandler, :get_or_create_thread, Messaging::V1::GetOrCreateThreadRequest.new(recipient_profile_id: guest)).thread
      send_message(thread_id: opened.id, content: "from cast")

      act_as(guest)
      expect { send_message(thread_id: opened.id, content: "without a follow") }.to status(GRPC::Core::StatusCodes::FAILED_PRECONDITION)
      Social::Slice["repositories.follow_repository"].follow(follower_profile_id: guest, followee_profile_id: cast, status: "approved")
      reply = send_message(thread_id: opened.id, content: "from guest")

      expect(opened.counterpart.id).to eq(guest)
      expect(reply.thread_id).to eq(opened.id)
      expect(db[:messaging__messages].order(:created_at).select_map(:sender_profile_id)).to eq([cast, guest])
    end

    it "keeps a non-participant out of the thread" do
      act_as(cast)
      thread_id = send_message(recipient_profile_id: guest, content: "private").thread_id

      act_as(outsider)

      expect { rpc(Messaging::Grpc::MessagingHandler, :list_messages, Messaging::V1::ListMessagesRequest.new(thread_id: thread_id)) }
        .to status(GRPC::Core::StatusCodes::PERMISSION_DENIED)
      expect { rpc(Messaging::Grpc::MessagingHandler, :mark_read, Messaging::V1::MarkReadRequest.new(thread_id: thread_id)) }
        .to status(GRPC::Core::StatusCodes::PERMISSION_DENIED)
      expect { rpc(Messaging::Grpc::MessagingHandler, :send_typing, Messaging::V1::SendTypingRequest.new(thread_id: thread_id)) }
        .to status(GRPC::Core::StatusCodes::PERMISSION_DENIED)
      expect { send_message(thread_id: thread_id, content: "intrusion") }.to raise_error(GRPC::BadStatus)
      expect(threads.threads).to eq([])
    end
  end

  describe "event payloads" do
    def capture(use_case)
      published = []
      allow(use_case).to receive(:notify) { |channel, payload| published << [channel, payload] }
      published
    end

    def parse(payload)
      handler(Messaging::Grpc::MessagingHandler, :stream_events, Messaging::V1::StreamEventsRequest.new).send(:parse_payload_to_event, payload)
    end

    it "publishes a message to both participants in a shape the stream can read back" do
      use_case = Messaging::Slice["use_cases.send_message"]
      published = capture(use_case)

      use_case.call(sender_profile_id: cast, content: "event", recipient_profile_id: guest)

      expect(published.map(&:first)).to eq(["messaging_user_#{cast}", "messaging_user_#{guest}"])
      event = parse(published.first.last)
      expect(event.message_event.sender_profile_id).to eq(cast)
      expect(event.message_event.content).to eq("event")
    end

    it "publishes read state and typing to the counterpart in a shape the stream can read back" do
      thread_id = Messaging::Slice["use_cases.send_message"].call(sender_profile_id: cast, content: "x", recipient_profile_id: guest)[:thread_id]
      mark_read = Messaging::Slice["use_cases.mark_read"]
      typing = Messaging::Slice["use_cases.send_typing"]
      read_published = capture(mark_read)
      typing_published = capture(typing)

      mark_read.call(thread_id: thread_id, viewer_profile_id: guest, message_id: nil)
      typing.call(thread_id: thread_id, viewer_profile_id: guest)

      expect(read_published.map(&:first)).to eq(["messaging_user_#{cast}"])
      expect(parse(read_published.first.last).read_state.profile_id).to eq(guest)
      expect(typing_published.map(&:first)).to eq(["messaging_user_#{cast}"])
      expect(parse(typing_published.first.last).typing.profile_id).to eq(guest)
    end
  end

  describe "notification RPCs" do
    let(:emit) { Notifications::Slice["use_cases.emit"] }

    def notifications
      rpc(Notifications::Grpc::NotificationHandler, :list_notifications, Notifications::V1::ListNotificationsRequest.new)
    end

    def unread
      rpc(Notifications::Grpc::NotificationHandler, :get_unread_count, Notifications::V1::GetUnreadCountRequest.new).count
    end

    it "lists a recipient's notifications with the latest actor and marks them read" do
      first = emit.call(recipient_profile_id: guest, type: "like", target_resource_id: SecureRandom.uuid_v7, actor_profile_id: cast)
      emit.call(recipient_profile_id: guest, type: "follow_approved", target_resource_id: cast, actor_profile_id: cast)
      emit.call(recipient_profile_id: outsider, type: "like", target_resource_id: SecureRandom.uuid_v7, actor_profile_id: cast)
      expect(db[:notifications__notifications].where(id: first[:id]).select_map([:recipient_profile_id, :latest_actor_profile_id])).to eq([[guest, cast]])

      act_as(guest)
      listed = notifications
      expect(listed.notifications.map { |n| [n.latest_actor.id, n.latest_actor.role] }).to eq([[cast, 2], [cast, 2]])
      expect(listed.unread_count).to eq(2)
      expect(unread).to eq(2)

      rpc(Notifications::Grpc::NotificationHandler, :mark_read, Notifications::V1::MarkReadRequest.new(id: first[:id]))
      expect(unread).to eq(1)
      affected = rpc(Notifications::Grpc::NotificationHandler, :mark_all_read, Notifications::V1::MarkAllReadRequest.new).affected
      expect(affected).to eq(1)
      expect(unread).to eq(0)

      act_as(outsider)
      expect(unread).to eq(1)
    end

    it "does not let a profile mark another profile's notification as read" do
      mine = emit.call(recipient_profile_id: guest, type: "like", target_resource_id: SecureRandom.uuid_v7, actor_profile_id: cast)

      act_as(outsider)
      rpc(Notifications::Grpc::NotificationHandler, :mark_read, Notifications::V1::MarkReadRequest.new(id: mine[:id]))

      act_as(guest)
      expect(unread).to eq(1)
    end

    it "stores preferences per profile and applies them when a notification is emitted" do
      act_as(guest)
      current = rpc(Notifications::Grpc::NotificationHandler, :get_notification_preferences, Notifications::V1::GetNotificationPreferencesRequest.new).preferences
      expect(current.like).to be true

      muted = Notifications::V1::NotificationPreferences.new(**current.to_h.merge(like: false))
      updated = rpc(Notifications::Grpc::NotificationHandler, :update_notification_preferences, Notifications::V1::UpdateNotificationPreferencesRequest.new(preferences: muted)).preferences

      expect(updated.like).to be false
      expect(db[:notifications__preferences].select_map(:profile_id)).to eq([guest])
      expect(emit.call(recipient_profile_id: guest, type: "like", target_resource_id: SecureRandom.uuid_v7, actor_profile_id: cast)).to be_nil
      expect(emit.call(recipient_profile_id: outsider, type: "like", target_resource_id: SecureRandom.uuid_v7, actor_profile_id: cast)).not_to be_nil
    end
  end
end
