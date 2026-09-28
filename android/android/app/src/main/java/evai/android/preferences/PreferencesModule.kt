package evai.android.preferences

import android.content.Context
import android.content.SharedPreferences
import com.facebook.react.bridge.ReactApplicationContext
import evai.android.specs.NativeEvaiPreferencesSpec

class PreferencesModule(context: ReactApplicationContext) : NativeEvaiPreferencesSpec(context) {
    private val preferences: SharedPreferences = context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)

    override fun readString(key: String): String? = preferences.getString(key, null)

    override fun writeString(key: String, value: String) {
        preferences.edit().putString(key, value).apply()
    }

    override fun remove(key: String) {
        preferences.edit().remove(key).apply()
    }

    override fun clear() {
        preferences.edit().clear().apply()
    }

    companion object {
        private const val PREFERENCES_NAME = "evai.preferences"
    }
}
