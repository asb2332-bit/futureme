class AddCapsuleEditors < ActiveRecord::Migration[7.1]
  def change
    add_column :capsules, :lock_version, :integer, null: false, default: 0
    create_table :capsule_editors do |t|
      t.references :capsule, null: false, foreign_key: { on_delete: :cascade }
      t.references :user, null: false, foreign_key: { on_delete: :cascade }
      t.index [:capsule_id, :user_id], unique: true
    end
  end
end
