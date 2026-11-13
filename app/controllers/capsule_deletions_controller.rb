class CapsuleDeletionsController < ApplicationController
  before_action :require_login

  def create
    capsule = current_user.capsules.find(params[:id])
    media = capsule.images.blobs.to_a + capsule.audio.blobs.to_a + capsule.video.blobs.to_a
    capsule.destroy!
    media.each(&:purge)
    redirect_to "/index.html", notice: "Capsule deleted."
  end
end
