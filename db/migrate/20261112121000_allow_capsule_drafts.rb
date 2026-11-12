class AllowCapsuleDrafts < ActiveRecord::Migration[7.1]
  def change
    add_column :capsules, :draft, :boolean, default: false, null: false
    change_column_null :capsules, :unlock_at, true
  end
end
