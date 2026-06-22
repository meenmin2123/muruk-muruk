package com.muruk.service

import com.muruk.config.MurukProperties
import org.slf4j.LoggerFactory
import org.springframework.scheduling.annotation.Async
import org.springframework.stereotype.Service
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse

/**
 * Postgres가 주 저장소, 노션은 백업(보기용). 상태 저장 시 비동기로 노션 중계 서버에 밀어준다.
 * NOTION_RELAY_URL 미설정 시 아무 것도 하지 않음. (1차 골격: best-effort)
 */
@Service
class NotionBackupService(private val props: MurukProperties) {

    private val log = LoggerFactory.getLogger(javaClass)
    private val http = HttpClient.newHttpClient()

    @Async
    fun backup(userId: String, stateJson: String) {
        val base = props.notionRelayUrl.trimEnd('/')
        if (base.isBlank()) return
        runCatching {
            val req = HttpRequest.newBuilder(URI.create("$base/push"))
                .header("Content-Type", "application/json")
                .header("X-Muruk-User", userId)
                .POST(HttpRequest.BodyPublishers.ofString(stateJson))
                .build()
            http.send(req, HttpResponse.BodyHandlers.discarding())
        }.onFailure { log.warn("노션 백업 실패(user={}): {}", userId, it.message) }
    }
}
