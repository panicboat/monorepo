# frozen_string_literal: true

module Portfolio
  module Repositories
    class GuestRepository < Portfolio::DB::Repo
      commands :create, update: :by_pk

      # PK is user_id (no separate id column)
      def find_by_id(id)
        guests.by_pk(id).one
      end

      # find_by_ids now uses user_id (which is the PK)
      def find_by_ids(ids)
        return [] if ids.nil? || ids.empty?

        guests.where(user_id: ids).to_a
      end

      # find_by_user_id is equivalent to find_by_id since PK = user_id
      def find_by_user_id(user_id)
        guests.by_pk(user_id).one
      end

      # find_by_user_ids is equivalent to find_by_ids since PK = user_id
      def find_by_user_ids(user_ids)
        return [] if user_ids.nil? || user_ids.empty?

        guests.where(user_id: user_ids).to_a
      end

      def create(attrs)
        guests.changeset(:create, attrs).commit
      end

      def update(user_id, attrs)
        guests.by_pk(user_id).changeset(:update, attrs).commit
      end
    end
  end
end
