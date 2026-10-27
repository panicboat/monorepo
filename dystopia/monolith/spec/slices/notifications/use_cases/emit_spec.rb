# frozen_string_literal: true

require "spec_helper"

RSpec.describe Notifications::UseCases::Emit, type: :database do
  let(:send_push) { double(:send_push, call: nil) }
  let(:use_case) { described_class.new(send_push: send_push) }
  let(:notification_repo) { Notifications::Slice["repositories.notification_repository"] }
  let(:update_preferences) { Notifications::Slice["use_cases.update_preferences"] }
  let(:defaults) { Notifications::UseCases::GetPreferences::DEFAULT_PREFERENCES }
  let(:recipient_profile_id) { create_account_with_profile }
  let(:actor_profile_id) { create_account_with_profile }
  let(:target_resource_id) { SecureRandom.uuid_v7 }

  def emit(type: "mention", **rest)
    use_case.call(recipient_profile_id: recipient_profile_id, type: type, target_resource_id: target_resource_id, actor_profile_id: actor_profile_id, **rest)
  end

  it "lists the notification even when the recipient turned that kind off for devices" do
    update_preferences.call(profile_id: recipient_profile_id, preferences: defaults.merge(mention: false))

    expect(emit).not_to be_nil
    expect(notification_repo.list(recipient_profile_id: recipient_profile_id).map(&:type)).to eq(["mention"])
  end

  it "hands the event to the device push with its post and text" do
    post_id = SecureRandom.uuid_v7

    emit(type: "reply", target_post_id: post_id, excerpt: "ありがとう")

    expect(send_push).to have_received(:call).with(
      recipient_profile_id: recipient_profile_id, kind: "reply", actor_profile_id: actor_profile_id, post_id: post_id, excerpt: "ありがとう"
    )
  end

  it "uses the liked post as the post of a like" do
    emit(type: "like")

    expect(send_push).to have_received(:call).with(hash_including(kind: "like", post_id: target_resource_id, excerpt: nil))
  end

  describe "aggregating the actors of one notification" do
    let(:other_actor_profile_id) { create_account_with_profile }

    def emit_from(actor, type: "like", target_post_id: nil)
      use_case.call(recipient_profile_id: recipient_profile_id, type: type, target_resource_id: target_resource_id, actor_profile_id: actor, target_post_id: target_post_id)
    end

    def rows
      notification_repo.list(recipient_profile_id: recipient_profile_id)
    end

    %w[like follow].each do |type|
      it "counts a repeated #{type} actor once and neither reopens the row nor pushes again" do
        emit_from(actor_profile_id, type: type)
        Notifications::Slice["use_cases.mark_all_read"].call(recipient_profile_id: recipient_profile_id)

        expect(emit_from(actor_profile_id, type: type)).to be_nil

        expect(rows.map { |row| [row.actor_count, row.latest_actor_profile_id] }).to eq([[1, actor_profile_id]])
        expect(rows.first.read_at).not_to be_nil
        expect(send_push).to have_received(:call).once
      end
    end

    %w[comment reply mention].each do |type|
      it "counts a repeated #{type} actor once but reopens the row, moves it to the new post and pushes again" do
        first_post_id = SecureRandom.uuid_v7
        second_post_id = SecureRandom.uuid_v7
        emit_from(actor_profile_id, type: type, target_post_id: first_post_id)
        Notifications::Slice["use_cases.mark_all_read"].call(recipient_profile_id: recipient_profile_id)
        first_event_at = rows.first.latest_event_at

        expect(emit_from(actor_profile_id, type: type, target_post_id: second_post_id)).not_to be_nil

        row = rows.first
        expect([row.actor_count, row.actor_profile_ids, row.latest_actor_profile_id, row.target_post_id])
          .to eq([1, [actor_profile_id], actor_profile_id, second_post_id])
        expect(row.read_at).to be_nil
        expect(row.latest_event_at).to be > first_event_at
        expect(send_push).to have_received(:call).twice
      end
    end

    it "counts a commenter who returns after another commenter once and makes them the latest actor" do
      emit_from(actor_profile_id, type: "comment")
      emit_from(other_actor_profile_id, type: "comment")
      emit_from(actor_profile_id, type: "comment")

      expect(rows.map { |row| [row.actor_count, row.latest_actor_profile_id] }).to eq([[2, actor_profile_id]])
      expect(rows.first.actor_profile_ids).to contain_exactly(actor_profile_id, other_actor_profile_id)
    end

    it "counts each distinct actor and keeps the latest one" do
      emit_from(actor_profile_id)
      emit_from(other_actor_profile_id)

      expect(rows.map { |row| [row.actor_count, row.latest_actor_profile_id] }).to eq([[2, other_actor_profile_id]])
      expect(send_push).to have_received(:call).twice
    end

    it "counts an actor who returns after another actor only once" do
      emit_from(actor_profile_id)
      emit_from(other_actor_profile_id)
      emit_from(actor_profile_id)

      expect(rows.map { |row| [row.actor_count, row.latest_actor_profile_id] }).to eq([[2, other_actor_profile_id]])
    end
  end

  it "neither lists nor pushes a notification to oneself or from a blocked profile" do
    use_case.call(recipient_profile_id: recipient_profile_id, type: "like", target_resource_id: target_resource_id, actor_profile_id: recipient_profile_id)
    Social::Slice["repositories.block_repository"].block(blocker_profile_id: recipient_profile_id, blocked_profile_id: actor_profile_id)
    emit

    expect(notification_repo.list(recipient_profile_id: recipient_profile_id)).to be_empty
    expect(send_push).not_to have_received(:call)
  end
end
