import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.ksp)
}

val localProperties = Properties()
val rootLocalPropertiesFile = rootProject.file("local.properties")
if (rootLocalPropertiesFile.exists()) {
    rootLocalPropertiesFile.inputStream().use { localProperties.load(it) }
}
val nativeLocalPropertiesFile = file("local.properties")
if (nativeLocalPropertiesFile.exists()) {
    nativeLocalPropertiesFile.inputStream().use { localProperties.load(it) }
}

val supabaseUrl = localProperties.getProperty("SUPABASE_URL")
    ?: System.getenv("SUPABASE_URL")
    ?: System.getenv("NEXT_PUBLIC_SUPABASE_URL")
    ?: "https://example.supabase.co"

val supabaseAnonKey = localProperties.getProperty("SUPABASE_ANON_KEY")
    ?: System.getenv("SUPABASE_ANON_KEY")
    ?: System.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    ?: "dummy-anon-key"

val webAppUrl = localProperties.getProperty("WEB_APP_URL")
    ?: System.getenv("WEB_APP_URL")
    ?: "https://naryad-ai.vercel.app"

android {
    namespace = "kz.naryadai.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "kz.naryadai.app"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables {
            useSupportLibrary = true
        }

        buildConfigField("String", "SUPABASE_URL", "\"$supabaseUrl\"")
        buildConfigField("String", "SUPABASE_ANON_KEY", "\"$supabaseAnonKey\"")
        buildConfigField("String", "WEB_APP_URL", "\"$webAppUrl\"")
    }

    signingConfigs {
        getByName("debug") {
            val keystoreFile = file("${rootDir}/debug.keystore")
            if (keystoreFile.exists()) {
                storeFile = keystoreFile
                storePassword = "android"
                keyAlias = "androiddebugkey"
                keyPassword = "android"
            }
        }
    }

    buildTypes {
        debug {
            signingConfig = signingConfigs.getByName("debug")
        }
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_21
        targetCompatibility = JavaVersion.VERSION_21
    }

    kotlin {
        jvmToolchain(21)
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.navigation.compose)

    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.material.icons.extended)

    // Room
    implementation(libs.androidx.room.runtime)
    implementation(libs.androidx.room.ktx)
    ksp(libs.androidx.room.compiler)

    // Supabase
    implementation(platform(libs.supabase.bom))
    implementation(libs.supabase.auth)
    implementation(libs.supabase.postgrest)
    implementation(libs.supabase.realtime)
    implementation(libs.supabase.storage)

    // Ktor
    implementation(libs.ktor.client.okhttp)
    implementation(libs.ktor.client.content.negotiation)
    implementation(libs.ktor.serialization.kotlinx.json)

    // Serialization & Coroutines
    implementation(libs.kotlinx.serialization.json)
    implementation(libs.kotlinx.coroutines.android)

    // Image loading
    implementation(libs.coil.compose)

    debugImplementation(libs.androidx.compose.ui.tooling)
}
