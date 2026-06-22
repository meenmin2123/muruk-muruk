package com.muruk.service

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ObjectNode
import com.muruk.config.MurukProperties
import org.slf4j.LoggerFactory
import org.springframework.scheduling.annotation.Async
import org.springframework.stereotype.Service
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse

/**
 * Postgres가 주 저장소, 노션은 백업(보기용). 상태 저장 시 비동기로 노션에 밀어준다(best-effort).
 *
 * 두 가지 모드:
 *  1) 직접 연결 — NOTION_TOKEN + NOTION_DATABASE_ID 설정 시 Notion API를 직접 호출.
 *     데이터베이스에 사용자별 페이지 1개를 두고(없으면 생성, 있으면 갱신) 상태를 기록.
 *     필요한 DB 속성: Name(title), UserId(rich_text), UpdatedAt(date),
 *                     Streak(number), Stickers(number), Data(rich_text)
 *  2) 중계 서버 — NOTION_RELAY_URL 만 설정 시 해당 서버로 그대로 전달.
 *  둘 다 없으면 아무 것도 하지 않음.
 */
@Service
class NotionBackupService(
    private val props: MurukProperties,
    private val mapper: ObjectMapper,
) {

    private val log = LoggerFactory.getLogger(javaClass)
    private val http = HttpClient.newHttpClient()
    private val notionVersion = "2022-06-28"

    @Async
    fun backup(userId: String, stateJson: String) {
        when {
            props.notionToken.isNotBlank() && props.notionDatabaseId.isNotBlank() ->
                runCatching { backupDirect(userId, stateJson) }
                    .onFailure { log.warn("노션 직접 백업 실패(user={}): {}", userId, it.message) }
            props.notionRelayUrl.isNotBlank() ->
                runCatching { backupViaRelay(userId, stateJson) }
                    .onFailure { log.warn("노션 중계 백업 실패(user={}): {}", userId, it.message) }
            else -> { /* 비활성 */ }
        }
    }

    private fun backupViaRelay(userId: String, stateJson: String) {
        val base = props.notionRelayUrl.trimEnd('/')
        val req = HttpRequest.newBuilder(URI.create("$base/push"))
            .header("Content-Type", "application/json")
            .header("X-Muruk-User", userId)
            .POST(HttpRequest.BodyPublishers.ofString(stateJson))
            .build()
        http.send(req, HttpResponse.BodyHandlers.discarding())
    }

    // ---- 직접 연결 ----

    private fun backupDirect(userId: String, stateJson: String) {
        val state = runCatching { mapper.readTree(stateJson) }.getOrNull()
        val streak = state?.get("bestStreak")?.asInt(0) ?: 0
        val stickers = countStickers(state)
        val pageId = findPage(userId)
        val props = buildProperties(userId, streak, stickers)
        val children = dataBlocks(stateJson)
        if (pageId == null) createPage(props, children) else updatePage(pageId, props, children)
    }

    private fun findPage(userId: String): String? {
        val body = mapper.createObjectNode()
        val filter = body.putObject("filter")
        filter.put("property", "UserId")
        filter.putObject("rich_text").put("equals", userId)
        body.put("page_size", 1)
        val res = notion("POST", "/v1/databases/${props.notionDatabaseId}/query", body.toString())
        val tree = mapper.readTree(res)
        return tree.path("results").firstOrNull()?.path("id")?.asText(null)
    }

    private fun buildProperties(userId: String, streak: Int, stickers: Int): ObjectNode {
        val p = mapper.createObjectNode()
        titleProp(p, "Name", "무럽무럽 백업 · $userId")
        richTextProp(p, "UserId", userId)
        p.putObject("UpdatedAt").putObject("date").put("start", java.time.OffsetDateTime.now().toString())
        p.putObject("Streak").put("number", streak)
        p.putObject("Stickers").put("number", stickers)
        return p
    }

    private fun titleProp(parent: ObjectNode, name: String, value: String) {
        val arr = parent.putObject(name).putArray("title")
        arr.addObject().putObject("text").put("content", value.take(2000))
    }

    private fun richTextProp(parent: ObjectNode, name: String, value: String) {
        val arr = parent.putObject(name).putArray("rich_text")
        arr.addObject().putObject("text").put("content", value.take(2000))
    }

    /** 상태 JSON 전문을 코드 블록 children 으로(2000자 단위로 쪼갬). */
    private fun dataBlocks(json: String): com.fasterxml.jackson.databind.node.ArrayNode {
        val blocks = mapper.createArrayNode()
        json.chunked(1900).take(20).forEach { chunk ->
            val block = blocks.addObject()
            block.put("object", "block").put("type", "code")
            val code = block.putObject("code")
            code.put("language", "json")
            code.putArray("rich_text").addObject().putObject("text").put("content", chunk)
        }
        return blocks
    }

    private fun createPage(properties: ObjectNode, children: com.fasterxml.jackson.databind.node.ArrayNode) {
        val body = mapper.createObjectNode()
        body.putObject("parent").put("database_id", props.notionDatabaseId)
        body.set<ObjectNode>("properties", properties)
        body.set<com.fasterxml.jackson.databind.node.ArrayNode>("children", children)
        notion("POST", "/v1/pages", body.toString())
    }

    private fun updatePage(pageId: String, properties: ObjectNode, children: com.fasterxml.jackson.databind.node.ArrayNode) {
        val body = mapper.createObjectNode()
        body.set<ObjectNode>("properties", properties)
        notion("PATCH", "/v1/pages/$pageId", body.toString())
        // 기존 블록 정리 후 최신 데이터 블록 교체
        replaceChildren(pageId, children)
    }

    private fun replaceChildren(pageId: String, children: com.fasterxml.jackson.databind.node.ArrayNode) {
        val existing = mapper.readTree(notion("GET", "/v1/blocks/$pageId/children?page_size=50", null))
        existing.path("results").forEach { blk ->
            blk.path("id").asText(null)?.let { runCatching { notion("DELETE", "/v1/blocks/$it", null) } }
        }
        val body = mapper.createObjectNode()
        body.set<com.fasterxml.jackson.databind.node.ArrayNode>("children", children)
        notion("PATCH", "/v1/blocks/$pageId/children", body.toString())
    }

    private fun countStickers(state: com.fasterxml.jackson.databind.JsonNode?): Int {
        var n = 0
        state?.path("dreams")?.forEach { d -> d.path("goals").forEach { g -> n += g.path("earned").asInt(0) } }
        return n
    }

    private fun notion(method: String, path: String, body: String?): String {
        val builder = HttpRequest.newBuilder(URI.create("https://api.notion.com$path"))
            .header("Authorization", "Bearer ${props.notionToken}")
            .header("Notion-Version", notionVersion)
            .header("Content-Type", "application/json")
        when (method) {
            "GET" -> builder.GET()
            "DELETE" -> builder.DELETE()
            "PATCH" -> builder.method("PATCH", HttpRequest.BodyPublishers.ofString(body ?: "{}"))
            else -> builder.POST(HttpRequest.BodyPublishers.ofString(body ?: "{}"))
        }
        val res = http.send(builder.build(), HttpResponse.BodyHandlers.ofString())
        if (res.statusCode() >= 300) {
            throw IllegalStateException("Notion $method $path -> ${res.statusCode()}: ${res.body().take(300)}")
        }
        return res.body()
    }
}
