# frozen_string_literal: true

require "concerns/cursor_pagination"

module Profile
  module Repositories
    class ProfileRepository < Profile::DB::Repo
      include ::Concerns::CursorPagination

      commands :create, update: :by_pk

      def find_by_account_id(account_id)
        profiles.by_pk(account_id).one
      end

      def find_by_username(username)
        return nil if username.nil? || username.strip.empty?

        profiles.where { Sequel.function(:lower, :username) =~ username.downcase }.one
      end

      def username_available?(username, exclude_account_id: nil)
        return false if username.nil? || username.strip.empty?

        scope = profiles.where { Sequel.function(:lower, :username) =~ username.downcase }
        scope = scope.exclude(account_id: exclude_account_id) if exclude_account_id
        !scope.exist?
      end

      def upsert(account_id:, attrs:)
        if profiles.by_pk(account_id).exist?
          update(account_id, attrs.merge(updated_at: Time.now))
        else
          create(attrs.merge(account_id: account_id))
        end
      end

      def save_areas(account_id:, area_ids:)
        transaction do
          profile_areas.where(profile_id: account_id).delete
          (area_ids || []).each do |area_id|
            profile_areas.changeset(:create, profile_id: account_id, area_id: area_id).commit
          end
        end
      end

      def find_area_ids(account_id)
        profile_areas.where(profile_id: account_id).pluck(:area_id)
      end

      # Cross-slice query for feed AREA tab. Returns account_ids whose
      # profile.prefecture matches the input. NULL prefecture rows are
      # naturally excluded (Sequel where uses = which doesn't match NULL).
      # is_private (account 鍵) follow-gate is NOT applied here — that is
      # the social slice's responsibility, deferred per feed spec.
      def account_ids_by_prefecture(prefecture)
        return [] if prefecture.nil? || prefecture.to_s.empty?

        profiles.where(prefecture: prefecture).pluck(:account_id)
      end

      def save_media(account_id:, avatar_media_id: nil, cover_media_id: nil)
        attrs = {}
        attrs[:avatar_media_id] = avatar_media_id unless avatar_media_id.nil?
        attrs[:cover_media_id] = cover_media_id unless cover_media_id.nil?
        return if attrs.empty?

        update(account_id, attrs.merge(updated_at: Time.now))
      end

      # Newest-first profiles for the suggested-users feature.
      # role_filter: nil = no filter, 1 = guest only, 2 = cast only (subquery against identity.users).
      # exclude_account_ids: viewer self + already-following + bidirectionally-blocked.
      # Cursor pagination over (created_at, account_id) — same shape as search_by_query.
      def list_recent(limit:, cursor: nil, exclude_account_ids: [], role_filter: nil)
        scope = profiles
        scope = scope.exclude(account_id: exclude_account_ids) unless exclude_account_ids.empty?

        if role_filter && [1, 2].include?(role_filter)
          scope = scope.where(
            account_id: profiles.dataset.db[:identity__users].where(role: role_filter).select(:id)
          )
        end

        if cursor
          decoded = decode_cursor(cursor)
          if decoded
            scope = scope.where {
              (created_at < decoded[:created_at]) |
                ((created_at =~ decoded[:created_at]) & (account_id < decoded[:id]))
            }
          end
        end

        scope.order { [created_at.desc, account_id.desc] }.limit(limit + 1).to_a
      end

      # Cross-slice query for discovery slice. Case-insensitive partial match
      # on username or display_name. Cursor pagination over (created_at, account_id)
      # — profiles has no separate id column, account_id is the PK.
      # role_filter: nil/0 = no filter, 1 = guest only, 2 = cast only.
      # Implemented via subquery against identity.users (account.id == users.id).
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

        if role_filter && [1, 2].include?(role_filter)
          scope = scope.where(
            account_id: profiles.dataset.db[:identity__users].where(role: role_filter).select(:id)
          )
        end

        if cursor
          decoded = decode_cursor(cursor)
          if decoded
            scope = scope.where {
              (created_at < decoded[:created_at]) |
                ((created_at =~ decoded[:created_at]) & (account_id < decoded[:id]))
            }
          end
        end

        scope.order { [created_at.desc, account_id.desc] }.limit(limit + 1).to_a
      end

      def delete_profile_areas_by_account(account_id)
        profile_areas.where(profile_id: account_id).delete
      end

      def delete_by_account(account_id)
        profiles.dataset.where(account_id: account_id).delete
      end
    end
  end
end
