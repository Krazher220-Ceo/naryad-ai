package kz.naryadai.app

import android.app.Application
import kz.naryadai.app.data.Api
import kz.naryadai.app.data.Repository
import kz.naryadai.app.data.Session

// Общие объекты приложения: вход, сеть и данные. Создаются один раз при запуске.
object Graph {
    lateinit var session: Session
        private set
    lateinit var api: Api
        private set
    lateinit var repo: Repository
        private set

    fun init(app: Application) {
        session = Session(app)
        api = Api(session)
        repo = Repository(app, session, api)
    }
}

class NaryadApp : Application() {
    override fun onCreate() {
        super.onCreate()
        Graph.init(this)
    }
}
