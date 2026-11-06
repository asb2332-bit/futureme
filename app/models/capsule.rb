class Capsule < ApplicationRecord
  MEDIA_BLOCK_TYPES = %w[image audio].freeze

  has_many_attached :media

  validates :title, :message, :unlock_at, presence: true
  validate :unlock_at_is_in_the_future, on: :create
  validate :media_blocks_reference_valid_uploads, on: :create

  before_create :attach_media_blobs

  def unlocked?
    unlock_at <= Time.current
  end

  def locked?
    !unlocked?
  end

  def sealed_blocks
    blocks = design.is_a?(Hash) ? design["sealed_blocks"] : nil
    blocks.is_a?(Array) ? blocks.select { |block| block.is_a?(Hash) } : []
  end

  def media_blocks
    sealed_blocks.select { |block| MEDIA_BLOCK_TYPES.include?(block["type"]) }
  end

  # What's sealed inside, by count only. Safe to show while the capsule is locked.
  def contents
    {
      notes: sealed_blocks.count { |block| !MEDIA_BLOCK_TYPES.include?(block["type"]) },
      photos: media_blocks.count { |block| block["type"] == "image" },
      audio: media_blocks.count { |block| block["type"] == "audio" }
    }
  end

  # Sealed blocks with a `url` added to each media block (yields the blob to build the URL).
  # Only call this for unlocked capsules.
  def sealed_blocks_with_media_urls
    blobs_by_id = media.blobs.index_by(&:id)

    sealed_blocks.map do |block|
      next block unless MEDIA_BLOCK_TYPES.include?(block["type"])

      blob = blobs_by_id[ActiveStorage::Blob.find_signed(block["media_id"].to_s)&.id]
      blob ? block.merge("url" => yield(blob)) : block
    end
  end

  private

  def unlock_at_is_in_the_future
    errors.add(:unlock_at, "must be in the future") if unlock_at.present? && unlock_at <= Time.current
  end

  def media_blocks_reference_valid_uploads
    @media_blobs = []

    media_blocks.each do |block|
      signed_id = block["media_id"]
      blob = ActiveStorage::Blob.find_signed(signed_id) if signed_id.is_a?(String)

      if blob.nil? || MediaUpload.blob_error(blob, block["type"])
        errors.add(:media, "is invalid")
      else
        @media_blobs << blob
      end
    end
  end

  def attach_media_blobs
    media.attach(@media_blobs.uniq) if @media_blobs.present?
  end
end
