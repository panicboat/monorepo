# frozen_string_literal: true

require "securerandom"
require "concerns/cursor_pagination"

module Profile
  module Repositories
    class ProfileRepository < Profile::DB::Repo
      include ::Concerns::CursorPagination

      UUID_FORMAT = /\A\h{8}-\h{4}-\h{4}-\h{4}-\h{12}\z/

      commands :create, update: :by_pk

      def find_by_id(id)
        return nil unless uuid?(id)

        profiles.by_pk(id).one
      end

      def find_by_username(username)
        return nil if username.nil? || username.strip.empty?

        profiles.where { Sequel.function(:lower, :username) =~ username.downcase }.one
      end

      def list_by_account(account_id)
        return [] unless uuid?(account_id)

        profiles.where(account_id: account_id).order { [created_at.asc, id.asc] }.to_a
      end

      def enabled_ids_by_account(account_id)
        return [] unless uuid?(account_id)

        profiles.where(account_id: account_id, disabled_at: nil).pluck(:id)
      end

      def username_available?(username, exclude_profile_id: nil)
        return false if username.nil? || username.strip.empty?

        scope = profiles.where { Sequel.function(:lower, :username) =~ username.downcase }
        scope = scope.exclude(id: exclude_profile_id) if exclude_profile_id
        !scope.exist?
      end

      def create_within_limit(account_id:, limit:, attrs:)
        profiles.dataset.db.transaction do
          # Lock the account row so concurrent creations cannot both pass the count check.
          profiles.dataset.db[:identity__accounts].where(id: account_id).for_update.first
          next nil if profiles.where(account_id: account_id).count >= limit

          create(attrs.merge(id: SecureRandom.uuid_v7, account_id: account_id))
        end
      end

      def find_owned(account_id:, profile_id:)
        return nil unless uuid?(account_id) && uuid?(profile_id)

        profiles.where(id: profile_id, account_id: account_id).one
      end

      def disable_unless_last_enabled(account_id:, profile_id:)
        profiles.dataset.db.transaction do
          # Lock the account row so concurrent disables cannot both leave the account without an enabled profile.
          profiles.dataset.db[:identity__accounts].where(id: account_id).for_update.first
          next nil if profiles.where(account_id: account_id, disabled_at: nil).exclude(id: profile_id).count.zero?

          update(profile_id, disabled_at: Time.now, updated_at: Time.now)
        end
      end

      def enable(profile_id)
        update(profile_id, disabled_at: nil, updated_at: Time.now)
      end

      def update_profile(id, attrs)
        update(id, attrs.merge(updated_at: Time.now))
      end

      def profile_ids_by_prefecture(prefecture)
        return [] if prefecture.nil? || prefecture.to_s.empty?

        profiles.where(prefecture: prefecture).pluck(:id)
      end

      def save_media(profile_id:, avatar_media_id: nil, cover_media_id: nil)
        attrs = {}
        attrs[:avatar_media_id] = avatar_media_id unless avatar_media_id.nil?
        attrs[:cover_media_id] = cover_media_id unless cover_media_id.nil?
        return if attrs.empty?

        update(profile_id, attrs.merge(updated_at: Time.now))
      end

      def list_recent(limit:, cursor: nil, exclude_profile_ids: [], role_filter: nil)
        scope = profiles
        scope = scope.exclude(id: exclude_profile_ids) unless exclude_profile_ids.empty?
        scope = filter_by_role(scope, role_filter)
        scope = apply_cursor(scope, cursor)

        scope.order { [created_at.desc, id.desc] }.limit(limit + 1).to_a
      end

      def search_by_query(query:, limit: 20, cursor: nil, role_filter: nil)
        q = query.to_s.strip
        return [] if q.empty?

        pattern = "%#{q}%"
        scope = profiles.where(
          Sequel.|(
            Sequel.lit("username ILIKE ?", pattern),
            Sequel.lit("display_name ILIKE ?", pattern)
          )
        )
        scope = filter_by_role(scope, role_filter)
        scope = apply_cursor(scope, cursor)

        scope.order { [created_at.desc, id.desc] }.limit(limit + 1).to_a
      end

      def role_of(profile_id)
        profile = find_by_id(profile_id)
        return nil unless profile

        profiles.dataset.db[:identity__accounts].where(id: profile.account_id).get(:role)
      end

      def delete(id)
        profiles.dataset.where(id: id).delete
      end

      private

      def uuid?(value)
        UUID_FORMAT.match?(value.to_s)
      end

      def filter_by_role(scope, role_filter)
        return scope unless role_filter && [1, 2].include?(role_filter)

        scope.where(
          account_id: profiles.dataset.db[:identity__accounts].where(role: role_filter).select(:id)
        )
      end

      def apply_cursor(scope, cursor)
        return scope unless cursor

        decoded = decode_cursor(cursor)
        return scope unless decoded

        scope.where {
          (created_at < decoded[:created_at]) |
            ((created_at =~ decoded[:created_at]) & (id < decoded[:id]))
        }
      end
    end
  end
end
