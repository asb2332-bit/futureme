namespace :futureme do
  desc "Purge uploaded photos and voice notes that were never sealed into a capsule (older than 1 day)"
  task purge_unattached_uploads: :environment do
    purged = 0

    ActiveStorage::Blob.unattached.where(created_at: ...1.day.ago).find_each do |blob|
      blob.purge
      purged += 1
    end

    puts "Purged #{purged} unattached upload#{'s' unless purged == 1}."
  end
end
