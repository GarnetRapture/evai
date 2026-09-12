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
        externalNativeBuild {
            cmake {
                arguments += listOf("-DEVERSOUL_ENABLE_LITERT=ON", "-DANDROID_STL=c++_shared")
                cppFlags += "-std=c++2b"
            }
        }
    }

    externalNativeBuild {
        cmake {
            path = file("src/main/cpp/CMakeLists.txt")
            version = "3.31.6+"
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

val litertRuntimeVersion = "2.2.0"
val litertNativeConfiguration = configurations.create("litertNativeRuntime") {
    isCanBeConsumed = false
    isCanBeResolved = true
}

val extractLiteRtNativeLibraries = tasks.register<Copy>("extractLiteRtNativeLibraries") {
    val jniLibsDir = layout.projectDirectory.dir("src/main/jniLibs")
    dependsOn(litertNativeConfiguration)
    from({
        litertNativeConfiguration.resolvedConfiguration.resolvedArtifacts
            .filter { it.file.name.endsWith(".aar") }
            .map { zipTree(it.file).matching { include("jni/**/libLiteRt.so") } }
    })
    eachFile {
        path = path.removePrefix("jni/")
    }
    includeEmptyDirs = false
    into(jniLibsDir)
}

tasks.named("preBuild") {
    dependsOn(extractLiteRtNativeLibraries)
}

dependencies {
    add("litertNativeRuntime", "com.google.ai.edge.litert:litert:$litertRuntimeVersion")
    implementation("androidx.activity:activity-ktx:1.13.0")
    implementation("androidx.core:core-ktx:1.19.0")
    implementation("androidx.webkit:webkit:1.17.0")
    implementation("androidx.documentfile:documentfile:1.1.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.11.0")
}
