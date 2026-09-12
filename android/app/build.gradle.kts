import groovy.json.JsonSlurper
import javax.inject.Inject

plugins {
    id("com.android.application")
}

abstract class SyncWebDistTask : DefaultTask() {
    @get:InputDirectory
    abstract val webDistDirectory: DirectoryProperty

    @get:OutputDirectory
    abstract val outputDirectory: DirectoryProperty

    @get:Inject
    abstract val fileSystemOperations: FileSystemOperations

    @TaskAction
    fun synchronize() {
        fileSystemOperations.sync {
            from(webDistDirectory)
            into(outputDirectory)
        }
    }
}

val webProjectDirectory: Directory = rootProject.layout.projectDirectory.dir("..")
val webPackageVersion: String = (JsonSlurper().parse(webProjectDirectory.file("package.json").asFile) as Map<*, *>)["version"] as String
val webPackageVersionParts: List<Int> = webPackageVersion.split(".").map { it.toInt() }
val npmExecutable: String = if (System.getProperty("os.name").lowercase().contains("windows")) "npm.cmd" else "npm"

val buildWebApp = tasks.register<Exec>("buildWebApp") {
    group = "build"
    workingDir = webProjectDirectory.asFile
    commandLine(npmExecutable, "run", "build")
}

val syncWebDist = tasks.register<SyncWebDistTask>("syncWebDist") {
    dependsOn(buildWebApp)
    webDistDirectory.set(webProjectDirectory.dir("dist"))
    outputDirectory.set(layout.buildDirectory.dir("generated/webDist"))
}

android {
    namespace = "pro.everlib.ai"
    compileSdk = 37

    defaultConfig {
        applicationId = "pro.everlib.ai"
        minSdk = 26
        targetSdk = 37
        versionCode = webPackageVersionParts[0] * 10000 + webPackageVersionParts[1] * 100 + webPackageVersionParts[2]
        versionName = webPackageVersion
        ndk {
            abiFilters += listOf("arm64-v8a", "x86_64")
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

androidComponents {
    onVariants { variant ->
        variant.sources.assets?.addGeneratedSourceDirectory(syncWebDist, SyncWebDistTask::outputDirectory)
    }
}

dependencies {
    implementation("com.google.ai.edge.litertlm:litertlm-android:0.17.0")
    implementation("com.google.ai.edge.aicore:aicore:0.0.1-exp02")
    implementation("androidx.activity:activity-ktx:1.13.0")
    implementation("androidx.core:core-ktx:1.19.0")
    implementation("androidx.webkit:webkit:1.17.0")
    implementation("androidx.documentfile:documentfile:1.1.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.11.0")
}
