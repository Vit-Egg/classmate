import java.net.URI
import java.util.Properties

plugins {
    id("com.android.application")
}

// Nastavení sestavení se čte z local.properties (necommitovaný soubor), z ~/.gradle/gradle.properties nebo z -P na příkazové řádce.
val local = Properties().apply {
    rootProject.file("local.properties").takeIf { it.exists() }?.inputStream()?.use { load(it) }
}

fun prop(name: String, default: String = ""): String = local.getProperty(name) ?: providers.gradleProperty(name).orNull ?: default

fun quoted(value: String) = "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"") + "\""

// Číslo verze = počet commitů, stejně jako u serveru.
val commitCount: Int = runCatching {
    providers.exec { commandLine("git", "rev-list", "--count", "HEAD") }.standardOutput.asText.get().trim().toInt()
}.getOrDefault(1)

val baseUrl = prop("classmate.baseUrl", "https://aplikace.classmate.cz").trimEnd('/')
val debugBaseUrl = prop("classmate.debugBaseUrl", baseUrl).trimEnd('/')

// Odkud aplikace zjišťuje, že vyšla nová verze (soubor latest.json). Prázdné = bez kontroly (Google Play, vlastní sestavení). Ladicí sestavení kontrolu nemá.
val updateUrl = prop("classmate.updateUrl", "https://classmate.cz/app/latest.json")

android {
    namespace = "cz.classmate.app"
    compileSdk = 36

    defaultConfig {
        applicationId = "cz.classmate.app"
        minSdk = 27
        targetSdk = 36
        versionCode = commitCount
        versionName = "1.0.$commitCount"

        // Firebase (push). Bez těchto hodnot se aplikace sestaví a funguje, jen nechodí push přes FCM.
        buildConfigField("String", "FIREBASE_PROJECT_ID", quoted(prop("firebase.projectId")))
        buildConfigField("String", "FIREBASE_APP_ID", quoted(prop("firebase.appId")))
        buildConfigField("String", "FIREBASE_API_KEY", quoted(prop("firebase.apiKey")))
        buildConfigField("String", "FIREBASE_SENDER_ID", quoted(prop("firebase.senderId")))
    }

    buildFeatures {
        buildConfig = true
    }

    signingConfigs {
        // Podpis vydání: keystore.properties (storeFile, storePassword, keyAlias, keyPassword). Soubor ani klíč se necommitují.
        val file = rootProject.file("keystore.properties")
        if (file.exists()) {
            create("release") {
                val p = Properties().apply { file.inputStream().use { load(it) } }
                storeFile = rootProject.file(p.getProperty("storeFile"))
                storePassword = p.getProperty("storePassword")
                keyAlias = p.getProperty("keyAlias")
                keyPassword = p.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        debug {
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
            buildConfigField("String", "BASE_URL", quoted(debugBaseUrl))
            buildConfigField("String", "UPDATE_URL", quoted(prop("classmate.debugUpdateUrl")))
            // ladicí sestavení má jiný název balíčku, proto vlastní Firebase aplikace (když není zadaná, použije se ta běžná)
            buildConfigField("String", "FIREBASE_APP_ID", quoted(prop("firebase.debug.appId", prop("firebase.appId"))))
            buildConfigField("String", "FIREBASE_API_KEY", quoted(prop("firebase.debug.apiKey", prop("firebase.apiKey"))))
            manifestPlaceholders["baseHost"] = URI(debugBaseUrl).host
            manifestPlaceholders["baseScheme"] = URI(debugBaseUrl).scheme
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            buildConfigField("String", "BASE_URL", quoted(baseUrl))
            buildConfigField("String", "UPDATE_URL", quoted(updateUrl))
            manifestPlaceholders["baseHost"] = URI(baseUrl).host
            manifestPlaceholders["baseScheme"] = URI(baseUrl).scheme
            signingConfigs.findByName("release")?.let { signingConfig = it }
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    lint {
        abortOnError = true
        warningsAsErrors = false
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.17.0")
    implementation("androidx.activity:activity-ktx:1.11.0")
    implementation("androidx.core:core-splashscreen:1.0.1")
    // Firebase přitahuje starý Fragment 1.1.0, který neumí ActivityResult API (registerForActivityResult)
    implementation("androidx.fragment:fragment:1.8.9")
    implementation("androidx.webkit:webkit:1.14.0")
    implementation("androidx.work:work-runtime:2.10.5")
    implementation(platform("com.google.firebase:firebase-bom:34.19.0"))
    implementation("com.google.firebase:firebase-messaging")
    testImplementation("junit:junit:4.13.2")
}
