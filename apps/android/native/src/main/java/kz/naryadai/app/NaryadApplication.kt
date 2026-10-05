package kz.naryadai.app

import android.app.Application
import android.content.Context
import android.content.res.Configuration
import kz.naryadai.app.data.local.AppDatabase
import kz.naryadai.app.data.local.SessionManager
import kz.naryadai.app.data.remote.MobileApiClient
import kz.naryadai.app.data.remote.SupabaseManager
import kz.naryadai.app.data.repository.OrderRepository
import java.util.Locale

class NaryadApplication : Application() {
    lateinit var sessionManager: SessionManager
        private set
    lateinit var database: AppDatabase
        private set
    lateinit var supabaseManager: SupabaseManager
        private set
    lateinit var mobileApiClient: MobileApiClient
        private set
    lateinit var orderRepository: OrderRepository
        private set

    override fun onCreate() {
        super.onCreate()
        instance = this

        sessionManager = SessionManager(this)
        database = AppDatabase.getInstance(this)
        supabaseManager = SupabaseManager(sessionManager)
        mobileApiClient = MobileApiClient(sessionManager)
        orderRepository = OrderRepository(
            context = this,
            database = database,
            supabaseManager = supabaseManager,
            mobileApiClient = mobileApiClient,
            sessionManager = sessionManager
        )

        applyLocale(sessionManager.language)
    }

    fun applyLocale(langCode: String) {
        val locale = Locale(langCode)
        Locale.setDefault(locale)
        val config = Configuration(resources.configuration)
        config.setLocale(locale)
        resources.updateConfiguration(config, resources.displayMetrics)
    }

    companion object {
        lateinit var instance: NaryadApplication
            private set

        fun get(context: Context): NaryadApplication {
            return context.applicationContext as NaryadApplication
        }
    }
}
