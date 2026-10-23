# frozen_string_literal: true

require "spec_helper"

RSpec.describe Notifications::UseCases::SendPush, type: :database do
  let(:fake_sender_class) do
    Class.new do
      attr_accessor :enabled, :outcomes
      attr_reader :deliveries

      def initialize
        @enabled = true
        @outcomes = {}
        @deliveries = Queue.new
      end

      def enabled?
        @enabled
      end

      def deliver(endpoint:, p256dh:, auth:, payload:, urgency:)
        @deliveries << { endpoint: endpoint, payload: JSON.parse(payload), urgency: urgency }
        outcome = @outcomes.fetch(endpoint, :delivered)
        raise outcome if outcome.is_a?(Exception)

        outcome
      end

      def sent
        list = []
        list << @deliveries.pop until @deliveries.empty?
        list
      end
    end
  end

  let(:db) { Hanami.app["db.gateway"].connection }
  let(:sender) { fake_sender_class.new }
  let(:use_case) { described_class.new(web_push_sender: sender) }
  let(:subscriptions) { Notifications::Slice["repositories.push_subscription_repository"] }
  let(:update_preferences) { Notifications::Slice["use_cases.update_preferences"] }
  let(:defaults) { Notifications::UseCases::GetPreferences::DEFAULT_PREFERENCES }
  let(:recipient) { create_account_with_profile(display_name: "ゆな", username: "yuna") }
  let(:actor) { create_account_with_profile(display_name: "りん", username: "rin") }
  let(:post_id) { SecureRandom.uuid_v7 }

  def account_of(profile_id)
    db[:profile__profiles].where(id: profile_id).get(:account_id)
  end

  def endpoint(device)
    "https://fcm.googleapis.com/fcm/send/#{device}"
  end

  def subscribe(profile_id, device)
    subscriptions.upsert(account_id: account_of(profile_id), profile_id: profile_id, endpoint: endpoint(device), p256dh: "BKey", auth: "auth")
  end

  def push(kind: "like", **rest)
    use_case.call(recipient_profile_id: recipient, kind: kind, actor_profile_id: actor, post_id: post_id, **rest)
  end

  it "sends to every device registered for the recipient profile and to no one else" do
    subscribe(recipient, "phone")
    subscribe(recipient, "laptop")
    subscribe(actor, "actor-phone")

    push

    sent = sender.sent
    expect(sent.map { |d| d[:endpoint] }).to contain_exactly(endpoint("phone"), endpoint("laptop"))
    expect(sent.first[:payload]).to eq(
      "title" => "りん",
      "body" => "あなたの投稿にいいねしました",
      "url" => "/notifications/open?profile=#{recipient}&to=%2Fposts%2F#{post_id}"
    )
    expect(sent.map { |d| d[:urgency] }).to all(eq("normal"))
  end

  it "sends only to the devices registered for the recipient profile" do
    sibling = create_account_with_profile(account_id: account_of(recipient), display_name: "別名")
    subscribe(recipient, "phone")
    subscribe(sibling, "laptop")

    push

    expect(sender.sent.map { |d| d[:endpoint] }).to eq([endpoint("phone")])
  end

  it "sends a direct message urgently with its text and thread" do
    subscribe(recipient, "phone")

    use_case.call(recipient_profile_id: recipient, kind: "message", actor_profile_id: actor, thread_id: "thread-1", excerpt: "明日空いてますか？")

    expect(sender.sent).to contain_exactly(
      hash_including(urgency: "high", payload: hash_including("body" => "明日空いてますか？", "url" => "/notifications/open?profile=#{recipient}&to=%2Fmessages%2Fthread-1"))
    )
  end

  it "names the recipient profile only on a device shared by several profiles" do
    sibling = create_account_with_profile(account_id: account_of(recipient), display_name: "別名")
    subscribe(recipient, "shared")
    subscribe(sibling, "shared")
    subscribe(recipient, "single")
    real_builder = Notifications::Slice["use_cases.build_push_message"]
    shared_flags = []
    builder = double(:build_push_message)
    allow(builder).to receive(:call) do |**args|
      shared_flags << args[:shared_device]
      real_builder.call(**args)
    end

    described_class.new(web_push_sender: sender, build_push_message: builder)
      .call(recipient_profile_id: recipient, kind: "like", actor_profile_id: actor, post_id: post_id)

    titles = sender.sent.to_h { |d| [d[:endpoint], d[:payload]["title"]] }
    expect(titles).to eq(endpoint("shared") => "りん → ゆな", endpoint("single") => "りん")
    expect(shared_flags).to contain_exactly(true, false)
  end

  it "sends nothing for a kind the profile turned off, using the follow setting for both follow kinds" do
    subscribe(recipient, "phone")
    update_preferences.call(profile_id: recipient, preferences: defaults.merge(like: false, follow: false))

    push(kind: "like")
    push(kind: "follow_request")
    push(kind: "follow")
    push(kind: "comment", excerpt: "かわいい")

    expect(sender.sent.map { |d| d[:payload]["body"] }).to eq(["あなたの投稿にコメントしました：かわいい"])
  end

  it "sends nothing when push is not configured" do
    subscribe(recipient, "phone")
    sender.enabled = false

    push

    expect(sender.sent).to be_empty
  end

  it "sends nothing for a hidden recipient or from a hidden actor" do
    subscribe(recipient, "phone")
    db[:identity__accounts].where(id: account_of(actor)).update(deactivated_at: Time.now)
    push
    expect(sender.sent).to be_empty

    db[:identity__accounts].where(id: account_of(actor)).update(deactivated_at: nil)
    db[:profile__profiles].where(id: recipient).update(disabled_at: Time.now)
    push
    expect(sender.sent).to be_empty
  end

  it "drops the subscriptions the push service reports gone and keeps the rest" do
    subscribe(recipient, "phone")
    subscribe(recipient, "laptop")
    sender.outcomes = { endpoint("phone") => :gone, endpoint("laptop") => :failed }

    push

    expect(subscriptions.list_by_profile(recipient).map(&:endpoint)).to eq([endpoint("laptop")])
  end

  it "raises nothing when a device fails unexpectedly" do
    subscribe(recipient, "phone")
    sender.outcomes = { endpoint("phone") => RuntimeError.new("boom") }

    expect(push).to be_nil
  end
end
