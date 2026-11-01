# frozen_string_literal: true

require "spec_helper"
require "lib/current"
require "slices/messaging/grpc/messaging_handler"
require "slices/notifications/grpc/notification_handler"

RSpec.describe "Messaging and notifications RPC entry points", type: :database do
  let(:db) { Hanami.app["db.gateway"].connection }

  let(:cast) { create_account_with_profile(role: 2, username: "wiring_cast") }
  let(:guest) { create_account_with_profile(username: "wiring_guest") }
  let(:outsider) { create_account_with_profile(username: "wiring_outsider") }
  let(:private_cast) { create_account_with_profile(role: 2, username: "wiring_private_cast", is_private: true) }

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

  def thread(thread_id)
    rpc(Messaging::Grpc::MessagingHandler, :get_thread, Messaging::V1::GetThreadRequest.new(thread_id: thread_id))
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

    it "flags a private counterpart on the thread list and not a public one" do
      act_as(private_cast)
      send_message(recipient_profile_id: guest, content: "hello")

      expect(threads.threads.map { |t| t.counterpart.is_private }).to eq([false])

      act_as(guest)
      expect(threads.threads.map { |t| [t.counterpart.profile_id, t.counterpart.is_private] }).to eq([[private_cast, true]])
    end

    it "shows the thread to both participants with the counterpart and the unread count" do
      act_as(cast)
      thread_id = send_message(recipient_profile_id: guest, content: "one").thread_id
      send_message(thread_id: thread_id, content: "two")

      expect(threads.threads.map { |t| [t.counterpart.profile_id, t.unread_count] }).to eq([[guest, 0]])
      expect(total_unread).to eq(0)

      act_as(guest)
      listed = threads
      expect(listed.threads.map { |t| [t.id, t.counterpart.profile_id, t.counterpart.role, t.unread_count] }).to eq([[thread_id, cast, 2, 2]])
      expect(listed.threads.map(&:counterpart)).to all(be_a(::Profile::V1::ProfileSummary))
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

      expect(opened.counterpart.profile_id).to eq(guest)
      expect(reply.thread_id).to eq(opened.id)
      expect(db[:messaging__messages].order(:created_at).select_map(:sender_profile_id)).to eq([cast, guest])
    end

    it "names the missing follow as the reason when a guest replies to a cast without following" do
      act_as(cast)
      thread_id = send_message(recipient_profile_id: guest, content: "from cast").thread_id

      act_as(guest)

      expect { send_message(thread_id: thread_id, content: "without a follow") }.to raise_error(GRPC::BadStatus) { |e|
        expect(e.code).to eq(GRPC::Core::StatusCodes::FAILED_PRECONDITION)
        expect(e.metadata["error-reason"]).to eq("follow_required")
      }
    end

    it "returns a thread by id with its counterpart and what restricts the viewer from sending" do
      act_as(cast)
      thread_id = send_message(recipient_profile_id: guest, content: "from cast").thread_id

      opened = thread(thread_id)
      expect([opened.thread.id, opened.thread.counterpart.profile_id, opened.send_restriction]).to eq([thread_id, guest, :SEND_RESTRICTION_NONE])

      act_as(guest)
      opened = thread(thread_id)
      expect([opened.thread.counterpart.profile_id, opened.thread.unread_count, opened.send_restriction]).to eq([cast, 1, :SEND_RESTRICTION_FOLLOW_REQUIRED])

      Social::Slice["repositories.follow_repository"].follow(follower_profile_id: guest, followee_profile_id: cast, status: "approved")
      expect(thread(thread_id).send_restriction).to eq(:SEND_RESTRICTION_NONE)

      Social::Slice["repositories.block_repository"].block(blocker_profile_id: cast, blocked_profile_id: guest)
      expect(thread(thread_id).send_restriction).to eq(:SEND_RESTRICTION_BLOCKED)
    end

    it "keeps a non-participant out of the thread" do
      act_as(cast)
      thread_id = send_message(recipient_profile_id: guest, content: "private").thread_id

      act_as(outsider)

      expect { rpc(Messaging::Grpc::MessagingHandler, :list_messages, Messaging::V1::ListMessagesRequest.new(thread_id: thread_id)) }
        .to status(GRPC::Core::StatusCodes::PERMISSION_DENIED)
      expect { rpc(Messaging::Grpc::MessagingHandler, :mark_read, Messaging::V1::MarkReadRequest.new(thread_id: thread_id)) }
        .to status(GRPC::Core::StatusCodes::PERMISSION_DENIED)
      expect { send_message(thread_id: thread_id, content: "intrusion") }.to status(GRPC::Core::StatusCodes::PERMISSION_DENIED)
      expect { thread(thread_id) }.to status(GRPC::Core::StatusCodes::PERMISSION_DENIED)
      expect(threads.threads).to eq([])
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

    it "flags a private latest actor and not a public one" do
      emit.call(recipient_profile_id: guest, type: "like", target_resource_id: SecureRandom.uuid_v7, actor_profile_id: private_cast)
      emit.call(recipient_profile_id: guest, type: "like", target_resource_id: SecureRandom.uuid_v7, actor_profile_id: cast)

      act_as(guest)

      expect(notifications.notifications.map { |n| [n.latest_actor.profile_id, n.latest_actor.is_private] })
        .to contain_exactly([private_cast, true], [cast, false])
    end

    it "lists a recipient's notifications with the latest actor and marks them read" do
      first = emit.call(recipient_profile_id: guest, type: "like", target_resource_id: SecureRandom.uuid_v7, actor_profile_id: cast)
      emit.call(recipient_profile_id: guest, type: "follow", target_resource_id: cast, actor_profile_id: cast)
      emit.call(recipient_profile_id: outsider, type: "like", target_resource_id: SecureRandom.uuid_v7, actor_profile_id: cast)
      expect(db[:notifications__notifications].where(id: first[:id]).select_map([:recipient_profile_id, :latest_actor_profile_id])).to eq([[guest, cast]])

      act_as(guest)
      listed = notifications
      expect(listed.notifications.map { |n| [n.latest_actor.profile_id, n.latest_actor.role] }).to eq([[cast, 2], [cast, 2]])
      expect(listed.notifications.map(&:latest_actor)).to all(be_a(::Profile::V1::ProfileSummary))
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

    it "lists a quote notification with the quote type and the original post" do
      post_id = SecureRandom.uuid_v7
      emit.call(recipient_profile_id: guest, type: "quote", target_resource_id: post_id, actor_profile_id: cast, target_post_id: post_id)

      act_as(guest)

      expect(notifications.notifications.map { |n| [n.type, n.target_post_id] }).to eq([[:NOTIFICATION_TYPE_QUOTE, post_id]])
    end

    it "does not let a profile mark another profile's notification as read" do
      mine = emit.call(recipient_profile_id: guest, type: "like", target_resource_id: SecureRandom.uuid_v7, actor_profile_id: cast)

      act_as(outsider)
      rpc(Notifications::Grpc::NotificationHandler, :mark_read, Notifications::V1::MarkReadRequest.new(id: mine[:id]))

      act_as(guest)
      expect(unread).to eq(1)
    end

    it "stores preferences per profile and still lists the notification of a kind turned off" do
      act_as(guest)
      current = rpc(Notifications::Grpc::NotificationHandler, :get_notification_preferences, Notifications::V1::GetNotificationPreferencesRequest.new).preferences
      expect(current.like).to be true

      muted = Notifications::V1::NotificationPreferences.new(**current.to_h.merge(like: false))
      updated = rpc(Notifications::Grpc::NotificationHandler, :update_notification_preferences, Notifications::V1::UpdateNotificationPreferencesRequest.new(preferences: muted)).preferences

      expect(updated.like).to be false
      expect(db[:notifications__preferences].select_map(:profile_id)).to eq([guest])
      expect(emit.call(recipient_profile_id: guest, type: "like", target_resource_id: SecureRandom.uuid_v7, actor_profile_id: cast)).not_to be_nil
      expect(emit.call(recipient_profile_id: outsider, type: "like", target_resource_id: SecureRandom.uuid_v7, actor_profile_id: cast)).not_to be_nil
    end
  end
end
