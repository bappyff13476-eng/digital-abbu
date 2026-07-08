package com.disciplinev8.services

import android.content.Intent
import android.net.VpnService
import android.os.Build
import android.os.ParcelFileDescriptor
import android.util.Log
import com.disciplinev8.modules.CooldownManager
import java.io.FileInputStream
import java.io.FileOutputStream
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetAddress
import java.nio.ByteBuffer

/**
 * DnsVpnService — Local-only VPN intercepting port 53 (DNS) traffic.
 *
 * Uses a memory-optimized HashSet<String> for O(1) domain lookup.
 * Blocked queries receive a 0.0.0.0 A record response.
 * Allowed queries are forwarded to upstream DNS (8.8.8.8).
 *
 * This is the identical technique used by AdGuard, Blokada, NextDNS, and DNS66.
 * Traffic never leaves the device — it is filtered entirely on-device.
 */
class DnsVpnService : VpnService() {

    companion object {
        private const val TAG = "DnsVpnService"
        private const val VPN_ADDRESS = "10.0.0.2"
        private const val VPN_ROUTE = "0.0.0.0"
        private const val DNS_SERVER = "8.8.8.8"
        private const val MTU = 1500
        private const val DNS_PORT = 53

        @Volatile
        var isRunning: Boolean = false
            private set

        /**
         * Stop the VPN service. During active cooldown, the stop request is ignored.
         */
        fun stopVpn(context: android.content.Context) {
            CooldownManager.init(context)
            if (CooldownManager.isCooldownActive() && !CooldownManager.isAdminOverrideActive()) {
                Log.w(TAG, "Stop request ignored — cooldown active")
                return
            }
            val intent = Intent(context, DnsVpnService::class.java).apply {
                action = "STOP"
            }
            context.startService(intent)
        }
    }

    private var vpnInterface: ParcelFileDescriptor? = null
    private var blockedDomains: HashSet<String> = HashSet(4096)
    private var workerThread: Thread? = null
    @Volatile
    private var shouldRun = true

    override fun onCreate() {
        super.onCreate()
        CooldownManager.init(this)
        loadBlockedDomains()
        Log.i(TAG, "DnsVpnService created — ${blockedDomains.size} domains loaded")
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == "STOP") {
            shouldRun = false
            workerThread?.interrupt()
            vpnInterface?.close()
            vpnInterface = null
            isRunning = false
            stopSelf()
            return START_NOT_STICKY
        }

        if (isRunning) return START_STICKY

        establishVpn()
        return START_STICKY // Auto-restart if killed
    }

    override fun onRevoke() {
        Log.w(TAG, "VPN revoked by system")

        // During cooldown, attempt to re-establish
        if (CooldownManager.isCooldownActive()) {
            Log.w(TAG, "Cooldown active — attempting VPN re-establishment")
            try {
                establishVpn()
                return
            } catch (e: Exception) {
                Log.e(TAG, "Failed to re-establish VPN after revocation", e)
            }
        }

        shouldRun = false
        vpnInterface?.close()
        vpnInterface = null
        isRunning = false
        stopSelf()
    }

    override fun onDestroy() {
        shouldRun = false
        workerThread?.interrupt()
        vpnInterface?.close()
        vpnInterface = null
        isRunning = false

        // If cooldown is active, request restart
        if (CooldownManager.isCooldownActive()) {
            Log.w(TAG, "Cooldown active — requesting DNS VPN restart")
            val restartIntent = Intent(this, DnsVpnService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(restartIntent)
            } else {
                startService(restartIntent)
            }
        }

        super.onDestroy()
    }

    // ─── VPN Establishment ──────────────────────────────────────────

    private fun establishVpn() {
        try {
            vpnInterface = Builder()
                .setSession("DisciplineVPN")
                .addAddress(VPN_ADDRESS, 32)
                .addRoute(VPN_ROUTE, 0)
                .addDnsServer(DNS_SERVER)
                .setMtu(MTU)
                .setBlocking(true)
                .establish()

            if (vpnInterface == null) {
                Log.e(TAG, "Failed to establish VPN interface — user may not have granted permission")
                return
            }

            isRunning = true
            shouldRun = true

            // Start packet processing thread
            workerThread = Thread(::processPackets, "DnsVpnWorker").apply {
                isDaemon = true
                start()
            }

            Log.i(TAG, "VPN established — DNS filtering active")

        } catch (e: Exception) {
            Log.e(TAG, "Failed to establish VPN", e)
            isRunning = false
        }
    }

    // ─── Packet Processing ──────────────────────────────────────────

    private fun processPackets() {
        val tunFd = vpnInterface ?: return
        val inputStream = FileInputStream(tunFd.fileDescriptor)
        val outputStream = FileOutputStream(tunFd.fileDescriptor)
        val buffer = ByteArray(MTU)

        Log.i(TAG, "Packet processing thread started")

        while (shouldRun && !Thread.currentThread().isInterrupted) {
            try {
                val length = inputStream.read(buffer)
                if (length <= 0) continue

                // Parse IP header
                val ipVersion = (buffer[0].toInt() shr 4) and 0x0F
                if (ipVersion != 4) continue // Only handle IPv4

                val ipHeaderLength = (buffer[0].toInt() and 0x0F) * 4
                if (length < ipHeaderLength + 8) continue

                // Check protocol (UDP = 17)
                val protocol = buffer[9].toInt() and 0xFF
                if (protocol != 17) continue // Only handle UDP

                // Parse UDP header
                val udpOffset = ipHeaderLength
                val destPort = ((buffer[udpOffset + 2].toInt() and 0xFF) shl 8) or
                        (buffer[udpOffset + 3].toInt() and 0xFF)

                if (destPort != DNS_PORT) continue // Only handle DNS

                // Extract DNS payload
                val dnsOffset = udpOffset + 8
                val dnsLength = length - dnsOffset
                if (dnsLength < 12) continue

                val dnsPayload = buffer.copyOfRange(dnsOffset, length)

                // Parse domain name from DNS query
                val queryDomain = parseDnsQueryDomain(dnsPayload)
                if (queryDomain.isNullOrEmpty()) continue

                // Check if domain (or any parent domain) is blocked
                if (isDomainBlocked(queryDomain)) {
                    Log.d(TAG, "BLOCKED DNS: $queryDomain")

                    // Craft a response with 0.0.0.0
                    val response = craftBlockedDnsResponse(dnsPayload)
                    if (response != null) {
                        // Build the response IP/UDP packet
                        val responsePacket = buildResponsePacket(buffer, ipHeaderLength, response)
                        if (responsePacket != null) {
                            outputStream.write(responsePacket)
                            outputStream.flush()
                        }
                    }
                } else {
                    // Forward to upstream DNS
                    val upstreamResponse = forwardDnsQuery(dnsPayload)
                    if (upstreamResponse != null) {
                        val responsePacket = buildResponsePacket(buffer, ipHeaderLength, upstreamResponse)
                        if (responsePacket != null) {
                            outputStream.write(responsePacket)
                            outputStream.flush()
                        }
                    }
                }

            } catch (e: InterruptedException) {
                break
            } catch (e: Exception) {
                if (shouldRun) {
                    Log.e(TAG, "Error processing packet", e)
                }
            }
        }

        Log.i(TAG, "Packet processing thread stopped")
    }

    // ─── DNS Parsing ────────────────────────────────────────────────

    /**
     * Parse the QNAME from a DNS query payload.
     * DNS names are encoded as length-prefixed labels starting at offset 12.
     * Example: [3]www[6]google[3]com[0] -> "www.google.com"
     */
    private fun parseDnsQueryDomain(dnsPayload: ByteArray): String? {
        if (dnsPayload.size < 13) return null

        val sb = StringBuilder()
        var offset = 12 // Skip DNS header (12 bytes)

        while (offset < dnsPayload.size) {
            val labelLength = dnsPayload[offset].toInt() and 0xFF

            if (labelLength == 0) break // End of domain name
            if (labelLength > 63) return null // Compression pointer or invalid

            offset++
            if (offset + labelLength > dnsPayload.size) return null

            if (sb.isNotEmpty()) sb.append('.')

            for (i in 0 until labelLength) {
                sb.append(dnsPayload[offset + i].toInt().toChar())
            }

            offset += labelLength
        }

        return sb.toString().lowercase()
    }

    /**
     * Check if a domain or any of its parent domains are in the blocked set.
     * e.g., for "cdn.tiktok.com", checks: "cdn.tiktok.com", "tiktok.com", "com"
     */
    private fun isDomainBlocked(domain: String): Boolean {
        var current = domain
        while (current.contains('.')) {
            if (current in blockedDomains) return true
            current = current.substringAfter('.')
        }
        return current in blockedDomains
    }

    /**
     * Craft a DNS response with A record pointing to 0.0.0.0
     */
    private fun craftBlockedDnsResponse(query: ByteArray): ByteArray? {
        if (query.size < 12) return null

        val response = ByteBuffer.allocate(query.size + 16)

        // Copy transaction ID (2 bytes)
        response.put(query[0])
        response.put(query[1])

        // Flags: QR=1, OPCODE=0, AA=1, TC=0, RD=1, RA=1, RCODE=0
        response.put(0x85.toByte()) // 1000 0101
        response.put(0x80.toByte()) // 1000 0000

        // QDCOUNT = 1
        response.put(0x00.toByte())
        response.put(0x01.toByte())

        // ANCOUNT = 1
        response.put(0x00.toByte())
        response.put(0x01.toByte())

        // NSCOUNT = 0
        response.put(0x00.toByte())
        response.put(0x00.toByte())

        // ARCOUNT = 0
        response.put(0x00.toByte())
        response.put(0x00.toByte())

        // Copy question section from query
        var qOffset = 12
        while (qOffset < query.size) {
            val labelLen = query[qOffset].toInt() and 0xFF
            response.put(query[qOffset])
            qOffset++
            if (labelLen == 0) break
            for (i in 0 until labelLen) {
                if (qOffset < query.size) {
                    response.put(query[qOffset])
                    qOffset++
                }
            }
        }

        // QTYPE (2 bytes) + QCLASS (2 bytes)
        if (qOffset + 4 <= query.size) {
            response.put(query, qOffset, 4)
            qOffset += 4
        } else {
            return null
        }

        // ── Answer section ──
        // Name pointer to offset 12 (the question name)
        response.put(0xC0.toByte())
        response.put(0x0C.toByte())

        // TYPE = A (1)
        response.put(0x00.toByte())
        response.put(0x01.toByte())

        // CLASS = IN (1)
        response.put(0x00.toByte())
        response.put(0x01.toByte())

        // TTL = 300 seconds
        response.put(0x00.toByte())
        response.put(0x00.toByte())
        response.put(0x01.toByte())
        response.put(0x2C.toByte())

        // RDLENGTH = 4 (IPv4 address)
        response.put(0x00.toByte())
        response.put(0x04.toByte())

        // RDATA = 0.0.0.0
        response.put(0x00.toByte())
        response.put(0x00.toByte())
        response.put(0x00.toByte())
        response.put(0x00.toByte())

        response.flip()
        val result = ByteArray(response.remaining())
        response.get(result)
        return result
    }

    /**
     * Forward a DNS query to the upstream resolver (8.8.8.8).
     * Uses a protected DatagramSocket so the traffic doesn't loop through the VPN.
     */
    private fun forwardDnsQuery(dnsPayload: ByteArray): ByteArray? {
        var socket: DatagramSocket? = null
        try {
            socket = DatagramSocket().also { protect(it) }
            socket.soTimeout = 5000 // 5 second timeout

            val serverAddress = InetAddress.getByName(DNS_SERVER)
            val requestPacket = DatagramPacket(dnsPayload, dnsPayload.size, serverAddress, DNS_PORT)
            socket.send(requestPacket)

            val responseBuffer = ByteArray(1024)
            val responsePacket = DatagramPacket(responseBuffer, responseBuffer.size)
            socket.receive(responsePacket)

            return responseBuffer.copyOf(responsePacket.length)

        } catch (e: Exception) {
            Log.e(TAG, "DNS forward failed", e)
            return null
        } finally {
            socket?.close()
        }
    }

    /**
     * Build a complete IP/UDP response packet from a DNS response payload.
     * Swaps source/destination IPs and ports from the original request.
     */
    private fun buildResponsePacket(
        originalPacket: ByteArray,
        ipHeaderLength: Int,
        dnsResponse: ByteArray
    ): ByteArray? {
        try {
            val udpLength = 8 + dnsResponse.size
            val totalLength = ipHeaderLength + udpLength
            val packet = ByteArray(totalLength)

            // Copy IP header from original
            System.arraycopy(originalPacket, 0, packet, 0, ipHeaderLength)

            // Swap source and destination IP addresses
            // Source IP is at offset 12-15, Dest IP at 16-19
            for (i in 0..3) {
                val tmp = packet[12 + i]
                packet[12 + i] = packet[16 + i]
                packet[16 + i] = tmp
            }

            // Update total length in IP header
            packet[2] = ((totalLength shr 8) and 0xFF).toByte()
            packet[3] = (totalLength and 0xFF).toByte()

            // Clear IP checksum (offset 10-11) and recalculate
            packet[10] = 0
            packet[11] = 0
            val ipChecksum = calculateChecksum(packet, 0, ipHeaderLength)
            packet[10] = ((ipChecksum shr 8) and 0xFF).toByte()
            packet[11] = (ipChecksum and 0xFF).toByte()

            // UDP header
            val udpOffset = ipHeaderLength

            // Swap source and destination ports
            val srcPort0 = originalPacket[udpOffset]
            val srcPort1 = originalPacket[udpOffset + 1]
            packet[udpOffset] = originalPacket[udpOffset + 2]
            packet[udpOffset + 1] = originalPacket[udpOffset + 3]
            packet[udpOffset + 2] = srcPort0
            packet[udpOffset + 3] = srcPort1

            // UDP length
            packet[udpOffset + 4] = ((udpLength shr 8) and 0xFF).toByte()
            packet[udpOffset + 5] = (udpLength and 0xFF).toByte()

            // UDP checksum = 0 (optional for IPv4)
            packet[udpOffset + 6] = 0
            packet[udpOffset + 7] = 0

            // Copy DNS response payload
            System.arraycopy(dnsResponse, 0, packet, udpOffset + 8, dnsResponse.size)

            return packet

        } catch (e: Exception) {
            Log.e(TAG, "Failed to build response packet", e)
            return null
        }
    }

    /**
     * Calculate IP header checksum (RFC 1071).
     */
    private fun calculateChecksum(buffer: ByteArray, offset: Int, length: Int): Int {
        var sum = 0L
        var i = offset
        var remaining = length

        while (remaining > 1) {
            sum += ((buffer[i].toInt() and 0xFF) shl 8) or (buffer[i + 1].toInt() and 0xFF)
            i += 2
            remaining -= 2
        }

        if (remaining == 1) {
            sum += (buffer[i].toInt() and 0xFF) shl 8
        }

        while (sum shr 16 != 0L) {
            sum = (sum and 0xFFFF) + (sum shr 16)
        }

        return (sum.toInt().inv()) and 0xFFFF
    }

    // ─── Hosts List Loading ─────────────────────────────────────────

    private fun loadBlockedDomains() {
        try {
            val inputStream = assets.open("blocked_hosts.txt")
            inputStream.bufferedReader().useLines { lines ->
                lines.forEach { line ->
                    val trimmed = line.trim().lowercase()
                    if (trimmed.isNotEmpty() && !trimmed.startsWith("#")) {
                        // Handle "0.0.0.0 domain" or "127.0.0.1 domain" or plain "domain" formats
                        val domain = if (trimmed.contains(" ") || trimmed.contains("\t")) {
                            trimmed.split(Regex("\\s+")).lastOrNull() ?: ""
                        } else {
                            trimmed
                        }
                        if (domain.isNotEmpty() && domain.contains(".")) {
                            blockedDomains.add(domain)
                        }
                    }
                }
            }
            Log.i(TAG, "Loaded ${blockedDomains.size} blocked domains")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to load blocked domains", e)
            // Fallback: hardcode essential social media domains
            blockedDomains.addAll(listOf(
                "tiktok.com", "www.tiktok.com", "m.tiktok.com", "api.tiktok.com",
                "instagram.com", "www.instagram.com", "api.instagram.com",
                "facebook.com", "www.facebook.com", "m.facebook.com", "graph.facebook.com",
                "snapchat.com", "www.snapchat.com", "app.snapchat.com"
            ))
        }
    }
}
