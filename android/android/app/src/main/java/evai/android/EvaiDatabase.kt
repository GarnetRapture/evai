package evai.android

import android.content.Context
import android.content.ContentValues
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import android.database.DatabaseUtils
import org.json.JSONObject

class EvaiDatabase(context: Context) : SQLiteOpenHelper(context, "eversoul-ai-chat.db", null, 1) {
    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL("CREATE TABLE records (store TEXT NOT NULL, record_key TEXT NOT NULL, value TEXT NOT NULL, persona_id TEXT, room_id TEXT, created_at TEXT, updated_at TEXT, memory_type TEXT, language TEXT, PRIMARY KEY (store, record_key))")
        db.execSQL("CREATE INDEX records_store ON records (store)")
        db.execSQL("CREATE INDEX records_rooms_by_persona ON records (persona_id, updated_at) WHERE store = 'chat_room'")
        db.execSQL("CREATE INDEX records_messages_by_room ON records (room_id, created_at) WHERE store = 'chat_message'")
        db.execSQL("CREATE INDEX records_messages_by_persona ON records (persona_id, created_at) WHERE store = 'chat_message'")
        db.execSQL("CREATE INDEX records_memory_by_persona_type ON records (persona_id, memory_type, created_at) WHERE store = 'persona_memory'")
        db.execSQL("CREATE INDEX records_prompts_by_language ON records (language) WHERE store = 'persona_localized_prompt'")
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        throw IllegalStateException("Database migration required from $oldVersion to $newVersion")
    }

    fun read(store: String, key: String): String? {
        readableDatabase.rawQuery(
            "SELECT value FROM records WHERE store = ? AND record_key = ?",
            arrayOf(store, key),
        ).use { cursor ->
            return if (cursor.moveToFirst()) cursor.getString(0) else null
        }
    }

    fun list(store: String): List<String> {
        val records = ArrayList<String>()
        readableDatabase.rawQuery(
            "SELECT value FROM records WHERE store = ? ORDER BY record_key",
            arrayOf(store),
        ).use { cursor ->
            while (cursor.moveToNext()) records.add(cursor.getString(0))
        }
        return records
    }

    fun listRoomsForPersona(personaId: String): List<String> = queryValues(
        "SELECT value FROM records WHERE store = 'chat_room' AND persona_id = ? ORDER BY updated_at DESC, record_key",
        arrayOf(personaId),
    )

    fun listMessagesForRoom(roomId: String): List<String> = queryValues(
        "SELECT value FROM records WHERE store = 'chat_message' AND room_id = ? ORDER BY created_at, record_key",
        arrayOf(roomId),
    )

    fun listMessagesForPersona(personaId: String): List<String> = queryValues(
        "SELECT value FROM records WHERE store = 'chat_message' AND persona_id = ? ORDER BY created_at, record_key",
        arrayOf(personaId),
    )

    private fun queryValues(sql: String, args: Array<String>): List<String> {
        val records = ArrayList<String>()
        readableDatabase.rawQuery(sql, args).use { cursor ->
            while (cursor.moveToNext()) records.add(cursor.getString(0))
        }
        return records
    }

    fun count(store: String): Long = DatabaseUtils.longForQuery(
        readableDatabase,
        "SELECT COUNT(*) FROM records WHERE store = ?",
        arrayOf(store),
    )

    fun write(store: String, key: String, value: String) {
        val record = JSONObject(value)
        fun field(name: String): String? = if (record.has(name) && !record.isNull(name)) record.getString(name) else null
        val columns = ContentValues().apply {
            put("store", store)
            put("record_key", key)
            put("value", value)
            put("persona_id", field("persona_id"))
            put("room_id", field("room_id"))
            put("created_at", field("created_at"))
            put("updated_at", field("updated_at"))
            put("memory_type", field("memory_type"))
            put("language", field("language"))
        }
        val result = writableDatabase.insertWithOnConflict("records", null, columns, SQLiteDatabase.CONFLICT_REPLACE)
        check(result != -1L) { "Could not save $store record" }
    }

    fun writePair(firstStore: String, firstKey: String, firstValue: String, secondStore: String, secondKey: String, secondValue: String) {
        writeAll(listOf(Triple(firstStore, firstKey, firstValue), Triple(secondStore, secondKey, secondValue)))
    }

    fun writeAll(writes: List<Triple<String, String, String>>) {
        val db = writableDatabase
        db.beginTransactionNonExclusive()
        try {
            for ((store, key, value) in writes) {
                write(store, key, value)
            }
            db.setTransactionSuccessful()
        } finally {
            db.endTransaction()
        }
    }

    fun remove(store: String, key: String) {
        writableDatabase.execSQL(
            "DELETE FROM records WHERE store = ? AND record_key = ?",
            arrayOf(store, key),
        )
    }
}
