// AI-generated (Claude)
package expo.modules.httpserver

import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.BufferedInputStream
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.io.InputStream
import java.io.OutputStream
import java.net.Inet4Address
import java.net.InetSocketAddress
import java.net.NetworkInterface
import java.net.ServerSocket
import java.net.Socket
import java.util.concurrent.CompletableFuture
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.TimeoutException
import java.util.concurrent.atomic.AtomicInteger

// The Android counterpart of ios/HttpServerModule.swift: a plain HTTP/1.1
// listener that hands every request to JS as an `onRequest` event and writes
// back what JS answers through `respond`. One request per connection.
class HttpServerModule : Module() {
  private var server: HttpListener? = null

  override fun definition() = ModuleDefinition {
    Name("HttpServer")

    Events("onRequest", "onStop")

    AsyncFunction("start") { port: Int, promise: Promise ->
      server?.stop()
      val listener = HttpListener(
        onRequest = { request -> sendEvent("onRequest", request) },
        onStop = { message -> sendEvent("onStop", mapOf("error" to message)) },
      )
      server = listener
      try {
        promise.resolve(listener.start(port))
      } catch (error: IOException) {
        server = null
        promise.reject("ERR_HTTP_LISTEN", error.message ?: "Cannot listen on port $port", error)
      }
    }

    AsyncFunction("stop") {
      server?.stop()
      server = null
    }

    // The headers are JS's to choose; only the framing ones (Content-Length,
    // Connection) are written here.
    Function("respond") { id: String, status: Int, headers: Map<String, String>, body: String ->
      server?.respond(id, Response(status, headers, body.toByteArray(Charsets.UTF_8)))
    }

    Function("addresses") {
      interfaceAddresses()
    }

    OnDestroy {
      server?.stop()
    }
  }
}

/** Requests whose body is larger than this are refused with 413. */
private const val MAX_REQUEST_BYTES = 1 shl 20

/** How long JS gets to answer before the client is sent a 504. */
private const val RESPONSE_TIMEOUT_SECONDS = 60L

private class Response(val status: Int, val headers: Map<String, String>, val body: ByteArray)

private class BadRequest(val status: Int, message: String) : Exception(message)

private class HttpListener(
  private val onRequest: (Map<String, Any>) -> Unit,
  private val onStop: (String?) -> Unit,
) {
  private var socket: ServerSocket? = null
  private val workers: ExecutorService = Executors.newCachedThreadPool()
  private val pending = ConcurrentHashMap<String, CompletableFuture<Response>>()
  private val nextId = AtomicInteger(0)
  @Volatile private var stopped = false

  /** Binds and starts accepting; returns the port bound. 0 picks any free one. */
  fun start(port: Int): Int {
    val server = ServerSocket()
    server.reuseAddress = true
    server.bind(InetSocketAddress(port))
    socket = server
    workers.execute {
      try {
        while (!stopped) {
          val client = server.accept()
          workers.execute { serve(client) }
        }
      } catch (error: IOException) {
        if (!stopped) {
          stopped = true
          onStop(error.message)
        }
      }
    }
    return server.localPort
  }

  fun stop() {
    stopped = true
    try {
      socket?.close()
    } catch (_: IOException) {
    }
    pending.values.forEach { it.cancel(true) }
    pending.clear()
    workers.shutdownNow()
  }

  fun respond(id: String, response: Response) {
    pending.remove(id)?.complete(response)
  }

  private fun serve(client: Socket) {
    client.use {
      client.soTimeout = 30_000
      val input = BufferedInputStream(client.getInputStream())
      val output = client.getOutputStream()
      val response = try {
        val request = readRequest(input, output)
        val id = nextId.incrementAndGet().toString()
        val future = CompletableFuture<Response>()
        pending[id] = future
        onRequest(request + ("id" to id))
        try {
          future.get(RESPONSE_TIMEOUT_SECONDS, TimeUnit.SECONDS)
        } catch (_: TimeoutException) {
          pending.remove(id)
          text(504, "No response")
        }
      } catch (error: BadRequest) {
        text(error.status, error.message ?: "Bad request")
      } catch (_: Exception) {
        return
      }
      try {
        write(output, response)
      } catch (_: IOException) {
      }
    }
  }
}

private fun text(status: Int, message: String) =
  Response(status, mapOf("Content-Type" to "text/plain"), "$message\n".toByteArray(Charsets.UTF_8))

/** Reads one request: the head up to the blank line, then Content-Length bytes. */
private fun readRequest(input: InputStream, output: OutputStream): Map<String, Any> {
  val head = ByteArrayOutputStream()
  var matched = 0
  val terminator = byteArrayOf('\r'.code.toByte(), '\n'.code.toByte(), '\r'.code.toByte(), '\n'.code.toByte())
  while (matched < 4) {
    val byte = input.read()
    if (byte < 0) throw IOException("Connection closed")
    head.write(byte)
    matched = if (byte.toByte() == terminator[matched]) matched + 1 else if (byte == '\r'.code) 1 else 0
    if (head.size() > 16 * 1024) throw BadRequest(413, "Request head too large")
  }
  val lines = head.toString(Charsets.UTF_8.name()).split("\r\n")
  val requestLine = lines.first().split(" ")
  if (requestLine.size != 3 || !requestLine[2].startsWith("HTTP/1.")) {
    throw BadRequest(400, "Bad request line")
  }
  val headers = mutableMapOf<String, String>()
  for (line in lines.drop(1)) {
    val colon = line.indexOf(':')
    if (colon <= 0) continue
    headers[line.substring(0, colon).trim().lowercase()] = line.substring(colon + 1).trim()
  }
  if (headers.containsKey("transfer-encoding")) {
    throw BadRequest(501, "Chunked request bodies are not supported")
  }
  val length = headers["content-length"]?.toIntOrNull() ?: if (headers.containsKey("content-length")) -1 else 0
  if (length < 0) throw BadRequest(400, "Bad Content-Length")
  if (length > MAX_REQUEST_BYTES) throw BadRequest(413, "Request too large")
  if (length > 0 && headers["expect"]?.lowercase() == "100-continue") {
    output.write("HTTP/1.1 100 Continue\r\n\r\n".toByteArray(Charsets.US_ASCII))
    output.flush()
  }
  val body = ByteArray(length)
  var read = 0
  while (read < length) {
    val count = input.read(body, read, length - read)
    if (count < 0) throw IOException("Connection closed")
    read += count
  }
  return mapOf(
    "method" to requestLine[0],
    "path" to requestLine[1],
    "headers" to headers,
    "body" to String(body, Charsets.UTF_8),
  )
}

private fun write(output: OutputStream, response: Response) {
  val head = StringBuilder()
  // Clients read the status code, not the phrase; RFC 9112 lets it be anything.
  head.append("HTTP/1.1 ${response.status} ${if (response.status < 400) "OK" else "Error"}\r\n")
  for ((name, value) in response.headers) head.append("$name: $value\r\n")
  head.append("Content-Length: ${response.body.size}\r\nConnection: close\r\n\r\n")
  output.write(head.toString().toByteArray(Charsets.US_ASCII))
  output.write(response.body)
  output.flush()
}

private fun interfaceAddresses(): List<Map<String, String>> {
  val result = mutableListOf<Map<String, String>>()
  val interfaces = NetworkInterface.getNetworkInterfaces() ?: return result
  for (network in interfaces) {
    if (!network.isUp || network.isLoopback) continue
    for (address in network.inetAddresses) {
      if (address is Inet4Address) {
        result.add(mapOf("name" to network.name, "address" to (address.hostAddress ?: continue)))
      }
    }
  }
  return result
}
