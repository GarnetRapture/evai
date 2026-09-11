package pro.everlib.ai.bridge

class BridgeException(val code: String, val detail: String) : Exception("$code: $detail")
