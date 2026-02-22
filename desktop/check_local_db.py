import sqlite3
import json
import os
import re

db_path = os.path.join(os.path.dirname(__file__), 'church_songs.db')
conn = sqlite3.connect(db_path)
cur = conn.cursor()

# Get schema
cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = [r[0] for r in cur.fetchall()]
print(f"Tables: {tables}")

if 'songs' in tables:
    cur.execute("PRAGMA table_info(songs)")
    columns = [row[1] for row in cur.fetchall()]
    print(f"Columns: {columns}")
    
    cur.execute("SELECT * FROM songs LIMIT 1")
    print(f"Row 1: {cur.fetchone()}")

    cur.execute("SELECT * FROM songs")
    all_local_songs = cur.fetchall()

    def is_english(title):
        if not title: return False
        return bool(re.match(r"^[a-zA-Z\s0-9.,!?'-:;()\"’]+$", str(title).strip()))

    idx_id = 0
    idx_cat = 1
    idx_title = 3
    idx_num = 4

    local_english_songs = [s for s in all_local_songs if is_english(s[idx_title])]
    print(f"Local English Songs: {len(local_english_songs)}")
    print("Local English Sample:", [(s[idx_id], s[idx_title]) for s in local_english_songs[:5]])

    # Export to json 
    out_path = os.path.join(os.path.dirname(__file__), 'local_english_songs.json')
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump([
            {
                "id": s[idx_id],
                "title": str(s[idx_title]).strip() if s[idx_title] is not None else "",
                "category": str(s[idx_cat]).strip() if s[idx_cat] is not None else "",
                "song_number": str(s[idx_num]).strip() if s[idx_num] is not None else ""
            } for s in local_english_songs
        ], f, indent=2)

conn.close()
