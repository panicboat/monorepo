# frozen_string_literal: true

require "spec_helper"
require "lib/current"
require "errors/validation_error"
require "slices/post/grpc/post_handler"
require "slices/media/grpc/handler"
require "slices/messaging/grpc/messaging_handler"

RSpec.describe "Values the API accepts only within what the screens send", type: :database do
  let(:db) { Hanami.app["db.gateway"].connection }
  let(:profile) { create_account_with_profile(username: "input_owner") }

  after { Current.clear }

  def act_as(profile_id)
    Current.account_id = db[:profile__profiles].where(id: profile_id).get(:account_id)
    Current.profile_id = profile_id
  end

  def rpc(handler_class, method, message)
    handler_class.new(method_key: method, service: double, rpc_desc: double, active_call: double, message: message).public_send(method)
  end

  def invalid_argument = raise_error(GRPC::BadStatus) { |e| expect(e.code).to eq(GRPC::Core::StatusCodes::INVALID_ARGUMENT) }

  it "refuses a post visibility other than public and private" do
    act_as(profile)

    expect { rpc(Post::Grpc::PostHandler, :save_post, Post::V1::SavePostRequest.new(content: "hi", visibility: "Private")) }.to invalid_argument
    expect(db[:post__posts].where(author_profile_id: profile).count).to eq(0)
    expect(rpc(Post::Grpc::PostHandler, :save_post, Post::V1::SavePostRequest.new(content: "hi", visibility: "private")).post.visibility).to eq("private")
  end

  it "issues upload urls only for images and videos" do
    act_as(profile)
    request = ->(content_type) { Media::V1::GetUploadUrlRequest.new(filename: "a.bin", content_type: content_type, media_type: :MEDIA_TYPE_IMAGE) }

    expect { rpc(Media::Grpc::Handler, :get_upload_url, request.call("text/html")) }.to invalid_argument
    expect { rpc(Media::Grpc::Handler, :get_upload_url, request.call("application/javascript")) }.to invalid_argument
    expect(rpc(Media::Grpc::Handler, :get_upload_url, request.call("image/png")).media_id).not_to be_empty
    expect(rpc(Media::Grpc::Handler, :get_upload_url, request.call("video/mp4")).media_id).not_to be_empty
  end

  it "refuses to read a thread up to a message of another thread" do
    other = create_account_with_profile(username: "input_other")
    third = create_account_with_profile(username: "input_third")
    repo = Messaging::Slice["repositories.messaging_repository"]
    thread = repo.upsert_thread(profile_a: [profile, other].min, profile_b: [profile, other].max)
    elsewhere = repo.upsert_thread(profile_a: [other, third].min, profile_b: [other, third].max)
    foreign = repo.insert_message(thread_id: elsewhere[:id], sender_profile_id: third, content: "elsewhere")
    act_as(profile)

    expect { rpc(Messaging::Grpc::MessagingHandler, :mark_read, Messaging::V1::MarkReadRequest.new(thread_id: thread[:id], message_id: foreign[:id])) }.to invalid_argument
    expect(db[:messaging__read_states].where(thread_id: thread[:id]).count).to eq(0)
  end

  it "refuses a schedule date that does not exist when deleting or listing" do
    delete = Schedule::Slice["use_cases.delete_schedule"]
    list = Schedule::Slice["use_cases.list_schedules"]

    expect { delete.call(profile_id: profile, work_date: "2026-02-30") }.to raise_error(Errors::ValidationError, "予定日の形式が正しくありません")
    expect { list.call(profile_id: profile, viewer_profile_id: profile, from_date: "2026-13-01", to_date: "2026-13-31") }.to raise_error(Errors::ValidationError)
  end
end
