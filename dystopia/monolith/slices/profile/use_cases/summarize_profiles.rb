# frozen_string_literal: true

module Profile
  module UseCases
    class SummarizeProfiles
      Summary = Data.define(:profile_id, :username, :display_name, :avatar_url, :is_private, :role, :industry)

      include Deps["repositories.profile_repository"]

      def initialize(media_adapter: nil, **deps)
        super(**deps)
        @media_adapter = media_adapter
      end

      def call(profile_ids:)
        ids = Array(profile_ids).compact.map(&:to_s).uniq
        rows = profile_repository.visible_by_ids(ids)
        return {} if rows.empty?

        roles = profile_repository.roles_by_account_ids(rows.map { |row| row[:account_id].to_s }.uniq)
        avatars = media_adapter.find_by_ids(rows.filter_map { |row| row[:avatar_media_id] unless row[:avatar_media_id].to_s.empty? })
        by_id = rows.to_h { |row| [row[:id].to_s, row] }

        ids.each_with_object({}) do |id, summaries|
          row = by_id[id]
          next unless row

          summaries[id] = Summary.new(
            profile_id: id,
            username: row[:username] || "",
            display_name: row[:display_name] || "",
            avatar_url: avatars[row[:avatar_media_id]]&.url || "",
            is_private: row[:is_private] ? true : false,
            role: roles[row[:account_id].to_s] || 0,
            industry: row[:industry] || ""
          )
        end
      end

      private

      def media_adapter
        @media_adapter ||= Profile::Adapters::MediaAdapter.new
      end
    end
  end
end
