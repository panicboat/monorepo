# frozen_string_literal: true

module Profile
  module UseCases
    class ListAreas
      include Deps["repositories.area_repository"]

      def call(prefecture: nil)
        if prefecture && !prefecture.to_s.empty?
          area_repository.list_by_prefecture(prefecture)
        else
          area_repository.list_all
        end
      end
    end
  end
end
