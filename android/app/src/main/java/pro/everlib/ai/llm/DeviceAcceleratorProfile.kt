package pro.everlib.ai.llm

import android.os.Build

enum class AcceleratorVendor { QUALCOMM, MEDIATEK, GOOGLE_TENSOR, GENERIC }

data class DeviceAcceleratorProfile(
    val vendor: AcceleratorVendor,
    val socModel: String,
    val socMatchKeys: List<String>,
)

object DeviceAcceleratorDetector {
    fun detect(): DeviceAcceleratorProfile {
        val socModel = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) Build.SOC_MODEL.orEmpty() else ""
        val hardware = Build.HARDWARE.orEmpty()
        val board = Build.BOARD.orEmpty()
        val combined = listOf(socModel, hardware, board).joinToString(" ").lowercase()
        return when {
            combined.contains("qcom") || combined.contains("snapdragon") || Regex("sm\\d{4}|qcs\\d{3,4}").containsMatchIn(combined) ->
                DeviceAcceleratorProfile(AcceleratorVendor.QUALCOMM, socModel, qualcommKeys(combined, socModel))
            combined.contains("mt6") || combined.contains("mediatek") || combined.contains("dimensity") ->
                DeviceAcceleratorProfile(AcceleratorVendor.MEDIATEK, socModel, mediatekKeys(combined, socModel))
            combined.contains("tensor") || combined.contains("gs20") || combined.contains("zuma") ->
                DeviceAcceleratorProfile(AcceleratorVendor.GOOGLE_TENSOR, socModel, googleTensorKeys(combined))
            else -> DeviceAcceleratorProfile(AcceleratorVendor.GENERIC, socModel, emptyList())
        }
    }

    private fun qualcommKeys(combined: String, socModel: String): List<String> {
        val match = Regex("sm\\d{4}|qcs\\d{3,4}").find(combined)?.value ?: socModel.lowercase()
        return listOfNotNull(match.takeIf { it.isNotEmpty() })
    }

    private fun mediatekKeys(combined: String, socModel: String): List<String> {
        val match = Regex("mt\\d{4}").find(combined)?.value ?: socModel.lowercase()
        return listOfNotNull(match.takeIf { it.isNotEmpty() })
    }

    private fun googleTensorKeys(combined: String): List<String> {
        val generation = Regex("g\\d").find(combined)?.value
        return listOfNotNull(generation?.let { "google_tensor_${it}" })
    }
}
