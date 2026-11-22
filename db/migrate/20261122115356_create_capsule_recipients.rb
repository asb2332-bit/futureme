class CreateCapsuleRecipients < ActiveRecord::Migration[7.1]
  def change
    create_table :capsule_recipients do |t|
      t.references :capsule, null: false, foreign_key: true
      t.string :email, null: false
      t.datetime :sealed_sent_at
      t.datetime :unlocked_sent_at

      t.timestamps
    end
    add_index :capsule_recipients, [:capsule_id, :email], unique: true
  end
end
