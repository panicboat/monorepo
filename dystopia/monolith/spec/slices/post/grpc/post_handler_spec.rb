# frozen_string_literal: true

require "spec_helper"
require "lib/current"
require "slices/post/grpc/post_handler"

RSpec.describe Post::Grpc::PostHandler, type: :database do
  let(:db) { Hanami.app.slices[:post]["db.rom"].gateways[:default].connection }
  let(:profile_repo) { Hanami.app.slices[:profile]["repositories.profile_repository"] }
  let(:notification_repo) { Hanami.app.slices[:notifications]["repositories.notification_repository"] }
  let(:author_id) { create_account }
  let(:mentioned_id) { create_account }

  def create_account(role: 1)
    id = SecureRandom.uuid_v7
    db[:identity__accounts].insert(id: id, role: role, created_at: Time.now, updated_at: Time.now)
    id
  end

  after { Current.clear }

  describe "#save_post mentions" do
    let(:handler) do
      described_class.new(method_key: :save_post, service: double, rpc_desc: double, active_call: double, message: message)
    end
    let(:message) do
      Post::V1::SavePostRequest.new(id: "", content: "hi @mentioned_user", visibility: "public")
    end

    before do
      profile_repo.create(account_id: mentioned_id, display_name: "Mentioned", username: "mentioned_user")
      Current.user_id = author_id
    end

    it "includes the resolved mention in the response" do
      response = handler.save_post

      expect(response.post.mentions.length).to eq(1)
      expect(response.post.mentions.first.account_id).to eq(mentioned_id)
      expect(response.post.mentions.first.username).to eq("mentioned_user")
    end

    it "emits a mention notification on create" do
      handler.save_post

      notifications = notification_repo.list(recipient_id: mentioned_id)
      expect(notifications.map(&:type)).to include("mention")
    end

    it "does not emit a mention notification on edit" do
      created = handler.save_post

      edit_message = Post::V1::SavePostRequest.new(id: created.post.id, content: "hi @mentioned_user again", visibility: "public")
      edit_handler = described_class.new(method_key: :save_post, service: double, rpc_desc: double, active_call: double, message: edit_message)
      edit_handler.save_post

      notifications = notification_repo.list(recipient_id: mentioned_id)
      expect(notifications.map(&:type).count("mention")).to eq(1)
    end

    it "collapses repeated mentions of the same account into a single notification" do
      repeated_message = Post::V1::SavePostRequest.new(id: "", content: "@mentioned_user @mentioned_user", visibility: "public")
      repeated_handler = described_class.new(method_key: :save_post, service: double, rpc_desc: double, active_call: double, message: repeated_message)

      repeated_handler.save_post

      notifications = notification_repo.list(recipient_id: mentioned_id)
      expect(notifications.length).to eq(1)
      expect(notifications.first.actor_count).to eq(1)
    end
  end
end
