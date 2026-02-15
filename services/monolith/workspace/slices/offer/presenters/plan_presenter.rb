# frozen_string_literal: true

module Offer
  module Presenters
    class PlanPresenter
      def self.to_proto(plan)
        return nil unless plan

        ::Offer::V1::Plan.new(
          id: plan.id.to_s,
          name: plan.name,
          price: plan.price || 0,
          duration_minutes: plan.duration_minutes,
          is_recommended: plan.is_recommended || false
        )
      end

      def self.many_to_proto(plans)
        (plans || []).map { |p| to_proto(p) }
      end
    end
  end
end
