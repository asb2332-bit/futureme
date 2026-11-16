class AddOpenedAtToCapsules < ActiveRecord::Migration[7.1]
  def change
    add_column :capsules, :opened_at, :datetime
  end
end
