# frozen_string_literal: true

require "spec_helper"
require "lib/current"
require "lib/interceptors/authentication_interceptor"
require "slices/profile/grpc/profile_handler"

RSpec.describe "Profile lifecycle RPCs", type: :database do
  let(:db) { Hanami.app["db.gateway"].connection }
  let(:repo) { Hanami.app.slices[:profile]["repositories.profile_repository"] }

  let(:account_id) { create_account(role: 2) }
  let!(:first) { create_account_with_profile(account_id: account_id, username: "lifecycle_first") }
  let!(:second) { create_account_with_profile(account_id: account_id, username: "lifecycle_second") }
  let(:stranger) { create_account_with_profile(role: 2, username: "lifecycle_stranger") }

  def rpc(method, message)
    Profile::Grpc::ProfileHandler.new(method_key: method, service: double, rpc_desc: double, active_call: double, message: message).public_send(method)
  end

  def status(code)
    raise_error(GRPC::BadStatus) { |e| expect(e.code).to eq(code) }
  end

  def disable(profile_id)
    rpc(:disable_profile, Profile::V1::DisableProfileRequest.new(profile_id: profile_id))
  end

  def enable(profile_id)
    rpc(:enable_profile, Profile::V1::EnableProfileRequest.new(profile_id: profile_id))
  end

  def delete(profile_id)
    rpc(:delete_profile, Profile::V1::DeleteProfileRequest.new(profile_id: profile_id))
  end

  def disabled?(profile_id)
    !db[:profile__profiles].where(id: profile_id).get(:disabled_at).nil?
  end

  def acting_as(profile_id)
    request = double(:request, metadata: { "x-user-id" => account_id, "x-profile-id" => profile_id }, context: {})
    Interceptors::AuthenticationInterceptor.new(request, double(:error)).call { yield }
  end

  def expect_account_lock
    expect_any_instance_of(Profile::Repositories::ProfileRepository)
      .to receive(:locking_account).with(account_id).at_least(:once).and_call_original
  end

  before { Current.account_id = account_id }
  after { Current.clear }

  describe "DisableProfile" do
    it "disables a profile of the account without an acting profile and stops it from acting" do
      expect_account_lock

      response = disable(first)

      expect([response.profile.id, response.profile.disabled]).to eq([first, true])
      expect([disabled?(first), disabled?(second)]).to eq([true, false])
      expect {
        acting_as(first) { rpc(:save_profile_media, Profile::V1::SaveProfileMediaRequest.new) }
      }.to status(GRPC::Core::StatusCodes::PERMISSION_DENIED)
    end

    it "refuses to disable the last enabled profile" do
      disable(first)

      expect { disable(second) }.to status(GRPC::Core::StatusCodes::FAILED_PRECONDITION)
      expect(disabled?(second)).to be false
    end

    it "answers NOT_FOUND for a profile of another account and leaves it enabled" do
      expect { disable(stranger) }.to status(GRPC::Core::StatusCodes::NOT_FOUND)
      expect(disabled?(stranger)).to be false
    end

    it "keeps a disabled profile disabled, with its original time, when asked again" do
      disable(first)
      disabled_at = db[:profile__profiles].where(id: first).get(:disabled_at)

      expect(disable(first).profile.disabled).to be true
      expect(db[:profile__profiles].where(id: first).get(:disabled_at)).to eq(disabled_at)
    end

    it "answers NOT_FOUND for an empty or malformed profile id" do
      expect { disable("") }.to status(GRPC::Core::StatusCodes::NOT_FOUND)
      expect { disable("not-a-uuid") }.to status(GRPC::Core::StatusCodes::NOT_FOUND)
    end

    it "requires an account" do
      Current.clear

      expect { disable(first) }.to status(GRPC::Core::StatusCodes::UNAUTHENTICATED)
    end
  end

  describe "EnableProfile" do
    it "enables a disabled profile of the account so that it can act again" do
      disable(first)
      expect_account_lock

      response = enable(first)

      expect([response.profile.id, response.profile.disabled]).to eq([first, false])
      expect(disabled?(first)).to be false
      expect(acting_as(first) { rpc(:get_profile, Profile::V1::GetProfileRequest.new).profile.id }).to eq(first)
    end

    it "returns an enabled profile unchanged" do
      response = enable(first)

      expect([response.profile.id, response.profile.disabled]).to eq([first, false])
    end

    it "answers NOT_FOUND for a profile of another account and leaves it disabled" do
      db[:profile__profiles].where(id: stranger).update(disabled_at: Time.now)

      expect { enable(stranger) }.to status(GRPC::Core::StatusCodes::NOT_FOUND)
      expect(disabled?(stranger)).to be true
    end
  end

  describe "DeleteProfile" do
    let(:post_repo) { Post::Slice["repositories.post_repository"] }
    let(:karte_entries) { Karte::Slice["repositories.entry_repository"] }

    it "refuses to delete an enabled profile" do
      expect { delete(first) }.to status(GRPC::Core::StatusCodes::FAILED_PRECONDITION)
      expect(repo.find_by_id(first)).not_to be_nil
    end

    it "answers NOT_FOUND for a profile of another account and leaves it in place" do
      db[:profile__profiles].where(id: stranger).update(disabled_at: Time.now)

      expect { delete(stranger) }.to status(GRPC::Core::StatusCodes::NOT_FOUND)
      expect(repo.find_by_id(stranger)).not_to be_nil
    end

    it "deletes a disabled profile with its rows in other slices, frees its username and keeps the account's karte record" do
      post_repo.create_post(author_profile_id: first, content: "by first", visibility: "public")
      kept_post = post_repo.create_post(author_profile_id: second, content: "by second", visibility: "public")
      Social::Slice["repositories.follow_repository"].follow(follower_profile_id: first, followee_profile_id: stranger, status: "approved")
      record = karte_entries.create(
        author_account_id: account_id, author_profile_id: first, target_profile_id: stranger, rating: 3, body: "note"
      )
      disable(first)
      expect_account_lock

      delete(first)

      expect(db[:profile__profiles].where(account_id: account_id).select_map(:id)).to eq([second])
      expect(db[:post__posts].select_map(:id)).to eq([kept_post.id])
      expect(db[:social__follows].count).to eq(0)
      expect(repo.username_available?("lifecycle_first")).to be true
      mine = Karte::Slice["use_cases.list_my_entries"].call(viewer_account_id: account_id)
      expect(mine[:entries].map { |entry| entry[:id] }).to eq([record.id])
    end
  end
end
