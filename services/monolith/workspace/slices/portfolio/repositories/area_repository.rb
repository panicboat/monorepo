module Portfolio
  module Repositories
    class AreaRepository < Portfolio::DB::Repo
      def list_all
        areas.where(active: true).order(:sort_order).to_a
      end

      def list_by_prefecture(prefecture)
        areas.where(active: true, prefecture: prefecture).order(:sort_order).to_a
      end

      def find_by_code(code)
        areas.where(code: code).one
      end

      def find_by_ids(ids)
        return [] if ids.nil? || ids.empty?
        areas.where(id: ids).to_a
      end
    end
  end
end
