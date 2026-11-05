class Capsule < ApplicationRecord
  validates :title, :message, :unlock_at, presence: true
  validate :unlock_at_is_in_the_future, on: :create
  validate :valid_poster_design

  def unlocked?
    unlock_at <= Time.current
  end

  def locked?
    !unlocked?
  end

  private

  def valid_poster_design
    PosterDesign.new(design).validation_errors.each do |message|
      errors.add(:design, message)
    end
  end

  def unlock_at_is_in_the_future
    errors.add(:unlock_at, "must be in the future") if unlock_at.present? && unlock_at <= Time.current
  end
end
