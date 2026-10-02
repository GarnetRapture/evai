package evai.android.graphics

import android.graphics.Path
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.ceil
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.sqrt
import kotlin.math.tan

class SvgPathParser(private val data: String) {
    private var index = 0
    private val path = Path()
    private var currentX = 0f
    private var currentY = 0f
    private var startX = 0f
    private var startY = 0f
    private var controlX = 0f
    private var controlY = 0f
    private var previousCommand = ' '

    fun parse(): Path {
        var command = ' '
        while (true) {
            skipSeparators()
            if (index >= data.length) {
                break
            }
            val character = data[index]
            if (character.isLetter()) {
                command = character
                index += 1
            } else if (command == ' ') {
                throw IllegalArgumentException("path data must start with a command: $data")
            }
            applyCommand(command)
            previousCommand = command
            if (command == 'M') {
                command = 'L'
            } else if (command == 'm') {
                command = 'l'
            }
        }
        return path
    }

    private fun applyCommand(command: Char) {
        val relative = command.isLowerCase()
        val originX = if (relative) currentX else 0f
        val originY = if (relative) currentY else 0f
        when (command.uppercaseChar()) {
            'M' -> {
                currentX = originX + number()
                currentY = originY + number()
                startX = currentX
                startY = currentY
                path.moveTo(currentX, currentY)
                resetControl()
            }
            'L' -> {
                currentX = originX + number()
                currentY = originY + number()
                path.lineTo(currentX, currentY)
                resetControl()
            }
            'H' -> {
                currentX = originX + number()
                path.lineTo(currentX, currentY)
                resetControl()
            }
            'V' -> {
                currentY = originY + number()
                path.lineTo(currentX, currentY)
                resetControl()
            }
            'C' -> {
                val x1 = originX + number()
                val y1 = originY + number()
                val x2 = originX + number()
                val y2 = originY + number()
                val x = originX + number()
                val y = originY + number()
                path.cubicTo(x1, y1, x2, y2, x, y)
                controlX = x2
                controlY = y2
                currentX = x
                currentY = y
            }
            'S' -> {
                val reflect = previousCommand.uppercaseChar() == 'C' || previousCommand.uppercaseChar() == 'S'
                val x1 = if (reflect) 2 * currentX - controlX else currentX
                val y1 = if (reflect) 2 * currentY - controlY else currentY
                val x2 = originX + number()
                val y2 = originY + number()
                val x = originX + number()
                val y = originY + number()
                path.cubicTo(x1, y1, x2, y2, x, y)
                controlX = x2
                controlY = y2
                currentX = x
                currentY = y
            }
            'Q' -> {
                val x1 = originX + number()
                val y1 = originY + number()
                val x = originX + number()
                val y = originY + number()
                path.quadTo(x1, y1, x, y)
                controlX = x1
                controlY = y1
                currentX = x
                currentY = y
            }
            'T' -> {
                val reflect = previousCommand.uppercaseChar() == 'Q' || previousCommand.uppercaseChar() == 'T'
                val x1 = if (reflect) 2 * currentX - controlX else currentX
                val y1 = if (reflect) 2 * currentY - controlY else currentY
                val x = originX + number()
                val y = originY + number()
                path.quadTo(x1, y1, x, y)
                controlX = x1
                controlY = y1
                currentX = x
                currentY = y
            }
            'A' -> {
                val radiusX = abs(number())
                val radiusY = abs(number())
                val rotation = number()
                val largeArc = flag()
                val sweep = flag()
                val x = originX + number()
                val y = originY + number()
                arcTo(radiusX, radiusY, rotation, largeArc, sweep, x, y)
                currentX = x
                currentY = y
                resetControl()
            }
            'Z' -> {
                path.close()
                currentX = startX
                currentY = startY
                resetControl()
            }
            else -> throw IllegalArgumentException("unsupported path command $command in $data")
        }
    }

    private fun resetControl() {
        controlX = currentX
        controlY = currentY
    }

    private fun arcTo(radiusX: Float, radiusY: Float, rotationDegrees: Float, largeArc: Boolean, sweep: Boolean, x: Float, y: Float) {
        if (radiusX == 0f || radiusY == 0f || (x == currentX && y == currentY)) {
            path.lineTo(x, y)
            return
        }
        val phi = rotationDegrees * PI / 180.0
        val cosPhi = cos(phi)
        val sinPhi = sin(phi)
        val halfDx = (currentX - x) / 2.0
        val halfDy = (currentY - y) / 2.0
        val x1 = cosPhi * halfDx + sinPhi * halfDy
        val y1 = -sinPhi * halfDx + cosPhi * halfDy
        var rx = radiusX.toDouble()
        var ry = radiusY.toDouble()
        val lambda = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry)
        if (lambda > 1) {
            rx *= sqrt(lambda)
            ry *= sqrt(lambda)
        }
        val numerator = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1
        val denominator = rx * rx * y1 * y1 + ry * ry * x1 * x1
        val coefficient = (if (largeArc == sweep) -1.0 else 1.0) * sqrt((numerator / denominator).coerceAtLeast(0.0))
        val centerXPrime = coefficient * rx * y1 / ry
        val centerYPrime = -coefficient * ry * x1 / rx
        val centerX = cosPhi * centerXPrime - sinPhi * centerYPrime + (currentX + x) / 2.0
        val centerY = sinPhi * centerXPrime + cosPhi * centerYPrime + (currentY + y) / 2.0
        val startAngle = atan2((y1 - centerYPrime) / ry, (x1 - centerXPrime) / rx)
        var deltaAngle = atan2((-y1 - centerYPrime) / ry, (-x1 - centerXPrime) / rx) - startAngle
        if (sweep && deltaAngle < 0) {
            deltaAngle += 2 * PI
        } else if (!sweep && deltaAngle > 0) {
            deltaAngle -= 2 * PI
        }
        val segments = ceil(abs(deltaAngle) / (PI / 2)).toInt().coerceAtLeast(1)
        val step = deltaAngle / segments
        val handle = 4.0 / 3.0 * tan(step / 4)
        var angle = startAngle
        for (segment in 0 until segments) {
            val cosStart = cos(angle)
            val sinStart = sin(angle)
            val nextAngle = angle + step
            val cosEnd = cos(nextAngle)
            val sinEnd = sin(nextAngle)
            val p1x = rx * (cosStart - handle * sinStart)
            val p1y = ry * (sinStart + handle * cosStart)
            val p2x = rx * (cosEnd + handle * sinEnd)
            val p2y = ry * (sinEnd - handle * cosEnd)
            val endX = rx * cosEnd
            val endY = ry * sinEnd
            path.cubicTo(
                (cosPhi * p1x - sinPhi * p1y + centerX).toFloat(),
                (sinPhi * p1x + cosPhi * p1y + centerY).toFloat(),
                (cosPhi * p2x - sinPhi * p2y + centerX).toFloat(),
                (sinPhi * p2x + cosPhi * p2y + centerY).toFloat(),
                (cosPhi * endX - sinPhi * endY + centerX).toFloat(),
                (sinPhi * endX + cosPhi * endY + centerY).toFloat(),
            )
            angle = nextAngle
        }
    }

    private fun skipSeparators() {
        while (index < data.length && (data[index].isWhitespace() || data[index] == ',')) {
            index += 1
        }
    }

    private fun flag(): Boolean {
        skipSeparators()
        if (index >= data.length || (data[index] != '0' && data[index] != '1')) {
            throw IllegalArgumentException("expected an arc flag at $index in $data")
        }
        val value = data[index] == '1'
        index += 1
        return value
    }

    private fun number(): Float {
        skipSeparators()
        val start = index
        if (index < data.length && (data[index] == '-' || data[index] == '+')) {
            index += 1
        }
        var seenDot = false
        var seenExponent = false
        while (index < data.length) {
            val character = data[index]
            when {
                character.isDigit() -> index += 1
                character == '.' && !seenDot && !seenExponent -> {
                    seenDot = true
                    index += 1
                }
                (character == 'e' || character == 'E') && !seenExponent -> {
                    seenExponent = true
                    index += 1
                    if (index < data.length && (data[index] == '-' || data[index] == '+')) {
                        index += 1
                    }
                }
                else -> break
            }
        }
        if (start == index) {
            throw IllegalArgumentException("expected a number at $index in $data")
        }
        return data.substring(start, index).toFloat()
    }
}
