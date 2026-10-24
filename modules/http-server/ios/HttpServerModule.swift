// AI-generated (Claude)
import ExpoModulesCore
import Network

// A plain HTTP/1.1 listener for the MCP server in Settings. Native code only
// moves bytes: it accepts a connection, reads one request, hands it to JS as an
// `onRequest` event and writes back whatever JS answers through `respond`. What
// the requests mean is TypeScript (src/lib/mcp), where it can be tested.
//
// One request per connection - every response says `Connection: close`. MCP
// clients send one JSON-RPC message per POST, so keep-alive would save little
// and cost a request parser that has to find message boundaries.
public class HttpServerModule: Module {
  private var server: HttpListener?

  public func definition() -> ModuleDefinition {
    Name("HttpServer")

    Events("onRequest", "onStop")

    // Resolves with the port actually bound once the listener is ready. 0 asks
    // the system for any free port.
    AsyncFunction("start") { (port: Int, promise: Promise) in
      self.server?.stop()
      let listener = HttpListener(
        onRequest: { [weak self] request in self?.sendEvent("onRequest", request) },
        onStop: { [weak self] message in
          self?.sendEvent("onStop", ["error": message as Any? ?? NSNull()])
        })
      self.server = listener
      listener.start(port: port, promise: promise)
    }

    AsyncFunction("stop") {
      self.server?.stop()
      self.server = nil
    }

    Function("respond") { (id: String, status: Int, contentType: String, body: String) in
      self.server?.respond(id: id, status: status, contentType: contentType, body: body)
    }

    // The device's IPv4 addresses, for the URL Settings shows. Loopback and
    // interfaces that are down are left out.
    Function("addresses") { () -> [[String: String]] in
      interfaceAddresses()
    }

    OnDestroy {
      self.server?.stop()
    }
  }
}

/** Requests whose body is larger than this are refused with 413. */
private let maxRequestBytes = 1 << 20

/** How long JS gets to answer before the client is sent a 504. */
private let responseTimeout: TimeInterval = 60

private final class HttpListener {
  private let queue = DispatchQueue(label: "codes.mani.subsurface.http-server")
  private let onRequest: ([String: Any]) -> Void
  private let onStop: (String?) -> Void
  private var listener: NWListener?
  /** Connections waiting for JS to respond, by request id. Touched on `queue` only. */
  private var pending: [String: NWConnection] = [:]
  private var nextId = 0
  private var stopped = false

  init(onRequest: @escaping ([String: Any]) -> Void, onStop: @escaping (String?) -> Void) {
    self.onRequest = onRequest
    self.onStop = onStop
  }

  func start(port: Int, promise: Promise) {
    let parameters = NWParameters.tcp
    // Lets a stop and an immediate start bind the same port again.
    parameters.allowLocalEndpointReuse = true
    let endpointPort: NWEndpoint.Port
    if port == 0 {
      endpointPort = .any
    } else if let value = NWEndpoint.Port(rawValue: UInt16(clamping: port)) {
      endpointPort = value
    } else {
      promise.reject("ERR_HTTP_PORT", "Invalid port \(port)")
      return
    }

    let listener: NWListener
    do {
      listener = try NWListener(using: parameters, on: endpointPort)
    } catch {
      promise.reject("ERR_HTTP_LISTEN", error.localizedDescription)
      return
    }
    self.listener = listener

    var settled = false
    listener.stateUpdateHandler = { [weak self] state in
      guard let self else { return }
      switch state {
      case .ready:
        if !settled {
          settled = true
          promise.resolve(Int(listener.port?.rawValue ?? 0))
        }
      case .failed(let error):
        listener.cancel()
        if !settled {
          settled = true
          promise.reject("ERR_HTTP_LISTEN", error.localizedDescription)
        } else {
          self.finish(error.localizedDescription)
        }
      case .cancelled:
        if !settled {
          settled = true
          promise.reject("ERR_HTTP_LISTEN", "The listener was cancelled")
        }
      default:
        break
      }
    }
    listener.newConnectionHandler = { [weak self] connection in
      self?.accept(connection)
    }
    listener.start(queue: queue)
  }

  func stop() {
    queue.async {
      self.stopped = true
      self.listener?.cancel()
      self.listener = nil
      for connection in self.pending.values {
        connection.cancel()
      }
      self.pending.removeAll()
    }
  }

  /** The listener died on its own (not through `stop`): tell JS once. */
  private func finish(_ message: String?) {
    if stopped { return }
    stopped = true
    for connection in pending.values {
      connection.cancel()
    }
    pending.removeAll()
    onStop(message)
  }

  func respond(id: String, status: Int, contentType: String, body: String) {
    queue.async {
      guard let connection = self.pending.removeValue(forKey: id) else { return }
      self.send(connection, status: status, contentType: contentType, body: Data(body.utf8))
    }
  }

  // MARK: - Connections

  private func accept(_ connection: NWConnection) {
    connection.stateUpdateHandler = { state in
      if case .failed = state { connection.cancel() }
    }
    connection.start(queue: queue)
    receive(connection, buffer: Data())
  }

  private func receive(_ connection: NWConnection, buffer: Data) {
    connection.receive(minimumIncompleteLength: 1, maximumLength: 64 * 1024) {
      [weak self] data, _, isComplete, error in
      guard let self else { return }
      var buffer = buffer
      if let data { buffer.append(data) }
      if error != nil {
        connection.cancel()
        return
      }
      switch parseRequest(buffer) {
      case .incomplete(let expectContinue):
        if buffer.count > maxRequestBytes + 16 * 1024 {
          self.send(connection, status: 413, contentType: "text/plain", body: Data("Request too large\n".utf8))
          return
        }
        if isComplete {
          connection.cancel()
          return
        }
        if expectContinue {
          // curl waits a second for this before sending a body over 1 KiB.
          connection.send(content: Data("HTTP/1.1 100 Continue\r\n\r\n".utf8), completion: .idempotent)
        }
        self.receive(connection, buffer: buffer)
      case .invalid(let status, let message):
        self.send(connection, status: status, contentType: "text/plain", body: Data("\(message)\n".utf8))
      case .complete(let request):
        self.dispatch(connection, request)
      }
    }
  }

  private func dispatch(_ connection: NWConnection, _ request: ParsedRequest) {
    nextId += 1
    let id = String(nextId)
    pending[id] = connection
    queue.asyncAfter(deadline: .now() + responseTimeout) { [weak self] in
      guard let self, let connection = self.pending.removeValue(forKey: id) else { return }
      self.send(connection, status: 504, contentType: "text/plain", body: Data("No response\n".utf8))
    }
    onRequest([
      "id": id,
      "method": request.method,
      "path": request.path,
      "headers": request.headers,
      "body": String(decoding: request.body, as: UTF8.self),
    ])
  }

  private func send(_ connection: NWConnection, status: Int, contentType: String, body: Data) {
    var head = "HTTP/1.1 \(status) \(reasonPhrase(status))\r\n"
    head += "Content-Length: \(body.count)\r\n"
    if !body.isEmpty {
      head += "Content-Type: \(contentType)\r\n"
    }
    if status == 405 {
      head += "Allow: POST\r\n"
    }
    head += "Cache-Control: no-store\r\nConnection: close\r\n\r\n"
    var data = Data(head.utf8)
    data.append(body)
    connection.send(content: data, completion: .contentProcessed { _ in connection.cancel() })
  }
}

// MARK: - Request parsing

private struct ParsedRequest {
  let method: String
  let path: String
  /** Header names lower-cased; a repeated header keeps its last value. */
  let headers: [String: String]
  let body: Data
}

private enum ParseResult {
  case incomplete(expectContinue: Bool)
  case invalid(status: Int, message: String)
  case complete(ParsedRequest)
}

private func parseRequest(_ buffer: Data) -> ParseResult {
  guard let headerEnd = buffer.range(of: Data("\r\n\r\n".utf8)) else {
    return .incomplete(expectContinue: false)
  }
  let head = String(decoding: buffer[buffer.startIndex..<headerEnd.lowerBound], as: UTF8.self)
  var lines = head.components(separatedBy: "\r\n")
  let requestLine = lines.removeFirst().split(separator: " ")
  guard requestLine.count == 3, requestLine[2].hasPrefix("HTTP/1.") else {
    return .invalid(status: 400, message: "Bad request line")
  }
  var headers: [String: String] = [:]
  for line in lines {
    guard let colon = line.firstIndex(of: ":") else { continue }
    let name = line[line.startIndex..<colon].trimmingCharacters(in: .whitespaces).lowercased()
    let value = line[line.index(after: colon)...].trimmingCharacters(in: .whitespaces)
    headers[name] = value
  }
  if headers["transfer-encoding"] != nil {
    return .invalid(status: 501, message: "Chunked request bodies are not supported")
  }
  let length = Int(headers["content-length"] ?? "0") ?? -1
  if length < 0 {
    return .invalid(status: 400, message: "Bad Content-Length")
  }
  if length > maxRequestBytes {
    return .invalid(status: 413, message: "Request too large")
  }
  let bodyStart = headerEnd.upperBound
  if buffer.endIndex - bodyStart < length {
    let expect = headers["expect"]?.lowercased() == "100-continue" && buffer.endIndex == bodyStart
    return .incomplete(expectContinue: expect)
  }
  return .complete(
    ParsedRequest(
      method: String(requestLine[0]),
      path: String(requestLine[1]),
      headers: headers,
      body: buffer[bodyStart..<(bodyStart + length)]))
}

private func reasonPhrase(_ status: Int) -> String {
  switch status {
  case 200: return "OK"
  case 202: return "Accepted"
  case 204: return "No Content"
  case 400: return "Bad Request"
  case 403: return "Forbidden"
  case 404: return "Not Found"
  case 405: return "Method Not Allowed"
  case 406: return "Not Acceptable"
  case 413: return "Payload Too Large"
  case 415: return "Unsupported Media Type"
  case 500: return "Internal Server Error"
  case 501: return "Not Implemented"
  case 504: return "Gateway Timeout"
  default: return "Status"
  }
}

// MARK: - Addresses

private func interfaceAddresses() -> [[String: String]] {
  var result: [[String: String]] = []
  var first: UnsafeMutablePointer<ifaddrs>?
  guard getifaddrs(&first) == 0, let head = first else { return result }
  defer { freeifaddrs(head) }
  var cursor: UnsafeMutablePointer<ifaddrs>? = head
  while let entry = cursor {
    defer { cursor = entry.pointee.ifa_next }
    let flags = Int32(entry.pointee.ifa_flags)
    guard let address = entry.pointee.ifa_addr,
      address.pointee.sa_family == UInt8(AF_INET),
      flags & IFF_UP != 0, flags & IFF_RUNNING != 0, flags & IFF_LOOPBACK == 0
    else { continue }
    var host = [CChar](repeating: 0, count: Int(NI_MAXHOST))
    let status = getnameinfo(
      address, socklen_t(address.pointee.sa_len), &host, socklen_t(host.count), nil, 0, NI_NUMERICHOST)
    if status == 0 {
      result.append(["name": String(cString: entry.pointee.ifa_name), "address": String(cString: host)])
    }
  }
  return result
}
