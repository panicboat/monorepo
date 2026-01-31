module Portfolio
  module Repositories
    class GenreRepository < Portfolio::DB::Repo
      def list_all
        genres.where(is_active: true).order(:display_order).to_a
      end

      def find_by_id(id)
        genres.where(id: id).one
      end

      def find_by_ids(ids)
        return [] if ids.nil? || ids.empty?
        genres.where(id: ids).to_a
      end

      def find_by_slug(slug)
        genres.where(slug: slug).one
      end
    end
  end
end
