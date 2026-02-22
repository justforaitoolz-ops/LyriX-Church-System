import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), 'church_songs.db')
conn = sqlite3.connect(db_path)
cur = conn.cursor()

cur.execute("SELECT song_id, title FROM songs WHERE category = 'English Choruses' LIMIT 5")
print("Local English Choruses Sample:")
for row in cur.fetchall():
    print(row)

conn.close()
