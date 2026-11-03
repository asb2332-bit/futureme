class AddDesignToCapsules < ActiveRecord::Migration[7.1]
  def change
    add_column :capsules, :design, :jsonb, null: false, default: {}
  end
end
